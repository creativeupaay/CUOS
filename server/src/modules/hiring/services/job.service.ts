import { Job, IJob } from '../models/Job.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import type {
    CreateJobInput,
    UpdateJobInput,
    ListJobsInput,
} from '../validators/job.validator';

export class JobService {
    /**
     * Create a new job posting
     */
    async createJob(data: CreateJobInput, createdBy: Types.ObjectId): Promise<IJob> {
        const job = await Job.create({
            ...data,
            createdBy,
        });
        return job.populate('createdBy', 'name email');
    }

    /**
     * Get all jobs with optional filters
     */
    async getJobs(filters: ListJobsInput): Promise<{
        jobs: IJob[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { department, employmentType, isHiring, search, page = 1, limit = 50 } = filters;

        const query: any = {};

        if (department) query.department = { $regex: department, $options: 'i' };
        if (employmentType) query.employmentType = employmentType;
        if (isHiring !== undefined) query.isHiring = isHiring;

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('createdBy', 'name email'),
            Job.countDocuments(query),
        ]);

        return {
            jobs,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get a single job by ID
     */
    async getJobById(id: string): Promise<IJob> {
        const job = await Job.findById(id).populate('createdBy', 'name email');
        if (!job) {
            throw new AppError('Job not found', 404);
        }
        return job;
    }

    /**
     * Update a job posting
     */
    async updateJob(id: string, data: UpdateJobInput): Promise<IJob> {
        const job = await Job.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        }).populate('createdBy', 'name email');

        if (!job) {
            throw new AppError('Job not found', 404);
        }
        return job;
    }

    /**
     * Toggle isHiring status
     */
    async toggleHiring(id: string): Promise<IJob> {
        const job = await Job.findById(id);
        if (!job) {
            throw new AppError('Job not found', 404);
        }
        job.isHiring = !job.isHiring;
        await job.save();
        await job.populate('createdBy', 'name email');
        return job;
    }

    /**
     * Delete a job posting
     */
    async deleteJob(id: string): Promise<void> {
        const job = await Job.findByIdAndDelete(id);
        if (!job) {
            throw new AppError('Job not found', 404);
        }
    }

    /**
     * Get all active (isHiring = true) jobs — public endpoint
     */
    async getActiveJobs(): Promise<IJob[]> {
        return Job.find({ isHiring: true }).sort({ createdAt: -1 }).select(
            'title department location description requirements employmentType assignmentRequired createdAt'
        );
    }
}
