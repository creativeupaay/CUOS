/**
 * Client-side Logger Utility
 *
 * This logger wraps standard console methods to ensure they only execute
 * in development mode. This prevents debugging artifacts from leaking into
 * production builds, adhering to the project's strict cleanliness guidelines.
 */

const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args: Parameters<typeof console.log>) => {
        if (isDev) {
            console.log(...args);
        }
    },
    info: (...args: Parameters<typeof console.info>) => {
        if (isDev) {
            console.info(...args);
        }
    },
    warn: (...args: Parameters<typeof console.warn>) => {
        if (isDev) {
            console.warn(...args);
        }
    },
    error: (...args: Parameters<typeof console.error>) => {
        if (isDev) {
            console.error(...args);
        }
    },
    debug: (...args: Parameters<typeof console.debug>) => {
        if (isDev) {
            console.debug(...args);
        }
    },
};
