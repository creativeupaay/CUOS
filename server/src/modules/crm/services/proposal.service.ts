import { Proposal, IProposal } from '../models/Proposal.model';
import { Lead } from '../models/Lead.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import type {
    CreateProposalInput,
    UpdateProposalInput,
    ListProposalsInput,
} from '../validators/proposal.validator';

export class ProposalService {
    /**
     * Create a new proposal
     */
    async createProposal(
        data: CreateProposalInput,
        createdBy: Types.ObjectId
    ): Promise<IProposal> {
        // Verify lead exists
        const lead = await Lead.findById(data.leadId);
        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        const proposal = await Proposal.create({
            ...data,
            createdBy,
        });

        // Auto-update lead stage to proposal-sent if currently at qualified or earlier
        const earlyStages = ['new', 'contacted', 'qualified'];
        if (earlyStages.includes(lead.stage)) {
            lead.stage = 'proposal-sent';
            await lead.save();
        }

        return proposal;
    }

    /**
     * Get all proposals with filters
     */
    async getProposals(filters: ListProposalsInput): Promise<{
        proposals: IProposal[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { leadId, status, search, page = 1, limit = 20 } = filters;

        const query: any = {};

        if (leadId) query.leadId = leadId;
        if (status) query.status = status;

        if (search) {
            query.$or = [{ title: { $regex: search, $options: 'i' } }];
        }

        const skip = (page - 1) * limit;

        const [proposals, total] = await Promise.all([
            Proposal.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('leadId', 'name company email stage')
                .populate('clientId', 'name email')
                .populate('createdBy', 'name email'),
            Proposal.countDocuments(query),
        ]);

        return {
            proposals,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get proposal by ID
     */
    async getProposalById(id: string): Promise<IProposal> {
        const proposal = await Proposal.findById(id)
            .populate('leadId', 'name company email stage')
            .populate('clientId', 'name email')
            .populate('createdBy', 'name email');

        if (!proposal) {
            throw new AppError('Proposal not found', 404);
        }

        return proposal;
    }

    /**
     * Update proposal
     */
    async updateProposal(
        id: string,
        data: UpdateProposalInput
    ): Promise<IProposal> {
        const proposal = await Proposal.findById(id);

        if (!proposal) {
            throw new AppError('Proposal not found', 404);
        }

        // Cannot edit accepted/rejected proposals
        if (['accepted', 'rejected'].includes(proposal.status)) {
            throw new AppError(
                `Cannot edit a proposal that is ${proposal.status}`,
                400
            );
        }

        // Use save() to trigger pre-save hook for total computation
        Object.assign(proposal, data);
        await proposal.save();

        return this.getProposalById(id);
    }

    /**
     * Delete proposal
     */
    async deleteProposal(id: string): Promise<void> {
        const proposal = await Proposal.findById(id);

        if (!proposal) {
            throw new AppError('Proposal not found', 404);
        }

        if (proposal.status === 'accepted') {
            throw new AppError('Cannot delete an accepted proposal', 400);
        }

        await Proposal.findByIdAndDelete(id);
    }

    /**
     * Update proposal status (send, accept, reject)
     */
    async updateStatus(
        id: string,
        newStatus: 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
    ): Promise<IProposal> {
        const proposal = await Proposal.findById(id);

        if (!proposal) {
            throw new AppError('Proposal not found', 404);
        }

        // Validate transitions
        const validTransitions: Record<string, string[]> = {
            draft: ['sent'],
            sent: ['viewed', 'accepted', 'rejected', 'expired'],
            viewed: ['accepted', 'rejected', 'expired'],
            accepted: [],
            rejected: [],
            expired: [],
        };

        if (!validTransitions[proposal.status]?.includes(newStatus)) {
            throw new AppError(
                `Cannot transition from "${proposal.status}" to "${newStatus}"`,
                400
            );
        }

        proposal.status = newStatus;

        if (newStatus === 'sent') {
            proposal.sentAt = new Date();
        }
        if (newStatus === 'accepted') {
            proposal.acceptedAt = new Date();

            // Update lead stage to negotiation if not already won
            const lead = await Lead.findById(proposal.leadId);
            if (lead && !['won', 'lost'].includes(lead.stage)) {
                lead.stage = 'negotiation';
                await lead.save();
            }
        }

        await proposal.save();

        return this.getProposalById(id);
    }
}
