import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { AssignmentService } from '../services/assignment.service';
import type {
    CreateAssignmentInput,
    SubmitAssignmentInput,
    UpdateAssignmentInput,
} from '../validators/assignment.validator';

const assignmentService = new AssignmentService();

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
    const data: CreateAssignmentInput = req.body;
    const assignment = await assignmentService.createAssignment(data);

    res.status(201).json({
        status: 'success',
        data: { assignment },
    });
});

export const getAssignmentsByJob = asyncHandler(async (req: Request, res: Response) => {
    // If user is a job manager (not admin/HR), filter to only assignments for their managed jobs
    const managerUserId = req.isJobManager ? req.user?.id : undefined;

    const assignments = await assignmentService.getAssignmentsByJob(req.params.jobId, managerUserId);

    res.status(200).json({
        status: 'success',
        data: { assignments },
    });
});

export const updateAssignment = asyncHandler(async (req: Request, res: Response) => {
    const data: UpdateAssignmentInput = req.body;
    const assignment = await assignmentService.updateAssignment(req.params.id, data);

    res.status(200).json({
        status: 'success',
        data: { assignment },
    });
});

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
    await assignmentService.deleteAssignment(req.params.id, {
        deletedBy: req.user?.id,
        reason: 'Hiring assignment delete requested',
    });

    res.status(200).json({
        status: 'success',
        message: 'Assignment deleted successfully',
    });
});

export const getAssignmentForApplication = asyncHandler(async (req: Request, res: Response) => {
    const result = await assignmentService.getAssignmentForApplication(req.params.applicationId);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const submitAssignment = asyncHandler(async (req: Request, res: Response) => {
    const data: SubmitAssignmentInput = req.body;
    const allFiles: Express.Multer.File[] = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[])
        : [];

    const files = allFiles.filter((file) => file.fieldname === 'attachments');
    const customAttachmentFiles = allFiles
        .filter((file) => file.fieldname.startsWith('custom_'))
        .reduce<Record<string, Express.Multer.File>>((acc, file) => {
            acc[file.fieldname] = file;
            return acc;
        }, {});

    const submission = await assignmentService.submitAssignment(
        req.params.applicationId,
        data,
        files,
        customAttachmentFiles
    );

    res.status(201).json({
        status: 'success',
        message: 'Assignment submitted successfully',
        data: { submission },
    });
});

export const getAssignmentSubmissions = asyncHandler(async (req: Request, res: Response) => {
    const submissions = await assignmentService.getAssignmentSubmissions(req.params.id);

    res.status(200).json({
        status: 'success',
        data: { submissions },
    });
});
