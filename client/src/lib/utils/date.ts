/**
 * Date Utilities
 * All date formatting and manipulation in one place.
 */

/** Formats a date to "Nov 09, 2025" (CUOS standard) */
export function formatDate(date: string | Date | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** Formats a date to "DD MMM YYYY, HH:MM AM/PM" */
export function formatDateTime(date: string | Date | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** Formats a date to an HTML date input value: "YYYY-MM-DD" */
export function toDateInputValue(date: string | Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
}

/** Returns today's date as "YYYY-MM-DD" (local timezone) */
export function todayInputValue(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Returns a relative label: "2 days ago", "in 3 hours", etc. */
export function formatRelative(date: string | Date | null | undefined): string {
    if (!date) return '—';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffMs = new Date(date).getTime() - Date.now();
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (Math.abs(diffSecs) < 60) return rtf.format(diffSecs, 'second');
    if (Math.abs(diffMins) < 60) return rtf.format(diffMins, 'minute');
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(diffDays, 'day');
}

/**
 * Timezone-safe start of day
 */
export function getLocalStartOfDay(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Timezone-safe end of day
 */
export function getLocalEndOfDay(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

/**
 * Returns current Indian Fiscal Year (April 1 to March 31)
 */
export function getCurrentFiscalYearRange(): { startDate: Date; endDate: Date } {
    const now = new Date();
    // Use Intl to get date in IST
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentYear = istDate.getFullYear();
    const isAfterMarch = istDate.getMonth() >= 3; // April is 3
    const startYear = isAfterMarch ? currentYear : currentYear - 1;
    
    return {
        startDate: new Date(startYear, 3, 1, 0, 0, 0, 0),
        endDate: new Date(startYear + 1, 2, 31, 23, 59, 59, 999)
    };
}

/**
 * Returns previous Indian Fiscal Year
 */
export function getPreviousFiscalYearRange(): { startDate: Date; endDate: Date } {
    const { startDate } = getCurrentFiscalYearRange();
    const startYear = startDate.getFullYear() - 1;
    
    return {
        startDate: new Date(startYear, 3, 1, 0, 0, 0, 0),
        endDate: new Date(startYear + 1, 2, 31, 23, 59, 59, 999)
    };
}
