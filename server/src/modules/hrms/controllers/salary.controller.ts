import { Request, Response, NextFunction } from 'express';
import { salaryService } from '../services/salary.service';
import asyncHandler from '../../../utils/asyncHandler';

// ── Create Salary Structure ─────────────────────────────────────────
export const createSalary = asyncHandler(async (req: Request, res: Response) => {
    const createdBy = (req.user as any).id;
    const salary = await salaryService.createSalaryStructure(req.body, createdBy);

    res.status(201).json({
        status: 'success',
        data: { salary },
    });
});

// ── Get All Salary Structures ───────────────────────────────────────
export const getSalaries = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const result = await salaryService.getAllSalaries({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
        status: 'success',
        data: result,
    });
});

// ── Get Salary by Employee ID ───────────────────────────────────────
export const getSalaryByEmployee = asyncHandler(async (req: Request, res: Response) => {
    const salary = await salaryService.getSalaryByEmployeeId(req.params.employeeId);

    res.json({
        status: 'success',
        data: { salary },
    });
});

// ── Get Salary by ID ────────────────────────────────────────────────
export const getSalaryById = asyncHandler(async (req: Request, res: Response) => {
    const salary = await salaryService.getSalaryById(req.params.id);

    res.json({
        status: 'success',
        data: { salary },
    });
});

// ── Update Salary Structure ─────────────────────────────────────────
export const updateSalary = asyncHandler(async (req: Request, res: Response) => {
    const revisedBy = (req.user as any).id;
    const salary = await salaryService.updateSalaryStructure(req.params.id, req.body, revisedBy);

    res.json({
        status: 'success',
        data: { salary },
    });
});

// ── Delete Salary Structure ─────────────────────────────────────────
export const deleteSalary = asyncHandler(async (req: Request, res: Response) => {
    await salaryService.deleteSalaryStructure(req.params.id);

    res.json({
        status: 'success',
        message: 'Salary structure deleted successfully',
    });
});
