import axios, { AxiosInstance } from 'axios';
import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import type { IInterviewSchedulingConfig } from '../models/Job.model';
import { logger } from "../../../utils/logger";

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
const CALCOM_BOOKINGS_API_VERSION = '2024-08-13';
const MIN_CALENDAR_DAYS_WINDOW = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_RANGE_OVERRIDE_DAYS = 400;

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

function normalizeAvailabilityRanges(
    scheduling: IInterviewSchedulingConfig
): Array<{
    startDate: Date;
    endDate: Date;
    weekdays?: number[];
    dailySlots?: Array<{ startTime: string; endTime: string }>;
}> {
    const rawRanges = Array.isArray((scheduling as any).availableRanges)
        ? (scheduling as any).availableRanges
        : [];

    const normalized = rawRanges
        .map((range: any) => ({
            startDate: new Date(range.startDate),
            endDate: new Date(range.endDate),
            weekdays: Array.isArray(range.weekdays)
                ? range.weekdays
                      .map((day: any) => Number(day))
                      .filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6)
                : undefined,
            dailySlots: Array.isArray(range.dailySlots)
                ? range.dailySlots
                      .filter(
                          (slot: any) =>
                              typeof slot?.startTime === 'string' &&
                              typeof slot?.endTime === 'string' &&
                              slot.endTime > slot.startTime
                      )
                      .map((slot: any) => ({
                          startTime: String(slot.startTime),
                          endTime: String(slot.endTime),
                      }))
                : undefined,
        }))
        .filter(
            (range: { startDate: Date; endDate: Date }) =>
                !Number.isNaN(range.startDate.getTime()) &&
                !Number.isNaN(range.endDate.getTime()) &&
                range.startDate.getTime() <= range.endDate.getTime()
        )
        .sort(
            (a: { startDate: Date; endDate: Date }, b: { startDate: Date; endDate: Date }) =>
                a.startDate.getTime() - b.startDate.getTime()
        );

    if (normalized.length > 0) {
        return normalized;
    }

    // Legacy fallback for older records that still have availableFrom/availableTo.
    const legacyFrom = (scheduling as any).availableFrom ? new Date((scheduling as any).availableFrom) : undefined;
    const legacyTo = (scheduling as any).availableTo ? new Date((scheduling as any).availableTo) : undefined;

    if (
        legacyFrom &&
        legacyTo &&
        !Number.isNaN(legacyFrom.getTime()) &&
        !Number.isNaN(legacyTo.getTime()) &&
        legacyFrom.getTime() <= legacyTo.getTime()
    ) {
        return [{ startDate: legacyFrom, endDate: legacyTo }];
    }

    return [];
}

