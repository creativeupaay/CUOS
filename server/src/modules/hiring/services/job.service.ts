import { Job, IJob } from '../models/Job.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import { env } from '../../../config/env.config';
import { calcomService } from './calcom.service';
import { Application } from '../models/Application.model';
import { Assignment } from '../models/Assignment.model';
import { buildInterviewSchedulingSyncHash } from './scheduling-hash.util';
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

function normalizeReminderMinutes(value: unknown): number[] {
    const raw = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
    const normalized = raw
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item >= 0)
        .map((item) => Math.floor(item));

    const uniqueSorted = Array.from(new Set(normalized)).sort((a, b) => a - b);
    return uniqueSorted.length ? uniqueSorted : [30];
}

function normalizeAvailableRanges(
    input?: Array<{
        startDate?: string;
        endDate?: string;
        weekdays?: number[];
        dailySlots?: Array<{ startTime?: string; endTime?: string }>;
    }> | null
) {
    const ranges = (input || [])
        .map((range) => ({
            startDate: toDate(range?.startDate),
            endDate: toDate(range?.endDate),
            weekdays: Array.isArray(range?.weekdays)
                ? range.weekdays
                      .map((day) => Number(day))
                      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
                : undefined,
            dailySlots: Array.isArray(range?.dailySlots)
                ? range.dailySlots
                      .filter(
                          (slot) =>
                              typeof slot?.startTime === 'string' &&
                              typeof slot?.endTime === 'string' &&
                              slot.endTime > slot.startTime
                      )
                      .map((slot) => ({
                          startTime: String(slot.startTime),
                          endTime: String(slot.endTime),
                      }))
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                : undefined,
        }))
        .filter((range) => range.startDate && range.endDate)
        .map((range) => ({
            startDate: range.startDate as Date,
            endDate: range.endDate as Date,
            weekdays: range.weekdays?.length ? Array.from(new Set(range.weekdays)).sort((a, b) => a - b) : undefined,
            dailySlots: range.dailySlots?.length ? range.dailySlots : undefined,
        }))
        .filter((range) => range.startDate.getTime() <= range.endDate.getTime());

    return ranges.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

function normalizeDateOverrides(
    input?: Array<{
        date?: string;
        slots?: Array<{ startTime?: string; endTime?: string }>;
    }> | null
) {
    const overrides = (input || [])
        .map((item) => ({
            date: toDate(item?.date),
            slots: Array.isArray(item?.slots)
                ? item.slots
                      .filter(
                          (slot) =>
                              typeof slot?.startTime === 'string' &&
                              typeof slot?.endTime === 'string' &&
                              slot.endTime > slot.startTime
                      )
                      .map((slot) => ({
                          startTime: String(slot.startTime),
                          endTime: String(slot.endTime),
                      }))
                : [],
        }))
        .filter((item) => item.date && item.slots.length > 0)
        .map((item) => ({
            date: item.date as Date,
            slots: item.slots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
        }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    const byDate = new Map<string, { date: Date; slots: Array<{ startTime: string; endTime: string }> }>();
    overrides.forEach((item) => {
        const key = item.date.toISOString().slice(0, 10);
        byDate.set(key, item);
    });

    return Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

function normalizeCreateScheduling(input?: InterviewSchedulingInput) {
    const legacyRange =
        (input as any)?.availableFrom && (input as any)?.availableTo
            ? [
                  {
                      startDate: (input as any).availableFrom,
                      endDate: (input as any).availableTo,
                  },
              ]
            : [];

    return {
        enabled: input?.enabled ?? false,
        active: input?.active ?? input?.enabled ?? false,
        timezone: input?.timezone ?? 'Asia/Kolkata',
        organizerName: input?.organizerName ?? env.CALCOM_DEFAULT_ORGANIZER,
        availableRanges: normalizeAvailableRanges(input?.availableRanges ?? legacyRange),
        dateOverrides: normalizeDateOverrides(input?.dateOverrides),
        weekdays: input?.weekdays ?? [1, 2, 3, 4, 5],
        dailySlots: input?.dailySlots ?? [{ startTime: '10:00', endTime: '18:00' }],
        durationMinutes: input?.durationMinutes ?? 45,
        beforeEventBufferMinutes: input?.beforeEventBufferMinutes ?? 5,
        afterEventBufferMinutes: input?.afterEventBufferMinutes ?? 5,
        reminderMinutesBefore: normalizeReminderMinutes(input?.reminderMinutesBefore),
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

    const legacyExistingRanges =
        existingScheduling?.availableFrom && existingScheduling?.availableTo
            ? [
                  {
                      startDate: existingScheduling.availableFrom,
                      endDate: existingScheduling.availableTo,
                  },
              ]
            : [];

    const normalizedExistingRanges =
        Array.isArray(existingScheduling?.availableRanges) && existingScheduling.availableRanges.length
            ? normalizeAvailableRanges(existingScheduling.availableRanges)
            : normalizeAvailableRanges(legacyExistingRanges);

    const normalizedUpdateRanges =
        updates.availableRanges !== undefined
            ? normalizeAvailableRanges(updates.availableRanges)
            : normalizedExistingRanges;

    const normalizedExistingOverrides = normalizeDateOverrides(existingScheduling?.dateOverrides);
    const normalizedUpdateOverrides =
        updates.dateOverrides !== undefined
            ? normalizeDateOverrides(updates.dateOverrides)
            : normalizedExistingOverrides;

    const normalizedReminders =
        updates.reminderMinutesBefore !== undefined
            ? normalizeReminderMinutes(updates.reminderMinutesBefore)
            : normalizeReminderMinutes(existingScheduling?.reminderMinutesBefore);

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
        availableRanges: normalizedUpdateRanges,
        dateOverrides: normalizedUpdateOverrides,
        reminderMinutesBefore: normalizedReminders,
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
                job.interviewScheduling.syncConfigHash = buildInterviewSchedulingSyncHash(
                    job.interviewScheduling as any
                );
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
        const { department, locationType, employmentType, isHiring, search, page = 1, limit = 50 } = filters;

        const query: any = {};

        if (department) query.department = { $regex: department, $options: 'i' };
        if (locationType) query.locationType = locationType;
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
                job.interviewScheduling.syncConfigHash = buildInterviewSchedulingSyncHash(
                    job.interviewScheduling as any
                );
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
            'title department locationType location description requirements employmentType assignmentRequired createdAt'
        );
    }
}
