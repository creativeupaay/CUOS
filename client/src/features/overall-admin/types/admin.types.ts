// ── User Types ───────────────────────────────────────────────────────

export interface AdminUser {
    _id: string;
    name: string;
    email: string;
    role: {
        _id: string;
        name: string;
        level: number;
    } | string;
    department?: string;
    isActive: boolean;
    lastLogin?: string;
    createdAt: string;
    updatedAt: string;
    modulePermissions?: {
        projectManagement?: {
            enabled: boolean;
            projectPermissions?: Array<{ projectId: string; subModules?: { overview: boolean; tasks: boolean; timeLogs: boolean; meetings: boolean; credentials: boolean; documents: boolean } }>;
        };
        finance?: { enabled: boolean; subModules?: { dashboard: boolean; expenses: boolean; invoices: boolean; reports: boolean } };
        crm?: { enabled: boolean; subModules?: { pipeline: boolean; leads: boolean; proposals: boolean; clients: boolean } };
        hrms?: { enabled: boolean; subModules?: { dashboard: boolean; employees: boolean; attendance: boolean; leaves: boolean; payroll: boolean } };
        overallAdmin?: { enabled: boolean; subModules?: { users: boolean; permissions: boolean; settings: boolean; auditLogs: boolean } };
    };
}

export interface UserFilters {
    search?: string;
    role?: string;
    department?: string;
    isActive?: string;
    page?: number;
    limit?: number;
}

export interface CreateUserPayload {
    name: string;
    email: string;
    password: string;
    role: string;
    department?: string;
}

export interface UpdateUserPayload {
    name?: string;
    email?: string;
    role?: string;
    department?: string;
    isActive?: boolean;
    modulePermissions?: Record<string, any>;
}

// ── Role & Permission Types ──────────────────────────────────────────

export interface AdminRole {
    _id: string;
    name: string;
    description: string;
    permissions: AdminPermission[] | string[];
    level: number;
    createdAt: string;
    updatedAt: string;
}

export interface AdminPermission {
    _id: string;
    resource: string;
    action: string;
    description: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateRolePayload {
    name: string;
    description: string;
    permissions: string[];
    level: number;
}

export interface UpdateRolePayload {
    name?: string;
    description?: string;
    permissions?: string[];
    level?: number;
}

// ── Audit Log Types ──────────────────────────────────────────────────

export interface AuditLogEntry {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
    };
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    createdAt: string;
}

export interface AuditLogFilters {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

// ── Org Settings Types ───────────────────────────────────────────────

export interface OrgSettings {
    _id: string;
    companyName: string;
    companyEmail: string;
    companyPhone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
    };
    departments: string[];
    currency: string;
    taxSettings: {
        gstEnabled: boolean;
        gstRate: number;
        tdsEnabled: boolean;
        tdsRate: number;
    };
    workingHours: {
        startTime: string;
        endTime: string;
        daysPerWeek: number;
        hoursPerDay: number;
    };
    featureToggles: {
        projectManagement: boolean;
        finance: boolean;
        crm: boolean;
        hrms: boolean;
        leads: boolean;
    };
    passwordPolicy: {
        minLength: number;
        requireUppercase: boolean;
        requireLowercase: boolean;
        requireNumbers: boolean;
        requireSpecialChars: boolean;
    };
    sessionExpiryMinutes: number;
    createdAt: string;
    updatedAt: string;
}

// ── Dashboard Stats Types ────────────────────────────────────────────

export interface DashboardStats {
    stats: {
        totalUsers: number;
        activeUsers: number;
        inactiveUsers: number;
        totalRoles: number;
    };
    recentUsers: AdminUser[];
    recentAuditLogs: AuditLogEntry[];
    roleDistribution: Array<{ _id: string; count: number }>;
}

// ── API Response Types ───────────────────────────────────────────────

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface PaginatedResponse<T> {
    data: T;
    pagination: Pagination;
}
