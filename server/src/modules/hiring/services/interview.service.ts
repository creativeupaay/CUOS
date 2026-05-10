import AppError from '../../../utils/appError';
import { Application } from '../models/Application.model';
import { Assignment } from '../models/Assignment.model';
import { AssignmentSubmission } from '../models/AssignmentSubmission.model';
import { Interview, IInterview, InterviewStatus } from '../models/Interview.model';
import { InterviewNote, IInterviewNote } from '../models/InterviewNote.model';
import { Job } from '../models/Job.model';
import type {
    ListInterviewsInput,
    RequestInterviewRescheduleInput,
    SaveInterviewNoteInput,
} from '../validators/interview.validator';
import {
    sendInterviewInviteEmail,
    sendInterviewRescheduleEmail,
} from '../../../services/email.service';
import { logApplicationActivity } from './activity.service';
import { calcomService } from './calcom.service';
import { buildInterviewSchedulingSyncHash } from './scheduling-hash.util';
import { logger } from "../../../utils/logger";
import {
    hydrateMeetingLinkFromCalcom,
} from './interview-url.util';
import {
    WebhookDebugEvent,
    webhookDebugEvents,
} from './interview-webhook.util';
import {
    clearInterviewReminderTimer,
} from './interview-reminder.service';

export class InterviewService {
    getWebhookDebug(limit = 20): WebhookDebugEvent[] {
        const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
        return webhookDebugEvents.slice(0, safeLimit);
    }

