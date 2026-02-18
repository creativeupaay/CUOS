import type { User } from './types';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    success: boolean;
    message: string;
    data: {
        user: User;
        accessToken: string;
    };
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    role?: string;
    department?: string;
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    data: User;
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

export interface RefreshTokenResponse {
    success: boolean;
    message: string;
    data: {
        accessToken: string;
    };
}

export interface GetMeResponse {
    success: boolean;
    message: string;
    data: User;
}
