type ModuleKey = 'projectManagement' | 'finance' | 'crm' | 'hrms' | 'overallAdmin' | 'partners' | 'hiring';

export interface ModuleAccessUser {
    role?: unknown;
    isPartnerEmployee?: unknown;
    modulePermissions?: {
        accessControlVersion?: number | string;
    } & Partial<Record<ModuleKey, {
        adminAccess?: boolean;
        enabled?: boolean;
        subModules?: Record<string, boolean>;
    }>>;
    [key: string]: unknown;
}

export function usesVersionedModulePermissions(user: ModuleAccessUser | null | undefined): boolean {
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

export function hasModuleAdminAccess(user: ModuleAccessUser | null | undefined, moduleKey: ModuleKey): boolean {
    const roleName = String(user?.role || '').toLowerCase();
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
    return moduleAccess?.adminAccess === true;
}

export function hasModuleViewAccess(user: ModuleAccessUser | null | undefined, moduleKey: ModuleKey): boolean {
    if (hasModuleAdminAccess(user, moduleKey)) return true;

    const roleName = String(user?.role || '').toLowerCase();
    if (roleName === 'partner') {
        if (!user?.isPartnerEmployee && !usesVersionedModulePermissions(user)) {
            return moduleKey === 'projectManagement' || moduleKey === 'crm' || moduleKey === 'partners';
        }
        return moduleKey === 'projectManagement' || moduleKey === 'crm'
            ? user?.modulePermissions?.[moduleKey]?.enabled === true
            : moduleKey === 'partners';
    }

    if (user?.modulePermissions?.[moduleKey]?.enabled === true) return true;

    if (!usesVersionedModulePermissions(user) && moduleKey === 'hrms' && !user?.isPartnerEmployee) {
        return true;
    }

    return false;
}

export type HrmsSelfSubmodule = 'attendance' | 'leaves' | 'holidays' | 'payroll' | 'announcements';

export function hasHrmsSelfSubmoduleAccess(user: ModuleAccessUser | null | undefined, submodule: HrmsSelfSubmodule): boolean {
    if (hasModuleAdminAccess(user, 'hrms')) return true;
    if (!hasModuleViewAccess(user, 'hrms')) return false;

    const subModules = user?.modulePermissions?.hrms?.subModules;
    if (!subModules) return true;

    if (submodule in subModules) {
        return subModules[submodule] === true;
    }

    return submodule === 'holidays' || submodule === 'announcements';
}
