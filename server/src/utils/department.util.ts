import { OrgSettings } from '../modules/overall-admin/models/OrgSettings.model';

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

export function buildDepartmentFilter(value?: string | null) {
    const normalized = normalizeWhitespace(String(value || ''));
    if (!normalized) return undefined;

    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { $regex: `^${escaped}$`, $options: 'i' };
}

export function mergeDepartmentCounts(
    rows: Array<{ _id: string; count: number }>,
    configuredDepartments: string[] = DEFAULT_DEPARTMENTS
) {
    const merged = new Map<string, { _id: string; count: number }>();

    rows.forEach((row) => {
        const departmentId = resolveDepartmentValue(row._id, configuredDepartments);
        const normalized = normalizeDepartmentKey(departmentId);
        const existing = merged.get(normalized);

        if (existing) {
            existing.count += row.count;
            return;
        }

        merged.set(normalized, {
            _id: departmentId,
            count: row.count,
        });
    });

    return Array.from(merged.values()).sort((a, b) => b.count - a.count);
}

export async function getDepartmentCatalog() {
    const settings = await OrgSettings.findOne().select('departments').lean();
    const configuredDepartments =
        settings?.departments && settings.departments.length
            ? settings.departments
            : DEFAULT_DEPARTMENTS;

    return dedupeDepartments(configuredDepartments);
}
