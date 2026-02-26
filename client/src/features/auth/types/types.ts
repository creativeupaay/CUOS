export interface User {
    _id: string;
    name: string;
    email: string;
    role: Role | string;
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
