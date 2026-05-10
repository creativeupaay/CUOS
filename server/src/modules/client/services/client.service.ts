import { Client, IClient } from '../models/Client.model';
import { IProject } from '../../project/models/Project.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { uploadDocument } from '../../../utils/cloudinary.util';
import type { CreateClientInput, UpdateClientInput, ListClientsInput, AddClientActivityInput } from '../validators/client.validator';
import { sendClientOnboardingEmail } from '../../../services/email.service';
import { env } from '../../../config/env.config';
import { notificationService } from '../../notification/services/notification.service';
import { logger } from "../../../utils/logger";
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

export class ClientService {
    private isAdminRole(role?: string): boolean {
        const normalizedRole = role?.toLowerCase();
        return normalizedRole === 'admin' || normalizedRole === 'super-admin' || normalizedRole === 'super_admin';
    }

    private assertPartnerClientAccess(client: IClient, requesterPartnerId?: string): void {
        if (!requesterPartnerId) {
            return;
        }

        // Handle both populated and non-populated partnerId
        const clientPartnerId = client.partnerId
            ? (client.partnerId as any)._id?.toString() || client.partnerId.toString()
            : null;

        if (!clientPartnerId || clientPartnerId !== requesterPartnerId) {
            throw new AppError('You do not have access to this client', 403);
        }
    }

    /**
     * Create a new client.
     * Handles optional lead-linking and optional onboarding email dispatch.
     */
    async createClient(
        data: CreateClientInput & { partnerId?: string },
        createdBy: Types.ObjectId,
        context?: { requesterRole?: string; requesterPartnerId?: string }
    ): Promise<IClient> {
        const { sendOnboardingForm, leadId, partnerId, ...clientData } = data as any;

        // Build proposal linkage if this client comes from a lead
        let proposalIds: Types.ObjectId[] = [];
        let leadActivities: any[] = [];
        let leadDocuments: any[] = [];
        let leadLinks: any[] = [];

        if (leadId) {
            const { Lead } = await import('../../crm/models/Lead.model');
            const { Proposal } = await import('../../crm/models/Proposal.model');

            const lead = await Lead.findById(leadId);
            if (lead) {
                const proposals = await Proposal.find({ leadId: lead._id });
                proposalIds = proposals.map((p) => p._id as Types.ObjectId);

                // Copy activities from the lead
                leadActivities = lead.activities.map((act) => ({
                    type: act.type,
                    description: act.description,
                    date: act.date,
                    createdBy: act.createdBy,
                }));

                // Copy lead documents to client record
                leadDocuments = (lead.documents || []).map((doc) => ({
                    name: doc.name,
                    url: doc.url,
                    cloudinaryId: doc.cloudinaryId,
                    size: doc.size,
                    mimeType: doc.mimeType,
                    uploadedAt: doc.uploadedAt,
                    uploadedBy: doc.uploadedBy,
                }));

                // Copy lead links to client record
                leadLinks = (lead.links || []).map((link) => ({
                    name: link.name,
                    url: link.url,
                    addedAt: link.addedAt,
                }));
            }
        }

        const client = await Client.create({
            ...clientData,
            leadId: leadId ? new Types.ObjectId(leadId) : undefined,
            partnerId: partnerId ? new Types.ObjectId(partnerId) : undefined,
            proposalIds,
            activities: leadActivities,
            documents: leadDocuments,
            links: leadLinks,
            createdBy,
        });

        // Link proposals back to the new client and mark lead as converted
        if (leadId) {
            const { Lead } = await import('../../crm/models/Lead.model');
            const { Proposal } = await import('../../crm/models/Proposal.model');

            if (proposalIds.length > 0) {
                await Proposal.updateMany(
                    { _id: { $in: proposalIds } },
                    { $set: { clientId: client._id } }
                );
            }

            await Lead.findByIdAndUpdate(leadId, {
                $set: { convertedClientId: client._id },
            });
        }

        // Optionally send onboarding form email
        if (sendOnboardingForm && client.email) {
            await this.issueOnboardingToken(client._id.toString(), client.email, client.name);
        }

        return this.getClientById(client._id.toString(), context);
    }

