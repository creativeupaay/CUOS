import { Request, Response, NextFunction } from 'express';
import * as docService from '../services/doc.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { DocFolder } from '../models/DocFolder.model';

// ─── Folders ─────────────────────────────────────────────────────────────────

export const getFolders = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const projectId = req.params.id;
        const userId = req.user?.id!;
        const userRole = req.user?.role;
        const parentId = (req.query.parentId as string) || null;
        const isPartnerRequest = !!req.partnerId;

        const folders = await docService.getFolders(projectId, parentId, userId, userRole, isPartnerRequest);

        res.status(200).json({ success: true, data: folders });
    }
);

export const createFolder = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const projectId = req.params.id;
        const userId = req.user?.id!;
        const { name, parentId } = req.body;

        const folder = await docService.createFolder(projectId, name, parentId || null, userId);

        res.status(201).json({ success: true, data: folder });
    }
);

export const renameFolder = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { folderId } = req.params;
        const { name } = req.body;

        const folder = await docService.renameFolder(folderId, name);

        res.status(200).json({ success: true, data: folder });
    }
);

export const deleteFolder = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { folderId } = req.params;

        await docService.deleteFolder(folderId);

        res.status(200).json({ success: true, message: 'Folder deleted successfully' });
    }
);

export const updateFolderAccess = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { folderId } = req.params;
        const { viewAccess } = req.body;

        const folder = await docService.updateFolderAccess(folderId, viewAccess || []);

        res.status(200).json({ success: true, data: folder });
    }
);

// ─── Files ────────────────────────────────────────────────────────────────────

export const getDocItems = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const projectId = req.params.id;
        const userId = req.user?.id!;
        const userRole = req.user?.role;
        const folderId = (req.query.folderId as string) || null;
        const isPartnerRequest = !!req.partnerId;

        const items = await docService.getDocItems(projectId, folderId, userId, userRole, isPartnerRequest);

        res.status(200).json({ success: true, data: items });
    }
);

export const uploadDocItem = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const projectId = req.params.id;
        const userId = req.user?.id!;
        const userRole = req.user?.role;
        const folderId = (req.body.folderId as string) || null;
        const isPartnerRequest = !!req.partnerId;

        // Check if user is document admin
        const admin = await docService.isDocAdmin(projectId, userId, userRole);
        let allowUpload = admin;

        // Special case: Partners can upload to unified shared folder only
        if (!allowUpload && isPartnerRequest && folderId) {
            const folder = await DocFolder.findOne({ _id: folderId, projectId }).lean();
            if (folder && folder.isSystem && folder.isClientShared && folder.isPartnerShared) {
                allowUpload = true;
            }
        }

        if (!allowUpload) {
            return next(new AppError('You do not have permission to upload files', 403));
        }

        if (!req.file) return next(new AppError('No file uploaded', 400));

        const item = await docService.uploadDocItem(
            projectId,
            folderId,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            userId
        );

        res.status(201).json({ success: true, data: item });
    }
);

export const getDocItemUrl = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { itemId } = req.params;

        const url = await docService.getDocItemUrl(itemId);

        res.status(200).json({ success: true, data: { url } });
    }
);

export const renameDocItem = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { itemId } = req.params;
        const { name } = req.body;

        const item = await docService.renameDocItem(itemId, name);

        res.status(200).json({ success: true, data: item });
    }
);

export const deleteDocItem = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { itemId } = req.params;

        await docService.deleteDocItem(itemId);

        res.status(200).json({ success: true, message: 'File deleted successfully' });
    }
);

export const updateDocItemAccess = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { itemId } = req.params;
        const { viewAccess } = req.body;

        const item = await docService.updateDocItemAccess(itemId, viewAccess || []);

        res.status(200).json({ success: true, data: item });
    }
);

// ─── Doc Admins ───────────────────────────────────────────────────────────────

export const getDocAdmins = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const docAdmins = await docService.getDocAdmins(req.params.id);
        res.status(200).json({ success: true, data: docAdmins });
    }
);

export const updateDocAdmins = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { userIds } = req.body;
        await docService.updateDocAdmins(req.params.id, userIds || []);
        res.status(200).json({ success: true, message: 'Doc admins updated successfully' });
    }
);
