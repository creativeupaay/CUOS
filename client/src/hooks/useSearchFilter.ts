import { useState, useMemo, useCallback } from 'react';

export interface UseSearchFilterOptions<T> {
    items: T[];
    /** Fields to search across. Supports dot-notation like "user.name" */
    searchFields: (keyof T | string)[];
    /** Additional filter predicates beyond text search */
    filters?: Array<(item: T) => boolean>;
}

function getNestedValue(obj: unknown, path: string): string {
    return String(
        path.split('.').reduce<unknown>((acc, key) => {
            if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
            return '';
        }, obj) ?? '',
    ).toLowerCase();
}

export interface UseSearchFilterReturn<T> {
    query: string;
    setQuery: (q: string) => void;
    filtered: T[];
    total: number;
}

/**
 * Generic list search & filter hook.
 * Usage:
 *   const { query, setQuery, filtered } = useSearchFilter({
 *     items: expenses,
 *     searchFields: ['description', 'vendor', 'category'],
 *   });
 */
export function useSearchFilter<T>({
    items,
    searchFields,
    filters = [],
}: UseSearchFilterOptions<T>): UseSearchFilterReturn<T> {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((item) => {
            const matchesSearch =
                !q ||
                searchFields.some((field) =>
                    getNestedValue(item, field as string).includes(q),
                );
            const matchesFilters = filters.every((fn) => fn(item));
            return matchesSearch && matchesFilters;
        });
    }, [items, query, searchFields, filters]);

    const handleSetQuery = useCallback((q: string) => setQuery(q), []);

    return { query, setQuery: handleSetQuery, filtered, total: items.length };
}
