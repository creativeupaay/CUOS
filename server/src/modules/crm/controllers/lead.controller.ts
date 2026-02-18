import { Request, Response, NextFunction } from 'express';
import { LeadService } from '../services/lead.service';
import asyncHandler from '../../../utils/asyncHandler';
import type {
    CreateLeadInput,
    UpdateLeadInput,
    ListLeadsInput,
    AddActivityInput,
    AddMeetingInput,
} from '../validators/lead.validator';

const leadService = new LeadService();

/**
 * Create a new lead
 */
export const createLead = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const data: CreateLeadInput = req.body;
        const createdBy = (req.user as any).id;

        const lead = await leadService.createLead(data, createdBy);

        res.status(201).json({
            status: 'success',
            data: { lead },
        });
    }
);

/**
 * Get all leads
 */
export const getLeads = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const filters: ListLeadsInput = req.query as any;

        const result = await leadService.getLeads(filters);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    }
);

/**
 * Get lead by ID
 */
export const getLead = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;

        const lead = await leadService.getLeadById(id);

        res.status(200).json({
            status: 'success',
            data: { lead },
        });
    }
);

/**
 * Update lead
 */
export const updateLead = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const data: UpdateLeadInput = req.body;

        const lead = await leadService.updateLead(id, data);

        res.status(200).json({
            status: 'success',
            data: { lead },
        });
    }
);

/**
 * Delete lead
 */
export const deleteLead = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;

        await leadService.deleteLead(id);

        res.status(204).json({
            status: 'success',
            data: null,
        });
    }
);

/**
 * Add activity to lead
 */
export const addActivity = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const data: AddActivityInput = req.body;
        const createdBy = (req.user as any).id;

        const lead = await leadService.addActivity(id, data, createdBy);

        res.status(201).json({
            status: 'success',
            data: { lead },
        });
    }
);

/**
 * Add meeting to lead
 */
export const addMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const data: AddMeetingInput = req.body;
        const createdBy = (req.user as any).id;

        const lead = await leadService.addMeeting(id, data, createdBy);

        res.status(201).json({
            status: 'success',
            data: { lead },
        });
    }
);

/**
 * Close lead — auto-creates client, locks lead
 */
export const closeLead = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const userId = (req.user as any).id;

        const result = await leadService.closeLead(id, userId);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    }
);

/**
 * Get pipeline summary
 */
export const getPipelineSummary = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { assignedTo } = req.query;

        const summary = await leadService.getPipelineSummary(
            assignedTo as string | undefined
        );

        res.status(200).json({
            status: 'success',
            data: summary,
        });
    }
);
