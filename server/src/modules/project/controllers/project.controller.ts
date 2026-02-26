import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { User } from '../../auth/models/User.model';

export const createProject = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        if (!userId) {
            return next(new AppError('User not authenticated', 401));
        }

        const project = await projectService.createProject({
            ...req.body,
            createdBy: userId,
        });

        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            data: project,
        });
    }
);

export const getProjects = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;
        const userRole = req.user?.role!;

        // Fetch this user's modulePermissions to honour project access
        const userDoc = await User.findById(userId).select('modulePermissions').lean();
        const pmPerms = (userDoc as any)?.modulePermissions?.projectManagement;
        // Extract allowed projectIds from the per-project permissions array
        const projectPermissions: any[] = pmPerms?.projectPermissions ?? [];
        const projectIds: string[] = projectPermissions.map((p: any) => p.projectId);

        const projects = await projectService.getProjects(userId, userRole, {
            status: req.query.status as string,
            clientId: req.query.clientId as string,
            priority: req.query.priority as string,
        }, 'custom', projectIds);

        res.status(200).json({
            success: true,
            message: 'Projects retrieved successfully',
            data: projects,
        });
    }
);

export const getProjectById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const project = await projectService.getProjectById(req.params.id);

        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Project retrieved successfully',
            data: project,
        });
    }
);

export const updateProject = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const project = await projectService.updateProject(req.params.id, req.body);

        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Project updated successfully',
            data: project,
        });
    }
);

export const deleteProject = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const project = await projectService.deleteProject(req.params.id);

        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Project archived successfully',
            data: project,
        });
    }
);

export const addAssignee = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const adminId = req.user?.id!;
        const { employeeId: assigneeId, role, subModules } = req.body;

        const project = await projectService.addAssignee(
            req.params.id,
            assigneeId,
            role,
            adminId,
            subModules // Pass through optional sub permissions
        );

        res.status(200).json({
            success: true,
            message: 'Assignee added successfully',
            data: project,
        });
    }
);

export const removeAssignee = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const project = await projectService.removeAssignee(
            req.params.id,
            req.params.employeeId
        );

        res.status(200).json({
            success: true,
            message: 'Assignee removed successfully',
            data: project,
        });
    }
);

export const updateAssigneePermissions = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const { subModules } = req.body;

        await projectService.updateAssigneePermissions(
            req.params.employeeId,
            req.params.id,
            subModules
        );

        res.status(200).json({
            success: true,
            message: 'Assignee permissions updated successfully'
        });
    }
);

export const getAssigneePermissions = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const permissions = await projectService.getAssigneePermissions(
            req.params.employeeId,
            req.params.id
        );

        res.status(200).json({
            success: true,
            data: permissions
        });
    }
);

export const uploadDocument = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        if (!req.file) {
            return next(new AppError('No file uploaded', 400));
        }

        const project = await projectService.uploadProjectDocument(
            req.params.id,
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            req.body.type,
            userId
        );

        res.status(200).json({
            success: true,
            message: 'Document uploaded successfully',
            data: project,
        });
    }
);

export const getDocument = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const signedUrl = await projectService.getProjectDocument(
            req.params.id,
            req.params.docId
        );

        res.status(200).json({
            success: true,
            message: 'Document URL generated successfully',
            data: { url: signedUrl },
        });
    }
);

export const deleteDocument = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const project = await projectService.deleteProjectDocument(
            req.params.id,
            req.params.docId
        );

        res.status(200).json({
            success: true,
            message: 'Document deleted successfully',
            data: project,
        });
    }
);
