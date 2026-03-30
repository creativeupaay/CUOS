import { Response, NextFunction } from 'express';
import { ClientPortalRequest } from '../middleware/clientPortalAuth';
import * as portalService from '../services/clientPortal.service';
import asyncHandler from '../../../utils/asyncHandler';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const exchangeToken = asyncHandler(async (req, res) => {
    const { clientId, token } = req.body;
    if (!clientId || !token) {
        res.status(400).json({ status: 'fail', message: 'Invalid access link.' });
        return;
    }
    const result = await portalService.exchangePortalToken(clientId, token);

    res.cookie('portal_jwt', result.jwt_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    });

    res.status(200).json({ status: 'success', data: { client: result.client } });
});

export const logoutPortal = asyncHandler(async (_req, res) => {
    res.clearCookie('portal_jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });
    res.status(200).json({ status: 'success', message: 'Logged out.' });
});

export const getMe = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const client = await portalService.getPortalClientInfo(req.portalClient!.clientId);
    res.status(200).json({ status: 'success', data: { client } });
});

// ─── Projects ─────────────────────────────────────────────────────────────────

export const getProjects = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const projects = await portalService.getPortalProjects(req.portalClient!.clientId);
    res.status(200).json({ status: 'success', data: { projects } });
});

export const getProject = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const project = await portalService.getPortalProject(
        req.portalClient!.clientId,
        req.params.projectId
    );
    res.status(200).json({ status: 'success', data: { project } });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const getTasks = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const { status } = req.query as { status?: string };
    const tasks = await portalService.getPortalTasks(
        req.portalClient!.clientId,
        req.params.projectId,
        status
    );
    res.status(200).json({ status: 'success', data: { tasks } });
});

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const getMeetings = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const meetings = await portalService.getPortalMeetings(
        req.portalClient!.clientId,
        req.params.projectId
    );
    res.status(200).json({ status: 'success', data: { meetings } });
});

// ─── Credentials ──────────────────────────────────────────────────────────────

export const getCredentials = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const credentials = await portalService.getPortalCredentials(
        req.portalClient!.clientId,
        req.params.projectId
    );
    res.status(200).json({ status: 'success', data: { credentials } });
});

// ─── Documents ────────────────────────────────────────────────────────────────

export const getDocuments = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const result = await portalService.getPortalDocuments(
        req.portalClient!.clientId,
        req.params.projectId
    );
    res.status(200).json({ status: 'success', data: result });
});

export const uploadDocument = asyncHandler(async (req: ClientPortalRequest, res: Response, next: NextFunction) => {
    if (!req.file) {
        res.status(400).json({ status: 'fail', message: 'No file uploaded.' });
        return;
    }
    const item = await portalService.uploadPortalDocument(
        req.portalClient!.clientId,
        req.params.projectId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        req.file.size
    );
    res.status(201).json({ status: 'success', data: { item } });
});

export const getDocumentUrl = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const url = await portalService.getPortalDocumentUrl(
        req.portalClient!.clientId,
        req.params.projectId,
        req.params.itemId
    );
    res.status(200).json({ status: 'success', data: { url } });
});

// ─── Comments ─────────────────────────────────────────────────────────────────

const resolveEntityType = (entityParam: string): 'task' | 'meeting' => {
    if (entityParam === 'tasks') return 'task';
    if (entityParam === 'meetings') return 'meeting';
    throw new Error('Invalid entity type');
};

export const getComments = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const entityType = resolveEntityType(req.params.entityType);
    const comments = await portalService.getComments(
        req.portalClient!.clientId,
        req.params.projectId,
        entityType,
        req.params.entityId
    );
    res.status(200).json({ status: 'success', data: { comments } });
});

export const addComment = asyncHandler(async (req: ClientPortalRequest, res: Response) => {
    const { content } = req.body;
    if (!content?.trim()) {
        res.status(400).json({ status: 'fail', message: 'Comment content is required.' });
        return;
    }
    const entityType = resolveEntityType(req.params.entityType);
    const comment = await portalService.addClientComment(
        req.portalClient!.clientId,
        req.params.projectId,
        entityType,
        req.params.entityId,
        content,
        req.portalClient!.name
    );
    res.status(201).json({ status: 'success', data: { comment } });
});
