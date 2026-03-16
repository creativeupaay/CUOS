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
            existing.timeLimitHours = data.timeLimitHours;
            existing.submissionFields = data.submissionFields;
            await existing.save();
            return existing;
        }

        const assignment = await Assignment.create(data);
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
        if (data.timeLimitHours !== undefined) assignment.timeLimitHours = data.timeLimitHours;
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
        hasStarted: boolean;
        startedAt: Date | null;
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

        const startedAt = (application as any).assignmentWindowStartedAt || null;
        const expiresAt = (application as any).assignmentWindowExpiresAt || null;
        const isExpired = Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());

        return {
            assignment,
            applicationId,
            hasSubmitted: Boolean(submission),
            hasStarted: Boolean(startedAt),
            startedAt,
            expiresAt,
            isExpired,
        };
    }

    async startAssignment(applicationId: string): Promise<{
        startedAt: Date;
        expiresAt: Date;
    }> {
        const application = await Application.findById(applicationId).select(
            'jobId status assignmentWindowStartedAt assignmentWindowExpiresAt'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        if ((application as any).status !== 'assignment-round') {
            throw new AppError('Assignment can be started only in assignment stage', 400);
        }

        const assignment = await Assignment.findOne({ jobId: (application as any).jobId }).sort({
            createdAt: -1,
        });
        if (!assignment) {
            throw new AppError('Assignment not found for this application', 404);
        }

        const currentStart = (application as any).assignmentWindowStartedAt as Date | undefined;
        const currentExpiry = (application as any).assignmentWindowExpiresAt as Date | undefined;

        if (currentStart && currentExpiry) {
            if (currentExpiry.getTime() < Date.now()) {
                throw new AppError('Assignment link has expired', 410);
            }

            return {
                startedAt: currentStart,
                expiresAt: currentExpiry,
            };
        }

        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + assignment.timeLimitHours * 60 * 60 * 1000);

        await Application.findByIdAndUpdate(application._id, {
            assignmentWindowStartedAt: startedAt,
            assignmentWindowExpiresAt: expiresAt,
        });

        await logApplicationActivity({
            applicationId: application._id,
            type: 'assignment.started',
            title: 'Assignment Started',
            description: 'Candidate started the assignment timer.',
            actorType: 'candidate',
            metadata: {
                startedAt,
                expiresAt,
            },
        });

        return {
            startedAt,
            expiresAt,
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

        const startedAt = (application as any).assignmentWindowStartedAt as Date | undefined;
        const expiresAt = (application as any).assignmentWindowExpiresAt as Date | undefined;
        if (!startedAt || !expiresAt) {
            throw new AppError('Please start the assignment before submitting', 400);
        }

        if (expiresAt.getTime() < Date.now()) {
            throw new AppError('Assignment submission window has expired', 410);
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
            submittedAt: new Date(),
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
            .populate('assignmentId', 'title jobId timeLimitHours');
    }
}
