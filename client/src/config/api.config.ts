/**
 * Resolves the API base URL safely across local and production environments.
 * 
 * In production (when accessed via any domain other than localhost / 127.0.0.1):
 * - If VITE_API_BASE_URL contains 'localhost' or '127.0.0.1' (baked during build from dev .env),
 *   it ignores the localhost URL and safely falls back to '/api/v1' (relative URL to same origin).
 * - If VITE_API_BASE_URL is not set at all, it safely falls back to '/api/v1'.
 * - If VITE_API_BASE_URL is set to an external production URL, it uses that.
 * 
 * In local development (localhost / 127.0.0.1):
 * - Uses VITE_API_BASE_URL if available, otherwise 'http://localhost:8000/api/v1'.
 */
export function getApiBaseUrl(): string {
    const envUrl = (import.meta as any).env?.VITE_API_BASE_URL?.trim();

    if (typeof window !== 'undefined') {
        const isLocalhost =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (!isLocalhost) {
            if (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
                return '/api/v1';
            }
            return envUrl;
        }
    }

    return envUrl || 'http://localhost:8000/api/v1';
}

/**
 * Resolves the Socket.IO server URL safely across local and production environments.
 */
export function getSocketBaseUrl(): string {
    const apiUrl = getApiBaseUrl();

    if (apiUrl.startsWith('/')) {
        // Relative API URL — connect socket to current origin
        return typeof window !== 'undefined' ? window.location.origin : '';
    }

    return apiUrl.replace(/\/api\/v1\/?$/, '');
}
