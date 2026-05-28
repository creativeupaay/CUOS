import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import { InterviewService } from '../services/interview.service';
import { InterviewWebhookService } from '../services/interview-webhook.service';
import type {
    ListInterviewsInput,
    RequestInterviewRescheduleInput,
    SaveInterviewNoteInput,
    UpdateInterviewStatusInput,
    WebhookDebugQueryInput,
    WebhookDebugPublicQueryInput,
} from '../validators/interview.validator';

const interviewService = new InterviewService();
const interviewWebhookService = new InterviewWebhookService();

export const sendInterviewInvite = asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    const bookingUrl = await interviewService.sendInterviewInvite(req.params.applicationId, actorId);

    res.status(200).json({
        status: 'success',
        message: 'Interview invitation email sent',
        data: { bookingUrl },
    });
});

export const handleCalcomWebhook = asyncHandler(async (req: Request, res: Response) => {
    await interviewWebhookService.handleCalcomWebhook(req.body, req.headers);

    res.status(200).json({
        status: 'success',
        message: 'Webhook processed',
    });
});

export const getInterviews = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as unknown as ListInterviewsInput;

    // If user is a job manager (not admin/HR), filter to only interviews for their managed jobs
    const managerUserId = req.isJobManager ? req.user?.id : undefined;

    const result = await interviewService.listInterviews(filters, managerUserId);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

export const updateInterviewStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as UpdateInterviewStatusInput;
    const actorId = req.user?.id;
    const interview = await interviewService.updateInterviewStatus(req.params.id, status, actorId);

    res.status(200).json({
        status: 'success',
        data: { interview },
    });
});

export const requestInterviewReschedule = asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    const data = req.body as RequestInterviewRescheduleInput;
    const result = await interviewService.requestInterviewReschedule(req.params.id, data, actorId);

    res.status(200).json({
        status: 'success',
        message: 'Interview reschedule email sent successfully',
        data: result,
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
    const createdBy = req.user!.id;
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
