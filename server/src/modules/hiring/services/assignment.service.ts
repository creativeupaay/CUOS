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

export class AssignmentService {
    async createAssignment(data: CreateAssignmentInput): Promise<IAssignment> {
        const job = await Job.findById(data.jobId).select('_id');
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        const assignment = await Assignment.create(data);
        return assignment;
    }

    async getAssignmentsByJob(jobId: string): Promise<IAssignment[]> {
        return Assignment.find({ jobId }).sort({ createdAt: -1 });
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
    }> {
        const application = await Application.findById(applicationId).select('jobId status');
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

        return {
            assignment,
            applicationId,
            hasSubmitted: Boolean(submission),
        };
    }

    async submitAssignment(
        applicationId: string,
        data: SubmitAssignmentInput
    ): Promise<IAssignmentSubmission> {
        const application = await Application.findById(applicationId).select('jobId');
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        const assignment = await Assignment.findOne({ jobId: application.jobId }).sort({ createdAt: -1 });
        if (!assignment) {
            throw new AppError('Assignment not found for this application', 404);
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
            githubLink: data.githubLink || undefined,
            demoLink: data.demoLink || undefined,
            videoLink: data.videoLink || undefined,
            notes: data.notes || undefined,
            submittedAt: new Date(),
        });

        await Application.findByIdAndUpdate(application._id, {
            status: 'assignment-round',
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
