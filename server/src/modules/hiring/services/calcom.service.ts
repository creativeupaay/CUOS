import axios, { AxiosInstance } from 'axios';
import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import type { IInterviewSchedulingConfig } from '../models/Job.model';

interface SyncJobEventInput {
    jobId: string;
    jobTitle: string;
    jobDepartment?: string;
    scheduling: IInterviewSchedulingConfig;
}

interface SyncedEventInfo {
    scheduleId?: number;
    eventTypeId: number;
    eventTypeSlug?: string;
    bookingUrl: string;
    externalUpdatedAt?: Date;
}

interface CalcomSchedulePayload {
    name: string;
    timeZone: string;
    isDefault: boolean;
    availability: Array<{
        days: string[];
        startTime: string;
        endTime: string;
    }>;
    overrides: Array<{
        date: string;
        startTime: string;
        endTime: string;
    }>;
}

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CALCOM_EVENT_TYPES_API_VERSION = '2024-06-14';
const CALCOM_SCHEDULES_API_VERSION = '2024-06-11';
const MIN_CALENDAR_DAYS_WINDOW = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 48);
}

function normalizeApiData(payload: any): any {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as any).data;
    }
    return payload;
}

function buildFallbackBookingUrlFromTemplate(
    template: string,
    params: Record<string, string>
): string {
    let result = template;
    Object.entries(params).forEach(([key, value]) => {
        const token = `{${key}}`;
        result = result.split(token).join(encodeURIComponent(value));
    });
    return result;
}

function buildBookingFields() {
    return [
        {
            type: 'text',
            slug: 'applicationId',
            label: 'Application ID',
            hidden: true,
            required: false,
            disableOnPrefill: false,
        },
        {
            type: 'text',
            slug: 'jobId',
            label: 'Job ID',
            hidden: true,
            required: false,
            disableOnPrefill: false,
        },
        {
            type: 'text',
            slug: 'candidateEmail',
            label: 'Candidate Email',
            hidden: true,
            required: false,
            disableOnPrefill: false,
        },
    ];
}

