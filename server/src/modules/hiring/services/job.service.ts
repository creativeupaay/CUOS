import { Job, IJob } from '../models/Job.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import { env } from '../../../config/env.config';
import { calcomService } from './calcom.service';
import { Application } from '../models/Application.model';
import { Assignment } from '../models/Assignment.model';
import { Employee } from '../../hrms/models/Employee.model';
import { OrgSettings } from '../../overall-admin/models/OrgSettings.model';
import { buildInterviewSchedulingSyncHash } from './scheduling-hash.util';
import { getDepartmentCatalog, resolveDepartmentValue } from '../../../utils/department.util';
import type {
    CreateJobInput,
    UpdateJobInput,
    ListJobsInput,
    InterviewSchedulingInput,
    InterviewSchedulingUpdateInput,
    JobApplicationFormInput,
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

function slugifyFieldKey(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
}

const DEFAULT_STANDARD_FIELD_SETTINGS: Record<
    string,
    { label: string; placeholder?: string; helpText?: string }
> = {
    portfolio: {
        label: 'Portfolio URL',
        placeholder: 'https://your-portfolio.com',
    },
    github: {
        label: 'GitHub URL',
        placeholder: 'https://github.com/username',
    },
    linkedin: {
        label: 'LinkedIn URL',
        placeholder: 'https://linkedin.com/in/username',
    },
    experience: {
        label: 'Relevant Experience',
        placeholder: 'Briefly highlight your most relevant work',
    },
    coverLetter: {
        label: 'Cover Letter',
        placeholder: 'Tell us why you are a fit for this role',
    },
    figmaUrl: {
        label: 'Figma URL',
        placeholder: 'https://figma.com/file/...',
    },
};

const DEFAULT_ABOUT_COMPANY_TEXT =
    'Creative Upaay is a tech and design partner that works closely with Startups and Enterprises to build AI based digital products and systems. Our work goes beyond just design or development, we focus on creating practical, scalable solutions that teams actually use. We work across 10+ Industries, for their Custom web solution development, automation workflows, and AI based tools. A lot of our projects involve understanding messy real-world processes and turning them into structured digital experiences.\n\nSo far, we have worked with 85+ brands globally and delivered 350+ projects.\n\nWe look for people who take ownership, think in systems, and care about solving real problems, not just completing tasks. Our Team culture is simple: low ego, high responsibility, honest communication, and a strong focus on doing quality work that actually makes an impact.';

function normalizeApplicationForm(input?: JobApplicationFormInput) {
    const selectedStandardFields = Array.isArray(input?.selectedStandardFields)
        ? Array.from(
              new Set(
                  input.selectedStandardFields.filter((field) =>
                      ['portfolio', 'github', 'linkedin', 'experience', 'coverLetter', 'figmaUrl'].includes(field)
                  )
              )
          )
        : ['portfolio', 'linkedin', 'experience', 'coverLetter'];

    const standardFieldSettingsInput = Array.isArray(input?.standardFieldSettings)
        ? input.standardFieldSettings
        : [];

    const standardFieldSettings = selectedStandardFields.map((fieldKey) => {
        const matchingInput = standardFieldSettingsInput.find((item) => item.key === fieldKey);
        const defaults = DEFAULT_STANDARD_FIELD_SETTINGS[fieldKey] || {
            label: fieldKey,
        };

        return {
            key: fieldKey,
            label: String(matchingInput?.label || defaults.label).trim(),
            placeholder:
                String(matchingInput?.placeholder || defaults.placeholder || '').trim() || undefined,
            helpText:
                String(matchingInput?.helpText || defaults.helpText || '').trim() || undefined,
        };
    });

    const customFields = Array.isArray(input?.customFields)
        ? input.customFields
              .map((field) => ({
                  key: slugifyFieldKey(field.key || field.label),
                  label: String(field.label || '').trim(),
                  type: field.type,
                  placeholder: String(field.placeholder || '').trim() || undefined,
                  helpText: String(field.helpText || '').trim() || undefined,
              }))
              .filter((field) => field.key && field.label)
        : [];

    const uniqueCustomFields = Array.from(
        customFields.reduce((map, field) => map.set(field.key, field), new Map<string, (typeof customFields)[number]>()).values()
    );

    const pageSectionsInput = (input?.pageSections || {}) as {
        showAboutRole?: boolean;
        showRequirements?: boolean;
        showWhatYouGet?: boolean;
        whatYouGet?: string;
    };

    return {
        selectedStandardFields,
        standardFieldSettings,
        customFields: uniqueCustomFields,
        pageSections: {
            showAboutCompany: true,
            showAboutRole: pageSectionsInput.showAboutRole ?? true,
            showRequirements: pageSectionsInput.showRequirements ?? true,
            showWhatYouGet: pageSectionsInput.showWhatYouGet ?? true,
            aboutCompany: '',
            whatYouGet: String(pageSectionsInput.whatYouGet || '').trim() || '',
        },
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
        const departmentCatalog = await getDepartmentCatalog();
        const scheduling = normalizeCreateScheduling(data.interviewScheduling);
        const applicationForm = normalizeApplicationForm(data.applicationForm);

        const job = await Job.create({
            ...data,
            department: resolveDepartmentValue(data.department, departmentCatalog),
            managers: data.managers || [],
            applicationForm,
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

        return job.populate([
            { path: 'createdBy', select: 'name email' },
            { path: 'managers', select: 'userId designation department', populate: { path: 'userId', select: 'name email' } },
        ]);
    }

    /**
     * Get all jobs with optional filters
     */
    async getJobs(filters: ListJobsInput, managerUserId?: string): Promise<{
        jobs: IJob[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { department, locationType, employmentType, isHiring, search, page = 1, limit = 50 } = filters;

        const query: any = {};

        // If managerUserId is provided, filter to only jobs managed by this user
        if (managerUserId) {
            const employee = await Employee.findOne({ userId: managerUserId }).select('_id');
            if (!employee) {
                return { jobs: [], total: 0, page, totalPages: 0 };
            }
            query.managers = employee._id;
        }

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
                .populate('createdBy', 'name email')
                .populate({ path: 'managers', select: 'userId designation department', populate: { path: 'userId', select: 'name email' } }),
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
        const job = await Job.findById(id)
            .populate('createdBy', 'name email')
            .populate({ path: 'managers', select: 'userId designation department', populate: { path: 'userId', select: 'name email' } });
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

        const departmentCatalog = await getDepartmentCatalog();
        const updatePayload: any = { ...data };
        if ('department' in data) {
            updatePayload.department = resolveDepartmentValue(data.department, departmentCatalog);
        }

        if (data.interviewScheduling) {
            updatePayload.interviewScheduling = mergeSchedulingUpdate(
                existing.interviewScheduling,
                data.interviewScheduling
            );
        }

        if (data.applicationForm) {
            const existingApplicationForm =
                existing.applicationForm && typeof (existing.applicationForm as any).toObject === 'function'
                    ? (existing.applicationForm as any).toObject()
                    : existing.applicationForm;
            updatePayload.applicationForm = normalizeApplicationForm({
                ...(existingApplicationForm || {}),
                ...data.applicationForm,
            });
        }

        const job = await Job.findByIdAndUpdate(id, updatePayload, {
            new: true,
            runValidators: true,
        });

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Only sync with Cal.com if interview scheduling configuration was actually updated
        if (data.interviewScheduling) {
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
        }

        return job.populate([
            { path: 'createdBy', select: 'name email' },
            { path: 'managers', select: 'userId designation department', populate: { path: 'userId', select: 'name email' } },
        ]);
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
    async getActiveJobs(): Promise<any[]> {
        const jobs = await Job.find({ isHiring: true })
            .sort({ createdAt: -1 })
            .select(
                'title department locationType location description requirements employmentType assignmentRequired applicationForm createdAt'
            )
            .lean();

        let settings = await OrgSettings.findOne().select('hiring');
        if (!settings) {
            settings = await OrgSettings.create({});
        }

        const showAboutCompany = settings.hiring?.publicJobPage?.showAboutCompany ?? true;
        const aboutCompanyText =
            String(settings.hiring?.publicJobPage?.aboutCompanyText || '').trim() ||
            DEFAULT_ABOUT_COMPANY_TEXT;

        return jobs.map((job: any) => ({
            ...job,
            applicationForm: {
                ...(job.applicationForm || {}),
                pageSections: {
                    ...(job.applicationForm?.pageSections || {}),
                    showAboutCompany,
                    aboutCompany: aboutCompanyText,
                },
            },
        }));
    }

    async getApplicationFieldLibrary() {
        let settings = await OrgSettings.findOne().select('hiring');
        if (!settings) {
            settings = await OrgSettings.create({});
        }

        return settings.hiring?.applicationFieldLibrary || [];
    }

    async saveApplicationField(field: {
        key?: string;
        label: string;
        type: 'text' | 'url' | 'number' | 'note' | 'date' | 'attachment';
        placeholder?: string;
        helpText?: string;
    }) {
        let settings = await OrgSettings.findOne();
        if (!settings) {
            settings = await OrgSettings.create({});
        }

        const nextField = {
            key: slugifyFieldKey(field.key || field.label),
            label: String(field.label || '').trim(),
            type: field.type,
            placeholder: String(field.placeholder || '').trim() || undefined,
            helpText: String(field.helpText || '').trim() || undefined,
            createdAt: new Date(),
        };

        if (!nextField.key || !nextField.label) {
            throw new AppError('Field name is required', 400);
        }

        const existingFields = settings.hiring?.applicationFieldLibrary || [];
        const deduped = existingFields.filter((item: any) => item.key !== nextField.key);
        settings.hiring = {
            ...(settings.hiring || { applicationFieldLibrary: [] }),
            applicationFieldLibrary: [...deduped, nextField],
        };
        await settings.save();
        return settings.hiring.applicationFieldLibrary;
    }

    async deleteApplicationField(key: string) {
        const settings = await OrgSettings.findOne();
        if (!settings) {
            return [];
        }

        settings.hiring = {
            ...(settings.hiring || { applicationFieldLibrary: [] }),
            applicationFieldLibrary: (settings.hiring?.applicationFieldLibrary || []).filter(
                (field: any) => field.key !== key
            ),
        };
        await settings.save();
        return settings.hiring.applicationFieldLibrary;
    }

    /**
     * Check if a user is a job manager for any job
     */
    async isUserJobManager(userId: string): Promise<boolean> {
        const employee = await Employee.findOne({ userId }).select('_id');
        if (!employee) return false;
        const count = await Job.countDocuments({ managers: employee._id });
        return count > 0;
    }

    /**
     * Check if a user is a manager for a specific job
     */
    async isUserManagerForJob(userId: string, jobId: string): Promise<boolean> {
        const employee = await Employee.findOne({ userId }).select('_id');
        if (!employee) return false;
        const count = await Job.countDocuments({ _id: jobId, managers: employee._id });
        return count > 0;
    }

    /**
     * Get active employees list for manager picker
     */
    async getEmployeesList(): Promise<any[]> {
        const employees = await Employee.find({ status: 'active' })
            .select('userId designation department profilePhoto')
            .populate('userId', 'name email')
            .sort({ department: 1 })
            .lean();
        return employees;
    }
}
