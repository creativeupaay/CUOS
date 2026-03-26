import { api } from '@/services/api';
import type {
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    RefreshTokenResponse,
    GetMeResponse,
    GetUsersResponse,
} from './types/apiTypes';

export const authApi = api.injectEndpoints({
    endpoints: (builder) => ({
        login: builder.mutation<LoginResponse, LoginRequest>({
            query: (credentials) => ({
                url: '/auth/login',
                method: 'POST',
                body: credentials,
            }),
        }),
        // Partner login requires slug for personalized portal
        partnerLogin: builder.mutation<LoginResponse, LoginRequest & { slug: string }>({
            query: ({ slug, ...credentials }) => ({
                url: `/auth/partner/${slug}/login`,
                method: 'POST',
                body: credentials,
            }),
        }),
        register: builder.mutation<RegisterResponse, RegisterRequest>({
            query: (userData) => ({
                url: '/auth/register',
                method: 'POST',
                body: userData,
            }),
            invalidatesTags: ['User'],
        }),
        refreshToken: builder.mutation<RefreshTokenResponse, void>({
            query: () => ({
                url: '/auth/refresh',
                method: 'POST',
            }),
        }),
        logout: builder.mutation<{ success: boolean; message: string }, void>({
            query: () => ({
                url: '/auth/logout',
                method: 'POST',
            }),
        }),
        changePassword: builder.mutation<
            { success: boolean; message: string },
            { oldPassword: string; newPassword: string }
        >({
            query: (body) => ({
                url: '/auth/change-password',
                method: 'POST',
                body,
            }),
        }),
        getMe: builder.query<GetMeResponse, void>({
            query: () => '/auth/me',
            providesTags: ['User'],
        }),
        getUsers: builder.query<GetUsersResponse, void>({
            query: () => '/auth/users',
        }),
    }),
});

export const {
    useLoginMutation,
    usePartnerLoginMutation,
    useRegisterMutation,
    useRefreshTokenMutation,
    useLogoutMutation,
    useChangePasswordMutation,
    useGetMeQuery,
    useLazyGetMeQuery,
    useGetUsersQuery,
} = authApi;
