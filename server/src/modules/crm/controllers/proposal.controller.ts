import { Request, Response, NextFunction } from 'express';
import { ProposalService } from '../services/proposal.service';
import asyncHandler from '../../../utils/asyncHandler';
import type {
    CreateProposalInput,
    UpdateProposalInput,
    ListProposalsInput,
    UpdateStatusInput,
} from '../validators/proposal.validator';

const proposalService = new ProposalService();

/**
 * Create a new proposal
 */
export const createProposal = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const data: CreateProposalInput = req.body;
        const createdBy = (req.user as any).id;

        const proposal = await proposalService.createProposal(data, createdBy);

        res.status(201).json({
            status: 'success',
            data: { proposal },
        });
    }
);

/**
 * Get all proposals
 */
export const getProposals = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const filters: ListProposalsInput = req.query as any;

        const result = await proposalService.getProposals(filters);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    }
);

/**
 * Get proposal by ID
 */
export const getProposal = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;

        const proposal = await proposalService.getProposalById(id);

        res.status(200).json({
            status: 'success',
            data: { proposal },
        });
    }
);

/**
 * Update proposal
 */
export const updateProposal = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const data: UpdateProposalInput = req.body;

        const proposal = await proposalService.updateProposal(id, data);

        res.status(200).json({
            status: 'success',
            data: { proposal },
        });
    }
);

/**
 * Delete proposal
 */
export const deleteProposal = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;

        await proposalService.deleteProposal(id);

        res.status(204).json({
            status: 'success',
            data: null,
        });
    }
);

/**
 * Update proposal status
 */
export const updateStatus = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        const { status }: UpdateStatusInput = req.body;

        const proposal = await proposalService.updateStatus(id, status);

        res.status(200).json({
            status: 'success',
            data: { proposal },
        });
    }
);
