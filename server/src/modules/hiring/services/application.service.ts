import path from 'path';
import AppError from '../../../utils/appError';
import { uploadDocument } from '../../../utils/cloudinary.util';
import {
    sendHiringApplicationReceivedEmail,
    sendHiringAssignmentEmail,
    sendHiringOfferEmail,
    sendHiringRejectionEmail,
} from '../../../services/email.service';
import { env } from '../../../config/env.config';
import { Application, IApplication } from '../models/Application.model';
import { Offer, IOffer } from '../models/Offer.model';
import type { ApplicationStatus } from '../models/Application.model';
import { Job } from '../models/Job.model';
import { Assignment } from '../models/Assignment.model';
import type {
    ApplicationDecisionInput,
    CreatePublicApplicationInput,
    ListApplicationsInput,
    UpdateApplicationInput,
} from '../validators/application.validator';
import {
    getApplicationActivityTimeline,
    logApplicationActivity,
} from './activity.service';

async function runEmailSafely(label: string, fn: () => Promise<void>) {
    try {
        await fn();
    } catch (error) {
        console.error(`[Hiring Email] ${label} failed:`, error);
    }
}

export class ApplicationService {
    async createPublicApplication(
        jobId: string,
        data: CreatePublicApplicationInput,
        resumeFile: Express.Multer.File
    ): Promise<IApplication> {
        const job = await Job.findById(jobId).select('title isHiring');
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        if (!job.isHiring) {
            throw new AppError('This job is currently not accepting applications', 400);
        }

        const ext = path.extname(resumeFile.originalname) || '.pdf';
        const uploadResult = await uploadDocument(
            resumeFile.buffer,
            `hiring/jobs/${jobId}/applications`,
            `resume-${Date.now()}${ext}`,
            true
        );

        const application = await Application.create({
            jobId,
            ...data,
            resumeUrl: uploadResult.url,
            resumeCloudinaryId: uploadResult.cloudinaryId,
            status: 'new',
            tags: [],
        });

        await runEmailSafely('application received', () =>
            sendHiringApplicationReceivedEmail({
                to: data.email,
                candidateName: data.name,
                jobTitle: String((job as any).title || 'the role'),
            })
        );

        await logApplicationActivity({
            applicationId: application._id,
            type: 'application.received',
            title: 'Application Received',
            description: `${data.name} submitted an application for ${String((job as any).title || 'the role')}.`,
            actorType: 'candidate',
            metadata: {
                jobId,
                email: data.email,
            },
        });

        return application;
    }

