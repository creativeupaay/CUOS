import { Request, Response, NextFunction } from 'express';
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
        const createdBy = (req.user as any).id;

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
        const filters: ListJobsInput = req.query as any;

        const result = await jobService.getJobs(filters);

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

        await jobService.deleteJob(id);

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
