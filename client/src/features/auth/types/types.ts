export interface User {
    _id: string;
    name: string;
    email: string;
    partnerId?: string | { _id?: string };
    role: Role | string;
    department?: string;
    isActive: boolean;
    lastLogin?: string;
    createdAt: string;
    updatedAt: string;
    // Partner-specific fields (populated during partner login)
    partnerSlug?: string;
    companyName?: string;
    companyLogo?: string;
    isPartnerEmployee?: boolean;
    modulePermissions?: {
        accessControlVersion?: number;
        projectManagement?: {
            enabled: boolean;
            adminAccess?: boolean;
            projectPermissions?: Array<{ projectId: string; subModules?: { overview: boolean; tasks: boolean; timeLogs: boolean; meetings: boolean; credentials: boolean; documents: boolean; notes?: boolean } }>;
        };
        finance?: { enabled: boolean; adminAccess?: boolean; subModules?: { dashboard: boolean; expenses: boolean; invoices: boolean; reports: boolean; revenue?: boolean; cashInBank?: boolean; salariesPayrolls?: boolean } };
        crm?: { enabled: boolean; adminAccess?: boolean; subModules?: { pipeline: boolean; leads: boolean; proposals: boolean; clients: boolean } };
        teamManagement?: { enabled: boolean };
        hrms?: { enabled: boolean; adminAccess?: boolean; subModules?: { dashboard?: boolean; employees?: boolean; attendance: boolean; leaves: boolean; holidays?: boolean; payroll: boolean; announcements?: boolean } };
        overallAdmin?: { enabled: boolean; adminAccess?: boolean; subModules?: { users: boolean; permissions: boolean; settings: boolean; auditLogs: boolean } };
        partners?: { enabled: boolean; adminAccess?: boolean };
        hiring?: { enabled: boolean; adminAccess?: boolean };
    };
}

export interface Role {
    _id: string;
    name: string;
    description: string;
    permissions: Permission[] | string[];
    level: number;
    createdAt: string;
    updatedAt: string;
}

export interface Permission {
    _id: string;
    resource: string;
    action: string;
    description: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    loading: boolean;
    error: string | null;
}
