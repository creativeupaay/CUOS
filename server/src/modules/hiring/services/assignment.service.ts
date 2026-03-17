import AppError from '../../../utils/appError';
import { Application } from '../models/Application.model';
import { Assignment, IAssignment } from '../models/Assignment.model';
import {
    AssignmentSubmission,
    IAssignmentSubmission,
} from '../models/AssignmentSubmission.model';
import { Job } from '../models/Job.model';
import {
    CreateAssignmentInput,
    SubmitAssignmentInput,
    UpdateAssignmentInput,
} from '../validators/assignment.validator';
import { logApplicationActivity } from './activity.service';

export class AssignmentService {
    async createAssignment(data: CreateAssignmentInput): Promise<IAssignment> {
        const job = await Job.findById(data.jobId).select('_id');
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        const hasAtLeastOneSubmissionField = Object.values(data.submissionFields).some(Boolean);
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

    async getAssignmentsByJob(jobId: string): Promise<IAssignment[]> {
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

        const hasAtLeastOneSubmissionField = Object.values(assignment.submissionFields).some(Boolean);
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
        data: SubmitAssignmentInput
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
            githubLink: String(data.githubLink || '').trim(),
            demoLink: String(data.demoLink || '').trim(),
            videoLink: String(data.videoLink || '').trim(),
            notes: String(data.notes || '').trim(),
        };

        const hasAllowedSubmissionContent =
            (assignment.submissionFields.githubLink && Boolean(normalizedData.githubLink)) ||
            (assignment.submissionFields.demoLink && Boolean(normalizedData.demoLink)) ||
            (assignment.submissionFields.videoLink && Boolean(normalizedData.videoLink)) ||
            (assignment.submissionFields.notes && Boolean(normalizedData.notes));

        if (!hasAllowedSubmissionContent) {
            throw new AppError('Please provide at least one valid assignment submission input', 400);
        }

        const existingSubmission = await AssignmentSubmission.findOne({
            assignmentId: assignment._id,
            applicationId: application._id,
        }).select('_id');

        if (existingSubmission) {
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
            notes: assignment.submissionFields.notes ? normalizedData.notes || undefined : undefined,
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
