import { Request, Response } from 'express';
import * as adminRoleService from '../services/admin-role.service';
import asyncHandler from '../../../utils/asyncHandler';

// ── Roles ──────────────────────────────────────────────────────────────

export const getAllRoles = asyncHandler(async (req: Request, res: Response) => {
    const roles = await adminRoleService.getAllRoles();

    res.json({
        success: true,
        message: 'Roles retrieved successfully',
        data: roles,
    });
});

export const getRoleById = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminRoleService.getRoleById(req.params.id);

    res.json({
        success: true,
        message: 'Role retrieved successfully',
        data: result,
    });
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
    const role = await adminRoleService.createRole(req.body, req.user!.id);

    res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role,
    });
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
    const role = await adminRoleService.updateRole(req.params.id, req.body, req.user!.id);

    res.json({
        success: true,
        message: 'Role updated successfully',
        data: role,
    });
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminRoleService.deleteRole(req.params.id, req.user!.id);

    res.json({
        success: true,
        message: result.message,
    });
});

export const cloneRole = asyncHandler(async (req: Request, res: Response) => {
    const role = await adminRoleService.cloneRole(
        req.params.id,
        req.body.name,
        req.user!.id
    );

    res.status(201).json({
        success: true,
        message: 'Role cloned successfully',
        data: role,
    });
});

// ── Permissions ────────────────────────────────────────────────────────

export const getAllPermissions = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminRoleService.getAllPermissions();

    res.json({
        success: true,
        message: 'Permissions retrieved successfully',
        data: result,
    });
});

export const createPermission = asyncHandler(async (req: Request, res: Response) => {
    const permission = await adminRoleService.createPermission(req.body, req.user!.id);

    res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        data: permission,
    });
});

export const deletePermission = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminRoleService.deletePermission(req.params.id, req.user!.id);

    res.json({
        success: true,
        message: result.message,
    });
});
