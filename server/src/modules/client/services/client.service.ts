import { Client, IClient } from '../models/Client.model';
import { IProject } from '../../project/models/Project.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import crypto from 'crypto';
import type { CreateClientInput, UpdateClientInput, ListClientsInput, AddClientActivityInput } from '../validators/client.validator';
import { sendClientOnboardingEmail } from '../../../services/email.service';
import { env } from '../../../config/env.config';

export class ClientService {
    /**
     * Create a new client.
     * Handles optional lead-linking and optional onboarding email dispatch.
     */
    async createClient(
        data: CreateClientInput,
        createdBy: Types.ObjectId
    ): Promise<IClient> {
        const { sendOnboardingForm, leadId, ...clientData } = data as any;

        // Build proposal linkage if this client comes from a lead
        let proposalIds: Types.ObjectId[] = [];
        let leadActivities: any[] = [];

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
            }
        }

        const client = await Client.create({
            ...clientData,
            leadId: leadId ? new Types.ObjectId(leadId) : undefined,
            proposalIds,
            activities: leadActivities,
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

        return this.getClientById(client._id.toString());
    }

    /**
     * Get all clients with optional filters
     */
    async getClients(filters: ListClientsInput): Promise<{ clients: IClient[]; total: number; page: number; totalPages: number }> {
        const { status, search, page = 1, limit = 20 } = filters;

        const query: any = {};

        if (status) {
            query.status = status;
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
                .populate('createdBy', 'name email'),
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
    async getClientById(id: string): Promise<IClient> {
        const client = await Client.findById(id)
            .populate('createdBy', 'name email')
            .populate('activities.createdBy', 'name email');

        if (!client) {
            throw new AppError('Client not found', 404);
        }

        return client;
    }

    /**
     * Update client
     */
    async updateClient(id: string, data: UpdateClientInput): Promise<IClient> {
        const client = await Client.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!client) {
            throw new AppError('Client not found', 404);
        }

        return client;
    }

    /**
     * Delete client — permanently removes from database
     */
    async deleteClient(id: string): Promise<void> {
        const client = await Client.findByIdAndDelete(id);

        if (!client) {
            throw new AppError('Client not found', 404);
        }
    }

    /**
     * Get client's projects
     */
    async getClientProjects(clientId: string): Promise<IProject[]> {
        const { Project } = await import('../../project/models/Project.model');

        // Use lean() for performance as we don't need Mongoose document methods here
        const projects = await Project.find({ clientId, isArchived: false })
            .sort({ createdAt: -1 })
            .select('-documents') // Exclude documents for list view
            .lean();

        return projects as any; // Cast to any to avoid complex type issues with lean() + dynamic import, but efficiently fetched
    }

    /**
     * Add activity to client
     */
    async addActivity(clientId: string, data: AddClientActivityInput, createdBy: Types.ObjectId): Promise<IClient> {
        const client = await Client.findById(clientId);

        if (!client) {
            throw new AppError('Client not found', 404);
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

        return this.getClientById(clientId);
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
            console.error('[Onboarding Email] Failed to send:', err);
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
            console.error('[Onboarding Notification] Failed to notify admins:', err);
        }

        return updated;
    }
}