    async getApplications(filters: ListApplicationsInput): Promise<{
        applications: IApplication[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { jobId, status, tags, search, page = 1, limit = 50 } = filters;

        const query: any = {};
        if (jobId) query.jobId = jobId;
        if (status) query.status = status;
        if (tags) {
            const tagList = tags
                .split(',')
                .map((t) => t.trim().toLowerCase())
                .filter(Boolean);
            if (tagList.length > 0) query.tags = { $in: tagList };
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [applications, total] = await Promise.all([
            Application.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('jobId', 'title department location employmentType'),
            Application.countDocuments(query),
        ]);

        return {
            applications,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getApplicationById(id: string): Promise<IApplication> {
        const application = await Application.findById(id).populate(
            'jobId',
            'title department location employmentType isHiring'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }
        return application;
    }

    async getApplicationTimeline(id: string) {
        const application = await Application.findById(id).select('_id');
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        const activities = await getApplicationActivityTimeline(id);
        return { activities };
    }

    async updateApplication(id: string, data: UpdateApplicationInput): Promise<IApplication> {
        const payload: any = { ...data };
        if (payload.tags) {
            payload.tags = payload.tags
                .map((tag: string) => tag.trim().toLowerCase())
                .filter(Boolean);
        }

        const application = await Application.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true,
        }).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        return application;
    }

    async updateStatus(
        id: string,
        status: ApplicationStatus,
        actorId?: string
    ): Promise<IApplication> {
        const existing = await Application.findById(id)
            .select('status name email jobId')
            .populate('jobId', 'title');
        if (!existing) {
            throw new AppError('Application not found', 404);
        }

        if (status === 'offered') {
            throw new AppError(
                'Use the final decision flow to send an offer and move a candidate to Offered',
                400
            );
        }

        if (status === 'hired' && existing.status !== 'offered' && existing.status !== 'hired') {
            throw new AppError(
                'Candidate can be marked as Hired only after an offer has been sent',
                400
            );
        }

        const wasRejected = existing.status === 'rejected';
        const enteringAssignmentRound =
            status === 'assignment-round' && existing.status !== 'assignment-round';

        if (enteringAssignmentRound) {
            const jobId =
                existing.jobId && typeof existing.jobId === 'object'
                    ? (existing.jobId as any)._id
                    : existing.jobId;

            const assignment = await Assignment.findOne({ jobId }).sort({ updatedAt: -1, createdAt: -1 });
            if (!assignment) {
                throw new AppError('Please create an assignment for this job before moving candidate to assignment stage', 400);
            }

            const assignmentUrl = `${env.FRONTEND_URL.replace(/\/$/, '')}/assignment/${existing._id}`;
            const jobTitle =
                existing.jobId && typeof existing.jobId === 'object'
                    ? String((existing.jobId as any).title || 'the role')
                    : 'the role';

            await runEmailSafely('assignment invite', () =>
                sendHiringAssignmentEmail({
                    to: existing.email,
                    candidateName: existing.name,
                    jobTitle,
                    assignmentTitle: assignment.title,
                    assignmentUrl,
                    timeLimitHours: assignment.timeLimitHours,
                })
            );
        }

        const updatePayload: any = { status };
        if (enteringAssignmentRound) {
            updatePayload.assignmentWindowStartedAt = null;
            updatePayload.assignmentWindowExpiresAt = null;
        }

        const application = await Application.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true, runValidators: true }
        ).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        if (status === 'rejected' && !wasRejected) {
            const jobTitle =
                application.jobId && typeof application.jobId === 'object'
                    ? (application.jobId as any).title
                    : 'the role';
            await runEmailSafely('rejection email', () =>
                sendHiringRejectionEmail({
                    to: application.email,
                    candidateName: application.name,
                    jobTitle: String(jobTitle),
                })
            );

            await logApplicationActivity({
                applicationId: application._id,
                type: 'application.rejected',
                title: 'Candidate Rejected',
                description: 'Application moved to Rejected and rejection email sent.',
                actorType: actorId ? 'user' : 'system',
                actorId,
                metadata: {
                    status,
                },
            });
        } else {
            await logApplicationActivity({
                applicationId: application._id,
                type: 'application.status_changed',
                title: 'Stage Updated',
                description: `Application moved to ${status}.`,
                actorType: actorId ? 'user' : 'system',
                actorId,
                metadata: {
                    status,
                },
            });
        }

        return application;
    }

    async addTag(id: string, tag: string, actorId?: string): Promise<IApplication> {
        const normalizedTag = tag.trim().toLowerCase();
        const existing = await Application.findById(id).select('status tags');
        if (!existing) {
            throw new AppError('Application not found', 404);
        }

        const alreadyRejected = existing.status === 'rejected';
        const alreadyTaggedRejected = Array.isArray(existing.tags)
            ? existing.tags.includes('rejected')
            : false;

        const application = await Application.findByIdAndUpdate(
            id,
            {
                $addToSet: { tags: normalizedTag },
                ...(normalizedTag === 'rejected' ? { $set: { status: 'rejected' } } : {}),
            },
            { new: true, runValidators: true }
        ).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        if (normalizedTag === 'rejected' && !alreadyRejected && !alreadyTaggedRejected) {
            const jobTitle =
                application.jobId && typeof application.jobId === 'object'
                    ? (application.jobId as any).title
                    : 'the role';
            await runEmailSafely('tag rejection email', () =>
                sendHiringRejectionEmail({
                    to: application.email,
                    candidateName: application.name,
                    jobTitle: String(jobTitle),
                })
            );

            await logApplicationActivity({
                applicationId: application._id,
                type: 'application.rejected',
                title: 'Candidate Rejected',
                description: 'Application tagged as rejected and rejection email sent.',
                actorType: actorId ? 'user' : 'system',
                actorId,
                metadata: {
                    tag: normalizedTag,
                },
            });
        } else {
            await logApplicationActivity({
                applicationId: application._id,
                type: 'application.tag_added',
                title: 'Tag Added',
                description: `Tag "${normalizedTag}" was added to the application.`,
                actorType: actorId ? 'user' : 'system',
                actorId,
                metadata: {
                    tag: normalizedTag,
                },
            });
        }

        return application;
    }

