/**
 * Role Utilities
 * Centralized role checking — eliminates the 6+ inline getRoleName/hasAdminRole
 * duplications scattered across page components.
 */

type RoleValue = string | { name?: string; [key: string]: unknown } | null | undefined;

/**
 * Normalizes any role shape to a lowercase string.
 */
export function getRoleName(role: RoleValue): string {
    if (!role) return '';
    if (typeof role === 'string') return role.toLowerCase();
    if (typeof role === 'object') return String(role.name ?? '').toLowerCase();
    return '';
}

/**
 * Returns true if the role is any variant of "admin" or "super-admin".
 */
export function hasAdminRole(role: RoleValue): boolean {
    const name = getRoleName(role);
    return ['super-admin', 'super_admin', 'admin'].includes(name);
}

/**
 * Returns true if the role is exactly "super_admin" / "super-admin".
 */
export function isSuperAdmin(role: RoleValue): boolean {
    const name = getRoleName(role);
    return ['super-admin', 'super_admin'].includes(name);
}
