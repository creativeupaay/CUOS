import type { IncomingHttpHeaders } from 'http';
import { env } from '../../../config/env.config';
import AppError from '../../../utils/appError';
import { Application } from '../models/Application.model';
import { Interview, InterviewStatus } from '../models/Interview.model';
import { InterviewNotification } from '../models/InterviewNotification.model';
import { Job } from '../models/Job.model';
import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { logger } from '../../../utils/logger';
import { logApplicationActivity } from './activity.service';
import {
    normalizeMeetingUrl,
    extractMeetingUrlFromUnknown,
} from './interview-url.util';
import {
    pickFirst,
    parseCalcomStatus,
    sanitizeHeaderValue,
    extractWebhookIdentifiers,
    buildWebhookFingerprint,
    pushWebhookDebugEvent,
} from './interview-webhook.util';
import {
    clearInterviewReminderTimer,
    normalizeReminderMinutes,
    scheduleInterviewReminder,
} from './interview-reminder.service';
import {
    sendInterviewScheduledForCandidateEmail,
    sendInterviewScheduledForHrEmail,
} from '../../../services/email.service';

export class InterviewWebhookService {
    async handleCalcomWebhook(payload: any, headers: IncomingHttpHeaders): Promise<void> {
        // Comprehensive webhook payload logging for debugging
        logger.info('=== CAL.COM WEBHOOK FULL PAYLOAD START ===');
        logger.info(JSON.stringify(payload, null, 2));
        logger.info('=== CAL.COM WEBHOOK FULL PAYLOAD END ===');

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

        logger.info({
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
        }, 'Cal.com webhook extracted identifiers');
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
                status: {
                    $in: [
                        'interview',
                        'interview-scheduled',
                        'interview-rescheduled',
                        'interview-cancelled',
                    ],
                },
            })
                .sort({ updatedAt: -1 })
                .select('_id');

            if (latestInterviewStageApplication?._id) {
                applicationId = String(latestInterviewStageApplication._id);
            }
        }

        if (!applicationId) {
            logger.error({ context: {
                                ids,
                                rawEvent,
                            } }, 'Cal.com webhook ignored: unable to map payload to application');
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
            logger.error({ context: {
                                applicationId,
                            } }, 'Cal.com webhook ignored: mapped application not found');
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
            logger.warn({
                applicationId,
                jobIdFromWebhook: ids.jobId,
            }, 'Cal.com webhook job mismatch; continuing with mapped application');
        }

        const appJobId = String((application.jobId as any)?._id || application.jobId || '');
        if (!appJobId) {
            logger.error({ context: {
                                applicationId,
                            } }, 'Cal.com webhook ignored: application has no jobId');
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
                logger.warn({
                    applicationId,
                    expectedEventTypeId,
                    receivedEventTypeId: ids.eventTypeId,
                }, 'Cal.com webhook event type mismatch; continuing with mapped application');
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
            extractMeetingUrlFromUnknown(
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
                    'meetingUrl',
                    'location',
                ])
            ) || extractMeetingUrlFromUnknown(payload);

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

        const previousInterview = await Interview.findOne({ applicationId: application._id }).select(
            'scheduledTime meetLink status interviewer lastWebhookHash awaitingReschedule rescheduleRequestedAt'
        );

        const isFollowUpBookingAfterReschedule = Boolean(
            previousInterview?.awaitingReschedule &&
                (status === 'scheduled' || status === 'rescheduled')
        );

        const effectiveStatus: InterviewStatus = isFollowUpBookingAfterReschedule
            ? 'rescheduled'
            : status;

        const fingerprint = buildWebhookFingerprint({
            bookingUid: ids.bookingUid,
            bookingId: ids.bookingId,
            eventTypeId: ids.eventTypeId,
            status: effectiveStatus,
            scheduledTimeIso: validScheduledTime?.toISOString(),
            meetLink,
            rawEvent,
        });

        if (previousInterview?.lastWebhookHash === fingerprint) {
            return;
        }

        const nextScheduledTime =
            validScheduledTime || previousInterview?.scheduledTime || new Date();

        const nextMeetLink =
            normalizeMeetingUrl(meetLink) ||
            normalizeMeetingUrl(String(previousInterview?.meetLink || '').trim());

        if (!nextMeetLink) {
            logger.error({ context: {
                                applicationId,
                                ids,
                            } }, 'Cal.com webhook ignored: no meeting link could be derived');
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
            (effectiveStatus === 'scheduled' || effectiveStatus === 'rescheduled') &&
            reminderMinutesBefore.length > 0;

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
                    status: effectiveStatus,
                    calcomBookingId: ids.bookingId,
                    calcomBookingUid: ids.bookingUid,
                    calcomEventTypeId: ids.eventTypeId,
                    lastWebhookEvent: rawEvent,
                    lastWebhookHash: fingerprint,
                    lastWebhookAt: new Date(),
                    reminderScheduledFor,
                    reminderTargetScheduledTime:
                        effectiveStatus === 'scheduled' || effectiveStatus === 'rescheduled'
                            ? nextScheduledTime
                            : undefined,
                    reminderSentAt: undefined,
                    reminderOffsetsSent: [],
                    awaitingReschedule:
                        effectiveStatus === 'scheduled' ||
                        effectiveStatus === 'rescheduled' ||
                        isFollowUpBookingAfterReschedule
                            ? false
                            : Boolean(previousInterview?.awaitingReschedule),
                    rescheduleRequestedAt:
                        effectiveStatus === 'scheduled' || effectiveStatus === 'rescheduled'
                            ? undefined
                            : previousInterview?.rescheduleRequestedAt,
                };
            })(),
            { upsert: true, new: true, runValidators: true }
        );

        logger.info({
            applicationId: String(application._id),
            interviewId: String(updatedInterview?._id || ''),
            status: effectiveStatus,
            scheduledTime: nextScheduledTime.toISOString(),
        }, 'Cal.com webhook persisted interview');
        pushWebhookDebugEvent({
            at: new Date().toISOString(),
            stage: 'persisted',
            rawEvent,
            status: effectiveStatus,
            ids,
            mappedApplicationId: String(application._id),
            mappedJobId: appJobId,
            interviewId: String(updatedInterview?._id || ''),
            scheduledTime: nextScheduledTime.toISOString(),
        });

        if (effectiveStatus !== 'scheduled' && effectiveStatus !== 'rescheduled') {
            clearInterviewReminderTimer(String(updatedInterview?._id || ''));
        }

        // Move application to interview-scheduled once a booking is confirmed/rescheduled.
        if (effectiveStatus === 'scheduled' || effectiveStatus === 'rescheduled') {
            await Application.findByIdAndUpdate(application._id, {
                status:
                    effectiveStatus === 'rescheduled'
                        ? 'interview-rescheduled'
                        : 'interview-scheduled',
            });
        }

        // Move application to interview-cancelled when interview is cancelled
        if (effectiveStatus === 'cancelled' && !previousInterview?.awaitingReschedule) {
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
            title: timelineTitleByStatus[effectiveStatus],
            description: timelineDescriptionByStatus[effectiveStatus],
            actorType: 'candidate',
            metadata: {
                status: effectiveStatus,
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
            logger.error({ context: error }, 'Failed sending interview confirmation to candidate:');
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
            logger.error({ context: error }, 'Failed sending HR interview notifications:');
        }
    }
}

export const interviewWebhookService = new InterviewWebhookService();
