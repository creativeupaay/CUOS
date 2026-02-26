import { Request, Response, NextFunction } from 'express';
import { ClientService } from '../services/client.service';
import asyncHandler from '../../../utils/asyncHandler';
import type { CreateClientInput, UpdateClientInput, GetClientInput, ListClientsInput, AddClientActivityInput } from '../validators/client.validator';

const clientService = new ClientService();

/**
 * Create a new client
 */
export const createClient = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const data: CreateClientInput = req.body;
    const createdBy = (req.user as any).id;

    const client = await clientService.createClient(data, createdBy);

    res.status(201).json({
        status: 'success',
        data: { client },
    });
});

/**
 * Get all clients
 */
export const getClients = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const filters: ListClientsInput = req.query as any;

    const result = await clientService.getClients(filters);

    res.status(200).json({
        status: 'success',
        data: result,
    });
});

/**
 * Get client by ID
 */
export const getClient = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id }: GetClientInput = req.params as any;

    const client = await clientService.getClientById(id);

    res.status(200).json({
        status: 'success',
        data: { client },
    });
});

/**
 * Update client
 */
export const updateClient = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const data: UpdateClientInput = req.body;

    const client = await clientService.updateClient(id, data);

    res.status(200).json({
        status: 'success',
        data: { client },
    });
});

/**
 * Delete client (archive)
 */
export const deleteClient = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    await clientService.deleteClient(id);

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

/**
 * Get client's projects
 */
export const getClientProjects = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const projects = await clientService.getClientProjects(id);

    res.status(200).json({
        status: 'success',
        data: { projects },
    });
});

/**
 * Add activity to client
 */
export const addActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const data: AddClientActivityInput = req.body;
    const createdBy = (req.user as any).id;

    const client = await clientService.addActivity(id, data, createdBy);

    res.status(200).json({
        status: 'success',
        data: { client },
    });
});
