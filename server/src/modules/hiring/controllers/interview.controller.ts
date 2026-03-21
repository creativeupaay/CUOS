import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import { InterviewService } from '../services/interview.service';
import type {
    ListInterviewsInput,
    SaveInterviewNoteInput,
    UpdateInterviewStatusInput,
    WebhookDebugQueryInput,
    WebhookDebugPublicQueryInput,
} from '../validators/interview.validator';

const interviewService = new InterviewService();

export const sendInterviewInvite = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req.user as any)?.id;
    const bookingUrl = await interviewService.sendInterviewInvite(req.params.applicationId, actorId);

    res.status(200).json({
        status: 'success',
        message: 'Interview invitation email sent',
        data: { bookingUrl },
    });
});

export const handleCalcomWebhook = asyncHandler(async (req: Request, res: Response) => {
    await interviewService.handleCalcomWebhook(req.body, req.headers);

    res.status(200).json({
        status: 'success',
        message: 'Webhook processed',
    });
});

export const getInterviews = asyncHandler(async (req: Request, res: Response) => {
    const filters: ListInterviewsInput = req.query as any;
    const result = await interviewService.listInterviews(filters);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const updateInterviewStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as UpdateInterviewStatusInput;
    const actorId = (req.user as any)?.id;
    const interview = await interviewService.updateInterviewStatus(req.params.id, status, actorId);

    res.status(200).json({
        status: 'success',
        data: { interview },
    });
});

export const getInterviewDetails = asyncHandler(async (req: Request, res: Response) => {
    const result = await interviewService.getInterviewDetails(req.params.id);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const saveInterviewNote = asyncHandler(async (req: Request, res: Response) => {
    const data: SaveInterviewNoteInput = req.body;
    const createdBy = (req.user as any)?.id;
    const note = await interviewService.saveInterviewNote(req.params.id, data, createdBy);

    res.status(201).json({
        status: 'success',
        message: 'Interview note saved successfully',
        data: { note },
    });
});

export const getWebhookDebug = asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as WebhookDebugQueryInput;
    const events = interviewService.getWebhookDebug(limit || 20);

    res.status(200).json({
        status: 'success',
        data: {
            count: events.length,
            events,
        },
    });
});

export const getWebhookDebugPublic = asyncHandler(async (req: Request, res: Response) => {
    const { key, limit } = req.query as unknown as WebhookDebugPublicQueryInput;

    if (!env.CALCOM_WEBHOOK_SECRET || String(key) !== String(env.CALCOM_WEBHOOK_SECRET)) {
        throw new AppError('Invalid debug key', 401);
    }

    const events = interviewService.getWebhookDebug(limit || 20);

    res.status(200).json({
        status: 'success',
        data: {
            count: events.length,
            events,
        },
    });
});
