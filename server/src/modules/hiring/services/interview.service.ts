import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import type { IncomingHttpHeaders } from 'http';
import { createHash } from 'crypto';
import { Application } from '../models/Application.model';
import { Assignment } from '../models/Assignment.model';
import { AssignmentSubmission } from '../models/AssignmentSubmission.model';
import { Interview, IInterview, InterviewStatus } from '../models/Interview.model';
import { InterviewNote, IInterviewNote } from '../models/InterviewNote.model';
import { InterviewNotification } from '../models/InterviewNotification.model';
import { Job } from '../models/Job.model';
import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import type {
    ListInterviewsInput,
    SaveInterviewNoteInput,
} from '../validators/interview.validator';
import {
    sendInterviewInviteEmail,
    sendInterviewReminderForCandidateEmail,
    sendInterviewScheduledForCandidateEmail,
    sendInterviewScheduledForHrEmail,
} from '../../../services/email.service';
import { logApplicationActivity } from './activity.service';
import { calcomService } from './calcom.service';
import { buildInterviewSchedulingSyncHash } from './scheduling-hash.util';

function getNested(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function pickFirst(obj: any, paths: string[]): any {
    for (const path of paths) {
        const value = getNested(obj, path);
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return undefined;
}

function parseCalcomStatus(payload: any): InterviewStatus {
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

function sanitizeHeaderValue(headerValue: string | string[] | undefined): string {
    if (Array.isArray(headerValue)) {
        return String(headerValue[0] || '').trim();
    }
    return String(headerValue || '').trim();
}

/**
 * Safely extracts a string value from a potentially nested object.
 * If the value is an object, tries to extract common string fields.
 */
function extractStringValue(value: any): string {
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

function extractWebhookIdentifiers(payload: any): {
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

function buildWebhookFingerprint(input: {
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

type WebhookDebugStage =
    | 'received'
    | 'rejected'
    | 'ignored'
    | 'mapped'
    | 'persisted';

interface WebhookDebugEvent {
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

const webhookDebugEvents: WebhookDebugEvent[] = [];

function pushWebhookDebugEvent(event: WebhookDebugEvent): void {
    webhookDebugEvents.unshift(event);
    if (webhookDebugEvents.length > 20) {
        webhookDebugEvents.length = 20;
    }
}

const interviewReminderTimers = new Map<string, NodeJS.Timeout>();

function reminderTimerKey(interviewId: string, reminderMinutesBefore: number): string {
    return `${interviewId}:${reminderMinutesBefore}`;
}

function clearInterviewReminderTimer(interviewId: string): void {
    for (const [key, timer] of interviewReminderTimers.entries()) {
        if (!key.startsWith(`${interviewId}:`)) {
            continue;
        }
        clearTimeout(timer);
        interviewReminderTimers.delete(key);
    }
}

function normalizeReminderMinutes(value: unknown): number[] {
    const raw = Array.isArray(value) ? value : value !== undefined && value !== null ? [value] : [];
    const normalized = raw
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item >= 0)
        .map((item) => Math.floor(item));

    const uniqueSorted = Array.from(new Set(normalized)).sort((a, b) => a - b);
    return uniqueSorted.length ? uniqueSorted : [];
}

async function sendInterviewReminderEmailIfValid(input: {
    interviewId: string;
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    interviewer: string;
    scheduledTime: Date;
    meetLink: string;
    reminderMinutesBefore: number;
}): Promise<void> {
    const interview = await Interview.findById(input.interviewId).select(
        'status scheduledTime reminderSentAt reminderOffsetsSent'
    );
    if (!interview) {
        return;
    }

    if (interview.status === 'cancelled' || interview.status === 'completed' || interview.status === 'no-show') {
        return;
    }

    const sentOffsets = Array.isArray((interview as any).reminderOffsetsSent)
        ? ((interview as any).reminderOffsetsSent as number[])
        : [];

    if (sentOffsets.includes(input.reminderMinutesBefore)) {
        return;
    }

    const expectedTime = input.scheduledTime.getTime();
    if (interview.scheduledTime.getTime() !== expectedTime) {
        return;
    }

    if (input.scheduledTime.getTime() <= Date.now()) {
        return;
    }

    await sendInterviewReminderForCandidateEmail({
        to: input.candidateEmail,
        candidateName: input.candidateName,
        jobTitle: input.jobTitle,
        interviewer: input.interviewer,
        scheduledTime: input.scheduledTime,
        meetLink: input.meetLink,
    });

    await Interview.findByIdAndUpdate(input.interviewId, {
        reminderSentAt: new Date(),
        $addToSet: {
            reminderOffsetsSent: input.reminderMinutesBefore,
        },
    });
}

function scheduleInterviewReminder(input: {
    interviewId: string;
    candidateEmail: string;
    candidateName: string;
    jobTitle: string;
    interviewer: string;
    scheduledTime: Date;
    meetLink: string;
    reminderMinutesBefore: number;
}): void {
    if (input.reminderMinutesBefore <= 0) {
        return;
    }

    const reminderAt = input.scheduledTime.getTime() - input.reminderMinutesBefore * 60 * 1000;
    const delay = reminderAt - Date.now();

    if (delay <= 0) {
        sendInterviewReminderEmailIfValid(input).catch((error) => {
            console.error('Failed sending immediate interview reminder:', error);
        });
        return;
    }

    const timerKey = reminderTimerKey(input.interviewId, input.reminderMinutesBefore);
    const existingTimer = interviewReminderTimers.get(timerKey);
    if (existingTimer) {
        clearTimeout(existingTimer);
        interviewReminderTimers.delete(timerKey);
    }

    const timer = setTimeout(() => {
        sendInterviewReminderEmailIfValid(input)
            .catch((error) => {
                console.error('Failed sending scheduled interview reminder:', error);
            })
            .finally(() => {
                interviewReminderTimers.delete(timerKey);
            });
    }, delay);

    interviewReminderTimers.set(timerKey, timer);
}

export class InterviewService {
    getWebhookDebug(limit = 20): WebhookDebugEvent[] {
        const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
        return webhookDebugEvents.slice(0, safeLimit);
    }

    async sendInterviewInvite(applicationId: string, actorId?: string): Promise<string> {
        const application = await Application.findById(applicationId).populate(
            'jobId',
            'title interviewScheduling'
        );
        if (!application) {
            throw new AppError('Application not found', 404);
        }

        const job =
            application.jobId && typeof application.jobId === 'object'
                ? (application.jobId as any)
                : null;

        if (!job) {
            throw new AppError('Job details are missing on this application', 422);
        }

        let scheduling = job.interviewScheduling;
        const hasJobScheduling = Boolean(scheduling?.enabled);
        const schedulingHash = hasJobScheduling
            ? buildInterviewSchedulingSyncHash(scheduling as any)
            : '';
        const syncedHash = String((scheduling as any)?.syncConfigHash || '').trim();
        const hasSchedulingDrift = Boolean(schedulingHash && syncedHash && schedulingHash !== syncedHash);
        if (
            hasJobScheduling &&
            (!scheduling?.active ||
                scheduling?.syncStatus !== 'synced' ||
                !scheduling?.scheduleId ||
                !scheduling?.eventTypeId ||
                !scheduling?.bookingUrl ||
                hasSchedulingDrift)
        ) {
            const jobDoc = await Job.findById(String(job._id));

            if (!jobDoc?.interviewScheduling?.enabled) {
                throw new AppError(
                    'Interview scheduling is not enabled for this job',
                    422
                );
            }

            jobDoc.interviewScheduling.syncStatus = 'pending';
            jobDoc.interviewScheduling.syncError = undefined;
            await jobDoc.save();

            try {
                const synced = await calcomService.syncJobEventType({
                    jobId: String(jobDoc._id),
                    jobTitle: jobDoc.title,
                    jobDepartment: jobDoc.department,
                    scheduling: jobDoc.interviewScheduling as any,
                });

                jobDoc.interviewScheduling.scheduleId = synced.scheduleId;
                jobDoc.interviewScheduling.eventTypeId = synced.eventTypeId;
                jobDoc.interviewScheduling.eventTypeSlug = synced.eventTypeSlug;
                jobDoc.interviewScheduling.bookingUrl = synced.bookingUrl;
                jobDoc.interviewScheduling.externalUpdatedAt = synced.externalUpdatedAt;
                jobDoc.interviewScheduling.lastSyncedAt = new Date();
                jobDoc.interviewScheduling.syncStatus = 'synced';
                jobDoc.interviewScheduling.syncConfigHash = buildInterviewSchedulingSyncHash(
                    jobDoc.interviewScheduling as any
                );
                jobDoc.interviewScheduling.syncError = undefined;
                jobDoc.interviewScheduling.active = true;
                await jobDoc.save();

                scheduling = jobDoc.interviewScheduling;
            } catch (error: any) {
                jobDoc.interviewScheduling.syncStatus = 'failed';
                jobDoc.interviewScheduling.syncError =
                    error?.message || 'Failed to sync interview scheduling with Cal.com';
                jobDoc.interviewScheduling.active = false;
                await jobDoc.save();

                throw new AppError(
                    `Interview scheduling sync failed for this job: ${jobDoc.interviewScheduling.syncError}`,
                    422
                );
            }
        }

        const bookingUrl = calcomService.buildCandidateBookingUrl({
            applicationId,
            jobId: String(job._id),
            candidateName: application.name,
            candidateEmail: application.email,
            scheduling,
        });

        const jobTitle =
            application.jobId && typeof application.jobId === 'object'
                ? String((application.jobId as any).title || 'the role')
                : 'the role';

        sendInterviewInviteEmail({
            to: application.email,
            candidateName: application.name,
            jobTitle,
            bookingUrl,
        }).catch((err) => {
            console.error('Failed to send interview invite email asynchronously:', err);
        });

        await Application.findByIdAndUpdate(applicationId, { status: 'interview' });

        await logApplicationActivity({
            applicationId: application._id,
            type: 'interview.invite_sent',
            title: 'Interview Invite Sent',
            description: 'Interview invite email was sent with booking link.',
            actorType: actorId ? 'user' : 'system',
            actorId,
            metadata: {
                bookingUrl,
                jobId: String(job._id),
                eventTypeId: scheduling?.eventTypeId,
            },
        });
        return bookingUrl;
    }

    async handleCalcomWebhook(payload: any, headers: IncomingHttpHeaders): Promise<void> {
        // Comprehensive webhook payload logging for debugging
        console.log('=== CAL.COM WEBHOOK FULL PAYLOAD START ===');
        console.log(JSON.stringify(payload, null, 2));
        console.log('=== CAL.COM WEBHOOK FULL PAYLOAD END ===');

        const configuredSecret = env.CALCOM_WEBHOOK_SECRET?.trim();
        if (configuredSecret) {
            const headerSecret =
                sanitizeHeaderValue(headers['x-cal-secret-key']) ||
                sanitizeHeaderValue(headers['x-calcom-secret-key']) ||
                sanitizeHeaderValue(headers['x-webhook-secret']) ||
                sanitizeHeaderValue(headers['x-cal-webhook-secret']);

            // Some Cal.com webhook modes do not send a shared-secret header.
            // Only reject when a secret header is present but mismatched.
            if (headerSecret && headerSecret !== configuredSecret) {
                pushWebhookDebugEvent({
                    at: new Date().toISOString(),
                    stage: 'rejected',
                    reason: 'Invalid webhook secret header',
                    ids: {},
                });
                throw new AppError('Invalid Cal.com webhook secret', 401);
            }
        }

        const ids = extractWebhookIdentifiers(payload);
        const status = parseCalcomStatus(payload);
        const rawEvent = String(
            pickFirst(payload, ['triggerEvent', 'event', 'type', 'data.type', 'payload.type']) || ''
        ).trim();

        console.info('Cal.com webhook extracted identifiers', {
            rawEvent,
            status,
            bookingUid: ids.bookingUid,
            bookingId: ids.bookingId,
            eventTypeId: ids.eventTypeId,
            candidateEmail: ids.candidateEmail,
            applicationId: ids.applicationId,
            jobId: ids.jobId,
            // Show types to verify proper extraction
            types: {
                candidateEmail: typeof ids.candidateEmail,
                applicationId: typeof ids.applicationId,
                jobId: typeof ids.jobId,
            },
        });
        pushWebhookDebugEvent({
            at: new Date().toISOString(),
            stage: 'received',
            rawEvent,
            status,
            ids,
        });

        let applicationId = ids.applicationId;

        if (!applicationId && ids.bookingUid) {
            const byBooking = await Interview.findOne({ calcomBookingUid: ids.bookingUid }).select(
                'applicationId'
            );
            if (byBooking?.applicationId) {
                applicationId = String(byBooking.applicationId);
            }
        }

        if (!applicationId && ids.candidateEmail && ids.jobId) {
            const latestByEmailAndJob = await Application.findOne({
                email: String(ids.candidateEmail).toLowerCase(),
                jobId: ids.jobId,
            })
                .sort({ createdAt: -1 })
                .select('_id');
            if (latestByEmailAndJob?._id) {
                applicationId = String(latestByEmailAndJob._id);
            }
        }

        if (!applicationId && ids.candidateEmail && ids.eventTypeId) {
            const mappedJob = await Job.findOne({
                'interviewScheduling.eventTypeId': ids.eventTypeId,
            }).select('_id');

            if (mappedJob?._id) {
                const latestByEmailAndEventJob = await Application.findOne({
                    email: String(ids.candidateEmail).toLowerCase(),
                    jobId: mappedJob._id,
                })
                    .sort({ createdAt: -1 })
                    .select('_id');

                if (latestByEmailAndEventJob?._id) {
                    applicationId = String(latestByEmailAndEventJob._id);
                }
            }
        }

        if (!applicationId && ids.candidateEmail) {
            const latestInterviewStageApplication = await Application.findOne({
                email: String(ids.candidateEmail).toLowerCase(),
                status: { $in: ['interview', 'interview-scheduled', 'interview-cancelled'] },
            })
                .sort({ updatedAt: -1 })
                .select('_id');

            if (latestInterviewStageApplication?._id) {
                applicationId = String(latestInterviewStageApplication._id);
            }
        }

        if (!applicationId) {
            console.error('Cal.com webhook ignored: unable to map payload to application', {
                ids,
                rawEvent,
            });
            pushWebhookDebugEvent({
                at: new Date().toISOString(),
                stage: 'ignored',
                reason: 'Unable to map payload to application',
                rawEvent,
                status,
                ids,
            });
            return;
        }

        const application = await Application.findById(applicationId)
            .select('_id name email jobId')
            .populate('jobId', 'title interviewScheduling');
        if (!application) {
            console.error('Cal.com webhook ignored: mapped application not found', {
                applicationId,
            });
            pushWebhookDebugEvent({
                at: new Date().toISOString(),
                stage: 'ignored',
                reason: 'Mapped application not found',
                rawEvent,
                status,
                ids,
                mappedApplicationId: applicationId,
            });
            return;
        }

        if (ids.jobId && String(application.jobId?._id || application.jobId) !== String(ids.jobId)) {
            console.warn('Cal.com webhook job mismatch; continuing with mapped application', {
                applicationId,
                jobIdFromWebhook: ids.jobId,
            });
        }

        const appJobId = String((application.jobId as any)?._id || application.jobId || '');
        if (!appJobId) {
            console.error('Cal.com webhook ignored: application has no jobId', {
                applicationId,
            });
            pushWebhookDebugEvent({
                at: new Date().toISOString(),
                stage: 'ignored',
                reason: 'Mapped application has no jobId',
                rawEvent,
                status,
                ids,
                mappedApplicationId: applicationId,
            });
            return;
        }

        pushWebhookDebugEvent({
            at: new Date().toISOString(),
            stage: 'mapped',
            rawEvent,
            status,
            ids,
            mappedApplicationId: String(application._id),
            mappedJobId: appJobId,
        });

        if (ids.eventTypeId) {
            const job = await Job.findById(appJobId).select('interviewScheduling.eventTypeId');
            const expectedEventTypeId = job?.interviewScheduling?.eventTypeId;
            if (expectedEventTypeId && expectedEventTypeId !== ids.eventTypeId) {
                console.warn('Cal.com webhook event type mismatch; continuing with mapped application', {
                    applicationId,
                    expectedEventTypeId,
                    receivedEventTypeId: ids.eventTypeId,
                });
            }
        }

        const startRaw = pickFirst(payload, [
            'payload.startTime',
            'payload.startsAt',
            'payload.start',
            'data.startTime',
            'data.startsAt',
            'data.start',
            'booking.startTime',
            'booking.startsAt',
            'booking.start',
            'startTime',
            'startsAt',
            'start',
        ]);

        const scheduledTime = startRaw ? new Date(String(startRaw)) : null;

        const meetLink =
            String(
                pickFirst(payload, [
                    'payload.meetingUrl',
                    'payload.location.url',
                    'payload.location.value',
                    'payload.location',
                    'data.meetingUrl',
                    'data.location.url',
                    'data.location.value',
                    'data.location',
                    'booking.meetingUrl',
                    'booking.location.url',
                    'booking.location.value',
                    'booking.location',
                    'payload.metadata.bookingUrl',
                    'data.metadata.bookingUrl',
                    'booking.metadata.bookingUrl',
                    'meetingUrl',
                    'location',
                ]) || ''
            ).trim();

        const validScheduledTime =
            scheduledTime && !Number.isNaN(scheduledTime.getTime()) ? scheduledTime : undefined;

        const interviewer =
            String(
                pickFirst(payload, [
                    'payload.organizer.name',
                    'data.organizer.name',
                    'booking.organizer.name',
                    'organizer.name',
                ]) || env.CALCOM_DEFAULT_ORGANIZER
            ).trim() || env.CALCOM_DEFAULT_ORGANIZER;

        const fingerprint = buildWebhookFingerprint({
            bookingUid: ids.bookingUid,
            bookingId: ids.bookingId,
            eventTypeId: ids.eventTypeId,
            status,
            scheduledTimeIso: validScheduledTime?.toISOString(),
            meetLink,
            rawEvent,
        });

        const previousInterview = await Interview.findOne({ applicationId: application._id }).select(
            'scheduledTime meetLink status interviewer lastWebhookHash'
        );

        if (previousInterview?.lastWebhookHash === fingerprint) {
            return;
        }

        const nextScheduledTime =
            validScheduledTime || previousInterview?.scheduledTime || new Date();

        const fallbackBookingUrl = calcomService.buildCandidateBookingUrl({
            applicationId: String(application._id),
            jobId: appJobId,
            candidateName: application.name,
            candidateEmail: application.email,
            scheduling: (application.jobId as any)?.interviewScheduling,
        });

        const nextMeetLink =
            meetLink ||
            String(previousInterview?.meetLink || '').trim() ||
            String(fallbackBookingUrl || env.CALCOM_BOOKING_URL || '').trim();

        if (!nextMeetLink) {
            console.error('Cal.com webhook ignored: no meeting link could be derived', {
                applicationId,
                ids,
            });
            pushWebhookDebugEvent({
                at: new Date().toISOString(),
                stage: 'ignored',
                reason: 'No meeting link could be derived',
                rawEvent,
                status,
                ids,
                mappedApplicationId: String(application._id),
                mappedJobId: appJobId,
            });
            return;
        }

        const reminderMinutesBefore = normalizeReminderMinutes(
            (application.jobId as any)?.interviewScheduling?.reminderMinutesBefore
        );
        const shouldKeepReminder =
            (status === 'scheduled' || status === 'rescheduled') && reminderMinutesBefore.length > 0;

        const updatedInterview = await Interview.findOneAndUpdate(
            { applicationId: application._id },
            (() => {
                const reminderScheduledFor =
                    shouldKeepReminder
                        ? new Date(
                              nextScheduledTime.getTime() -
                                  Math.max(...reminderMinutesBefore) * 60 * 1000
                          )
                        : undefined;

                return {
                    applicationId: application._id,
                    scheduledTime: nextScheduledTime,
                    meetLink: nextMeetLink,
                    interviewer,
                    status,
                    calcomBookingId: ids.bookingId,
                    calcomBookingUid: ids.bookingUid,
                    calcomEventTypeId: ids.eventTypeId,
                    lastWebhookEvent: rawEvent,
                    lastWebhookHash: fingerprint,
                    lastWebhookAt: new Date(),
                    reminderScheduledFor,
                    reminderTargetScheduledTime:
                        status === 'scheduled' || status === 'rescheduled' ? nextScheduledTime : undefined,
                    reminderSentAt: undefined,
                    reminderOffsetsSent: [],
                };
            })(),
            { upsert: true, new: true, runValidators: true }
        );

        console.info('Cal.com webhook persisted interview', {
            applicationId: String(application._id),
            interviewId: String(updatedInterview?._id || ''),
            status,
            scheduledTime: nextScheduledTime.toISOString(),
        });
        pushWebhookDebugEvent({
            at: new Date().toISOString(),
            stage: 'persisted',
            rawEvent,
            status,
            ids,
            mappedApplicationId: String(application._id),
            mappedJobId: appJobId,
            interviewId: String(updatedInterview?._id || ''),
            scheduledTime: nextScheduledTime.toISOString(),
        });

        if (status !== 'scheduled' && status !== 'rescheduled') {
            clearInterviewReminderTimer(String(updatedInterview?._id || ''));
        }

        // Move application to interview-scheduled once a booking is confirmed/rescheduled.
        if (status === 'scheduled' || status === 'rescheduled') {
            await Application.findByIdAndUpdate(application._id, {
                status: 'interview-scheduled',
            });
        }

        // Move application to interview-cancelled when interview is cancelled
        if (status === 'cancelled') {
            await Application.findByIdAndUpdate(application._id, {
                status: 'interview-cancelled',
            });
        }

        const timelineTitleByStatus: Record<InterviewStatus, string> = {
            scheduled: 'Interview Scheduled',
            rescheduled: 'Interview Rescheduled',
            cancelled: 'Interview Cancelled',
            completed: 'Interview Completed',
            'no-show': 'Interview Marked No-show',
        };

        const timelineDescriptionByStatus: Record<InterviewStatus, string> = {
            scheduled: 'Interview booking was confirmed by candidate.',
            rescheduled: 'Interview booking was rescheduled by candidate.',
            cancelled: 'Interview booking was cancelled.',
            completed: 'Interview booking was marked completed.',
            'no-show': 'Interview booking was marked as no-show.',
        };

        await logApplicationActivity({
            applicationId: application._id,
            type: 'interview.webhook_updated',
            title: timelineTitleByStatus[status],
            description: timelineDescriptionByStatus[status],
            actorType: 'candidate',
            metadata: {
                status,
                scheduledTime: nextScheduledTime.toISOString(),
                meetLink: nextMeetLink,
                bookingUid: ids.bookingUid,
                bookingId: ids.bookingId,
                eventTypeId: ids.eventTypeId,
                webhookEvent: rawEvent,
            },
        });

        const wasSameSchedule =
            previousInterview &&
            previousInterview.scheduledTime?.getTime() === nextScheduledTime.getTime() &&
            String(previousInterview.meetLink || '') === nextMeetLink &&
            previousInterview.status === status;

        const shouldNotifyBooking = !wasSameSchedule && (status === 'scheduled' || status === 'rescheduled');
        if (!shouldNotifyBooking) {
            return;
        }

        const jobTitle =
            application.jobId && typeof application.jobId === 'object'
                ? String((application.jobId as any).title || 'the role')
                : 'the role';

        try {
            await sendInterviewScheduledForCandidateEmail({
                to: application.email,
                candidateName: application.name,
                jobTitle,
                interviewer,
                scheduledTime: nextScheduledTime,
                meetLink: nextMeetLink,
            });
        } catch (error) {
            console.error('Failed sending interview confirmation to candidate:', error);
        }

        if (updatedInterview?._id && reminderMinutesBefore.length > 0) {
            reminderMinutesBefore.forEach((offset) => {
                scheduleInterviewReminder({
                    interviewId: String(updatedInterview._id),
                    candidateEmail: application.email,
                    candidateName: application.name,
                    jobTitle,
                    interviewer,
                    scheduledTime: nextScheduledTime,
                    meetLink: nextMeetLink,
                    reminderMinutesBefore: offset,
                });
            });
        } else if (updatedInterview?._id) {
            clearInterviewReminderTimer(String(updatedInterview._id));
        }

        try {
            const hrRoleNames = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager'];
            const hrRoles = await Role.find({ name: { $in: hrRoleNames } }).select('_id');
            const hrRoleIds = hrRoles.map((role) => role._id);

            if (hrRoleIds.length === 0) {
                return;
            }

            const recipients = await User.find({
                isActive: true,
                role: { $in: hrRoleIds },
                email: { $exists: true, $ne: '' },
            }).select('_id email');

            const hrEmails = recipients.map((user) => String(user.email).trim()).filter(Boolean);

            if (hrEmails.length > 0) {
                await sendInterviewScheduledForHrEmail({
                    to: hrEmails,
                    candidateName: application.name,
                    candidateEmail: application.email,
                    jobTitle,
                    interviewer,
                    scheduledTime: nextScheduledTime,
                    meetLink: nextMeetLink,
                });
            }

            if (recipients.length > 0) {
                await InterviewNotification.insertMany(
                    recipients.map((user) => ({
                        userId: user._id,
                        applicationId: application._id,
                        interviewId: updatedInterview?._id,
                        title: 'Interview Scheduled',
                        message: `${application.name} has booked an interview for ${jobTitle}.`,
                        link: `/hiring/interviews`,
                    }))
                );
            }
        } catch (error) {
            console.error('Failed sending HR interview notifications:', error);
        }
    }

    async listInterviews(filters: ListInterviewsInput): Promise<{
        interviews: IInterview[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { applicationId, status, search, from, to, page = 1, limit = 50 } = filters;

        const query: any = {};
        if (applicationId) query.applicationId = applicationId;
        if (status) query.status = status;
        if (from || to) {
            query.scheduledTime = {};
            if (from) query.scheduledTime.$gte = new Date(from);
            if (to) query.scheduledTime.$lte = new Date(to);
        }

        let interviews = await Interview.find(query)
            .sort({ scheduledTime: 1 })
            .populate({
                path: 'applicationId',
                select: 'name email status jobId',
                populate: {
                    path: 'jobId',
                    select: 'title department',
                },
            });

        if (search) {
            const term = search.toLowerCase();
            interviews = interviews.filter((interview: any) => {
                const app = interview.applicationId;
                const job = app?.jobId;
                return (
                    String(app?.name || '')?.toLowerCase().includes(term) ||
                    String(app?.email || '')?.toLowerCase().includes(term) ||
                    String(job?.title || '')?.toLowerCase().includes(term)
                );
            });
        }

        const total = interviews.length;
        const skip = (page - 1) * limit;
        const paginated = interviews.slice(skip, skip + limit);

        return {
            interviews: paginated,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async updateInterviewStatus(
        id: string,
        status: InterviewStatus,
        actorId?: string
    ): Promise<IInterview> {
        const interview = await Interview.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        ).populate({
            path: 'applicationId',
            select: 'name email status jobId',
            populate: {
                path: 'jobId',
                select: 'title department',
            },
        });

        if (!interview) {
            throw new AppError('Interview not found', 404);
        }

        const appId = (interview.applicationId as any)?._id;
        if (appId) {
            await logApplicationActivity({
                applicationId: appId,
                type: 'interview.status_updated',
                title: 'Interview Status Updated',
                description: `Interview status changed to ${status}.`,
                actorType: actorId ? 'user' : 'system',
                actorId,
                metadata: {
                    interviewId: interview._id,
                    status,
                },
            });
        }

        return interview;
    }

    async getInterviewDetails(interviewId: string): Promise<{
        interview: IInterview;
        assignmentSubmission: any | null;
        note: IInterviewNote | null;
    }> {
        const interview = await Interview.findById(interviewId).populate({
            path: 'applicationId',
            select: 'name email phone resumeUrl status jobId portfolio linkedin experience',
            populate: {
                path: 'jobId',
                select: 'title department location',
            },
        });

        if (!interview) {
            throw new AppError('Interview not found', 404);
        }

        const application: any = interview.applicationId;

        let assignmentSubmission: any | null = null;
        if (application?.jobId?._id && application?._id) {
            const assignment = await Assignment.findOne({ jobId: application.jobId._id })
                .sort({ createdAt: -1 })
                .select('_id title submissionFields');

            if (assignment) {
                assignmentSubmission = await AssignmentSubmission.findOne({
                    assignmentId: assignment._id,
                    applicationId: application._id,
                })
                    .sort({ submittedAt: -1 })
                    .populate('assignmentId', 'title description instructions submissionFields');
            }
        }

        const note = await InterviewNote.findOne({ interviewId: interview._id }).populate(
            'createdBy',
            'name email'
        );

        return {
            interview,
            assignmentSubmission,
            note,
        };
    }

    async saveInterviewNote(
        interviewId: string,
        data: SaveInterviewNoteInput,
        createdBy: string
    ): Promise<IInterviewNote> {
        const interview = await Interview.findById(interviewId).select('_id applicationId');
        if (!interview) {
            throw new AppError('Interview not found', 404);
        }

        const note = await InterviewNote.findOneAndUpdate(
            { interviewId: interview._id },
            {
                interviewId: interview._id,
                applicationId: interview.applicationId,
                rating: data.rating,
                technicalScore: data.technicalScore,
                communicationScore: data.communicationScore,
                notes: data.notes,
                createdBy,
            },
            { upsert: true, new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        await logApplicationActivity({
            applicationId: interview.applicationId,
            type: 'interview.notes_saved',
            title: 'Interview Notes Saved',
            description: 'Interviewer evaluation notes were saved.',
            actorType: 'user',
            actorId: createdBy,
            metadata: {
                interviewId,
                rating: data.rating,
                technicalScore: data.technicalScore,
                communicationScore: data.communicationScore,
            },
        });

        return note;
    }
}