    async sendInterviewInvite(applicationId: string, actorId?: string): Promise<string> {
        const application = await Application.findById(applicationId).populate(
            'jobId',
            'title interviewScheduling'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        const job =
            application.jobId && typeof application.jobId === 'object'
                ? (application.jobId as any)
                : null;

        if (!job) {
            throw new AppError('Job details are missing on this application', 422);
        }

        let scheduling = job.interviewScheduling;
        const hasJobScheduling = Boolean(scheduling?.enabled);
        const schedulingHash = hasJobScheduling
            ? buildInterviewSchedulingSyncHash(scheduling as any)
            : '';
        const syncedHash = String((scheduling as any)?.syncConfigHash || '').trim();
        const hasSchedulingDrift = Boolean(schedulingHash && syncedHash && schedulingHash !== syncedHash);
        if (
            hasJobScheduling &&
            (!scheduling?.active ||
                scheduling?.syncStatus !== 'synced' ||
                !scheduling?.scheduleId ||
                !scheduling?.eventTypeId ||
                !scheduling?.bookingUrl ||
                hasSchedulingDrift)
        ) {
            const jobDoc = await Job.findById(String(job._id));

            if (!jobDoc?.interviewScheduling?.enabled) {
                throw new AppError(
                    'Interview scheduling is not enabled for this job',
                    422
                );
            }

            jobDoc.interviewScheduling.syncStatus = 'pending';
            jobDoc.interviewScheduling.syncError = undefined;
            await jobDoc.save();

            try {
                const synced = await calcomService.syncJobEventType({
                    jobId: String(jobDoc._id),
                    jobTitle: jobDoc.title,
                    jobDepartment: jobDoc.department,
                    scheduling: jobDoc.interviewScheduling as any,
                });

                jobDoc.interviewScheduling.scheduleId = synced.scheduleId;
                jobDoc.interviewScheduling.eventTypeId = synced.eventTypeId;
                jobDoc.interviewScheduling.eventTypeSlug = synced.eventTypeSlug;
                jobDoc.interviewScheduling.bookingUrl = synced.bookingUrl;
                jobDoc.interviewScheduling.externalUpdatedAt = synced.externalUpdatedAt;
                jobDoc.interviewScheduling.lastSyncedAt = new Date();
                jobDoc.interviewScheduling.syncStatus = 'synced';
                jobDoc.interviewScheduling.syncConfigHash = buildInterviewSchedulingSyncHash(
                    jobDoc.interviewScheduling as any
                );
                jobDoc.interviewScheduling.syncError = undefined;
                jobDoc.interviewScheduling.active = true;
                await jobDoc.save();

                scheduling = jobDoc.interviewScheduling;
            } catch (error: any) {
                jobDoc.interviewScheduling.syncStatus = 'failed';
                jobDoc.interviewScheduling.syncError =
                    error?.message || 'Failed to sync interview scheduling with Cal.com';
                jobDoc.interviewScheduling.active = false;
                await jobDoc.save();

                throw new AppError(
                    `Interview scheduling sync failed for this job: ${jobDoc.interviewScheduling.syncError}`,
                    422
                );
            }
        }

        const bookingUrl = calcomService.buildCandidateBookingUrl({
            applicationId,
            jobId: String(job._id),
            candidateName: application.name,
            candidateEmail: application.email,
            scheduling,
        });

        const jobTitle =
            application.jobId && typeof application.jobId === 'object'
                ? String((application.jobId as any).title || 'the role')
                : 'the role';

        sendInterviewInviteEmail({
            to: application.email,
            candidateName: application.name,
            jobTitle,
            bookingUrl,
        }).catch((err) => {
            logger.error({ context: err }, 'Failed to send interview invite email asynchronously:');
        });

        await Application.findByIdAndUpdate(applicationId, { status: 'interview' });

        await logApplicationActivity({
            applicationId: application._id,
            type: 'interview.invite_sent',
            title: 'Interview Invite Sent',
            description: 'Interview invite email was sent with booking link.',
            actorType: actorId ? 'user' : 'system',
            actorId,
            metadata: {
                bookingUrl,
                jobId: String(job._id),
                eventTypeId: scheduling?.eventTypeId,
            },
        });
        return bookingUrl;
    }

    async requestInterviewReschedule(
        interviewId: string,
        data: RequestInterviewRescheduleInput,
        actorId?: string
    ): Promise<{ interview: IInterview; bookingUrl: string }> {
        const interview = await Interview.findById(interviewId).populate({
            path: 'applicationId',
            select: 'name email status jobId',
            populate: {
                path: 'jobId',
                select: 'title interviewScheduling',
            },
        });

        if (!interview) {
            throw new AppError('Interview not found', 404);
        }

        const application =
            interview.applicationId && typeof interview.applicationId === 'object'
                ? (interview.applicationId as any)
                : null;

        if (!application?._id) {
            throw new AppError('Application details are missing for this interview', 422);
        }

        const job =
            application.jobId && typeof application.jobId === 'object'
                ? (application.jobId as any)
                : null;

        if (!job?._id) {
            throw new AppError('Job details are missing on this interview application', 422);
        }

        const preferredTime = new Date(data.preferredTime);
        if (Number.isNaN(preferredTime.getTime())) {
            throw new AppError('Preferred time is invalid', 400);
        }

        if (interview.calcomBookingUid) {
            try {
                await calcomService.cancelBooking(
                    String(interview.calcomBookingUid),
                    'Interview rescheduled by the hiring team'
                );
            } catch (error: any) {
                logger.error({ context: error }, 'Failed to cancel previous Cal.com interview booking:');
                throw new AppError(
                    error?.message || 'Could not cancel the previously scheduled interview booking',
                    422
                );
            }
        }

        const bookingUrl = calcomService.buildCandidateBookingUrl({
            applicationId: String(application._id),
            jobId: String(job._id),
            candidateName: application.name,
            candidateEmail: application.email,
            scheduling: job.interviewScheduling,
        });

        await sendInterviewRescheduleEmail({
            to: application.email,
            candidateName: application.name,
            jobTitle: String(job.title || 'the role'),
            bookingUrl,
            preferredTime,
        });

        clearInterviewReminderTimer(String(interview._id));

        const updatedInterview = await Interview.findByIdAndUpdate(
            interviewId,
            {
                status: 'cancelled',
                awaitingReschedule: true,
                rescheduleRequestedAt: new Date(),
                calcomBookingId: undefined,
                calcomBookingUid: undefined,
                reminderScheduledFor: undefined,
                reminderTargetScheduledTime: undefined,
                reminderSentAt: undefined,
                reminderOffsetsSent: [],
            },
            { new: true, runValidators: true }
        ).populate({
            path: 'applicationId',
            select: 'name email status jobId',
            populate: {
                path: 'jobId',
                select: 'title department',
            },
        });

        await Application.findByIdAndUpdate(String(application._id), {
            status: 'interview',
        });

        await logApplicationActivity({
            applicationId: application._id,
            type: 'interview.reschedule_requested',
            title: 'Interview Reschedule Requested',
            description: 'Previous interview booking was cancelled and a reschedule link was sent.',
            actorType: actorId ? 'user' : 'system',
            actorId,
            metadata: {
                interviewId,
                previousBookingUid: interview.calcomBookingUid,
                bookingUrl,
                preferredTime: preferredTime.toISOString(),
            },
        });

        return {
            interview: updatedInterview as IInterview,
            bookingUrl,
        };
    }



    async listInterviews(
        filters: ListInterviewsInput,
        managerUserId?: string
    ): Promise<{
        interviews: IInterview[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { applicationId, status, search, from, to, page = 1, limit = 50 } = filters;

        const query: any = {};

        // If managerUserId is provided, filter to only interviews for jobs managed by this user
        if (managerUserId) {
            const { Employee } = await import('../../hrms/models/Employee.model');
            const { Job } = await import('../models/Job.model');
            const { Application } = await import('../models/Application.model');

            const employee = await Employee.findOne({ userId: managerUserId }).select('_id');
            if (!employee) {
                return { interviews: [], total: 0, page, totalPages: 0 };
            }

            const managedJobs = await Job.find({ managers: employee._id }).select('_id');
            const managedJobIds = managedJobs.map((job) => job._id);
            if (managedJobIds.length === 0) {
                return { interviews: [], total: 0, page, totalPages: 0 };
            }

            // Get applications for managed jobs
            const applications = await Application.find({ jobId: { $in: managedJobIds } }).select('_id');
            const applicationIds = applications.map((app) => app._id);
            if (applicationIds.length === 0) {
                return { interviews: [], total: 0, page, totalPages: 0 };
            }

            query.applicationId = { $in: applicationIds };
        }

        if (applicationId) {
            // If manager filter is already applied, ensure requested applicationId is in the allowed list
            if (query.applicationId && query.applicationId.$in) {
                const allowedIds = query.applicationId.$in.map((id: any) => id.toString());
                if (!allowedIds.includes(applicationId.toString())) {
                    return { interviews: [], total: 0, page, totalPages: 0 };
                }
            }
            query.applicationId = applicationId;
        }
        if (status) query.status = status;
        if (from || to) {
            query.scheduledTime = {};
            if (from) query.scheduledTime.$gte = new Date(from);
            if (to) query.scheduledTime.$lte = new Date(to);
        }

        let interviews = await Interview.find(query)
            .sort({ scheduledTime: 1 })
            .populate({
                path: 'applicationId',
                select: 'name email status jobId',
                populate: {
                    path: 'jobId',
                    select: 'title department',
                },
            });

        if (search) {
            const term = search.toLowerCase();
            interviews = interviews.filter((interview: any) => {
                const app = interview.applicationId;
                const job = app?.jobId;
                return (
                    String(app?.name || '')?.toLowerCase().includes(term) ||
                    String(app?.email || '')?.toLowerCase().includes(term) ||
                    String(job?.title || '')?.toLowerCase().includes(term)
                );
            });
        }

        const total = interviews.length;
        const skip = (page - 1) * limit;
        const paginated = interviews.slice(skip, skip + limit);

        return {
            interviews: paginated,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async updateInterviewStatus(
        id: string,
        status: InterviewStatus,
        actorId?: string
    ): Promise<IInterview> {
        const interview = await Interview.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        ).populate({
            path: 'applicationId',
            select: 'name email status jobId',
            populate: {
                path: 'jobId',
                select: 'title department',
            },
        });

        if (!interview) {
            throw new AppError('Interview not found', 404);
        }

        const appId = (interview.applicationId as any)?._id;
        if (appId) {
            await logApplicationActivity({
                applicationId: appId,
                type: 'interview.status_updated',
                title: 'Interview Status Updated',
                description: `Interview status changed to ${status}.`,
                actorType: actorId ? 'user' : 'system',
                actorId,
                metadata: {
                    interviewId: interview._id,
                    status,
                },
            });
        }

        return interview;
    }

    async getInterviewDetails(interviewId: string): Promise<{
        interview: IInterview;
        assignmentSubmission: any | null;
        note: IInterviewNote | null;
    }> {
        const interviewDoc = await Interview.findById(interviewId).populate({
            path: 'applicationId',
            select: 'name email phone resumeUrl status jobId portfolio linkedin github experience',
            populate: {
                path: 'jobId',
                select: 'title department location',
            },
        });

        if (!interviewDoc) {
            throw new AppError('Interview not found', 404);
        }

        const interview = await hydrateMeetingLinkFromCalcom(interviewDoc as IInterview);

        const application: any = interview.applicationId;

        let assignmentSubmission: any | null = null;
        if (application?.jobId?._id && application?._id) {
            const assignment = await Assignment.findOne({ jobId: application.jobId._id })
                .sort({ createdAt: -1 })
                .select('_id title submissionFields');

            if (assignment) {
                assignmentSubmission = await AssignmentSubmission.findOne({
                    assignmentId: assignment._id,
                    applicationId: application._id,
                })
                    .sort({ submittedAt: -1 })
                    .populate('assignmentId', 'title description instructions submissionFields');
            }
        }

        const note = await InterviewNote.findOne({ interviewId: interview._id }).populate(
            'createdBy',
            'name email'
        );

        return {
            interview,
            assignmentSubmission,
            note,
        };
    }

    async saveInterviewNote(
        interviewId: string,
        data: SaveInterviewNoteInput,
        createdBy: string
    ): Promise<IInterviewNote> {
        const interview = await Interview.findById(interviewId).select('_id applicationId');
        if (!interview) {
            throw new AppError('Interview not found', 404);
        }

        const note = await InterviewNote.findOneAndUpdate(
            { interviewId: interview._id },
            {
                interviewId: interview._id,
                applicationId: interview.applicationId,
                rating: data.rating,
                technicalScore: data.technicalScore,
                communicationScore: data.communicationScore,
                notes: data.notes,
                createdBy,
            },
            { upsert: true, new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        await logApplicationActivity({
            applicationId: interview.applicationId,
            type: 'interview.notes_saved',
            title: 'Interview Notes Saved',
            description: 'Interviewer evaluation notes were saved.',
            actorType: 'user',
            actorId: createdBy,
            metadata: {
                interviewId,
                rating: data.rating,
                technicalScore: data.technicalScore,
                communicationScore: data.communicationScore,
            },
        });

        return note;
    }
}
