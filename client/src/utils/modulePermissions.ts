export type ModuleKey =
    | 'projectManagement'
    | 'finance'
    | 'crm'
    | 'hrms'
    | 'overallAdmin'
    | 'partners'
    | 'hiring';

export const MODULE_KEYS: ModuleKey[] = [
    'projectManagement',
    'finance',
    'crm',
    'hrms',
    'overallAdmin',
    'partners',
    'hiring',
];

export function getRoleName(role: any): string {
    return role ? (typeof role === 'object' ? String(role.name || '') : String(role)).toLowerCase() : '';
}

export function usesVersionedModulePermissions(user: any): boolean {
    return Number(user?.modulePermissions?.accessControlVersion || 0) >= 2;
}

function isGlobalAdminRole(roleName: string) {
    return ['super-admin', 'super_admin', 'admin'].includes(roleName);
}

function isHrRole(roleName: string) {
    return ['hr', 'hr-admin', 'hr_admin', 'hr-manager', 'hrmanager', 'human-resources'].includes(roleName);
}

function hasLegacyModuleRole(roleName: string, moduleKey: ModuleKey) {
    if (moduleKey === 'finance') return ['finance', 'finance-admin', 'finance_admin', 'accountant'].includes(roleName);
    if (moduleKey === 'projectManagement') return ['project-manager', 'project_manager', 'manager'].includes(roleName);
    if (moduleKey === 'crm') return ['crm', 'sales', 'manager'].includes(roleName);
    if (moduleKey === 'hrms' || moduleKey === 'hiring') return isHrRole(roleName);
    return false;
}

export function hasModuleAdminAccess(user: any, moduleKey: ModuleKey): boolean {
    const roleName = getRoleName(user?.role);
    if (['super-admin', 'super_admin'].includes(roleName)) return true;

    const moduleAccess = user?.modulePermissions?.[moduleKey];
    if (usesVersionedModulePermissions(user)) {
        return moduleAccess?.adminAccess === true;
    }

    if (roleName === 'partner' && !user?.isPartnerEmployee) {
        return moduleKey === 'projectManagement' || moduleKey === 'crm';
    }

    if (isGlobalAdminRole(roleName)) return true;
    if (hasLegacyModuleRole(roleName, moduleKey)) return true;
    if (isHrRole(roleName) && (moduleKey === 'hrms' || moduleKey === 'hiring')) return true;
    return moduleAccess?.adminAccess === true;
}

export function hasModuleViewAccess(
    user: any,
    moduleKey: ModuleKey,
    options?: { isJobManager?: boolean }
): boolean {
    if (hasModuleAdminAccess(user, moduleKey)) return true;
    if (moduleKey === 'hiring' && options?.isJobManager) return true;

    const roleName = getRoleName(user?.role);
    if (roleName === 'partner') {
        if (!user?.isPartnerEmployee && !usesVersionedModulePermissions(user)) {
            return moduleKey === 'projectManagement' || moduleKey === 'crm' || moduleKey === 'partners';
        }
        if (moduleKey === 'projectManagement' || moduleKey === 'crm') {
            return user?.modulePermissions?.[moduleKey]?.enabled === true;
        }
        if (moduleKey === 'partners') return true;
        return false;
    }

    const moduleAccess = user?.modulePermissions?.[moduleKey];
    if (moduleAccess?.enabled === true) return true;

    if (!usesVersionedModulePermissions(user)) {
        if (moduleKey === 'hrms' && !user?.isPartnerEmployee) return true;
        if (moduleKey === 'hiring' && isHrRole(roleName)) return true;
    }

    return false;
}

export type HrmsSelfSubmodule = 'attendance' | 'leaves' | 'holidays' | 'payroll' | 'announcements';

export function hasHrmsSelfSubmoduleAccess(user: any, submodule: HrmsSelfSubmodule): boolean {
    if (hasModuleAdminAccess(user, 'hrms')) return true;
    if (!hasModuleViewAccess(user, 'hrms')) return false;

    const subModules = user?.modulePermissions?.hrms?.subModules;
    if (!subModules) return true;

    if (submodule in subModules) {
        return subModules[submodule] === true;
    }

    return submodule === 'holidays' || submodule === 'announcements';
}
