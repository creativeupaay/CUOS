import { Request, Response, NextFunction } from 'express';
import * as credentialService from '../services/credential.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';

export const createCredential = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const credential = await credentialService.createCredential({
            ...req.body,
            projectId: req.params.projectId,
            createdBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Credential created successfully',
            data: credential,
        });
    }
);

export const getCredentials = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;
        const userRole = req.user?.role!;

        const credentials = await credentialService.getCredentials(
            req.params.projectId,
            userId,
            userRole,
            {
                type: req.query.type as string,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Credentials retrieved successfully',
            data: credentials,
        });
    }
);

export const getCredentialById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const credential = await credentialService.getCredentialById(req.params.id);

        if (!credential) {
            return next(new AppError('Credential not found', 404));
        }

        // Log access
        await credentialService.logCredentialAccess(req.params.id, userId);

        // Decrypt credentials
        const decryptedCredentials = credential.decryptCredentials();

        res.status(200).json({
            success: true,
            message: 'Credential retrieved successfully',
            data: {
                ...credential.toObject(),
                credentials: decryptedCredentials,
            },
        });
    }
);

export const updateCredential = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const credential = await credentialService.updateCredential(
            req.params.id,
            req.body,
            userId
        );

        if (!credential) {
            return next(new AppError('Credential not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Credential updated successfully',
            data: credential,
        });
    }
);

export const deleteCredential = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        await credentialService.deleteCredential(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Credential deleted successfully',
        });
    }
);

/**
 * POST /:projectId/credentials/share
 * Share specific credentials (view-only) with specific users.
 * Requires: credential admin or super-admin.
 */
export const shareCredentials = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { projectId } = req.params;
        const { credentialIds, userIds } = req.body;

        if (!Array.isArray(credentialIds) || credentialIds.length === 0) {
            return next(new AppError('credentialIds must be a non-empty array', 400));
        }
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return next(new AppError('userIds must be a non-empty array', 400));
        }

        await credentialService.shareViewAccess(projectId, credentialIds, userIds);

        res.status(200).json({
            success: true,
            message: 'View access granted successfully',
        });
    }
);

/**
 * DELETE /:projectId/credentials/share
 * Revoke view access for specific users from specific credentials.
 * Requires: credential admin or super-admin.
 */
export const revokeCredentialAccess = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { projectId } = req.params;
        const { credentialIds, userIds } = req.body;

        if (!Array.isArray(credentialIds) || credentialIds.length === 0) {
            return next(new AppError('credentialIds must be a non-empty array', 400));
        }
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return next(new AppError('userIds must be a non-empty array', 400));
        }

        await credentialService.revokeViewAccess(projectId, credentialIds, userIds);

        res.status(200).json({
            success: true,
            message: 'View access revoked successfully',
        });
    }
);

/**
 * PATCH /:projectId/credential-admins
 * Set credential admins for a project (replaces list).
 * Requires: super-admin only.
 */
export const updateCredentialAdmins = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { projectId } = req.params;
        const { userIds } = req.body;

        if (!Array.isArray(userIds)) {
            return next(new AppError('userIds must be an array', 400));
        }

        await credentialService.updateCredentialAdmins(projectId, userIds);

        res.status(200).json({
            success: true,
            message: 'Credential admins updated successfully',
        });
    }
);

/**
 * GET /:projectId/credential-admins
 * Get credential admins for a project.
 * Requires: project access.
 */
export const getCredentialAdmins = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { projectId } = req.params;
        const admins = await credentialService.getCredentialAdmins(projectId);

        res.status(200).json({
            success: true,
            message: 'Credential admins retrieved',
            data: admins,
        });
    }
);
