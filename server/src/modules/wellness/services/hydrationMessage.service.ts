import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../../config/env.config';
import { logger } from '../../../utils/logger';

// ─── Fallback message pool ────────────────────────────────────────────────────
// Deterministic round-robin based on index; never requires Gemini.
const FALLBACK_MESSAGES: readonly string[] = [
    '💧 Quick water break! You\'ve been working continuously for {minutes} minutes. Take a moment to hydrate before diving back in.',
    '💧 Time for a quick sip! You\'ve been focused for {minutes} minutes. A short hydration break can help you stay sharp.',
    '💧 You\'ve been in the zone for {minutes} minutes. Take a brief pause to grab some water — you\'ve earned it.',
    '💧 Hydration check! {minutes} minutes of solid focus deserves a moment to recharge. Go grab some water.',
    '💧 Nice work staying focused for {minutes} minutes! A quick water break now will help you keep up the great work.',
    '💧 CUOS reminder: {minutes} minutes of continuous work complete. Take a short break to hydrate and reset.',
];

let fallbackIndex = 0;

/**
 * Returns a fallback message, cycling through the pool.
 * workMinutes is interpolated into the `{minutes}` placeholder.
 */
export function pickFallbackMessage(workMinutes: number): string {
    const template = FALLBACK_MESSAGES[fallbackIndex % FALLBACK_MESSAGES.length];
    fallbackIndex = (fallbackIndex + 1) % FALLBACK_MESSAGES.length;
    return template.replace('{minutes}', String(workMinutes));
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HydrationMessageInput {
    userName?: string;
    workMinutes: number;
    timeOfDay: string; // e.g. "3:30 PM"
}

export interface HydrationMessageResult {
    message: string;
    source: 'gemini' | 'fallback';
}

// ─── Gemini generation ────────────────────────────────────────────────────────

const GENERATION_TIMEOUT_MS = 5_000;

function buildPrompt(input: HydrationMessageInput): string {
    const namePart = input.userName ? ` The user's name is ${input.userName}.` : '';

    return `Generate a short, friendly hydration reminder for a productivity application.${namePart}
The user has been working continuously for ${input.workMinutes} minutes. The current time is ${input.timeOfDay}.

Rules:
- Keep it concise (1-2 sentences maximum).
- Keep it encouraging and warm.
- Do not shame the user.
- Do not guilt the user.
- Do not make any medical claims.
- Do not prescribe a specific amount of water.
- Do not mention medical conditions.
- Do not provide health diagnoses.
- Do not use alarming language.
- Do not be repetitive — vary the wording.
- Personalize naturally if a name is provided.
- Mention the continuous work duration naturally.
- Start the message with the water drop emoji: 💧

Respond ONLY with the reminder message text. No quotes, no explanation, no JSON — just the message itself.`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

const MODEL_CANDIDATES = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-pro',
];

/**
 * Generates a hydration reminder message.
 * Falls back to the local pool if Gemini is unavailable or times out.
 */
export async function generateHydrationMessage(
    input: HydrationMessageInput
): Promise<HydrationMessageResult> {
    if (!env.GEMINI_API_KEY) {
        logger.debug('[HydrationMessage] GEMINI_API_KEY not configured — using fallback');
        return { message: pickFallbackMessage(input.workMinutes), source: 'fallback' };
    }

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const prompt = buildPrompt(input);

    for (const modelName of MODEL_CANDIDATES) {
        try {
            logger.debug(`[HydrationMessage] Attempting generation with ${modelName}`);

            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 150,
                },
            });

            const result = await withTimeout(
                model.generateContent(prompt),
                GENERATION_TIMEOUT_MS
            );

            const text = result.response.text().trim();

            // Sanity check: must be non-empty and not too long
            if (!text || text.length < 10 || text.length > 400) {
                logger.warn(`[HydrationMessage] Response from ${modelName} failed length check (${text.length} chars)`);
                continue;
            }

            logger.info(`[HydrationMessage] Successfully generated message with ${modelName}`);
            return { message: text, source: 'gemini' };

        } catch (err: any) {
            logger.warn({ err: err.message }, `[HydrationMessage] Generation failed with ${modelName}`);
        }
    }

    logger.warn('[HydrationMessage] All Gemini models failed — using fallback');
    return { message: pickFallbackMessage(input.workMinutes), source: 'fallback' };
}
