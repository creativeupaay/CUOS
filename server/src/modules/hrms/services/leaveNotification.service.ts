/**
 * leaveNotification.service.ts
 *
 * Generates and broadcasts team-wide notification messages when an employee's
 * leave, WFH, or half-day request is approved by admin.
 *
 * Uses Gemini API for smart, natural language messages — falls back to a
 * curated pool of messages if Gemini is unavailable or times out.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../../config/env.config';
import { logger } from '../../../utils/logger';
import { notificationService } from '../../notification/services/notification.service';
import type { ILeave } from '../models/Leave.model';

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaveCategory = 'leave' | 'wfh' | 'half-day';

interface LeaveNotificationInput {
    employeeName: string;
    leaveType: ILeave['type'];
    startDate: Date;
    endDate: Date;
    days: number;
}

// ─── Fallback message pool ────────────────────────────────────────────────────

const FALLBACK_LEAVE_MESSAGES = [
    '{name} will be on {type} from {start} to {end} ({days} day(s)). Please plan your tasks accordingly!',
    'Heads up! {name} has approved {type} from {start} to {end}. Coordinate with the team if needed.',
    '📢 {name} will be on {type} starting {start} until {end} ({days} day(s)). Factor this into your project timelines.',
    'Team update: {name} is on {type} from {start} to {end}. Reach out early if you need something from them!',
    'Just a reminder — {name} will be unavailable (on {type}) from {start} to {end} ({days} day(s)).',
];

const FALLBACK_WFH_MESSAGES = [
    '🏠 {name} will be working from home on {start}. Ping them digitally — they\'re just a message away!',
    'Team note: {name} is WFH on {start}. All communication will be online.',
    '📡 {name} is working remotely on {start}. They\'re available — just reach out online.',
];

const FALLBACK_HALFDAY_MESSAGES = [
    '🌓 {name} is on a half-day on {start}. They\'ll be available for part of the day.',
    'Quick note: {name} has a half-day on {start}. Plan time-sensitive tasks for when they\'re online.',
    '{name} will be available for half the day on {start}. Plan accordingly!',
];

let leaveIdx = 0;
let wfhIdx = 0;
let halfdayIdx = 0;

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
}

function getCategory(type: ILeave['type']): LeaveCategory {
    if (type === 'wfh') return 'wfh';
    return 'leave';
}

function pickFallbackMessage(input: LeaveNotificationInput): string {
    const start = formatDate(input.startDate);
    const end = formatDate(input.endDate);
    const type = input.leaveType === 'wfh' ? 'WFH' : `${input.leaveType} leave`;

    const isSameDay = input.startDate.toDateString() === input.endDate.toDateString();
    const isHalfDay = input.days <= 0.5 || input.leaveType === 'half-day' as any;

    let template: string;
    if (input.leaveType === 'wfh') {
        template = FALLBACK_WFH_MESSAGES[wfhIdx % FALLBACK_WFH_MESSAGES.length];
        wfhIdx++;
    } else if (isHalfDay) {
        template = FALLBACK_HALFDAY_MESSAGES[halfdayIdx % FALLBACK_HALFDAY_MESSAGES.length];
        halfdayIdx++;
    } else {
        template = FALLBACK_LEAVE_MESSAGES[leaveIdx % FALLBACK_LEAVE_MESSAGES.length];
        leaveIdx++;
    }

    return template
        .replace(/{name}/g, input.employeeName)
        .replace(/{type}/g, type)
        .replace(/{start}/g, isSameDay ? start : start)
        .replace(/{end}/g, end)
        .replace(/{days}/g, String(input.days));
}

// ─── Gemini generation ────────────────────────────────────────────────────────

const GENERATION_TIMEOUT_MS = 5_000;

const MODEL_CANDIDATES = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

function buildGeminiPrompt(input: LeaveNotificationInput): string {
    const start = formatDate(input.startDate);
    const end = formatDate(input.endDate);
    const isSameDay = input.startDate.toDateString() === input.endDate.toDateString();
    const dateRange = isSameDay ? `on ${start}` : `from ${start} to ${end}`;

    return `Write a short, friendly team notification for a workplace productivity app.

Context:
- Employee name: ${input.employeeName}
- Leave type: ${input.leaveType}
- Date(s): ${dateRange} (${input.days} day(s))

Rules:
- Write exactly 1 or 2 sentences.
- You MUST explicitly include the dates "${dateRange}" in the message.
- Be warm, professional, and concise.
- Tell the team who is on leave, what type, and when.
- Explicitly tell teammates that if they have any pending work related to this person, they should finish/sync it up before the leave starts so work continues without a break.
- Use a relevant emoji at the start (📢 for leave, 🏠 for WFH, 🌓 for half-day).
- Do not mention salary, pay, or personal reasons.
- Respond ONLY with the notification message text. No quotes, no explanation.`;
}

async function generateWithGemini(input: LeaveNotificationInput): Promise<string | null> {
    if (!env.GEMINI_API_KEY) return null;

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const prompt = buildGeminiPrompt(input);

    for (const modelName of MODEL_CANDIDATES) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { temperature: 0.7, maxOutputTokens: 150 },
            });

            const result = await withTimeout(model.generateContent(prompt), GENERATION_TIMEOUT_MS);
            const text = result.response.text().trim();

            if (text && text.length >= 25 && text.length <= 500) {
                logger.debug(`[LeaveNotification] Generated message with ${modelName}`);
                return text;
            }
        } catch (err: any) {
            logger.warn({ err: err.message }, `[LeaveNotification] Gemini ${modelName} failed`);
        }
    }

    return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate a team notification message for an approved leave and broadcast
 * it to all internal employees.
 *
 * @param leave     - The approved Leave document
 * @param employeeName - The display name of the employee going on leave
 */
export async function notifyTeamOfApprovedLeave(
    leave: ILeave,
    employeeName: string
): Promise<void> {
    const input: LeaveNotificationInput = {
        employeeName,
        leaveType: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days,
    };

    // Generate message — try Gemini first, fall back to pool
    let message: string;
    try {
        const geminiMessage = await generateWithGemini(input);
        message = geminiMessage ?? pickFallbackMessage(input);
        
        // Fail-safe: ensure the dates are always in the final message if Gemini hallucinated them away
        if (geminiMessage) {
            const start = formatDate(input.startDate);
            if (!message.includes(start)) {
                const end = formatDate(input.endDate);
                const isSameDay = input.startDate.toDateString() === input.endDate.toDateString();
                const dateRange = isSameDay ? start : `${start} to ${end}`;
                message = `${message.trim()} (Date: ${dateRange})`;
            }
        }
    } catch (err) {
        logger.warn({ err }, '[LeaveNotification] Error generating message — using fallback');
        message = pickFallbackMessage(input);
    }

    // Build a human-readable title
    const typeLabel = leave.type === 'wfh' ? 'WFH' : `${leave.type.charAt(0).toUpperCase() + leave.type.slice(1)} Leave`;
    const title = `${employeeName} — ${typeLabel} Approved`;

    // Broadcast to all internal employees (excludes partners)
    await notificationService.notifyInternalUsers({
        type: 'leave_approved_team',
        title,
        message,
        link: '/hrms/attendance',
        metadata: {
            leaveId: leave._id.toString(),
            employeeName,
            leaveType: leave.type,
            startDate: leave.startDate.toISOString(),
            endDate: leave.endDate.toISOString(),
            days: leave.days,
        },
    });

    logger.info({ leaveId: leave._id, employeeName, leaveType: leave.type }, '[LeaveNotification] Team notified of approved leave');
}
