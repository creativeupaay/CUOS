import { Lead, ILead } from '../models/Lead.model';
import { Client } from '../../client/models/Client.model';
import { Proposal } from '../models/Proposal.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import type {
    CreateLeadInput,
    UpdateLeadInput,
    ListLeadsInput,
    AddActivityInput,
    AddMeetingInput,
} from '../validators/lead.validator';

export class LeadService {
    /**
     * Create a new lead
     */
    async createLead(data: CreateLeadInput, createdBy: Types.ObjectId): Promise<ILead> {
        const lead = await Lead.create({
            ...data,
            createdBy,
        });
        return lead;
    }

    /**
     * Get all leads with filters
     */
    async getLeads(filters: ListLeadsInput): Promise<{
        leads: ILead[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { stage, source, priority, assignedTo, search, page = 1, limit = 20 } = filters;

        const query: any = {};

        if (stage) query.stage = stage;
        if (source) query.source = source;
        if (priority) query.priority = priority;
        if (assignedTo) query.assignedTo = assignedTo;

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { tags: { $in: [new RegExp(search, 'i')] } },
            ];
        }

        const skip = (page - 1) * limit;

        const [leads, total] = await Promise.all([
            Lead.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('assignedTo', 'name email')
                .populate('createdBy', 'name email'),
            Lead.countDocuments(query),
        ]);

        return {
            leads,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get lead by ID
     */
    async getLeadById(id: string): Promise<ILead> {
        const lead = await Lead.findById(id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .populate('convertedClientId', 'name email')
            .populate('activities.createdBy', 'name email')
            .populate('meetings.createdBy', 'name email');

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }
        return lead;
    }

    /**
     * Update lead
     */
    async updateLead(id: string, data: UpdateLeadInput): Promise<ILead> {
        const lead = await Lead.findById(id);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        // Prevent editing locked (closed) leads
        if (lead.isLocked) {
            throw new AppError('Cannot edit a closed/locked lead', 400);
        }

        // Prevent editing converted leads (backward compat)
        if (lead.convertedClientId) {
            throw new AppError('Cannot edit a converted lead', 400);
        }

        const updated = await Lead.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        )
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');

        return updated!;
    }

    /**
     * Delete lead
     */
    async deleteLead(id: string): Promise<void> {
        const lead = await Lead.findById(id);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        if (lead.isLocked || lead.convertedClientId) {
            throw new AppError('Cannot delete a closed or converted lead', 400);
        }

        await Lead.findByIdAndDelete(id);
    }

    /**
     * Add activity to lead
     */
    async addActivity(
        leadId: string,
        data: AddActivityInput,
        createdBy: Types.ObjectId
    ): Promise<ILead> {
        const lead = await Lead.findById(leadId);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        lead.activities.push({
            ...data,
            date: data.date ? new Date(data.date) : new Date(),
            createdBy,
        });

        await lead.save();

        return this.getLeadById(leadId);
    }

    /**
     * Add meeting to lead
     */
    async addMeeting(
        leadId: string,
        data: AddMeetingInput,
        createdBy: Types.ObjectId
    ): Promise<ILead> {
        const lead = await Lead.findById(leadId);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        lead.meetings.push({
            ...data,
            date: data.date ? new Date(data.date) : new Date(),
            createdBy,
        });

        await lead.save();

        return this.getLeadById(leadId);
    }

    /**
     * Close lead — auto-creates client, locks lead, links proposals
     */
    async closeLead(leadId: string, userId: Types.ObjectId): Promise<{
        lead: ILead;
        client: any;
    }> {
        const lead = await Lead.findById(leadId);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        if (lead.isLocked) {
            throw new AppError('Lead is already closed', 400);
        }

        if (lead.convertedClientId) {
            throw new AppError('Lead is already converted to a client', 400);
        }

        // Find all proposals linked to this lead
        const proposals = await Proposal.find({ leadId: lead._id });
        const proposalIds = proposals.map((p) => p._id as Types.ObjectId);

        // Create client from lead data
        const client = await Client.create({
            name: lead.company || lead.name,
            companyName: lead.company,
            email: lead.email,
            phone: lead.phone,
            contacts: [
                {
                    name: lead.name,
                    email: lead.email,
                    phone: lead.phone,
                    role: 'Primary Contact',
                    isPrimary: true,
                },
            ],
            billingDetails: {
                currency: lead.currency,
            },
            leadId: lead._id,
            proposalIds,
            activities: lead.activities.map((act) => ({
                type: act.type,
                description: act.description,
                date: act.date,
                createdBy: act.createdBy,
            })),
            notes: `Converted from lead. Estimated value: ${lead.currency} ${lead.estimatedValue || 0}`,
            createdBy: userId,
        });

        // Update all proposals to reference the new client
        if (proposalIds.length > 0) {
            await Proposal.updateMany(
                { _id: { $in: proposalIds } },
                { $set: { clientId: client._id } }
            );
        }

        // Lock the lead and set stage to closed
        lead.stage = 'closed';
        lead.isLocked = true;
        lead.closedAt = new Date();
        lead.convertedClientId = client._id as Types.ObjectId;
        await lead.save();

        return {
            lead: await this.getLeadById(leadId),
            client,
        };
    }

    /**
     * Pipeline summary — count leads per stage
     */
    async getPipelineSummary(assignedTo?: string): Promise<{
        stages: { stage: string; count: number; totalValue: number }[];
        totalLeads: number;
        totalValue: number;
    }> {
        const match: any = {};
        if (assignedTo) match.assignedTo = new Types.ObjectId(assignedTo);

        const pipeline = await Lead.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$stage',
                    count: { $sum: 1 },
                    totalValue: { $sum: { $ifNull: ['$estimatedValue', 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Ensure all stages appear even with 0 count
        const allStages = [
            'new',
            'contacted',
            'qualified',
            'proposal-sent',
            'negotiation',
            'closed',
            'pending',
            'lead-lost',
            'follow-up',
        ];
        const stageMap = new Map(pipeline.map((s: any) => [s._id, s]));
        const stages = allStages.map((stage) => ({
            stage,
            count: (stageMap.get(stage) as any)?.count || 0,
            totalValue: (stageMap.get(stage) as any)?.totalValue || 0,
        }));

        const totalLeads = stages.reduce((sum, s) => sum + s.count, 0);
        const totalValue = stages.reduce((sum, s) => sum + s.totalValue, 0);

        return { stages, totalLeads, totalValue };
    }
}
