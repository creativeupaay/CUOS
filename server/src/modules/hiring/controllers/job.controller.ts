import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { JobService } from '../services/job.service';
import asyncHandler from '../../../utils/asyncHandler';
import type {
    CreateJobInput,
    UpdateJobInput,
    ListJobsInput,
} from '../validators/job.validator';

const jobService = new JobService();

/**
 * Create a new job posting
 */
export const createJob = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const data: CreateJobInput = req.body;
        const createdBy = new Types.ObjectId(req.user!.id);

        const job = await jobService.createJob(data, createdBy);

        res.status(201).json({
            status: 'success',
            data: { job },
        });
    }
);

/**
 * Get all jobs
 */
export const getJobs = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const filters = req.query as unknown as ListJobsInput;

        // If user is a job manager (not admin/HR), filter to only their managed jobs
        const managerUserId = req.isJobManager ? req.user?.id : undefined;

        const result = await jobService.getJobs(filters, managerUserId);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    }
);

/**
 * Get a single job by ID
 */
export const getJob = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { id } = req.params;

        const job = await jobService.getJobById(id);

        res.status(200).json({
            status: 'success',
            data: { job },
        });
    }
);

/**
 * Update job details
 */
export const updateJob = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { id } = req.params;
        const data: UpdateJobInput = req.body;

        const job = await jobService.updateJob(id, data);

        res.status(200).json({
            status: 'success',
            data: { job },
        });
    }
);

/**
 * Toggle hiring status
 */
export const toggleJobHiring = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { id } = req.params;

        const job = await jobService.toggleHiring(id);

        res.status(200).json({
            status: 'success',
            data: { job },
        });
    }
);

/**
 * Delete a job posting
 */
export const deleteJob = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { id } = req.params;

        await jobService.deleteJob(id, {
            deletedBy: req.user?.id,
            reason: 'Hiring job delete requested',
        });

        res.status(204).json({
            status: 'success',
            data: null,
        });
    }
);

/**
 * Public endpoint — return only active (isHiring = true) jobs
 */
export const getActiveJobs = asyncHandler(
    async (_req: Request, res: Response, _next: NextFunction) => {
        const jobs = await jobService.getActiveJobs();

        res.status(200).json({
            status: 'success',
            data: { jobs },
        });
    }
);

export const getApplicationFieldLibrary = asyncHandler(
    async (_req: Request, res: Response, _next: NextFunction) => {
        const fields = await jobService.getApplicationFieldLibrary();

        res.status(200).json({
            status: 'success',
            data: { fields },
        });
    }
);

export const saveApplicationField = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const fields = await jobService.saveApplicationField(req.body);

        res.status(200).json({
            status: 'success',
            data: { fields },
        });
    }
);

export const deleteApplicationField = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const fields = await jobService.deleteApplicationField(req.params.key);

        res.status(200).json({
            status: 'success',
            data: { fields },
        });
    }
);

/**
 * Get employees list for job manager picker
 */
export const getEmployeesList = asyncHandler(
    async (_req: Request, res: Response, _next: NextFunction) => {
        const employees = await jobService.getEmployeesList();

        res.status(200).json({
            status: 'success',
            data: { employees },
        });
    }
);

/**
 * Check if current user is a job manager for any job
 */
export const checkJobManagerStatus = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const userId = req.user!.id;
        const isJobManager = await jobService.isUserJobManager(userId);

        res.status(200).json({
            status: 'success',
            data: { isJobManager },
        });
    }
);
