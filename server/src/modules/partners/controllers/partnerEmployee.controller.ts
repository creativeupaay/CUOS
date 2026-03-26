import { Request, Response, NextFunction } from 'express';
import { PartnerEmployeeService } from '../services/partnerEmployee.service';
import asyncHandler from '../../../utils/asyncHandler';

const partnerEmployeeService = new PartnerEmployeeService();

/**
 * Create a new partner employee
 */
export const createEmployee = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const employee = await partnerEmployeeService.createEmployee(req.body, userId);

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: employee,
        });
    }
);

/**
 * Get all employees for the partner
 */
export const getEmployees = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const filters = {
            search: req.query.search as string | undefined,
            isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
            page: req.query.page ? parseInt(req.query.page as string) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        };

        const result = await partnerEmployeeService.getEmployees(userId, filters);

        res.status(200).json({
            success: true,
            message: 'Employees retrieved successfully',
            data: result,
        });
    }
);

/**
 * Get employee by ID
 */
export const getEmployeeById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const employee = await partnerEmployeeService.getEmployeeById(id, userId);

        res.status(200).json({
            success: true,
            message: 'Employee retrieved successfully',
            data: employee,
        });
    }
);

/**
 * Update employee
 */
export const updateEmployee = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const employee = await partnerEmployeeService.updateEmployee(id, req.body, userId);

        res.status(200).json({
            success: true,
            message: 'Employee updated successfully',
            data: employee,
        });
    }
);

/**
 * Delete employee
 */
export const deleteEmployee = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        await partnerEmployeeService.deleteEmployee(id, userId);

        res.status(200).json({
            success: true,
            message: 'Employee deleted successfully',
        });
    }
);

/**
 * Toggle employee active status
 */
export const toggleEmployeeStatus = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { id } = req.params;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const employee = await partnerEmployeeService.toggleEmployeeStatus(id, userId);

        res.status(200).json({
            success: true,
            message: `Employee ${employee.isActive ? 'activated' : 'deactivated'} successfully`,
            data: employee,
        });
    }
);

/**
 * Reset employee password
 */
export const resetEmployeePassword = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }

        await partnerEmployeeService.resetEmployeePassword(id, newPassword, userId);

        res.status(200).json({
            success: true,
            message: 'Password reset successfully',
        });
    }
);

/**
 * Get employee stats
 */
export const getEmployeeStats = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        const stats = await partnerEmployeeService.getStats(userId);

        res.status(200).json({
            success: true,
            message: 'Stats retrieved successfully',
            data: stats,
        });
    }
);
