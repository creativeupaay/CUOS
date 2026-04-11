import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ClientService } from '../services/client.service';
import { Client } from '../models/Client.model';
import asyncHandler from '../../../utils/asyncHandler';
import type { CreateClientInput, UpdateClientInput, GetClientInput, ListClientsInput, AddClientActivityInput } from '../validators/client.validator';
import { env } from '../../../config/env.config';
import { sendClientPortalAccessEmail } from '../../../services/email.service';

const clientService = new ClientService();

/**
 * Create a new client
 */
export const createClient = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const data: CreateClientInput & { partnerId?: string } = req.body;
    const createdBy = (req.user as any).id;

    const client = await clientService.createClient(
        {
            ...data,
            // Partner requests are always forced to their own partner ID.
            partnerId: req.partnerId ?? data.partnerId,
        },
        createdBy,
        {
            requesterRole: req.user?.role,
            requesterPartnerId: req.partnerId,
        }
    );

    res.status(201).json({
        status: 'success',
        data: { client },
    });
});

/**
 * Get all clients
 */
export const getClients = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const filters: ListClientsInput & { partnerId?: string } = req.query as any;

    const result = await clientService.getClients({
        ...filters,
        requesterRole: req.user?.role,
        requesterPartnerId: req.partnerId,
    });

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

    const client = await clientService.getClientById(id, {
        requesterRole: req.user?.role,
        requesterPartnerId: req.partnerId,
    });

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

    const client = await clientService.updateClient(id, data, {
        requesterRole: req.user?.role,
        requesterPartnerId: req.partnerId,
    });

    res.status(200).json({
        status: 'success',
        data: { client },
    });
});

/**
 * Upload client documents
 */
export const uploadClientDocuments = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const singleFile = req.file as Express.Multer.File | undefined;
    const normalizedFiles = files.length > 0 ? files : singleFile ? [singleFile] : [];

    if (normalizedFiles.length === 0) {
        res.status(400).json({ status: 'fail', message: 'No file uploaded.' });
        return;
    }

    const client = await clientService.uploadClientDocuments(
        id,
        normalizedFiles.map((file) => ({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
        })),
        (req.user as any).id,
        {
            requesterRole: req.user?.role,
            requesterPartnerId: req.partnerId,
        }
    );

    res.status(201).json({
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

    const projects = await clientService.getClientProjects(id, {
        requesterRole: req.user?.role,
        requesterPartnerId: req.partnerId,
    });

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

    const client = await clientService.addActivity(id, data, createdBy, {
        requesterRole: req.user?.role,
        requesterPartnerId: req.partnerId,
    });

    res.status(200).json({
        status: 'success',
        data: { client },
    });
});

// ─── Client Portal Management ─────────────────────────────────────────────────

/**
 * Generate (or regenerate) a unique portal access token for a client.
 * Discards any existing token (old link becomes invalid immediately).
 */
export const generatePortalToken = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const token = crypto.randomBytes(32).toString('hex');

    const client = await Client.findByIdAndUpdate(
        id,
        { portalToken: token },
        { new: true, select: 'name email portalEnabled portalToken' }
    ).lean();

    if (!client) {
        res.status(404).json({ status: 'fail', message: 'Client not found.' });
        return;
    }

    res.status(200).json({
        status: 'success',
        message: 'Portal access link generated.',
        data: { clientId: id, portalToken: token },
    });
});

/**
 * Revoke the portal access token. Existing link becomes invalid immediately.
 */
export const revokePortalToken = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const client = await Client.findByIdAndUpdate(
        id,
        { $unset: { portalToken: '' } },
        { new: true }
    ).lean();

    if (!client) {
        res.status(404).json({ status: 'fail', message: 'Client not found.' });
        return;
    }

    res.status(200).json({ status: 'success', message: 'Portal access revoked.' });
});

/**
 * Toggle the client portal on/off.
 * Body: { enabled: boolean }
 */
export const togglePortal = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
        res.status(400).json({ status: 'fail', message: '`enabled` must be a boolean.' });
        return;
    }

    const updateData: any = { portalEnabled: enabled };
    let generatedToken = null;

    if (enabled) {
        const currentClient = await Client.findById(id).select('portalToken').lean();
        if (!currentClient) {
            res.status(404).json({ status: 'fail', message: 'Client not found.' });
            return;
        }
        if (!currentClient.portalToken) {
            generatedToken = crypto.randomBytes(32).toString('hex');
            updateData.portalToken = generatedToken;
        }
    }

    const client = await Client.findByIdAndUpdate(
        id,
        updateData,
        { new: true, select: 'portalEnabled portalToken name email' }
    ).lean();

    if (!client) {
        res.status(404).json({ status: 'fail', message: 'Client not found.' });
        return;
    }

    // Send email ONLY when enabling
    if (enabled && client.email && client.portalToken) {
        const portalUrl = `${env.FRONTEND_URL}/portal/${client._id}/${client.portalToken}`;
        await sendClientPortalAccessEmail({
            to: client.email,
            clientName: client.name,
            portalUrl
        });
    }

    res.status(200).json({
        status: 'success',
        message: `Client portal ${enabled ? 'enabled' : 'disabled'} successfully.`,
        data: { client },
    });
});