    /**
     * Get all clients with optional filters
     */
    async getClients(
        filters: ListClientsInput & {
            partnerId?: string;
            requesterRole?: string;
            requesterPartnerId?: string;
        }
    ): Promise<{ clients: IClient[]; total: number; page: number; totalPages: number }> {
        const {
            status,
            search,
            partnerId,
            page = 1,
            limit = 20,
            requesterRole,
            requesterPartnerId,
        } = filters;

        const query: any = {};
        const isAdmin = this.isAdminRole(requesterRole);

        if (status) {
            query.status = status;
        }

        // Partners are always restricted to their own clients.
        if (requesterPartnerId) {
            query.partnerId = new Types.ObjectId(requesterPartnerId);
        } else if (partnerId && isAdmin) {
            // Optional explicit partner filter for admin views.
            query.partnerId = new Types.ObjectId(partnerId);
        } else if (!isAdmin) {
            // Non-admin employees should not see partner-owned clients.
            query.partnerId = { $exists: false };
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [clients, total] = await Promise.all([
            Client.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('createdBy', 'name email')
                .populate('partnerId', 'companyName contactPerson email'),
            Client.countDocuments(query),
        ]);

        return {
            clients,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get client by ID
     */
    async getClientById(
        id: string,
        context?: { requesterRole?: string; requesterPartnerId?: string }
    ): Promise<IClient> {
        const client = await Client.findById(id)
            .populate('createdBy', 'name email')
            .populate('partnerId', 'companyName contactPerson email')
            .populate('activities.createdBy', 'name email')
            .populate('documents.uploadedBy', 'name email');

        if (!client) {
            throw new AppError('Client not found', 404);
        }

        this.assertPartnerClientAccess(client, context?.requesterPartnerId);

        if (!context?.requesterPartnerId && !this.isAdminRole(context?.requesterRole) && client.partnerId) {
            throw new AppError('You do not have access to this client', 403);
        }

        return client;
    }

    /**
     * Update client
     */
    async updateClient(
        id: string,
        data: UpdateClientInput,
        context?: { requesterRole?: string; requesterPartnerId?: string }
    ): Promise<IClient> {
        const existing = await Client.findById(id);

        if (!existing) {
            throw new AppError('Client not found', 404);
        }

        this.assertPartnerClientAccess(existing, context?.requesterPartnerId);

        if (!context?.requesterPartnerId && !this.isAdminRole(context?.requesterRole) && existing.partnerId) {
            throw new AppError('You do not have access to this client', 403);
        }

        const client = await Client.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        )
            .populate('createdBy', 'name email')
            .populate('partnerId', 'companyName contactPerson email');

        if (!client) {
            throw new AppError('Client not found', 404);
        }

        return client;
    }

    /**
     * Upload one or more documents for a client.
     */
    async uploadClientDocuments(
        clientId: string,
        files: Array<{
            buffer: Buffer;
            originalname: string;
            mimetype: string;
            size: number;
        }>,
        uploadedBy: Types.ObjectId,
        context?: { requesterRole?: string; requesterPartnerId?: string }
    ): Promise<IClient> {
        const client = await Client.findById(clientId);

        if (!client) {
            throw new AppError('Client not found', 404);
        }

        this.assertPartnerClientAccess(client, context?.requesterPartnerId);

        if (!context?.requesterPartnerId && !this.isAdminRole(context?.requesterRole) && client.partnerId) {
            throw new AppError('You do not have access to this client', 403);
        }

        const cloudFolder = `crm/clients/${clientId}`;

        for (const file of files) {
            const uploadResult = await uploadDocument(file.buffer, cloudFolder, file.originalname);

            client.documents.push({
                name: file.originalname,
                url: uploadResult.url,
                cloudinaryId: uploadResult.cloudinaryId,
                size: uploadResult.size || file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date(),
                uploadedBy,
            });
        }

        await client.save();

        return this.getClientById(clientId, context);
    }

    /**
     * Delete client — permanently removes from database
     */
    async deleteClient(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const client = await Client.findById(id);

        if (!client) {
            throw new AppError('Client not found', 404);
        }

        const archiveBatchId = options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
        const graph = await DeleteGraphService.archiveGraph('Client', client._id, {
            archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Client delete requested',
            metadata: {
                ...options.metadata,
                clientId: client._id.toString(),
                leadId: client.leadId?.toString(),
                proposalIds: client.proposalIds?.map((proposalId) => proposalId.toString()) ?? [],
                partnerId: client.partnerId?.toString(),
            },
        });

        const projectIds = getGraphNodeIds(graph, 'Project', 'client_projects');
        const { deleteProject } = await import('../../project/services/project.service');
        for (const projectId of projectIds) {
            await deleteProject(projectId.toString(), {
                archiveBatchId,
                deletedBy: options.deletedBy?.toString(),
                reason: options.reason ?? 'Client delete requested',
            });
        }

        const revenueIds = getGraphNodeIds(graph, 'Revenue', 'client_revenue');
        const { RevenueService } = await import('../../finance/services/revenue.service');
        for (const revenueId of revenueIds) {
            await RevenueService.delete(revenueId, {
                ...options,
                archiveBatchId,
                skipArchive: true,
                metadata: {
                    ...options.metadata,
                    clientId: client._id.toString(),
                    linkedFrom: 'Client',
                },
            });
        }

        await client.deleteOne(options.session ? { session: options.session } : undefined);
    }

    /**
     * Get client's projects
     */
    async getClientProjects(
        clientId: string,
        context?: { requesterRole?: string; requesterPartnerId?: string }
    ): Promise<IProject[]> {
        const client = await this.getClientById(clientId, context);
        const { Project } = await import('../../project/models/Project.model');

        // Use lean() for performance as we don't need Mongoose document methods here
        const projectQuery: any = { clientId: client._id, isArchived: false };

        // Partners can only see projects they created.
        if (context?.requesterPartnerId) {
            projectQuery.partnerId = new Types.ObjectId(context.requesterPartnerId);
        }

        const projects = await Project.find(projectQuery)
            .sort({ createdAt: -1 })
            .select('-documents') // Exclude documents for list view
            .lean();

        return projects as any; // Cast to any to avoid complex type issues with lean() + dynamic import, but efficiently fetched
    }

    /**
     * Add activity to client
     */
    async addActivity(
        clientId: string,
        data: AddClientActivityInput,
        createdBy: Types.ObjectId,
        context?: { requesterRole?: string; requesterPartnerId?: string }
    ): Promise<IClient> {
        const client = await Client.findById(clientId);

        if (!client) {
            throw new AppError('Client not found', 404);
        }

        // Check access permissions
        this.assertPartnerClientAccess(client, context?.requesterPartnerId);

        if (!context?.requesterPartnerId && !this.isAdminRole(context?.requesterRole) && client.partnerId) {
            throw new AppError('You do not have access to this client', 403);
        }

        if (!client.activities) {
            client.activities = [];
        }

        client.activities.push({
            ...data,
            date: data.date ? new Date(data.date) : new Date(),
            createdBy,
        } as any);

        await client.save();

        return this.getClientById(clientId, context);
    }

    // ================================================================
    // ONBOARDING FORM
    // ================================================================

    /**
     * Generate a secure token, persist it on the client, and send the email.
     * Can be called standalone (e.g. resend) or from createClient.
     */
    async issueOnboardingToken(
        clientId: string,
        email: string,
        clientName: string
    ): Promise<{ token: string; expiresAt: Date }> {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await Client.findByIdAndUpdate(clientId, {
            $set: {
                onboardingToken: token,
                onboardingTokenExpiry: expiresAt,
                onboardingStatus: 'pending',
            },
        });

        const formUrl = `${env.FRONTEND_URL}/onboarding/${token}`;

        try {
            await sendClientOnboardingEmail({ to: email, clientName, formUrl, expiresAt });
        } catch (err) {
            // Email failure should not block the response — log and continue
            logger.error({ context: err }, '[Onboarding Email] Failed to send:');
        }

        return { token, expiresAt };
    }

    /**
     * Look up a client by its onboarding token.
     * Returns only the fields the public form needs; throws if expired.
     */
    async getClientByOnboardingToken(token: string): Promise<IClient> {
        const client = await Client.findOne({ onboardingToken: token });

        if (!client) {
            throw new AppError('Invalid or expired onboarding link', 404);
        }

        if (client.onboardingStatus === 'submitted') {
            throw new AppError('This onboarding form has already been submitted', 400);
        }

        if (client.onboardingTokenExpiry && client.onboardingTokenExpiry < new Date()) {
            throw new AppError('This onboarding link has expired', 400);
        }

        return client;
    }

    /**
     * Accept form data from the client, update the record, notify admins.
     */
    async submitOnboardingForm(
        token: string,
        formData: Omit<UpdateClientInput, 'status'>
    ): Promise<IClient> {
        const client = await this.getClientByOnboardingToken(token);

        // Update with submitted data (strip sensitive internal fields the form shouldn't touch)
        const allowedFields: (keyof typeof formData)[] = [
            'name',
            'companyName',
            'email',
            'phone',
            'otherPhones',
            'address',
            'billingDetails',
            'contacts',
            'gstNumber',
            'vatNumber',
            'customDetails',
            'notes',
            'registrationType',
        ];

        const safeUpdate: any = { onboardingStatus: 'submitted', onboardingSubmittedAt: new Date() };
        for (const key of allowedFields) {
            if ((formData as any)[key] !== undefined) {
                safeUpdate[key] = (formData as any)[key];
            }
        }

        const updated = await Client.findByIdAndUpdate(
            client._id,
            { $set: safeUpdate },
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!updated) {
            throw new AppError('Client not found', 404);
        }

        // Notify superadmins about client onboarding form submission
        notificationService.notifySuperadmins({
            type: 'client_onboarding',
            title: 'Client Onboarding Completed',
            message: `${updated.name || updated.companyName || 'A client'} has completed their onboarding form.`,
            link: '/crm/clients',
            metadata: {
                clientId: updated._id.toString(),
                clientName: updated.name || updated.companyName,
                submittedAt: updated.onboardingSubmittedAt?.toISOString(),
            },
        });

        // Notify all admins
        try {
            const { User } = await import('../../auth/models/User.model');
            const admins = await User.find({
                role: { $in: ['super-admin', 'admin'] },
                isActive: true,
            }).select('email');

            const adminEmails = admins.map((u: any) => u.email).filter(Boolean);
            const { sendOnboardingSubmittedNotification } = await import('../../../services/email.service');

            await sendOnboardingSubmittedNotification({
                adminEmails,
                clientName: updated.name,
                clientId: updated._id.toString(),
                dashboardUrl: `${env.FRONTEND_URL}/crm/clients/${updated._id}`,
            });
        } catch (err) {
            logger.error({ context: err }, '[Onboarding Notification] Failed to notify admins:');
        }

        return updated;
    }
}
