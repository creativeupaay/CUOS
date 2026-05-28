import { createHash } from 'crypto';
import { InterviewStatus } from '../models/Interview.model';

export function getNested(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

export function pickFirst(obj: any, paths: string[]): any {
    for (const path of paths) {
        const value = getNested(obj, path);
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return undefined;
}

export function parseCalcomStatus(payload: any): InterviewStatus {
    const raw = String(
        pickFirst(payload, [
            'triggerEvent',
            'event',
            'type',
            'data.type',
            'payload.type',
            'data.status',
            'payload.status',
        ]) || ''
    ).toLowerCase();

    if (raw.includes('cancel')) return 'cancelled';
    if (raw.includes('resched')) return 'rescheduled';
    if (raw.includes('complete')) return 'completed';
    if (raw.includes('no_show') || raw.includes('no-show')) return 'no-show';
    return 'scheduled';
}

export function sanitizeHeaderValue(headerValue: string | string[] | undefined): string {
    if (Array.isArray(headerValue)) {
        return String(headerValue[0] || '').trim();
    }
    return String(headerValue || '').trim();
}

/**
 * Safely extracts a string value from a potentially nested object.
 * If the value is an object, tries to extract common string fields.
 */
export function extractStringValue(value: any): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);

    // If it's an object, try to extract value from common fields
    if (typeof value === 'object') {
        // Try common value fields
        for (const field of ['value', 'label', 'text', 'name', 'id', 'email']) {
            if (value[field] && typeof value[field] === 'string') {
                return String(value[field]).trim();
            }
        }
        // If no common field found, return empty string to avoid [object Object]
        return '';
    }

    return String(value).trim();
}

