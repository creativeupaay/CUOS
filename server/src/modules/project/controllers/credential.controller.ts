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
