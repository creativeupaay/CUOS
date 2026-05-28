import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { LeadService } from '../services/lead.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerEmployee } from '../../partners/models/PartnerEmployee.model';
import type {
    CreateLeadInput,
    UpdateLeadInput,
    ListLeadsInput,
    AddActivityInput,
    AddMeetingInput,
} from '../validators/lead.validator';

const leadService = new LeadService();

const resolveRequesterPartnerId = async (req: Request): Promise<string | undefined> => {
    const user = req.user;
    if (!user) return undefined;
    if (user.role !== 'partner') return undefined;

    if (user.partnerId) {
        return String(user.partnerId);
    }

    if (user.isPartnerEmployee) {
        const employee = await PartnerEmployee.findById(user.id).select('partnerId').lean();
        if (!employee?.partnerId) {
            throw new AppError('Partner context not found', 403);
        }
        return String(employee.partnerId);
    }

    const partner = await Partner.findOne({ userId: user.id }).select('_id').lean();
    if (!partner?._id) {
        throw new AppError('Partner context not found', 403);
    }
    return String(partner._id);
};

/**
 * Create a new lead
 */
export const createLead = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const data: CreateLeadInput & { partnerId?: string } = req.body;
        const createdBy = new Types.ObjectId(req.user!.id);
        const requesterPartnerId = await resolveRequesterPartnerId(req);

        if (requesterPartnerId) {
            data.partnerId = requesterPartnerId;
        }

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
        const filters: ListLeadsInput & { partnerId?: string } = req.query as any;
        const requesterPartnerId = await resolveRequesterPartnerId(req);

        if (requesterPartnerId) {
            filters.partnerId = requesterPartnerId;
        }

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
        const data: UpdateLeadInput & { partnerId?: string | null } = req.body;
        const requesterPartnerId = await resolveRequesterPartnerId(req);

        if (requesterPartnerId) {
            data.partnerId = requesterPartnerId;
        }

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

        await leadService.deleteLead(id, {
            deletedBy: req.user?.id,
            reason: 'Lead delete requested from CRM module',
        });

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
        const createdBy = new Types.ObjectId(req.user!.id);

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
        const createdBy = new Types.ObjectId(req.user!.id);

        const lead = await leadService.addMeeting(id, data, createdBy);

        res.status(201).json({
            status: 'success',
            data: { lead },
        });
    }
);

/**
 * Upload lead document
 */
export const uploadLeadDocument = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        const singleFile = req.file as Express.Multer.File | undefined;
        const normalizedFiles = files.length > 0 ? files : singleFile ? [singleFile] : [];

        if (normalizedFiles.length === 0) {
            res.status(400).json({ status: 'fail', message: 'No file uploaded.' });
            return;
        }

        const lead = normalizedFiles.length === 1
            ? await leadService.uploadLeadDocument(
                id,
                normalizedFiles[0].buffer,
                normalizedFiles[0].originalname,
                normalizedFiles[0].mimetype,
                normalizedFiles[0].size,
                new Types.ObjectId(req.user!.id)
            )
            : await leadService.uploadLeadDocuments(
                id,
                normalizedFiles.map((file) => ({
                    buffer: file.buffer,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                })),
                new Types.ObjectId(req.user!.id)
            );

        res.status(201).json({
            status: 'success',
            data: { lead },
        });
    }
);

/**
 * Close lead — locks the lead; client creation is a separate step via the form.
 */
export const closeLead = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const userId = new Types.ObjectId(req.user!.id);

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
        const requesterPartnerId = await resolveRequesterPartnerId(req);

        const summary = await leadService.getPipelineSummary(
            assignedTo as string | undefined,
            requesterPartnerId
        );

        res.status(200).json({
            status: 'success',
            data: summary,
        });
    }
);