    async removeTag(id: string, tag: string, actorId?: string): Promise<IApplication> {
        const normalizedTag = tag.trim().toLowerCase();
        const application = await Application.findByIdAndUpdate(
            id,
            { $pull: { tags: normalizedTag } },
            { new: true }
        ).populate('jobId', 'title department location employmentType');

        if (!application) {
            throw new AppError('Application not found', 404);
        }

        await logApplicationActivity({
            applicationId: application._id,
            type: 'application.tag_removed',
            title: 'Tag Removed',
            description: `Tag "${normalizedTag}" was removed from the application.`,
            actorType: actorId ? 'user' : 'system',
            actorId,
            metadata: {
                tag: normalizedTag,
            },
        });

        return application;
    }

    async makeFinalDecision(
        id: string,
        data: ApplicationDecisionInput,
        offerLetterFile?: Express.Multer.File,
        actorId?: string
    ): Promise<{ application: IApplication; offer: IOffer | null }> {
        const application = await Application.findById(id).populate(
            'jobId',
            'title department location employmentType'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        if (data.decision === 'rejected') {
            application.status = 'rejected';
            await application.save();

            const jobTitle =
                application.jobId && typeof application.jobId === 'object'
                    ? (application.jobId as any).title
                    : 'the role';

            await runEmailSafely('final rejection email', () =>
                sendHiringRejectionEmail({
                    to: application.email,
                    candidateName: application.name,
                    jobTitle: String(jobTitle),
                })
            );

            await logApplicationActivity({
                applicationId: application._id,
                type: 'application.rejected',
                title: 'Final Decision: Rejected',
                description: 'Final decision marked as rejected and email sent to candidate.',
                actorType: actorId ? 'user' : 'system',
                actorId,
            });

            return {
                application,
                offer: null,
            };
        }

        const salary = String(data.salary || '').trim();
        const position = String(data.position || '').trim();

        if (!salary) {
            throw new AppError('Salary is required for accepted decision', 400);
        }
        if (!position) {
            throw new AppError('Position is required for accepted decision', 400);
        }
        if (!offerLetterFile) {
            throw new AppError('Offer letter PDF is required for accepted decision', 400);
        }

        if (offerLetterFile.mimetype !== 'application/pdf') {
            throw new AppError('Offer letter must be a PDF file', 400);
        }

        const offerUpload = await uploadDocument(
            offerLetterFile.buffer,
            `hiring/offers/${application._id}`,
            `offer-letter-${Date.now()}.pdf`,
            true
        );

        const offer = await Offer.findOneAndUpdate(
            { applicationId: application._id },
            {
                applicationId: application._id,
                salary,
                position,
                offerLetterUrl: offerUpload.url,
                offerLetterCloudinaryId: offerUpload.cloudinaryId,
                status: 'sent',
            },
            { upsert: true, new: true, runValidators: true }
        );

        application.status = 'offered';
        await application.save();

        await runEmailSafely('offer email', () =>
            sendHiringOfferEmail({
                to: application.email,
                candidateName: application.name,
                position,
                salary,
                offerLetterUrl: offer.offerLetterUrl,
            })
        );

        await logApplicationActivity({
            applicationId: application._id,
            type: 'application.offer_sent',
            title: 'Final Decision: Offer Sent',
            description: `Offer sent for position ${position} with salary ${salary}.`,
            actorType: actorId ? 'user' : 'system',
            actorId,
        });

        return {
            application,
            offer,
        };
    }
}
