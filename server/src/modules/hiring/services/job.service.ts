import { Job, IJob } from '../models/Job.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import { env } from '../../../config/env.config';
import { calcomService } from './calcom.service';
import { Application } from '../models/Application.model';
import { Assignment } from '../models/Assignment.model';
import type {
    CreateJobInput,
    UpdateJobInput,
    ListJobsInput,
    InterviewSchedulingInput,
    InterviewSchedulingUpdateInput,
} from '../validators/job.validator';

function toDate(value?: string | null): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed;
}

function normalizeCreateScheduling(input?: InterviewSchedulingInput) {
    return {
        enabled: input?.enabled ?? false,
        active: input?.active ?? input?.enabled ?? false,
        timezone: input?.timezone ?? 'Asia/Kolkata',
        organizerName: input?.organizerName ?? env.CALCOM_DEFAULT_ORGANIZER,
        availableFrom: toDate(input?.availableFrom),
        availableTo: toDate(input?.availableTo),
        weekdays: input?.weekdays ?? [1, 2, 3, 4, 5],
        dailySlots: input?.dailySlots ?? [{ startTime: '10:00', endTime: '18:00' }],
        durationMinutes: input?.durationMinutes ?? 45,
        slotIntervalMinutes: input?.slotIntervalMinutes ?? 30,
        minimumBookingNoticeMinutes: input?.minimumBookingNoticeMinutes ?? 60,
        beforeEventBufferMinutes: input?.beforeEventBufferMinutes ?? 5,
        afterEventBufferMinutes: input?.afterEventBufferMinutes ?? 5,
        syncStatus: 'not_configured' as const,
        syncError: undefined,
    };
}

function toPlainScheduling(existing: any) {
    if (!existing) return {};
    if (typeof existing.toObject === 'function') {
        return existing.toObject();
    }
    return { ...existing };
}

function mergeSchedulingUpdate(existing: any, updates: InterviewSchedulingUpdateInput) {
    const base = normalizeCreateScheduling();
    const existingScheduling = toPlainScheduling(existing);
    const merged = {
        ...base,
        ...existingScheduling,
        ...updates,
    };

    const enabled = updates.enabled ?? merged.enabled ?? false;
    const active = updates.active ?? enabled;

    return {
        ...merged,
        enabled,
        active,
        availableFrom:
            updates.availableFrom === null
                ? undefined
                : updates.availableFrom !== undefined
                ? toDate(updates.availableFrom)
                : toDate(existingScheduling?.availableFrom as any),
        availableTo:
            updates.availableTo === null
                ? undefined
                : updates.availableTo !== undefined
                ? toDate(updates.availableTo)
                : toDate(existingScheduling?.availableTo as any),
    };
}

export class JobService {
    /**
     * Create a new job posting
     */
    async createJob(data: CreateJobInput, createdBy: Types.ObjectId): Promise<IJob> {
        const scheduling = normalizeCreateScheduling(data.interviewScheduling);

        const job = await Job.create({
            ...data,
            interviewScheduling: scheduling,
            createdBy,
        });

        if (scheduling.enabled) {
            try {
                const synced = await calcomService.syncJobEventType({
                    jobId: String(job._id),
                    jobTitle: job.title,
                    jobDepartment: job.department,
                    scheduling: job.interviewScheduling as any,
                });

                job.interviewScheduling.scheduleId = synced.scheduleId;
                job.interviewScheduling.eventTypeId = synced.eventTypeId;
                job.interviewScheduling.eventTypeSlug = synced.eventTypeSlug;
                job.interviewScheduling.bookingUrl = synced.bookingUrl;
                job.interviewScheduling.externalUpdatedAt = synced.externalUpdatedAt;
                job.interviewScheduling.lastSyncedAt = new Date();
                job.interviewScheduling.syncStatus = 'synced';
                job.interviewScheduling.syncError = undefined;
                job.interviewScheduling.active = true;
                await job.save();
            } catch (error: any) {
                job.interviewScheduling.syncStatus = 'failed';
                job.interviewScheduling.syncError =
                    error?.message || 'Failed to sync interview scheduling with Cal.com';
                job.interviewScheduling.active = false;
                await job.save();
            }
        }

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
        const existing = await Job.findById(id);

        if (!existing) {
            throw new AppError('Job not found', 404);
        }

        const updatePayload: any = { ...data };

        if (data.interviewScheduling) {
            updatePayload.interviewScheduling = mergeSchedulingUpdate(
                existing.interviewScheduling,
                data.interviewScheduling
            );
        }

        const job = await Job.findByIdAndUpdate(id, updatePayload, {
            new: true,
            runValidators: true,
        });

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        if (job.interviewScheduling?.enabled) {
            job.interviewScheduling.syncStatus = 'pending';
            job.interviewScheduling.syncError = undefined;
            await job.save();

            try {
                const synced = await calcomService.syncJobEventType({
                    jobId: String(job._id),
                    jobTitle: job.title,
                    jobDepartment: job.department,
                    scheduling: job.interviewScheduling as any,
                });

                job.interviewScheduling.scheduleId = synced.scheduleId;
                job.interviewScheduling.eventTypeId = synced.eventTypeId;
                job.interviewScheduling.eventTypeSlug = synced.eventTypeSlug;
                job.interviewScheduling.bookingUrl = synced.bookingUrl;
                job.interviewScheduling.externalUpdatedAt = synced.externalUpdatedAt;
                job.interviewScheduling.lastSyncedAt = new Date();
                job.interviewScheduling.syncStatus = 'synced';
                job.interviewScheduling.syncError = undefined;
                job.interviewScheduling.active = true;
                await job.save();
            } catch (error: any) {
                job.interviewScheduling.syncStatus = 'failed';
                job.interviewScheduling.syncError =
                    error?.message || 'Failed to sync interview scheduling with Cal.com';
                job.interviewScheduling.active = false;
                await job.save();
            }
        } else if (job.interviewScheduling) {
            job.interviewScheduling.active = false;
            job.interviewScheduling.syncStatus = 'not_configured';
            job.interviewScheduling.syncError = undefined;
            await job.save();
        }

        return job.populate('createdBy', 'name email');
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
        const job = await Job.findById(id).select('_id title');
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        const [applicationCount, assignmentCount] = await Promise.all([
            Application.countDocuments({ jobId: job._id }),
            Assignment.countDocuments({ jobId: job._id }),
        ]);

        if (applicationCount > 0 || assignmentCount > 0) {
            throw new AppError(
                'This job already has hiring data linked to it. Close the job instead of deleting it.',
                400
            );
        }

        await Job.findByIdAndDelete(id);
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
