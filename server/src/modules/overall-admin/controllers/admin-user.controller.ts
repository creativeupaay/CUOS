import { Request, Response } from 'express';
import * as adminUserService from '../services/admin-user.service';
import asyncHandler from '../../../utils/asyncHandler';

export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
        search: req.query.search as string,
        role: req.query.role as string,
        department: req.query.department as string,
        isActive: req.query.isActive !== undefined
            ? req.query.isActive === 'true'
            : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await adminUserService.getAllUsers(filters);

    res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: result,
    });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminUserService.getUserById(req.params.id);

    res.json({
        success: true,
        message: 'User retrieved successfully',
        data: user,
    });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminUserService.createUser(req.body, req.user!.id);

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user,
    });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await adminUserService.updateUser(req.params.id, req.body, req.user!.id);

    res.json({
        success: true,
        message: 'User updated successfully',
        data: user,
    });
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
    await adminUserService.deactivateUser(req.params.id, req.user!.id);

    res.json({
        success: true,
        message: 'User deactivated successfully',
    });
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
    await adminUserService.activateUser(req.params.id, req.user!.id);

    res.json({
        success: true,
        message: 'User activated successfully',
    });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminUserService.resetPassword(
        req.params.id,
        req.body.newPassword,
        req.user!.id
    );

    res.json({
        success: true,
        message: result.message,
    });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminUserService.deleteUser(req.params.id, req.user!.id);

    res.json({
        success: true,
        message: result.message,
    });
});
