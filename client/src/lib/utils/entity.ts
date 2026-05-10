/**
 * Entity ID Utilities
 * Handles polymorphic MongoDB entity identifiers (populated vs. non-populated refs).
 */

/**
 * Extracts a plain string ID from a MongoDB entity reference that may be
 * populated (object with `_id`) or a raw string / ObjectId.
 */
export function getEntityId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (obj._id) return getEntityId(obj._id);
        if (obj.id) return getEntityId(obj.id);
        if (obj.userId) return getEntityId(obj.userId);
    }
    return String(value);
}

/**
 * Checks whether two entity references refer to the same document.
 */
export function isSameEntity(a: unknown, b: unknown): boolean {
    return getEntityId(a) === getEntityId(b);
}
