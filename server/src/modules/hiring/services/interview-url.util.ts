import { IInterview } from '../models/Interview.model';
import { calcomService } from './calcom.service';
import { logger } from '../../../utils/logger';

/**
 * Normalizes a meeting URL by extracting it from a larger string if necessary,
 * and ensuring it has a valid protocol.
 */
import { normalizeMeetingUrl } from '../../../utils/meeting-url.util';

export { normalizeMeetingUrl };

/**
 * Extracts a meeting URL from an unknown data structure (object, array, string).
 */
export function extractMeetingUrlFromUnknown(value: unknown, visited = new Set<unknown>()): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') {
        return normalizeMeetingUrl(value);
    }

    if (typeof value !== 'object') {
        return '';
    }

    if (visited.has(value)) {
        return '';
    }
    visited.add(value);

    if (Array.isArray(value)) {
        for (const item of value) {
            const match = extractMeetingUrlFromUnknown(item, visited);
            if (match) {
                return match;
            }
        }
        return '';
    }

    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
        const match = extractMeetingUrlFromUnknown(nestedValue, visited);
        if (match) {
            return match;
        }
    }

    return '';
}

/**
 * Hydrates a meeting link for an interview from Cal.com if it's missing but we have a booking UID.
 */
export async function hydrateMeetingLinkFromCalcom(interview: IInterview): Promise<IInterview> {
    const currentMeetLink = normalizeMeetingUrl(interview.meetLink);
    if (currentMeetLink) {
        if (currentMeetLink !== interview.meetLink) {
            interview.meetLink = currentMeetLink;
        }
        return interview;
    }

    const bookingUid = String((interview as any).calcomBookingUid || '').trim();
    if (!bookingUid) {
        return interview;
    }

    try {
        const booking = await calcomService.getBooking(bookingUid);
        const recoveredMeetLink = extractMeetingUrlFromUnknown(booking);

        if (!recoveredMeetLink) {
            return interview;
        }

        interview.meetLink = recoveredMeetLink;
        await interview.save();
    } catch (error) {
        logger.error({ context: {
                        interviewId: String(interview._id || ''),
                        bookingUid,
                        error,
                    } }, 'Failed to hydrate meeting link from Cal.com booking:');
    }

    return interview;
}
