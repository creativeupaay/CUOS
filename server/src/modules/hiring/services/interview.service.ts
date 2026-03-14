import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import type { IncomingHttpHeaders } from 'http';
import { Application } from '../models/Application.model';
import { Assignment } from '../models/Assignment.model';
import { AssignmentSubmission } from '../models/AssignmentSubmission.model';
import { Interview, IInterview, InterviewStatus } from '../models/Interview.model';
import { InterviewNote, IInterviewNote } from '../models/InterviewNote.model';
import type {
    ListInterviewsInput,
    SaveInterviewNoteInput,
} from '../validators/interview.validator';
import {
    sendInterviewInviteEmail,
} from '../../../services/email.service';

function getNested(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function pickFirst(obj: any, paths: string[]): any {
    for (const path of paths) {
        const value = getNested(obj, path);
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return undefined;
}

function parseCalcomStatus(payload: any): InterviewStatus {
    const raw = String(
        pickFirst(payload, [
            'triggerEvent',
            'event',
            'type',
            'data.type',
            'payload.type',
            'data.status',
            'payload.status',
        ]) || ''
    ).toLowerCase();

    if (raw.includes('cancel')) return 'cancelled';
    if (raw.includes('resched')) return 'rescheduled';
    if (raw.includes('no_show') || raw.includes('no-show')) return 'no-show';
    return 'scheduled';
}

function buildInterviewBookingUrl(applicationId: string): string {
    const baseUrl = env.CALCOM_BOOKING_URL;
    if (!baseUrl) {
        throw new AppError('CALCOM_BOOKING_URL is not configured', 500);
    }

    const url = new URL(baseUrl);
    url.searchParams.set('applicationId', applicationId);
    return url.toString();
}

export class InterviewService {
    async sendInterviewInvite(applicationId: string): Promise<string> {
        const application = await Application.findById(applicationId).populate('jobId', 'title');
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        const bookingUrl = buildInterviewBookingUrl(applicationId);
        const url = new URL(bookingUrl);
        url.searchParams.set('name', application.name);
        url.searchParams.set('email', application.email);

        const jobTitle =
            application.jobId && typeof application.jobId === 'object'
                ? String((application.jobId as any).title || 'the role')
                : 'the role';

        await sendInterviewInviteEmail({
            to: application.email,
            candidateName: application.name,
            jobTitle,
            bookingUrl: url.toString(),
        });

        await Application.findByIdAndUpdate(applicationId, { status: 'interview' });
        return url.toString();
    }

    async handleCalcomWebhook(payload: any, headers: IncomingHttpHeaders): Promise<void> {
        const configuredSecret = env.CALCOM_WEBHOOK_SECRET?.trim();
        if (configuredSecret) {
            const headerSecret =
                String(headers['x-cal-secret-key'] || '') ||
                String(headers['x-calcom-secret-key'] || '') ||
                String(headers['x-webhook-secret'] || '');

            if (!headerSecret || headerSecret !== configuredSecret) {
                throw new AppError('Invalid Cal.com webhook secret', 401);
            }
        }

        const applicationId = String(
            pickFirst(payload, [
                'payload.metadata.applicationId',
                'data.metadata.applicationId',
                'metadata.applicationId',
                'payload.booking.metadata.applicationId',
                'data.booking.metadata.applicationId',
                'booking.metadata.applicationId',
                'applicationId',
            ]) || ''
        ).trim();

        if (!applicationId) {
            return;
        }

        const application = await Application.findById(applicationId).select('_id');
        if (!application) {
            return;
        }

        const startRaw = pickFirst(payload, [
            'payload.startTime',
            'payload.startsAt',
            'data.startTime',
            'data.startsAt',
            'booking.startTime',
            'booking.startsAt',
            'startTime',
            'startsAt',
        ]);

        const scheduledTime = startRaw ? new Date(String(startRaw)) : null;
        if (!scheduledTime || Number.isNaN(scheduledTime.getTime())) {
            return;
        }

        const meetLink =
            String(
                pickFirst(payload, [
                    'payload.meetingUrl',
                    'payload.location',
                    'data.meetingUrl',
                    'data.location',
                    'booking.meetingUrl',
                    'booking.location',
                    'meetingUrl',
                    'location',
                ]) || env.CALCOM_BOOKING_URL || ''
            ).trim();

        if (!meetLink) {
            throw new AppError('No meeting URL found in Cal.com webhook payload', 400);
        }

        const interviewer =
            String(
                pickFirst(payload, [
                    'payload.organizer.name',
                    'data.organizer.name',
                    'booking.organizer.name',
                    'organizer.name',
                ]) || 'HR Team'
            ).trim() || 'HR Team';

        const status = parseCalcomStatus(payload);

        await Interview.findOneAndUpdate(
            { applicationId: application._id },
            {
                applicationId: application._id,
                scheduledTime,
                meetLink,
                interviewer,
                status,
            },
            { upsert: true, new: true, runValidators: true }
        );

        await Application.findByIdAndUpdate(application._id, { status: 'interview' });
    }

    async listInterviews(filters: ListInterviewsInput): Promise<{
        interviews: IInterview[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { status, search, from, to, page = 1, limit = 50 } = filters;

        const query: any = {};
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

    async updateInterviewStatus(id: string, status: InterviewStatus): Promise<IInterview> {
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

        return interview;
    }

    async getInterviewDetails(interviewId: string): Promise<{
        interview: IInterview;
        assignmentSubmission: any | null;
        note: IInterviewNote | null;
    }> {
        const interview = await Interview.findById(interviewId).populate({
            path: 'applicationId',
            select: 'name email phone resumeUrl status jobId portfolio linkedin experience',
            populate: {
                path: 'jobId',
                select: 'title department location',
            },
        });

        if (!interview) {
            throw new AppError('Interview not found', 404);
        }

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

        return note;
    }
}