export class CalcomService {
    private readonly client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: env.CALCOM_API_BASE_URL,
            timeout: 15000,
            headers: {
                Authorization: env.CALCOM_API_TOKEN
                    ? `Bearer ${env.CALCOM_API_TOKEN}`
                    : undefined,
                'Content-Type': 'application/json',
            },
        });
    }

    async syncJobEventType(input: SyncJobEventInput): Promise<SyncedEventInfo> {
        if (!env.CALCOM_API_TOKEN) {
            throw new AppError(
                'CALCOM_API_TOKEN is required to sync per-job interview scheduling',
                500
            );
        }

        const existingEventTypeId = input.scheduling.eventTypeId;
        const scheduleId = await this.upsertSchedule(input);
        const payload = this.buildEventPayload(input, scheduleId);

        if (existingEventTypeId) {
            const response = await this.client.patch(`/v2/event-types/${existingEventTypeId}`, payload, {
                headers: { 'cal-api-version': CALCOM_EVENT_TYPES_API_VERSION },
            });
            const data = normalizeApiData(response.data);
            const bookingUrl = String(data?.bookingUrl || input.scheduling.bookingUrl || '').trim();
            if (!bookingUrl) {
                throw new AppError('Cal.com event type update succeeded but booking URL is missing', 502);
            }

            return {
                scheduleId,
                eventTypeId: Number(data?.id || existingEventTypeId),
                eventTypeSlug: String(data?.slug || input.scheduling.eventTypeSlug || ''),
                bookingUrl,
                externalUpdatedAt: data?.updatedAt ? new Date(String(data.updatedAt)) : undefined,
            };
        }

        const response = await this.client.post('/v2/event-types', payload, {
            headers: { 'cal-api-version': CALCOM_EVENT_TYPES_API_VERSION },
        });
        const data = normalizeApiData(response.data);
        const eventTypeId = Number(data?.id);
        const bookingUrl = String(data?.bookingUrl || '').trim();

        if (!eventTypeId || !bookingUrl) {
            throw new AppError('Cal.com event type was created but response is missing id or bookingUrl', 502);
        }

        return {
            scheduleId,
            eventTypeId,
            eventTypeSlug: String(data?.slug || ''),
            bookingUrl,
            externalUpdatedAt: data?.updatedAt ? new Date(String(data.updatedAt)) : undefined,
        };
    }

    buildCandidateBookingUrl(opts: {
        applicationId: string;
        jobId: string;
        candidateName: string;
        candidateEmail: string;
        scheduling?: IInterviewSchedulingConfig | null;
    }): string {
        const schedulingUrl = String(opts.scheduling?.bookingUrl || '').trim();
        const fallbackGlobal = String(env.CALCOM_BOOKING_URL || '').trim();

        const baseUrl = schedulingUrl || fallbackGlobal;
        if (!baseUrl) {
            throw new AppError(
                'Interview scheduling is not configured for this job and no global fallback booking URL is available',
                422
            );
        }

        const template = String(env.CALCOM_FALLBACK_BOOKING_URL_TEMPLATE || '').trim();
        const templateParams = {
            applicationId: opts.applicationId,
            jobId: opts.jobId,
            candidateEmail: opts.candidateEmail,
            candidateName: opts.candidateName,
        };

        const resolvedBaseUrl = template
            ? buildFallbackBookingUrlFromTemplate(template, templateParams)
            : baseUrl;

        const url = new URL(resolvedBaseUrl);
        // Ensure candidate links always open a neutral booking page and do not inherit
        // stale calendar navigation state from previously copied URLs.
        [
            'date',
            'month',
            'week',
            'year',
            'slot',
            'startTime',
            'endTime',
            'rescheduleUid',
            'rescheduleToken',
        ].forEach((param) => url.searchParams.delete(param));
        url.searchParams.set('applicationId', opts.applicationId);
        url.searchParams.set('jobId', opts.jobId);
        url.searchParams.set('name', opts.candidateName);
        url.searchParams.set('email', opts.candidateEmail);
        url.searchParams.set('candidateEmail', opts.candidateEmail);
        return url.toString();
    }

    private async getEventType(eventTypeId: number): Promise<any> {
        const response = await this.client.get(`/v2/event-types/${eventTypeId}`, {
            headers: { 'cal-api-version': CALCOM_EVENT_TYPES_API_VERSION },
        });
        return normalizeApiData(response.data);
    }

    private async upsertSchedule(
        input: SyncJobEventInput
    ): Promise<number> {
        const payload = this.buildSchedulePayload(input);

        const response = await this.client.post('/v2/schedules', payload, {
            headers: { 'cal-api-version': CALCOM_SCHEDULES_API_VERSION },
        });
        const data = normalizeApiData(response.data);
        const scheduleId = Number(data?.id);
        if (!scheduleId) {
            throw new AppError('Cal.com schedule creation succeeded but no schedule id was returned', 502);
        }
        return scheduleId;
    }

    private buildEventPayload(
        input: SyncJobEventInput,
        scheduleId: number
    ): Record<string, unknown> {
        const scheduling = input.scheduling;
        const today = new Date();
        const availableFrom = scheduling.availableFrom ? new Date(scheduling.availableFrom) : undefined;
        const availableTo = scheduling.availableTo ? new Date(scheduling.availableTo) : undefined;

        // Booking window strategy:
        // When BOTH boundaries are set → use Cal.com's 'range' type with explicit start/end dates.
        //   This is the only reliable way to prevent candidates from seeing dates outside the window.
        //   A 'calendarDays' window always drifts because 'rolling: true' advances with the current date
        //   and 'rolling: false' anchors to the event-type sync date, both causing stale boundaries.
        // When only one boundary is set → fall back to calendarDays with a correct offsetStart.
        // When no boundaries → rolling 90-day open window.
        let bookingWindow: Record<string, unknown>;
        let offsetStart = 0;

        if (availableFrom && availableTo) {
            // Range type: candidate calendar is locked to exactly these calendar dates.
            bookingWindow = {
                type: 'range',
                value: [
                    this.formatDateInTimeZone(availableFrom, scheduling.timezone),
                    this.formatDateInTimeZone(availableTo, scheduling.timezone),
                ],
            };
            // offsetStart not needed — range type handles the lower bound via startDate.
        } else if (availableFrom) {
            // Only a lower bound: prevent booking before availableFrom.
            // offsetStart is in MINUTES from now.
            offsetStart = Math.max(
                0,
                Math.ceil((availableFrom.getTime() - today.getTime()) / (1000 * 60))
            );
            bookingWindow = {
                type: 'calendarDays',
                value: MIN_CALENDAR_DAYS_WINDOW,
                rolling: true,
            };
        } else if (availableTo) {
            // Only an upper bound: restrict how far in advance a booking can be made.
            const daysToEnd = Math.max(
                1,
                Math.ceil((availableTo.getTime() - today.getTime()) / MS_PER_DAY)
            );
            bookingWindow = {
                type: 'calendarDays',
                value: daysToEnd,
                rolling: false,
            };
        } else {
            // No boundaries: open rolling 90-day window.
            bookingWindow = {
                type: 'calendarDays',
                value: MIN_CALENDAR_DAYS_WINDOW,
                rolling: true,
            };
        }

        return {
            title: `${input.jobTitle} Interview`,
            slug: scheduling.eventTypeSlug || `${slugify(input.jobTitle)}-${input.jobId.slice(-6)}`,
            description: input.jobDepartment
                ? `Interview scheduling for ${input.jobTitle} (${input.jobDepartment})`
                : `Interview scheduling for ${input.jobTitle}`,
            timeZone: scheduling.timezone,
            lengthInMinutes: scheduling.durationMinutes,
            slotInterval: scheduling.slotIntervalMinutes,
            minimumBookingNotice: scheduling.minimumBookingNoticeMinutes,
            beforeEventBuffer: scheduling.beforeEventBufferMinutes,
            afterEventBuffer: scheduling.afterEventBufferMinutes,
            scheduleId,
            disableGuests: true,
            locations: [
                {
                    type: 'integration',
                    integration: env.CALCOM_EVENT_LOCATION_INTEGRATION,
                },
            ],
            bookingFields: buildBookingFields(),
            bookingWindow,
            offsetStart,
            metadata: {
                jobId: input.jobId,
                timezone: scheduling.timezone,
                weekdays: scheduling.weekdays,
                dailySlots: scheduling.dailySlots,
                availableFrom: scheduling.availableFrom ? new Date(scheduling.availableFrom).toISOString() : null,
                availableTo: scheduling.availableTo ? new Date(scheduling.availableTo).toISOString() : null,
            },
        };
    }

    private buildSchedulePayload(input: SyncJobEventInput): CalcomSchedulePayload {
        const scheduling = input.scheduling;
        const dayLabels = scheduling.weekdays
            .map((day) => WEEKDAY_LABELS[day])
            .filter(Boolean);

        if (dayLabels.length === 0) {
            throw new AppError('At least one interview weekday is required to sync Cal.com schedule', 400);
        }

        const availability = scheduling.dailySlots.map((slot) => ({
            days: dayLabels,
            startTime: slot.startTime,
            endTime: slot.endTime,
        }));

        return {
            name: `${input.jobTitle} Interview Schedule`,
            timeZone: scheduling.timezone,
            isDefault: false,
            availability,
            overrides: this.buildBoundaryOverrides(scheduling),
        };
    }

    private buildBoundaryOverrides(
        scheduling: IInterviewSchedulingConfig
    ): CalcomSchedulePayload['overrides'] {
        const availableFrom = scheduling.availableFrom ? new Date(scheduling.availableFrom) : undefined;
        const availableTo = scheduling.availableTo ? new Date(scheduling.availableTo) : undefined;

        if (!availableFrom && !availableTo) {
            return [];
        }

        const byDate = new Map<string, { startTime: string; endTime: string }>();
        const defaultStart = scheduling.dailySlots[0]?.startTime || '00:00';
        const defaultEnd =
            scheduling.dailySlots[scheduling.dailySlots.length - 1]?.endTime || '23:59';

        if (availableFrom) {
            const date = this.formatDateInTimeZone(availableFrom, scheduling.timezone);
            byDate.set(date, {
                startTime: this.formatTimeInTimeZone(availableFrom, scheduling.timezone),
                endTime: defaultEnd,
            });
        }

        if (availableTo) {
            const date = this.formatDateInTimeZone(availableTo, scheduling.timezone);
            const existing = byDate.get(date);
            byDate.set(date, {
                startTime: existing?.startTime || defaultStart,
                endTime: this.formatTimeInTimeZone(availableTo, scheduling.timezone),
            });
        }

        return Array.from(byDate.entries()).map(([date, range]) => ({
            date,
            startTime: range.startTime,
            endTime: range.endTime,
        }));
    }

    private formatDateInTimeZone(date: Date, timeZone: string): string {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });

        return formatter.format(date);
    }

    private formatTimeInTimeZone(date: Date, timeZone: string): string {
        const formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });

        return formatter.format(date);
    }
}

export const calcomService = new CalcomService();
