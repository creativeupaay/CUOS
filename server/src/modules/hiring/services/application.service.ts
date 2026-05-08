import path from 'path';
import { Types } from 'mongoose';
import AppError from '../../../utils/appError';
import { uploadDocument } from '../../../utils/cloudinary.util';
import {
    sendHiringApplicationReceivedEmail,
    sendHiringAssignmentEmail,
    sendHiringInterviewQualifiedEmail,
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
import { InterviewService } from './interview.service';
import type { IJobApplicationCustomField, JobApplicationFieldType } from '../models/Job.model';
import { logger } from "../../../utils/logger";

async function runEmailSafely(label: string, fn: () => Promise<void>) {
    try {
        await fn();
    } catch (error) {
        logger.error({ context: error }, `[Hiring Email] ${label} failed:`);
    }
}

const interviewService = new InterviewService();

function normalizeOptionalUrl(value?: string) {
    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) return '';
    return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

function isValidUrl(value?: string) {
    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) return true;

    try {
        const normalizedValue = /^https?:\/\//i.test(trimmedValue)
            ? trimmedValue
            : `https://${trimmedValue}`;
        const url = new URL(normalizedValue);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function parseCustomFieldValues(raw: unknown): Record<string, string> {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, string>;
    }
    if (typeof raw !== 'string') {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    } catch {
        return {};
    }
}

function getFieldTypeLabel(type: JobApplicationFieldType) {
    switch (type) {
        case 'url':
            return 'a valid URL';
        case 'number':
            return 'a valid number';
        case 'date':
            return 'a valid date';
        case 'attachment':
            return 'an attachment';
        default:
            return 'a value';
    }
}

const RESUME_ALLOWED_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export class ApplicationService {
    async createPublicApplication(
        jobId: string,
        data: CreatePublicApplicationInput,
        resumeFile: Express.Multer.File,
        uploadedFiles: Express.Multer.File[] = []
    ): Promise<IApplication> {
        const job = await Job.findById(jobId).select('title isHiring applicationForm');
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        if (!job.isHiring) {
            throw new AppError('This job is currently not accepting applications', 400);
        }

        if (!RESUME_ALLOWED_TYPES.has(resumeFile.mimetype)) {
            throw new AppError('Resume must be a PDF, DOC, or DOCX file', 400);
        }

        const selectedStandardFields = new Set(
            Array.isArray((job as any).applicationForm?.selectedStandardFields)
                ? (job as any).applicationForm.selectedStandardFields
                : []
        );
        const standardFieldSettings = Array.isArray((job as any).applicationForm?.standardFieldSettings)
            ? (job as any).applicationForm.standardFieldSettings
            : [];
        const requiredStandardFields = new Set(
            standardFieldSettings
                .filter((field: any) => Boolean(field?.required) && selectedStandardFields.has(field?.key))
                .map((field: any) => String(field.key))
        );
        const customFields = (Array.isArray((job as any).applicationForm?.customFields)
            ? (job as any).applicationForm.customFields
            : []) as IJobApplicationCustomField[];
        const customFieldValues = parseCustomFieldValues((data as any).customFieldValues);
        const filesByField = new Map(
            uploadedFiles
                .filter((file) => file.fieldname && file.fieldname !== 'resume')
                .map((file) => [file.fieldname, file])
        );

        if (selectedStandardFields.has('portfolio') && data.portfolio && !isValidUrl(data.portfolio)) {
            throw new AppError('Portfolio URL must be a valid link', 400);
        }
        if (selectedStandardFields.has('github') && data.github && !isValidUrl(data.github)) {
            throw new AppError('GitHub URL must be a valid link', 400);
        }
        if (selectedStandardFields.has('linkedin') && data.linkedin && !isValidUrl(data.linkedin)) {
            throw new AppError('LinkedIn URL must be a valid link', 400);
        }
        if (
            selectedStandardFields.has('figmaUrl') &&
            (data as any).figmaUrl &&
            !isValidUrl((data as any).figmaUrl)
        ) {
            throw new AppError('Figma URL must be a valid link', 400);
        }

        if (requiredStandardFields.has('portfolio') && !String(data.portfolio || '').trim()) {
            throw new AppError('Portfolio URL is required for this job', 400);
        }
        if (requiredStandardFields.has('github') && !String(data.github || '').trim()) {
            throw new AppError('GitHub URL is required for this job', 400);
        }
        if (requiredStandardFields.has('linkedin') && !String(data.linkedin || '').trim()) {
            throw new AppError('LinkedIn URL is required for this job', 400);
        }
        if (requiredStandardFields.has('experience') && !String(data.experience || '').trim()) {
            throw new AppError('Relevant Experience is required for this job', 400);
        }
        if (requiredStandardFields.has('coverLetter') && !String(data.coverLetter || '').trim()) {
            throw new AppError('Cover Letter is required for this job', 400);
        }
        if (requiredStandardFields.has('figmaUrl') && !String((data as any).figmaUrl || '').trim()) {
            throw new AppError('Figma URL is required for this job', 400);
        }

        const customFieldResponses: IApplication['customFieldResponses'] = [];
        for (const field of customFields) {
            const rawValue = String(customFieldValues[field.key] || '').trim();
            const isRequired = Boolean(field.required);

            if (field.type === 'attachment') {
                const file = filesByField.get(`custom_${field.key}`);
                if (isRequired && !file) {
                    throw new AppError(`${field.label} is required`, 400);
                }
                if (!file) continue;

                const fieldUpload = await uploadDocument(
                    file.buffer,
                    `hiring/jobs/${jobId}/applications/custom-fields`,
                    `${field.key}-${Date.now()}-${file.originalname}`,
                    true
                );

                customFieldResponses.push({
                    key: field.key,
                    label: field.label,
                    type: field.type,
                    fileUrl: fieldUpload.url,
                    fileCloudinaryId: fieldUpload.cloudinaryId,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                });
                continue;
            }

            if (isRequired && !rawValue) {
                throw new AppError(`${field.label} is required`, 400);
            }
            if (!rawValue) continue;

            if (field.type === 'url' && !isValidUrl(rawValue)) {
                throw new AppError(`${field.label} must be ${getFieldTypeLabel(field.type)}`, 400);
            }
            if (field.type === 'number' && Number.isNaN(Number(rawValue))) {
                throw new AppError(`${field.label} must be ${getFieldTypeLabel(field.type)}`, 400);
            }
            if (field.type === 'date' && Number.isNaN(new Date(rawValue).getTime())) {
                throw new AppError(`${field.label} must be ${getFieldTypeLabel(field.type)}`, 400);
            }

            customFieldResponses.push({
                key: field.key,
                label: field.label,
                type: field.type,
                value: field.type === 'url' ? normalizeOptionalUrl(rawValue) : rawValue,
            });
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
            portfolio: normalizeOptionalUrl(data.portfolio),
            linkedin: normalizeOptionalUrl(data.linkedin),
            github: normalizeOptionalUrl(data.github),
            figmaUrl: normalizeOptionalUrl((data as any).figmaUrl),
            resumeUrl: uploadResult.url,
            resumeCloudinaryId: uploadResult.cloudinaryId,
            customFieldResponses,
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

    async getApplications(
        filters: ListApplicationsInput,
        managerUserId?: string
    ): Promise<{
        applications: IApplication[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { jobId, status, tags, search, location, minExperience, page = 1, limit = 50 } = filters as any;

        const query: any = {};

        // If managerUserId is provided, filter to only applications for jobs managed by this user
        if (managerUserId) {
            const { Employee } = await import('../../hrms/models/Employee.model');
            const employee = await Employee.findOne({ userId: managerUserId }).select('_id');
            if (!employee) {
                return { applications: [], total: 0, page, totalPages: 0 };
            }
            const managedJobs = await Job.find({ managers: employee._id }).select('_id');
            const managedJobIds = managedJobs.map((job) => job._id);
            if (managedJobIds.length === 0) {
                return { applications: [], total: 0, page, totalPages: 0 };
            }
            query.jobId = { $in: managedJobIds };
        }

        if (jobId) {
            try {
                const requestedJobId = new Types.ObjectId(jobId);
                // If manager filter is already applied, ensure requested jobId is in the allowed list
                if (query.jobId && query.jobId.$in) {
                    const allowedIds = query.jobId.$in.map((id: Types.ObjectId) => id.toString());
                    if (!allowedIds.includes(requestedJobId.toString())) {
                        return { applications: [], total: 0, page, totalPages: 0 };
                    }
                }
                query.jobId = requestedJobId;
            } catch {
                // If jobId is not a valid ObjectId, just use it as is (shouldn't happen but safe guard)
                query.jobId = jobId;
            }
        }
        if (status) query.status = status;
        if (tags) {
            const tagList = tags
                .split(',')
                .map((t: string) => t.trim().toLowerCase())
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
        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }
        if (typeof minExperience === 'number') {
            query.yearsOfExperience = { $gte: minExperience };
        }

        const skip = (page - 1) * limit;

        const applications = await Application.aggregate([
            { $match: query },
            {
                $addFields: {
                    isRejected: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
                },
            },
            { $sort: { isRejected: 1, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
        ]);

        await Application.populate(applications, {
            path: 'jobId',
            select: 'title department location employmentType',
        });

        const total = await Application.countDocuments(query);

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
            'title department location employmentType isHiring interviewScheduling'
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

        if (
            status === 'hired' &&
            !['offered', 'hired', 'interview', 'interview-scheduled'].includes(existing.status)
        ) {
            throw new AppError(
                'Candidate can be marked as Hired only after an offer is sent or after an interview stage',
                400
            );
        }

        const wasRejected = existing.status === 'rejected';
        const wasHired = existing.status === 'hired';
        const enteringAssignmentRound =
            status === 'assignment-round' && existing.status !== 'assignment-round';
        const enteringAssignmentSubmitted =
            status === 'assignment-submitted' && existing.status !== 'assignment-submitted';
        const enteringInterview = status === 'interview' && existing.status !== 'interview';

        if (enteringAssignmentRound || enteringAssignmentSubmitted) {
            const jobId =
                existing.jobId && typeof existing.jobId === 'object'
                    ? (existing.jobId as any)._id
                    : existing.jobId;

            const assignment = await Assignment.findOne({ jobId }).sort({ updatedAt: -1, createdAt: -1 });
            if (!assignment) {
                throw new AppError(
                    'Please create an assignment for this job before moving candidate to an assignment stage',
                    400
                );
            }
        }

        if (enteringInterview) {
            await interviewService.sendInterviewInvite(id, actorId);

            const application = await Application.findById(id).populate(
                'jobId',
                'title department location employmentType interviewScheduling'
            );

            if (!application) {
                throw new AppError('Application not found', 404);
            }

            return application;
        }

        if (enteringAssignmentRound) {
            const jobId =
                existing.jobId && typeof existing.jobId === 'object'
                    ? (existing.jobId as any)._id
                    : existing.jobId;

            const assignment = await Assignment.findOne({ jobId }).sort({ updatedAt: -1, createdAt: -1 });
            if (!assignment) {
                throw new AppError(
                    'Please create an assignment for this job before moving candidate to an assignment stage',
                    400
                );
            }

            const timeLimitDays =
                typeof (assignment as any).timeLimitDays === 'number' && (assignment as any).timeLimitDays > 0
                    ? (assignment as any).timeLimitDays
                    : Math.max(1, Math.ceil(((assignment as any).timeLimitHours || 24) / 24));
            const assignmentWindowStartedAt = new Date();
            const assignmentWindowExpiresAt = new Date(
                assignmentWindowStartedAt.getTime() + timeLimitDays * 24 * 60 * 60 * 1000
            );

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
                    timeLimitDays,
                    deadlineAt: assignmentWindowExpiresAt,
                })
            );

            const updatePayload: any = {
                status,
                assignmentWindowStartedAt,
                assignmentWindowExpiresAt,
            };

            const application = await Application.findByIdAndUpdate(
                id,
                updatePayload,
                { new: true, runValidators: true }
            ).populate('jobId', 'title department location employmentType');

            if (!application) {
                throw new AppError('Application not found', 404);
            }

            await logApplicationActivity({
                applicationId: application._id,
                type: 'application.status_changed',
                title: 'Stage Updated',
                description: `Application moved to ${status}.`,
                actorType: actorId ? 'user' : 'system',
                actorId,
                metadata: {
                    status,
                    assignmentWindowStartedAt,
                    assignmentWindowExpiresAt,
                },
            });

            return application;
        }

        const updatePayload: any = { status };

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
        } else if (status === 'hired' && !wasHired) {
            const jobTitle =
                application.jobId && typeof application.jobId === 'object'
                    ? (application.jobId as any).title
                    : 'the role';

            await runEmailSafely('interview qualified email', () =>
                sendHiringInterviewQualifiedEmail({
                    to: application.email,
                    candidateName: application.name,
                    jobTitle: String(jobTitle),
                })
            );

            await logApplicationActivity({
                applicationId: application._id,
                type: 'application.hired',
                title: 'Candidate Marked as Hired',
                description:
                    'Application moved to Hired and interview qualification email sent to candidate.',
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
