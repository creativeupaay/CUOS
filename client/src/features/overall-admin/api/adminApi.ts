import api from '../../../services/api';
import type {
    AdminUser,
    AdminRole,
    AdminPermission,
    AuditLogEntry,
    OrgSettings,
    DashboardStats,
    UserFilters,
    CreateUserPayload,
    UpdateUserPayload,
    CreateRolePayload,
    UpdateRolePayload,
    AuditLogFilters,
    Pagination,
} from '../types/admin.types';

// ── API Response wrappers ────────────────────────────────────────────

interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
}

// ── Admin API ────────────────────────────────────────────────────────

const adminApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // ── Dashboard ────────────────────────────────────────────
        getAdminDashboardStats: builder.query<ApiResponse<DashboardStats>, void>({
            query: () => '/admin/dashboard-stats',
            providesTags: ['AdminUsers', 'Roles'],
        }),

        // ── Users ────────────────────────────────────────────────
        getAdminUsers: builder.query<
            ApiResponse<{ users: AdminUser[]; pagination: Pagination }>,
            UserFilters | void
        >({
            query: (filters) => {
                const params = new URLSearchParams();
                if (filters) {
                    Object.entries(filters).forEach(([key, value]) => {
                        if (value !== undefined && value !== '') {
                            params.append(key, String(value));
                        }
                    });
                }
                return `/admin/users?${params.toString()}`;
            },
            providesTags: ['AdminUsers'],
        }),

        getAdminUser: builder.query<ApiResponse<AdminUser>, string>({
            query: (id) => `/admin/users/${id}`,
            providesTags: ['AdminUsers'],
        }),

        createAdminUser: builder.mutation<ApiResponse<AdminUser>, CreateUserPayload>({
            query: (body) => ({
                url: '/admin/users',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['AdminUsers'],
        }),

        updateAdminUser: builder.mutation<
            ApiResponse<AdminUser>,
            { id: string; data: UpdateUserPayload }
        >({
            query: ({ id, data }) => ({
                url: `/admin/users/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['AdminUsers'],
        }),

        deactivateUser: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/admin/users/${id}/deactivate`,
                method: 'PATCH',
            }),
            invalidatesTags: ['AdminUsers'],
        }),

        activateUser: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/admin/users/${id}/activate`,
                method: 'PATCH',
            }),
            invalidatesTags: ['AdminUsers'],
        }),

        resetUserPassword: builder.mutation<
            ApiResponse,
            { id: string; newPassword: string }
        >({
            query: ({ id, newPassword }) => ({
                url: `/admin/users/${id}/reset-password`,
                method: 'PATCH',
                body: { newPassword },
            }),
        }),

        deleteAdminUser: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/admin/users/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['AdminUsers'],
        }),

        // ── Roles ────────────────────────────────────────────────
        getAdminRoles: builder.query<ApiResponse<AdminRole[]>, void>({
            query: () => '/admin/roles',
            providesTags: ['Roles'],
        }),

        getAdminRole: builder.query<
            ApiResponse<{ role: AdminRole; userCount: number }>,
            string
        >({
            query: (id) => `/admin/roles/${id}`,
            providesTags: ['Roles'],
        }),

        createAdminRole: builder.mutation<ApiResponse<AdminRole>, CreateRolePayload>({
            query: (body) => ({
                url: '/admin/roles',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Roles'],
        }),

        updateAdminRole: builder.mutation<
            ApiResponse<AdminRole>,
            { id: string; data: UpdateRolePayload }
        >({
            query: ({ id, data }) => ({
                url: `/admin/roles/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Roles'],
        }),

        deleteAdminRole: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/admin/roles/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Roles'],
        }),

        cloneAdminRole: builder.mutation<
            ApiResponse<AdminRole>,
            { id: string; name: string }
        >({
            query: ({ id, name }) => ({
                url: `/admin/roles/${id}/clone`,
                method: 'POST',
                body: { name },
            }),
            invalidatesTags: ['Roles'],
        }),

        // ── Permissions ──────────────────────────────────────────
        getAdminPermissions: builder.query<
            ApiResponse<{ permissions: AdminPermission[]; grouped: Record<string, AdminPermission[]> }>,
            void
        >({
            query: () => '/admin/permissions',
            providesTags: ['Permissions'],
        }),

        createAdminPermission: builder.mutation<
            ApiResponse<AdminPermission>,
            { resource: string; action: string; description: string }
        >({
            query: (body) => ({
                url: '/admin/permissions',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Permissions'],
        }),

        deleteAdminPermission: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/admin/permissions/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Permissions'],
        }),

        // ── Audit Logs ───────────────────────────────────────────
        getAuditLogs: builder.query<
            ApiResponse<{ logs: AuditLogEntry[]; pagination: Pagination }>,
            AuditLogFilters | void
        >({
            query: (filters) => {
                const params = new URLSearchParams();
                if (filters) {
                    Object.entries(filters).forEach(([key, value]) => {
                        if (value !== undefined && value !== '') {
                            params.append(key, String(value));
                        }
                    });
                }
                return `/admin/audit-logs?${params.toString()}`;
            },
            providesTags: ['AuditLogs'],
        }),

        // ── Settings ─────────────────────────────────────────────
        getOrgSettings: builder.query<ApiResponse<OrgSettings>, void>({
            query: () => '/admin/settings',
            providesTags: ['OrgSettings'],
        }),

        updateOrgSettings: builder.mutation<
            ApiResponse<OrgSettings>,
            Partial<OrgSettings>
        >({
            query: (body) => ({
                url: '/admin/settings',
                method: 'PATCH',
                body,
            }),
            invalidatesTags: ['OrgSettings'],
        }),
    }),
});

export const {
    // Dashboard
    useGetAdminDashboardStatsQuery,
    // Users
    useGetAdminUsersQuery,
    useGetAdminUserQuery,
    useCreateAdminUserMutation,
    useUpdateAdminUserMutation,
    useDeactivateUserMutation,
    useActivateUserMutation,
    useResetUserPasswordMutation,
    useDeleteAdminUserMutation,
    // Roles
    useGetAdminRolesQuery,
    useGetAdminRoleQuery,
    useCreateAdminRoleMutation,
    useUpdateAdminRoleMutation,
    useDeleteAdminRoleMutation,
    useCloneAdminRoleMutation,
    // Permissions
    useGetAdminPermissionsQuery,
    useCreateAdminPermissionMutation,
    useDeleteAdminPermissionMutation,
    // Audit Logs
    useGetAuditLogsQuery,
    // Settings
    useGetOrgSettingsQuery,
    useUpdateOrgSettingsMutation,
} = adminApi;

export default adminApi;
