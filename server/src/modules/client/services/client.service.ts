import { Client, IClient } from '../models/Client.model';
import { IProject } from '../../project/models/Project.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import type { CreateClientInput, UpdateClientInput, ListClientsInput, AddClientActivityInput } from '../validators/client.validator';

export class ClientService {
    /**
     * Create a new client
     */
    async createClient(data: CreateClientInput, createdBy: Types.ObjectId): Promise<IClient> {
        const client = await Client.create({
            ...data,
            createdBy,
        });

        return client;
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
     * Delete client (soft delete by archiving)
     */
    async deleteClient(id: string): Promise<void> {
        const client = await Client.findByIdAndUpdate(
            id,
            { $set: { status: 'archived' } },
            { new: true }
        );

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
}
