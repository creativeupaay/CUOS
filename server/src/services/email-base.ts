import { Resend } from 'resend';
import { env } from '../config/env.config';

// ============================================================
// Email Service Base — powered by Resend
// ============================================================

export const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

let resend: Resend | null = null;

export function getResend(): Resend {
    if (!env.RESEND_API_KEY) {
        throw new Error(
            'RESEND_API_KEY is not set. Please add it to your .env file to enable email sending.'
        );
    }
    if (!resend) {
        resend = new Resend(env.RESEND_API_KEY);
    }
    return resend;
}

/** Minimal shape of the object returned by Resend's emails.send() */
export interface ResendSendResult {
    data?: { id?: string } | null;
    error?: { message?: string } | string | null;
}

export async function sendEmailOrThrow(
    client: Resend,
    payload: Parameters<Resend['emails']['send']>[0]
): Promise<string | undefined> {
    const result = await client.emails.send(payload) as unknown as ResendSendResult;

    if (result?.error) {
        throw new Error(
            typeof result.error === 'string'
                ? result.error
                : result.error.message || 'Resend failed to send email'
        );
    }

    return result?.data?.id;
}
