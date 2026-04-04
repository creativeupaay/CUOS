import AppError from '../../../utils/appError';
import { uploadDocument } from '../../../utils/cloudinary.util';
import { Application } from '../models/Application.model';
import { Assignment, IAssignment } from '../models/Assignment.model';
import {
    AssignmentSubmission,
    IAssignmentSubmissionAttachment,
    IAssignmentSubmissionCustomFieldResponse,
    IAssignmentSubmission,
} from '../models/AssignmentSubmission.model';
import { Job } from '../models/Job.model';
import {
    CreateAssignmentInput,
    SubmitAssignmentInput,
    UpdateAssignmentInput,
} from '../validators/assignment.validator';
import { logApplicationActivity } from './activity.service';

function normalizeOptionalUrl(value?: string) {
    const trimmedValue = String(value || '').trim();
    if (!trimmedValue) return '';
    return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

const BUILTIN_ASSIGNMENT_SUBMISSION_FIELD_KEYS = [
    'githubLink',
    'demoLink',
    'videoLink',
    'figmaLink',
    'attachments',
    'notes',
] as const;

function hasAtLeastOneConfiguredSubmissionField(fields: any): boolean {
    const hasBuiltinFieldEnabled = BUILTIN_ASSIGNMENT_SUBMISSION_FIELD_KEYS.some(
        (key) => Boolean(fields?.[key])
    );
    const hasCustomFields = Array.isArray(fields?.customFields) && fields.customFields.length > 0;
    return hasBuiltinFieldEnabled || hasCustomFields;
}

export class AssignmentService {
    async createAssignment(data: CreateAssignmentInput): Promise<IAssignment> {
        const job = await Job.findById(data.jobId).select('_id');
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        const hasAtLeastOneSubmissionField = hasAtLeastOneConfiguredSubmissionField(data.submissionFields);
        if (!hasAtLeastOneSubmissionField) {
            throw new AppError('Enable at least one submission field for candidates', 400);
        }

        const existing = await Assignment.findOne({ jobId: data.jobId }).sort({ updatedAt: -1, createdAt: -1 });
        if (existing) {
            existing.title = data.title;
            existing.description = data.description;
            existing.instructions = data.instructions;
            existing.timeLimitDays = data.timeLimitDays;
            existing.timeLimitHours = data.timeLimitDays * 24;
            existing.submissionFields = data.submissionFields;
            await existing.save();
            return existing;
        }

        const assignment = await Assignment.create({
            ...data,
            timeLimitHours: data.timeLimitDays * 24,
        });
        return assignment;
    }

    async getAssignmentsByJob(jobId: string, managerUserId?: string): Promise<IAssignment[]> {
        // If managerUserId is provided, verify they manage this job
        if (managerUserId) {
            const { Employee } = await import('../../hrms/models/Employee.model');
            const employee = await Employee.findOne({ userId: managerUserId }).select('_id');
            if (!employee) {
                return [];
            }

            const job = await Job.findOne({ _id: jobId, managers: employee._id }).select('_id');
            if (!job) {
                return [];
            }
        }

        const assignment = await Assignment.findOne({ jobId }).sort({ updatedAt: -1, createdAt: -1 });
        return assignment ? [assignment] : [];
    }

    async updateAssignment(id: string, data: UpdateAssignmentInput): Promise<IAssignment> {
        const assignment = await Assignment.findById(id);

        if (!assignment) {
            throw new AppError('Assignment not found', 404);
        }

        if (data.title !== undefined) assignment.title = data.title;
        if (data.description !== undefined) assignment.description = data.description;
        if (data.instructions !== undefined) assignment.instructions = data.instructions;
        if (data.timeLimitDays !== undefined) {
            assignment.timeLimitDays = data.timeLimitDays;
            assignment.timeLimitHours = data.timeLimitDays * 24;
        }
        if (data.submissionFields) {
            assignment.submissionFields = {
                ...assignment.submissionFields,
                ...data.submissionFields,
            };
        }

        const hasAtLeastOneSubmissionField = hasAtLeastOneConfiguredSubmissionField(
            assignment.submissionFields
        );
        if (!hasAtLeastOneSubmissionField) {
            throw new AppError('Enable at least one submission field for candidates', 400);
        }

        await assignment.save();

        return assignment;
    }

    async deleteAssignment(id: string): Promise<void> {
        const assignment = await Assignment.findByIdAndDelete(id);
        if (!assignment) {
            throw new AppError('Assignment not found', 404);
        }

        await AssignmentSubmission.deleteMany({ assignmentId: assignment._id });
    }

    async getAssignmentForApplication(applicationId: string): Promise<{
        assignment: IAssignment;
        applicationId: string;
        hasSubmitted: boolean;
        expiresAt: Date | null;
        isExpired: boolean;
    }> {
        const application = await Application.findById(applicationId).select(
            'jobId status assignmentWindowStartedAt assignmentWindowExpiresAt'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        const assignment = await Assignment.findOne({ jobId: application.jobId }).sort({ createdAt: -1 });
        if (!assignment) {
            throw new AppError('Assignment not found for this job', 404);
        }

        const submission = await AssignmentSubmission.findOne({
            assignmentId: assignment._id,
            applicationId: application._id,
        }).select('_id');

        if (submission && (application as any).status !== 'assignment-submitted') {
            await Application.findByIdAndUpdate(application._id, {
                status: 'assignment-submitted',
            });
        }

        let expiresAt = (application as any).assignmentWindowExpiresAt || null;
        if (!expiresAt && (application as any).status === 'assignment-round') {
            const days =
                typeof assignment.timeLimitDays === 'number' && assignment.timeLimitDays > 0
                    ? assignment.timeLimitDays
                    : Math.max(1, Math.ceil((assignment.timeLimitHours || 24) / 24));
            const startedAt =
                (application as any).assignmentWindowStartedAt || (application as any).updatedAt || new Date();
            expiresAt = new Date(new Date(startedAt).getTime() + days * 24 * 60 * 60 * 1000);

            await Application.findByIdAndUpdate(application._id, {
                assignmentWindowStartedAt: startedAt,
                assignmentWindowExpiresAt: expiresAt,
            });
        }
        const isExpired = Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());

        return {
            assignment,
            applicationId,
            hasSubmitted: Boolean(submission),
            expiresAt,
            isExpired,
        };
    }

    async submitAssignment(
        applicationId: string,
        data: SubmitAssignmentInput,
        files: Express.Multer.File[] = [],
        customFieldFiles: Record<string, Express.Multer.File> = {}
    ): Promise<IAssignmentSubmission> {
        const application = await Application.findById(applicationId).select(
            'jobId assignmentWindowStartedAt assignmentWindowExpiresAt status'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        const assignment = await Assignment.findOne({ jobId: application.jobId }).sort({ createdAt: -1 });
        if (!assignment) {
            throw new AppError('Assignment not found for this application', 404);
        }

        let startedAt = (application as any).assignmentWindowStartedAt as Date | undefined;
        let expiresAt = (application as any).assignmentWindowExpiresAt as Date | undefined;
        if (!expiresAt) {
            const days =
                typeof assignment.timeLimitDays === 'number' && assignment.timeLimitDays > 0
                    ? assignment.timeLimitDays
                    : Math.max(1, Math.ceil((assignment.timeLimitHours || 24) / 24));
            const resolvedStartedAt = startedAt || (application as any).updatedAt || new Date();
            startedAt = resolvedStartedAt;
            expiresAt = new Date(
                new Date(resolvedStartedAt).getTime() + days * 24 * 60 * 60 * 1000
            );

            await Application.findByIdAndUpdate(application._id, {
                assignmentWindowStartedAt: startedAt,
                assignmentWindowExpiresAt: expiresAt,
            });
        }

        const normalizedData = {
            githubLink: normalizeOptionalUrl(data.githubLink),
            demoLink: normalizeOptionalUrl(data.demoLink),
            videoLink: normalizeOptionalUrl(data.videoLink),
            figmaLink: normalizeOptionalUrl(data.figmaLink),
            notes: String(data.notes || '').trim(),
            customFieldValues: data.customFieldValues || {},
        };

        const configuredCustomFields = Array.isArray(assignment.submissionFields.customFields)
            ? assignment.submissionFields.customFields
            : [];

        const customFieldResponses: IAssignmentSubmissionCustomFieldResponse[] = configuredCustomFields
            .map((field) => {
                if (field.type === 'attachment') {
                    const file = customFieldFiles[`custom_${field.key}`];
                    if (!file) return null;

                    return {
                        key: field.key,
                        label: field.label,
                        type: field.type,
                        value: '',
                        fileName: file.originalname,
                        mimeType: file.mimetype,
                        size: file.size,
                    } as IAssignmentSubmissionCustomFieldResponse;
                }

                const rawValue = normalizedData.customFieldValues?.[field.key];
                if (typeof rawValue !== 'string') return null;

                const trimmedValue = rawValue.trim();
                if (!trimmedValue) return null;

                const normalizedValue = field.type === 'url'
                    ? normalizeOptionalUrl(trimmedValue)
                    : trimmedValue;

                if (!normalizedValue) return null;

                return {
                    key: field.key,
                    label: field.label,
                    type: field.type,
                    value: normalizedValue,
                };
            })
            .filter(Boolean) as IAssignmentSubmissionCustomFieldResponse[];

        const uploadedAttachments: IAssignmentSubmissionAttachment[] = assignment.submissionFields.attachments
            ? await Promise.all(
                  files.map(async (file) => {
                      const uploadResult = await uploadDocument(
                          file.buffer,
                          `hiring/assignments/${application._id}`,
                          `${Date.now()}-${file.originalname}`,
                          false
                      );

                      return {
                          name: file.originalname,
                          url: uploadResult.url,
                          mimeType: file.mimetype,
                          size: file.size,
                          cloudinaryId: uploadResult.cloudinaryId,
                      };
                  })
              )
            : [];

        const customAttachmentResponses = await Promise.all(
            customFieldResponses.map(async (fieldResponse) => {
                if (fieldResponse.type !== 'attachment') return fieldResponse;

                const file = customFieldFiles[`custom_${fieldResponse.key}`];
                if (!file) return null;

                const uploadResult = await uploadDocument(
                    file.buffer,
                    `hiring/assignments/${application._id}/custom-fields`,
                    `${fieldResponse.key}-${Date.now()}-${file.originalname}`,
                    false
                );

                return {
                    ...fieldResponse,
                    value: uploadResult.url,
                    cloudinaryId: uploadResult.cloudinaryId,
                } as IAssignmentSubmissionCustomFieldResponse;
            })
        );

        const normalizedCustomFieldResponses = customAttachmentResponses.filter(Boolean) as IAssignmentSubmissionCustomFieldResponse[];

        const hasAllowedSubmissionContent =
            (assignment.submissionFields.githubLink && Boolean(normalizedData.githubLink)) ||
            (assignment.submissionFields.demoLink && Boolean(normalizedData.demoLink)) ||
            (assignment.submissionFields.videoLink && Boolean(normalizedData.videoLink)) ||
            (assignment.submissionFields.figmaLink && Boolean(normalizedData.figmaLink)) ||
            (assignment.submissionFields.attachments && uploadedAttachments.length > 0) ||
            (assignment.submissionFields.notes && Boolean(normalizedData.notes)) ||
            normalizedCustomFieldResponses.length > 0;

        if (!hasAllowedSubmissionContent) {
            throw new AppError('Please provide at least one valid assignment submission input', 400);
        }

        const existingSubmission = await AssignmentSubmission.findOne({
            assignmentId: assignment._id,
            applicationId: application._id,
        }).select('_id');

        if (existingSubmission) {
            if ((application as any).status !== 'assignment-submitted') {
                await Application.findByIdAndUpdate(application._id, {
                    status: 'assignment-submitted',
                });
            }
            throw new AppError('Assignment already submitted', 409);
        }

        const submittedAt = new Date();
        const submittedAfterDeadline = submittedAt.getTime() > expiresAt.getTime();

        const submission = await AssignmentSubmission.create({
            assignmentId: assignment._id,
            applicationId: application._id,
            githubLink: assignment.submissionFields.githubLink
                ? normalizedData.githubLink || undefined
                : undefined,
            demoLink: assignment.submissionFields.demoLink
                ? normalizedData.demoLink || undefined
                : undefined,
            videoLink: assignment.submissionFields.videoLink
                ? normalizedData.videoLink || undefined
                : undefined,
            figmaLink: assignment.submissionFields.figmaLink
                ? normalizedData.figmaLink || undefined
                : undefined,
            attachments: assignment.submissionFields.attachments ? uploadedAttachments : [],
            notes: assignment.submissionFields.notes ? normalizedData.notes || undefined : undefined,
            customFieldResponses: normalizedCustomFieldResponses,
            submittedAt,
            deadlineAt: expiresAt,
            submittedAfterDeadline,
        });

        await Application.findByIdAndUpdate(application._id, {
            status: 'assignment-submitted',
        });

        await logApplicationActivity({
            applicationId: application._id,
            type: 'assignment.submitted',
            title: 'Assignment Submitted',
            description: `Candidate submitted assignment "${assignment.title}".`,
            actorType: 'candidate',
            metadata: {
                assignmentId: assignment._id,
                submissionId: submission._id,
                submittedAfterDeadline,
                submittedAt,
                expiresAt,
                startedAt,
            },
        });

        return submission;
    }

    async getAssignmentSubmissions(assignmentId: string): Promise<IAssignmentSubmission[]> {
        const assignment = await Assignment.findById(assignmentId).select('_id');
        if (!assignment) {
            throw new AppError('Assignment not found', 404);
        }

        return AssignmentSubmission.find({ assignmentId })
            .sort({ submittedAt: -1 })
            .populate('applicationId', 'name email phone status jobId')
            .populate('assignmentId', 'title jobId timeLimitDays timeLimitHours');
    }
}
