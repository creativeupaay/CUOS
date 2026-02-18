import { Lead, ILead } from '../models/Lead.model';
import { Client } from '../../client/models/Client.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import type {
    CreateLeadInput,
    UpdateLeadInput,
    ListLeadsInput,
    AddActivityInput,
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
            .populate('activities.createdBy', 'name email');

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

        // Prevent editing converted leads
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

        if (lead.convertedClientId) {
            throw new AppError('Cannot delete a converted lead', 400);
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
     * Convert lead to client
     */
    async convertToClient(leadId: string, userId: Types.ObjectId): Promise<{
        lead: ILead;
        client: any;
    }> {
        const lead = await Lead.findById(leadId);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        if (lead.convertedClientId) {
            throw new AppError('Lead is already converted', 400);
        }

        if (lead.stage !== 'won') {
            throw new AppError('Lead must be in "won" stage to convert', 400);
        }

        // Create client from lead data
        const client = await Client.create({
            name: lead.company || lead.name,
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
            notes: `Converted from lead. Estimated value: ${lead.currency} ${lead.estimatedValue || 0}`,
            createdBy: userId,
        });

        // Update lead with converted client reference
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
            'won',
            'lost',
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
