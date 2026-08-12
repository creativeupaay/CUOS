/**
 * Utility to play a loud, crisp, modern notification sound effect.
 * Combines high-volume HTML5 PCM WAV audio playback with Web Audio API fallback.
 */

let cachedAudioUrl: string | null = null;
let audioCtx: AudioContext | null = null;

function getNotificationWavUrl(): string {
    if (cachedAudioUrl) return cachedAudioUrl;
    if (typeof window === 'undefined') return '';

    try {
        const sampleRate = 44100;
        const duration = 0.55;
        const numSamples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        // RIFF Header
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeString(8, 'WAVE');
        // fmt chunk
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true); // 16-bit
        // data chunk
        writeString(36, 'data');
        view.setUint32(40, numSamples * 2, true);

        // Synthesize a loud, bright 3-note ascending chime: G5 (784Hz) -> C6 (1047Hz) -> E6 (1318Hz)
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let sample = 0;

            // Note 1: G5 (0ms - 250ms)
            if (t >= 0 && t < 0.25) {
                const env = Math.exp(-t * 12);
                sample += (Math.sin(2 * Math.PI * 783.99 * t) * 0.6 + Math.sin(2 * Math.PI * 1567.98 * t) * 0.2) * env;
            }

            // Note 2: C6 (70ms - 380ms)
            if (t >= 0.07 && t < 0.38) {
                const env = Math.exp(-(t - 0.07) * 10);
                sample += (Math.sin(2 * Math.PI * 1046.50 * t) * 0.75 + Math.sin(2 * Math.PI * 2093.00 * t) * 0.25) * env;
            }

            // Note 3: E6 (150ms - 550ms)
            if (t >= 0.15 && t < 0.55) {
                const env = Math.exp(-(t - 0.15) * 7);
                sample += (Math.sin(2 * Math.PI * 1318.51 * t) * 0.85 + Math.sin(2 * Math.PI * 2637.02 * t) * 0.3) * env;
            }

            const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 25000)));
            view.setInt16(44 + i * 2, intSample, true);
        }

        const blob = new Blob([buffer], { type: 'audio/wav' });
        cachedAudioUrl = URL.createObjectURL(blob);
        return cachedAudioUrl;
    } catch {
        return '';
    }
}

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!audioCtx) {
        const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }

    return audioCtx;
}

// User interaction listener for Web Audio Context
if (typeof window !== 'undefined') {
    const unlockAudio = () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    };

    window.addEventListener('click', unlockAudio, { capture: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
}

function playWebAudioSound(volume: number): void {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
        masterGain.connect(ctx.destination);

        // Tone 1: G5 (783.99 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(783.99, now);

        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.7, now + 0.01);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.25);

        // Tone 2: C6 (1046.50 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1046.50, now + 0.07);

        gain2.gain.setValueAtTime(0, now + 0.07);
        gain2.gain.linearRampToValueAtTime(0.85, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.07);
        osc2.stop(now + 0.38);

        // Tone 3: E6 (1318.51 Hz)
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(1318.51, now + 0.15);

        gain3.gain.setValueAtTime(0, now + 0.15);
        gain3.gain.linearRampToValueAtTime(0.9, now + 0.16);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc3.connect(gain3);
        gain3.connect(masterGain);
        osc3.start(now + 0.15);
        osc3.stop(now + 0.55);
    } catch (err) {
        console.warn('[NotificationSound] Web Audio fallback failed:', err);
    }
}

/**
 * Plays a loud, clear, 3-note notification chime (G5 -> C6 -> E6).
 * @param volume Volume level between 0.0 and 1.0 (default 0.9)
 */
export function playNotificationSound(volume = 0.9): void {
    const url = getNotificationWavUrl();
    if (url) {
        try {
            const audio = new Audio(url);
            audio.volume = Math.max(0, Math.min(1, volume));
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // If HTML5 audio is blocked or fails, use Web Audio API fallback
                    playWebAudioSound(volume);
                });
                return;
            }
        } catch {
            // Fallthrough to Web Audio
        }
    }
    playWebAudioSound(volume);
}
