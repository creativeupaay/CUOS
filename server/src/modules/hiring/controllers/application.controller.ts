import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { ApplicationService } from '../services/application.service';
import type {
    ApplicationDecisionInput,
    CreatePublicApplicationInput,
    ListApplicationsInput,
    UpdateApplicationInput,
    UpdateStatusInput,
    TagInput,
} from '../validators/application.validator';

const applicationService = new ApplicationService();

export const createPublicApplication = asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const data: CreatePublicApplicationInput = req.body;

    const files = Array.isArray(req.files) ? req.files : [];
    const resume =
        req.file ||
        files.find((file) => file.fieldname === 'resume');
    if (!resume) {
        throw new AppError('Resume file is required', 400);
    }

    const application = await applicationService.createPublicApplication(jobId, data, resume, files);

    res.status(201).json({
        status: 'success',
        message: 'Application submitted successfully',
        data: {
            applicationId: application._id,
            status: application.status,
        },
    });
});

export const getApplications = asyncHandler(async (req: Request, res: Response) => {
    const filters: ListApplicationsInput = { ...req.query } as any;

    // The frontend sends `minExperience` as a string, make sure to convert it
    if (filters.minExperience && typeof filters.minExperience === 'string') {
        filters.minExperience = Number(filters.minExperience);
    }

    // If user is a job manager (not admin/HR), filter to only applications for their managed jobs
    const managerUserId = (req as any).isJobManager ? (req.user as any).id : undefined;

    const result = await applicationService.getApplications(filters, managerUserId);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const getApplication = asyncHandler(async (req: Request, res: Response) => {
    const application = await applicationService.getApplicationById(req.params.id);

    res.status(200).json({
        status: 'success',
        data: { application },
    });
});

export const getApplicationTimeline = asyncHandler(async (req: Request, res: Response) => {
    const timeline = await applicationService.getApplicationTimeline(req.params.id);

    res.status(200).json({
        status: 'success',
        data: timeline,
    });
});

export const updateApplication = asyncHandler(async (req: Request, res: Response) => {
    const data: UpdateApplicationInput = req.body;
    const application = await applicationService.updateApplication(req.params.id, data);

    res.status(200).json({
        status: 'success',
        data: { application },
    });
});

export const updateApplicationStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as UpdateStatusInput;
    const actorId = (req.user as any)?.id;
    const application = await applicationService.updateStatus(req.params.id, status, actorId);

    res.status(200).json({
        status: 'success',
        data: { application },
    });
});

export const addApplicationTag = asyncHandler(async (req: Request, res: Response) => {
    const { tag } = req.body as TagInput;
    const actorId = (req.user as any)?.id;
    const application = await applicationService.addTag(req.params.id, tag, actorId);

    res.status(200).json({
        status: 'success',
        data: { application },
    });
});

export const removeApplicationTag = asyncHandler(async (req: Request, res: Response) => {
    const { tag } = req.body as TagInput;
    const actorId = (req.user as any)?.id;
    const application = await applicationService.removeTag(req.params.id, tag, actorId);

    res.status(200).json({
        status: 'success',
        data: { application },
    });
});

export const applyFinalDecision = asyncHandler(async (req: Request, res: Response) => {
    const data: ApplicationDecisionInput = req.body;
    const offerLetter = req.file;
    const actorId = (req.user as any)?.id;

    const result = await applicationService.makeFinalDecision(req.params.id, data, offerLetter, actorId);

    res.status(200).json({
        status: 'success',
        message:
            data.decision === 'accepted'
                ? 'Offer created and sent successfully'
                : 'Candidate rejected successfully',
        data: result,
    });
});
