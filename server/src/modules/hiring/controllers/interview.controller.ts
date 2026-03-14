import { Request, Response } from 'express';
import asyncHandler from '../../../utils/asyncHandler';
import { InterviewService } from '../services/interview.service';
import type {
    ListInterviewsInput,
    SaveInterviewNoteInput,
    UpdateInterviewStatusInput,
} from '../validators/interview.validator';

const interviewService = new InterviewService();

export const sendInterviewInvite = asyncHandler(async (req: Request, res: Response) => {
    const bookingUrl = await interviewService.sendInterviewInvite(req.params.applicationId);

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
    const interview = await interviewService.updateInterviewStatus(req.params.id, status);

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
