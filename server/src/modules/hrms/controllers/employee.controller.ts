import { Request, Response, NextFunction } from 'express';
import { employeeService } from '../services/employee.service';
import asyncHandler from '../../../utils/asyncHandler';

// ── Create Employee ─────────────────────────────────────────────────
export const createEmployee = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const createdBy = (req.user as any).id;
    const employee = await employeeService.createEmployee(req.body, createdBy);

    res.status(201).json({
        status: 'success',
        data: { employee },
    });
});

// ── Get All Employees ───────────────────────────────────────────────
export const getEmployees = asyncHandler(async (req: Request, res: Response) => {
    const { department, status, search, page, limit } = req.query;
    const result = await employeeService.getEmployees({
        department: department as string,
        status: status as string,
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({
        status: 'success',
        data: result,
    });
});

// ── Get Employee by ID ──────────────────────────────────────────────
export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
    const employee = await employeeService.getEmployeeById(req.params.id);

    res.json({
        status: 'success',
        data: { employee },
    });
});

// ── Get My Employee Profile ─────────────────────────────────────────
export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req.user as any).id;
    const employee = await employeeService.getEmployeeByUserId(userId);

    res.json({
        status: 'success',
        data: { employee },
    });
});

// ── Update Employee ─────────────────────────────────────────────────
export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
    const employee = await employeeService.updateEmployee(req.params.id, req.body);

    res.json({
        status: 'success',
        data: { employee },
    });
});

// ── Delete Employee ─────────────────────────────────────────────────
export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
    await employeeService.deleteEmployee(req.params.id);

    res.json({
        status: 'success',
        message: 'Employee deleted successfully',
    });
});

// ── Get Team Members ────────────────────────────────────────────────
export const getTeamMembers = asyncHandler(async (req: Request, res: Response) => {
    const team = await employeeService.getTeamMembers(req.params.managerId);

    res.json({
        status: 'success',
        data: { team },
    });
});

// ── Get Onboarding Employees ────────────────────────────────────────
export const getOnboardingEmployees = asyncHandler(async (req: Request, res: Response) => {
    const employees = await employeeService.getOnboardingEmployees();

    res.json({
        status: 'success',
        data: { employees },
    });
});

// ── Update Onboarding Checklist ─────────────────────────────────────
export const updateOnboardingChecklist = asyncHandler(async (req: Request, res: Response) => {
    const employee = await employeeService.updateOnboardingChecklist(
        req.params.id,
        req.body.checklist
    );

    res.json({
        status: 'success',
        data: { employee },
    });
});

// ── Generate / Retrieve Form Token ──────────────────────────────────
export const generateFormToken = asyncHandler(async (req: Request, res: Response) => {
    const result = await employeeService.generateFormToken(req.params.id);

    res.json({
        status: 'success',
        data: result,
    });
});

// ── Get Identity Document (proxied) ────────────────────────────────
export const getIdentityDocumentUrl = asyncHandler(async (req: Request, res: Response) => {
    const url = await employeeService.getIdentityDocumentUrl(req.params.id);

    // Proxy the file server-side so the browser never has to deal with
    // Cloudinary's authenticated-resource signing/cookie requirements.
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
        if (upstream.status === 401) {
            res.status(401).json({
                status: 'error',
                message: 'Cloudinary Security Settings are blocking PDF delivery. Please go to your Cloudinary Dashboard -> Settings -> Security, and uncheck "Block delivery of PDF and ZIP files".'
            });
            return;
        }
        res.status(502).json({ status: 'error', message: 'Could not fetch document from storage' });
        return;
    }

    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    const cl = upstream.headers.get('content-length');
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Disposition', 'inline');
    if (cl) res.setHeader('Content-Length', cl);

    // Stream body to client (Node 22 has native fetch + ReadableStream)
    const { Readable } = await import('stream');
    Readable.fromWeb(upstream.body as any).pipe(res);
});