export function extractWebhookIdentifiers(payload: any): {
    applicationId?: string;
    jobId?: string;
    candidateEmail?: string;
    bookingUid?: string;
    bookingId?: string;
    eventTypeId?: number;
} {
    const applicationIdRaw = pickFirst(payload, [
        'payload.metadata.applicationId',
        'data.metadata.applicationId',
        'metadata.applicationId',
        'payload.booking.metadata.applicationId',
        'data.booking.metadata.applicationId',
        'booking.metadata.applicationId',
        'payload.responses.applicationId.value',
        'data.responses.applicationId.value',
        'responses.applicationId.value',
        'payload.responses.applicationId',
        'data.responses.applicationId',
        'responses.applicationId',
        'payload.booking.responses.applicationId.value',
        'data.booking.responses.applicationId.value',
        'booking.responses.applicationId.value',
        'payload.booking.responses.applicationId',
        'data.booking.responses.applicationId',
        'booking.responses.applicationId',
        'payload.customInputs.applicationId',
        'data.customInputs.applicationId',
        'customInputs.applicationId',
        'payload.booking.customInputs.applicationId',
        'data.booking.customInputs.applicationId',
        'booking.customInputs.applicationId',
        'payload.applicationId',
        'applicationId',
    ]);
    const applicationId = extractStringValue(applicationIdRaw);

    const jobIdRaw = pickFirst(payload, [
        'payload.metadata.jobId',
        'data.metadata.jobId',
        'metadata.jobId',
        'payload.booking.metadata.jobId',
        'data.booking.metadata.jobId',
        'booking.metadata.jobId',
        'payload.responses.jobId.value',
        'data.responses.jobId.value',
        'responses.jobId.value',
        'payload.responses.jobId',
        'data.responses.jobId',
        'responses.jobId',
        'payload.booking.responses.jobId.value',
        'data.booking.responses.jobId.value',
        'booking.responses.jobId.value',
        'payload.booking.responses.jobId',
        'data.booking.responses.jobId',
        'booking.responses.jobId',
        'payload.customInputs.jobId',
        'data.customInputs.jobId',
        'customInputs.jobId',
        'payload.booking.customInputs.jobId',
        'data.booking.customInputs.jobId',
        'booking.customInputs.jobId',
        'payload.jobId',
        'jobId',
    ]);
    const jobId = extractStringValue(jobIdRaw);

    const candidateEmailRaw = pickFirst(payload, [
        'payload.metadata.candidateEmail',
        'data.metadata.candidateEmail',
        'metadata.candidateEmail',
        'payload.responses.email.value',
        'data.responses.email.value',
        'responses.email.value',
        'payload.responses.email',
        'data.responses.email',
        'responses.email',
        'payload.responses.candidateEmail.value',
        'data.responses.candidateEmail.value',
        'responses.candidateEmail.value',
        'payload.responses.candidateEmail',
        'data.responses.candidateEmail',
        'responses.candidateEmail',
        'payload.booking.responses.email.value',
        'data.booking.responses.email.value',
        'booking.responses.email.value',
        'payload.booking.responses.email',
        'data.booking.responses.email',
        'booking.responses.email',
        'payload.booking.responses.candidateEmail.value',
        'data.booking.responses.candidateEmail.value',
        'booking.responses.candidateEmail.value',
        'payload.booking.responses.candidateEmail',
        'data.booking.responses.candidateEmail',
        'booking.responses.candidateEmail',
        'payload.email',
        'data.email',
        'booking.email',
        'payload.user.email',
        'data.user.email',
        'booking.user.email',
        'payload.customInputs.candidateEmail',
        'data.customInputs.candidateEmail',
        'customInputs.candidateEmail',
        'payload.booking.customInputs.candidateEmail',
        'data.booking.customInputs.candidateEmail',
        'booking.customInputs.candidateEmail',
        'payload.attendees.0.email',
        'data.attendees.0.email',
        'booking.attendees.0.email',
        'attendees.0.email',
    ]);
    const candidateEmail = extractStringValue(candidateEmailRaw);

    const bookingUidRaw = pickFirst(payload, [
        'payload.uid',
        'data.uid',
        'booking.uid',
        'uid',
        'payload.booking.uid',
        'data.booking.uid',
    ]);
    const bookingUid = extractStringValue(bookingUidRaw);

    const bookingIdRaw = pickFirst(payload, [
        'payload.id',
        'data.id',
        'booking.id',
        'payload.booking.id',
        'data.booking.id',
    ]);
    const bookingId = extractStringValue(bookingIdRaw);

    const eventTypeIdRaw = pickFirst(payload, [
        'payload.eventTypeId',
        'data.eventTypeId',
        'booking.eventTypeId',
        'payload.eventType.id',
        'data.eventType.id',
        'eventType.id',
    ]);

    const eventTypeId = eventTypeIdRaw !== undefined ? Number(eventTypeIdRaw) : undefined;

    return {
        applicationId: applicationId || undefined,
        jobId: jobId || undefined,
        candidateEmail: candidateEmail || undefined,
        bookingUid: bookingUid || undefined,
        bookingId: bookingId || undefined,
        eventTypeId: Number.isFinite(eventTypeId) ? eventTypeId : undefined,
    };
}

export function buildWebhookFingerprint(input: {
    bookingUid?: string;
    bookingId?: string;
    eventTypeId?: number;
    status: InterviewStatus;
    scheduledTimeIso?: string;
    meetLink?: string;
    rawEvent?: string;
}): string {
    const source = [
        input.bookingUid || '',
        input.bookingId || '',
        String(input.eventTypeId || ''),
        input.status,
        input.scheduledTimeIso || '',
        input.meetLink || '',
        input.rawEvent || '',
    ].join('|');
    return createHash('sha256').update(source).digest('hex');
}

export type WebhookDebugStage =
    | 'received'
    | 'rejected'
    | 'ignored'
    | 'mapped'
    | 'persisted';

export interface WebhookDebugEvent {
    at: string;
    stage: WebhookDebugStage;
    reason?: string;
    rawEvent?: string;
    status?: InterviewStatus;
    ids: {
        applicationId?: string;
        jobId?: string;
        candidateEmail?: string;
        bookingUid?: string;
        bookingId?: string;
        eventTypeId?: number;
    };
    mappedApplicationId?: string;
    mappedJobId?: string;
    interviewId?: string;
    scheduledTime?: string;
}

export const webhookDebugEvents: WebhookDebugEvent[] = [];

export function pushWebhookDebugEvent(event: WebhookDebugEvent): void {
    webhookDebugEvents.unshift(event);
    if (webhookDebugEvents.length > 20) {
        webhookDebugEvents.length = 20;
    }
}
