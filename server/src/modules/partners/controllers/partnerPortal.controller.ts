import { Request, Response, NextFunction } from 'express';
import {
    getPartnerPortalDocuments,
    uploadPartnerPortalDocument,
    getPartnerPortalDocumentUrl,
    getPartnerPortalProjects,
    getPartnerPortalProject,
} from '../services/partnerPortal.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';

function requirePartnerContext(req: Request) {
    if (!req.partner) throw new AppError('Partner context not found', 403);
    return req.partner;
}

/**
 * Get all projects for the partner
 */
export const getProjects = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { partnerId } = requirePartnerContext(req);

        const projects = await getPartnerPortalProjects(partnerId);

        res.status(200).json({
            success: true,
            message: 'Projects retrieved',
            data: { projects },
        });
    }
);

/**
 * Get single project details
 */
export const getProject = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { partnerId } = requirePartnerContext(req);
        const { projectId } = req.params;

        const project = await getPartnerPortalProject(partnerId, projectId);

        res.status(200).json({
            success: true,
            message: 'Project retrieved',
            data: { project },
        });
    }
);

/**
 * Get documents in the shared folder for a project
 */
export const getDocuments = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { partnerId } = requirePartnerContext(req);
        const { projectId } = req.params;

        const result = await getPartnerPortalDocuments(partnerId, projectId);

        res.status(200).json({
            success: true,
            message: 'Documents retrieved',
            data: result,
        });
    }
);

/**
 * Upload a document to the shared folder
 */
export const uploadDocument = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { partnerId, userId } = requirePartnerContext(req);
        const { projectId } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded',
            });
        }

        const item = await uploadPartnerPortalDocument(
            partnerId,
            projectId,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            req.file.size,
            userId
        );

        res.status(201).json({
            success: true,
            message: 'Document uploaded',
            data: { document: item },
        });
    }
);

/**
 * Get signed URL for a document
 */
export const getDocumentUrl = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { partnerId } = requirePartnerContext(req);
        const { projectId, itemId } = req.params;

        const url = await getPartnerPortalDocumentUrl(partnerId, projectId, itemId);

        res.status(200).json({
            success: true,
            message: 'Document URL retrieved',
            data: { url },
        });
    }
);
