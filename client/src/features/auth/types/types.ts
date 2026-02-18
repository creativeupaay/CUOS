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
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}
