export const DEFAULT_DEPARTMENTS = [
    'Engineering',
    'Design',
    'Marketing',
    'Finance',
    'HR',
    'Operations',
    'Creative',
];

const UPPERCASE_WORDS = new Set(['hr', 'ui', 'ux', 'qa', 'it', 'ai', 'seo', 'devops']);

function normalizeWhitespace(value: string) {
    return value.trim().replace(/\s+/g, ' ');
}

export function normalizeDepartmentKey(value?: string | null) {
    return normalizeWhitespace(String(value || '')).toLowerCase();
}

export function formatDepartmentLabel(value?: string | null) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized) return '';

    return normalized
        .split(' ')
        .map((part) => {
            const lower = part.toLowerCase();
            if (UPPERCASE_WORDS.has(lower)) {
                return lower.toUpperCase();
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

export function dedupeDepartments(values?: Array<string | null | undefined>) {
    const unique = new Map<string, string>();

    (values || []).forEach((value) => {
        const normalized = normalizeDepartmentKey(value);
        if (!normalized || unique.has(normalized)) return;
        unique.set(normalized, formatDepartmentLabel(value));
    });

    return Array.from(unique.values());
}

export function resolveDepartmentValue(
    value?: string | null,
    configuredDepartments: string[] = DEFAULT_DEPARTMENTS
) {
    const normalized = normalizeDepartmentKey(value);
    if (!normalized) return '';

    const matchedDepartment = dedupeDepartments(configuredDepartments).find(
        (department) => normalizeDepartmentKey(department) === normalized
    );

    return matchedDepartment || formatDepartmentLabel(value);
}
