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
    eventTypeId: number;
    eventTypeSlug?: string;
    bookingUrl: string;
    externalUpdatedAt?: Date;
}

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
                'cal-api-version': env.CALCOM_API_VERSION,
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

        const payload = this.buildEventPayload(input);
        const existingEventTypeId = input.scheduling.eventTypeId;

        if (existingEventTypeId) {
            const response = await this.client.patch(`/v2/event-types/${existingEventTypeId}`, payload);
            const data = normalizeApiData(response.data);
            const bookingUrl = String(data?.bookingUrl || input.scheduling.bookingUrl || '').trim();
            if (!bookingUrl) {
                throw new AppError('Cal.com event type update succeeded but booking URL is missing', 502);
            }

            return {
                eventTypeId: Number(data?.id || existingEventTypeId),
                eventTypeSlug: String(data?.slug || input.scheduling.eventTypeSlug || ''),
                bookingUrl,
                externalUpdatedAt: data?.updatedAt ? new Date(String(data.updatedAt)) : undefined,
            };
        }

        const response = await this.client.post('/v2/event-types', payload);
        const data = normalizeApiData(response.data);
        const eventTypeId = Number(data?.id);
        const bookingUrl = String(data?.bookingUrl || '').trim();

        if (!eventTypeId || !bookingUrl) {
            throw new AppError('Cal.com event type was created but response is missing id or bookingUrl', 502);
        }

        return {
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
        url.searchParams.set('applicationId', opts.applicationId);
        url.searchParams.set('jobId', opts.jobId);
        url.searchParams.set('name', opts.candidateName);
        url.searchParams.set('email', opts.candidateEmail);
        url.searchParams.set('candidateEmail', opts.candidateEmail);
        return url.toString();
    }

    private buildEventPayload(input: SyncJobEventInput): Record<string, unknown> {
        const scheduling = input.scheduling;
        const today = new Date();
        const availableTo = scheduling.availableTo ? new Date(scheduling.availableTo) : undefined;

        const calendarDaysWindow = availableTo
            ? Math.max(1, Math.ceil((availableTo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
            : 90;

        return {
            title: `${input.jobTitle} Interview`,
            slug: scheduling.eventTypeSlug || `${slugify(input.jobTitle)}-${input.jobId.slice(-6)}`,
            description: input.jobDepartment
                ? `Interview scheduling for ${input.jobTitle} (${input.jobDepartment})`
                : `Interview scheduling for ${input.jobTitle}`,
            lengthInMinutes: scheduling.durationMinutes,
            slotInterval: scheduling.slotIntervalMinutes,
            minimumBookingNotice: scheduling.minimumBookingNoticeMinutes,
            beforeEventBuffer: scheduling.beforeEventBufferMinutes,
            afterEventBuffer: scheduling.afterEventBufferMinutes,
            disableGuests: true,
            locations: [
                {
                    type: 'integration',
                    integration: env.CALCOM_EVENT_LOCATION_INTEGRATION,
                },
            ],
            bookingFields: buildBookingFields(),
            bookingWindow: {
                type: 'calendarDays',
                value: calendarDaysWindow,
                rolling: false,
            },
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
}

export const calcomService = new CalcomService();
