export function normalizeMeetingUrl(url?: string | null): string {
    if (!url) return '';

    const trimmedUrl = String(url).trim();
    if (!trimmedUrl || trimmedUrl.startsWith('/')) {
        return '';
    }

    const explicitMeetingUrlMatch = trimmedUrl.match(
        /https?:\/\/(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|meet\.jit\.si|whereby\.com)\/[^\s"'<>]+/i
    );
    if (explicitMeetingUrlMatch) {
        return explicitMeetingUrlMatch[0].replace(/[),.;]+$/, '');
    }

    const providerOnlyMatch = trimmedUrl.match(
        /(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|meet\.jit\.si|whereby\.com)\/[^\s"'<>]+/i
    );
    if (providerOnlyMatch) {
        const extracted = providerOnlyMatch[0].replace(/[),.;]+$/, '');
        return `https://${extracted}`;
    }

    return '';
}