function normalizeDateOverrides(
    scheduling: IInterviewSchedulingConfig
): Array<{ date: Date; slots: Array<{ startTime: string; endTime: string }> }> {
    const rawOverrides = Array.isArray((scheduling as any).dateOverrides)
        ? (scheduling as any).dateOverrides
        : [];

    return rawOverrides
        .map((item: any) => ({
            date: new Date(item?.date),
            slots: Array.isArray(item?.slots)
                ? item.slots
                      .filter(
                          (slot: any) =>
                              typeof slot?.startTime === 'string' &&
                              typeof slot?.endTime === 'string' &&
                              slot.endTime > slot.startTime
                      )
                      .map((slot: any) => ({
                          startTime: String(slot.startTime),
                          endTime: String(slot.endTime),
                      }))
                : [],
        }))
        .filter(
            (item: { date: Date; slots: Array<{ startTime: string; endTime: string }> }) =>
                !Number.isNaN(item.date.getTime()) && item.slots.length > 0
        )
        .sort(
            (
                a: { date: Date; slots: Array<{ startTime: string; endTime: string }> },
                b: { date: Date; slots: Array<{ startTime: string; endTime: string }> }
            ) => a.date.getTime() - b.date.getTime()
        );
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

        // If we have an existing event type ID, try to update it
        if (existingEventTypeId) {
            try {
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
            } catch (error: any) {
                // If the event type no longer exists (404), create a new one instead
                const is404 = error?.response?.status === 404 || error?.status === 404;
                if (!is404) {
                    throw error;
                }
                // Fall through to create a new event type
                logger.info(`[Cal.com] Event type ${existingEventTypeId} not found (404), creating new one`);
            }
        }

        // Create a new event type
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

    async cancelBooking(bookingUid: string, cancellationReason: string): Promise<void> {
        const uid = String(bookingUid || '').trim();
        if (!uid) {
            throw new AppError('Booking uid is required to cancel the interview booking', 400);
        }

        if (!env.CALCOM_API_TOKEN) {
            throw new AppError('CALCOM_API_TOKEN is required to cancel interview bookings', 500);
        }

        await this.client.post(
            `/v2/bookings/${uid}/cancel`,
            { cancellationReason },
            {
                headers: { 'cal-api-version': CALCOM_BOOKINGS_API_VERSION },
            }
        );
    }

    async getBooking(bookingUid: string): Promise<any> {
        const uid = String(bookingUid || '').trim();
        if (!uid) {
            throw new AppError('Booking uid is required to fetch booking details', 400);
        }

        if (!env.CALCOM_API_TOKEN) {
            throw new AppError('CALCOM_API_TOKEN is required to fetch interview bookings', 500);
        }

        const response = await this.client.get(`/v2/bookings/${uid}`, {
            headers: { 'cal-api-version': CALCOM_BOOKINGS_API_VERSION },
        });

        return normalizeApiData(response.data);
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

        const existingScheduleId = Number(input.scheduling.scheduleId || 0);
        if (existingScheduleId > 0) {
            try {
                await this.client.patch(`/v2/schedules/${existingScheduleId}`, payload, {
                    headers: { 'cal-api-version': CALCOM_SCHEDULES_API_VERSION },
                });
                return existingScheduleId;
            } catch (error: any) {
                const status = Number(error?.response?.status || 0);
                if (status !== 404) {
                    throw error;
                }
                // If the old schedule id is gone, fall back to creating a fresh one.
            }
        }

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
        const availabilityRanges = normalizeAvailabilityRanges(scheduling);
        const dateOverrides = normalizeDateOverrides(scheduling);
        const availableFrom = availabilityRanges[0]?.startDate;
        const availableTo = availabilityRanges[availabilityRanges.length - 1]?.endDate;

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
            slotInterval: scheduling.durationMinutes,
            minimumBookingNotice: 0,
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
                availableRanges: availabilityRanges.map((range) => ({
                    startDate: range.startDate.toISOString(),
                    endDate: range.endDate.toISOString(),
                    weekdays: range.weekdays || scheduling.weekdays,
                    dailySlots: range.dailySlots || scheduling.dailySlots,
                })),
                dateOverrides: dateOverrides.map((item) => ({
                    date: item.date.toISOString(),
                    slots: item.slots,
                })),
            },
        };
    }

    private buildSchedulePayload(input: SyncJobEventInput): CalcomSchedulePayload {
        const scheduling = input.scheduling;
        const dayLabels = scheduling.weekdays
            .map((day) => WEEKDAY_LABELS[day])
            .filter(Boolean);
        const availabilityRanges = normalizeAvailabilityRanges(scheduling);
        const dateOverrides = normalizeDateOverrides(scheduling);

        if (dayLabels.length === 0) {
            throw new AppError('At least one interview weekday is required to sync Cal.com schedule', 400);
        }

        const availability = availabilityRanges.length
            ? []
            : scheduling.dailySlots.map((slot) => ({
                  days: dayLabels,
                  startTime: slot.startTime,
                  endTime: slot.endTime,
              }));

        const baseOverrides = availabilityRanges.length
            ? this.buildRangeOverrides({
                  ranges: availabilityRanges,
                  defaultWeekdays: scheduling.weekdays,
                  defaultSlots: scheduling.dailySlots,
                  timeZone: scheduling.timezone,
              })
            : [];

        const overrides = this.applyDateOverrides({
            baseOverrides,
            dateOverrides,
            timeZone: scheduling.timezone,
        });

        return {
            name: `${input.jobTitle} Interview Schedule`,
            timeZone: scheduling.timezone,
            isDefault: false,
            availability,
            overrides,
        };
    }

    private buildRangeOverrides(input: {
        ranges: Array<{
            startDate: Date;
            endDate: Date;
            weekdays?: number[];
            dailySlots?: Array<{ startTime: string; endTime: string }>;
        }>;
        defaultWeekdays: number[];
        defaultSlots: Array<{ startTime: string; endTime: string }>;
        timeZone: string;
    }): Array<{ date: string; startTime: string; endTime: string }> {
        const overrides: Array<{ date: string; startTime: string; endTime: string }> = [];

        for (const range of input.ranges) {
            const weekdaySet = new Set(
                Array.isArray(range.weekdays) && range.weekdays.length
                    ? range.weekdays
                    : input.defaultWeekdays
            );
            const slots =
                Array.isArray(range.dailySlots) && range.dailySlots.length
                    ? range.dailySlots
                    : input.defaultSlots;
            const current = new Date(range.startDate);
            let daysAdded = 0;

            while (current.getTime() <= range.endDate.getTime()) {
                if (daysAdded > MAX_RANGE_OVERRIDE_DAYS) {
                    break;
                }

                const dayOfWeek = current.getUTCDay();
                if (weekdaySet.has(dayOfWeek)) {
                    const dateLabel = this.formatDateInTimeZone(current, input.timeZone);
                    slots.forEach((slot) => {
                        overrides.push({
                            date: dateLabel,
                            startTime: slot.startTime,
                            endTime: slot.endTime,
                        });
                    });
                }

                current.setUTCDate(current.getUTCDate() + 1);
                daysAdded += 1;
            }
        }

        return overrides;
    }

    private applyDateOverrides(input: {
        baseOverrides: Array<{ date: string; startTime: string; endTime: string }>;
        dateOverrides: Array<{ date: Date; slots: Array<{ startTime: string; endTime: string }> }>;
        timeZone: string;
    }): Array<{ date: string; startTime: string; endTime: string }> {
        const grouped = new Map<string, Array<{ date: string; startTime: string; endTime: string }>>();

        input.baseOverrides.forEach((item) => {
            const existing = grouped.get(item.date) || [];
            existing.push(item);
            grouped.set(item.date, existing);
        });

        input.dateOverrides.forEach((override) => {
            const dateLabel = this.formatDateInTimeZone(override.date, input.timeZone);
            grouped.set(
                dateLabel,
                override.slots.map((slot) => ({
                    date: dateLabel,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                }))
            );
        });

        return Array.from(grouped.values())
            .flat()
            .sort((a, b) => {
                if (a.date === b.date) {
                    return a.startTime.localeCompare(b.startTime);
                }
                return a.date.localeCompare(b.date);
            });
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

}

export const calcomService = new CalcomService();
