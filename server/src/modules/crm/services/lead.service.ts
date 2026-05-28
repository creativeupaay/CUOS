import { Lead, ILead } from '../models/Lead.model';
import { Proposal } from '../models/Proposal.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import { uploadDocument } from '../../../utils/cloudinary.util';
import type {
    CreateLeadInput,
    UpdateLeadInput,
    ListLeadsInput,
    AddActivityInput,
    AddMeetingInput,
} from '../validators/lead.validator';
import {
    ArchiveDeleteOptions,
    DeletedRecordService,
    DeleteGraphResult,
    DeleteGraphService,
} from '../../archive';

const getGraphNodeIds = (
    graph: DeleteGraphResult,
    sourceModel: string,
    relationship?: string
): Types.ObjectId[] => {
    const ids = new Map<string, Types.ObjectId>();

    for (const node of graph.nodes) {
        if (node.sourceModel !== sourceModel) continue;
        if (relationship && node.relationship !== relationship) continue;

        for (const sourceId of node.sourceIds) {
            ids.set(sourceId.toString(), sourceId);
        }
    }

    return Array.from(ids.values());
};

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
        const { stage, source, priority, assignedTo, partnerId, search, page = 1, limit = 20 } = filters as ListLeadsInput & { partnerId?: string };

        const query: any = {};

        if (stage) query.stage = stage;
        if (source) query.source = source;
        if (priority) query.priority = priority;
        if (assignedTo) query.assignedTo = assignedTo;
        if (partnerId) query.partnerId = partnerId;

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
                .populate('partnerId', 'companyName contactPerson userId')
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
            .populate('partnerId', 'companyName contactPerson userId')
            .populate('createdBy', 'name email')
            .populate('convertedClientId', 'name email')
            .populate('activities.createdBy', 'name email')
            .populate('meetings.createdBy', 'name email')
            .populate('documents.uploadedBy', 'name email');

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
            .populate('partnerId', 'companyName contactPerson userId')
            .populate('createdBy', 'name email')
            .populate('documents.uploadedBy', 'name email');

        return updated!;
    }

    /**
     * Delete lead
     */
    async deleteLead(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const lead = await Lead.findById(id);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        if (lead.isLocked || lead.convertedClientId) {
            throw new AppError('Cannot delete a closed or converted lead', 400);
        }

        const linkedProposals = await Proposal.find({ leadId: lead._id });
        if (linkedProposals.some((proposal) => proposal.status === 'accepted')) {
            throw new AppError('Cannot delete a lead with an accepted proposal', 400);
        }

        const archiveBatchId = options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
        const graph = await DeleteGraphService.archiveGraph('Lead', lead._id, {
            archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Lead delete requested',
            metadata: {
                ...options.metadata,
                leadId: lead._id.toString(),
                partnerId: lead.partnerId?.toString(),
                linkedProposalIds: linkedProposals.map((proposal) => proposal._id.toString()),
            },
        });

        const proposalIds = getGraphNodeIds(graph, 'Proposal', 'lead_proposals');
        if (proposalIds.length > 0) {
            await Proposal.deleteMany(
                { _id: { $in: proposalIds } },
                options.session ? { session: options.session } : undefined
            );
        }

        await lead.deleteOne(options.session ? { session: options.session } : undefined);
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
     * Upload a lead document
     */
    async uploadLeadDocument(
        leadId: string,
        fileBuffer: Buffer,
        fileName: string,
        mimeType: string,
        fileSize: number,
        uploadedBy: Types.ObjectId
    ): Promise<ILead> {
        const lead = await Lead.findById(leadId);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        const cloudFolder = `crm/leads/${leadId}`;
        const uploadResult = await uploadDocument(fileBuffer, cloudFolder, fileName);

        lead.documents.push({
            name: fileName,
            url: uploadResult.url,
            cloudinaryId: uploadResult.cloudinaryId,
            size: uploadResult.size || fileSize,
            mimeType,
            uploadedAt: new Date(),
            uploadedBy,
        });

        await lead.save();

        return this.getLeadById(leadId);
    }

    /**
     * Upload multiple lead documents
     */
    async uploadLeadDocuments(
        leadId: string,
        files: Array<{
            buffer: Buffer;
            originalname: string;
            mimetype: string;
            size: number;
        }>,
        uploadedBy: Types.ObjectId
    ): Promise<ILead> {
        const lead = await Lead.findById(leadId);

        if (!lead) {
            throw new AppError('Lead not found', 404);
        }

        const cloudFolder = `crm/leads/${leadId}`;

        for (const file of files) {
            const uploadResult = await uploadDocument(file.buffer, cloudFolder, file.originalname);

            lead.documents.push({
                name: file.originalname,
                url: uploadResult.url,
                cloudinaryId: uploadResult.cloudinaryId,
                size: uploadResult.size || file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date(),
                uploadedBy,
            });
        }

        await lead.save();

        return this.getLeadById(leadId);
    }

    /**
     * Close lead — locks the lead so the user can create a client from it.
     * Client creation is now a separate step done via the client form page.
     */
    async closeLead(leadId: string, _userId: Types.ObjectId): Promise<{ lead: ILead }> {
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

        // Lock the lead and set stage to closed — client will be created separately
        lead.stage = 'closed';
        lead.isLocked = true;
        lead.closedAt = new Date();
        await lead.save();

        return { lead: await this.getLeadById(leadId) };
    }

    /**
     * Link a converted client back to this lead
     * Called after the client is created from the lead form
     */
    async linkClientToLead(leadId: string, clientId: Types.ObjectId): Promise<void> {
        const lead = await Lead.findById(leadId);
        if (!lead) return;

        // Find all proposals linked to this lead and update them
        const proposals = await Proposal.find({ leadId: lead._id });
        const proposalIds = proposals.map((p) => p._id as Types.ObjectId);

        if (proposalIds.length > 0) {
            await Proposal.updateMany(
                { _id: { $in: proposalIds } },
                { $set: { clientId } }
            );
        }

        lead.convertedClientId = clientId;
        await lead.save();
    }

    /**
     * Pipeline summary — count leads per stage
     */
    async getPipelineSummary(assignedTo?: string, partnerId?: string): Promise<{
        stages: { stage: string; count: number; totalValue: number }[];
        totalLeads: number;
        totalValue: number;
    }> {
        const match: any = {};
        if (assignedTo) match.assignedTo = new Types.ObjectId(assignedTo);
        if (partnerId) match.partnerId = new Types.ObjectId(partnerId);

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
