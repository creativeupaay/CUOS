// ─── Hydration Fallback Message Pool ─────────────────────────────────────────
//
// These messages are used when:
//  - Gemini API key is unavailable
//  - Network request fails
//  - Gemini response times out (>5s)
//  - Response content fails validation
//
// Messages cycle round-robin to avoid repetition.
// The {minutes} placeholder is replaced with the actual work duration.

const FALLBACK_POOL: readonly string[] = [
    '💧 Quick water break! You\'ve been working for {minutes} minutes. Take a moment to hydrate.',
    '💧 Time for a quick sip of water. You\'ve been focused for {minutes} minutes — you\'re doing great!',
    '💧 You\'ve been in the zone for {minutes} minutes. Take a short hydration break before continuing.',
    '💧 Hydration check! Your {minutes}-minute focus session is complete. Grab some water.',
    '💧 Nice sustained focus for {minutes} minutes! A short water break will help you keep it up.',
    '💧 CUOS reminder: {minutes} minutes of continuous work. A quick water break awaits.',
];

let _poolIndex = 0;

/**
 * Returns the next fallback message from the pool, cycling round-robin.
 * workMinutes replaces the {minutes} placeholder.
 */
export function pickFallbackMessage(workMinutes: number): string {
    const template = FALLBACK_POOL[_poolIndex % FALLBACK_POOL.length];
    _poolIndex = (_poolIndex + 1) % FALLBACK_POOL.length;
    return template.replace('{minutes}', String(workMinutes));
}
