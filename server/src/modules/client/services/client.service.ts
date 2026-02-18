import { Client, IClient } from '../models/Client.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import type { CreateClientInput, UpdateClientInput, ListClientsInput } from '../validators/client.validator';

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
        const client = await Client.findById(id).populate('createdBy', 'name email');

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
    async getClientProjects(clientId: string): Promise<any[]> {
        const { Project } = await import('../../project/models/Project.model');

        const projects = await Project.find({ clientId, isArchived: false })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email')
            .select('-documents'); // Exclude documents for list view

        return projects;
    }
}
