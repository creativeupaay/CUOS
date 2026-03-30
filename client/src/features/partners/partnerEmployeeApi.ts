import { api } from '@/services/api';

export interface PartnerEmployee {
    _id: string;
    partnerId: string;
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    isActive: boolean;
    modulePermissions: {
        projectManagement: boolean;
        crm: boolean;
        teamManagement: boolean;
    };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePartnerEmployeeRequest {
    name: string;
    email: string;
    password: string;
    phone?: string;
    designation?: string;
    modulePermissions?: {
        projectManagement?: boolean;
        crm?: boolean;
        teamManagement?: boolean;
    };
}

export interface UpdatePartnerEmployeeRequest {
    name?: string;
    email?: string;
    phone?: string;
    designation?: string;
    isActive?: boolean;
    modulePermissions?: {
        projectManagement?: boolean;
        crm?: boolean;
        teamManagement?: boolean;
    };
}

export interface PartnerEmployeeListResponse {
    success: boolean;
    message: string;
    data: {
        employees: PartnerEmployee[];
        total: number;
        page: number;
        totalPages: number;
    };
}

export interface PartnerEmployeeResponse {
    success: boolean;
    message: string;
    data: PartnerEmployee;
}

export interface PartnerEmployeeStatsResponse {
    success: boolean;
    message: string;
    data: {
        total: number;
        active: number;
        inactive: number;
    };
}

export const partnerEmployeeApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // Get all employees
        getPartnerEmployees: builder.query<
            PartnerEmployeeListResponse,
            { search?: string; isActive?: boolean; page?: number; limit?: number } | void
        >({
            query: (params) => ({
                url: '/partner-employees',
                method: 'GET',
                params: params || {},
            }),
            providesTags: ['PartnerEmployees'],
        }),

        // Get employee by ID
        getPartnerEmployeeById: builder.query<PartnerEmployeeResponse, string>({
            query: (id) => ({
                url: `/partner-employees/${id}`,
                method: 'GET',
            }),
            providesTags: (_result, _error, id) => [{ type: 'PartnerEmployees', id }],
        }),

        // Create employee
        createPartnerEmployee: builder.mutation<PartnerEmployeeResponse, CreatePartnerEmployeeRequest>({
            query: (data) => ({
                url: '/partner-employees',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['PartnerEmployees'],
        }),

        // Update employee
        updatePartnerEmployee: builder.mutation<
            PartnerEmployeeResponse,
            { id: string; data: UpdatePartnerEmployeeRequest }
        >({
            query: ({ id, data }) => ({
                url: `/partner-employees/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'PartnerEmployees', id },
                'PartnerEmployees',
            ],
        }),

        // Delete employee
        deletePartnerEmployee: builder.mutation<{ success: boolean; message: string }, string>({
            query: (id) => ({
                url: `/partner-employees/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['PartnerEmployees'],
        }),

        // Toggle employee status
        togglePartnerEmployeeStatus: builder.mutation<PartnerEmployeeResponse, string>({
            query: (id) => ({
                url: `/partner-employees/${id}/toggle-status`,
                method: 'POST',
            }),
            invalidatesTags: (_result, _error, id) => [
                { type: 'PartnerEmployees', id },
                'PartnerEmployees',
            ],
        }),

        // Reset employee password
        resetPartnerEmployeePassword: builder.mutation<
            { success: boolean; message: string },
            { id: string; newPassword: string }
        >({
            query: ({ id, newPassword }) => ({
                url: `/partner-employees/${id}/reset-password`,
                method: 'POST',
                body: { newPassword },
            }),
        }),

        // Get employee stats
        getPartnerEmployeeStats: builder.query<PartnerEmployeeStatsResponse, void>({
            query: () => ({
                url: '/partner-employees/stats',
                method: 'GET',
            }),
            providesTags: ['PartnerEmployees'],
        }),
    }),
});

export const {
    useGetPartnerEmployeesQuery,
    useGetPartnerEmployeeByIdQuery,
    useCreatePartnerEmployeeMutation,
    useUpdatePartnerEmployeeMutation,
    useDeletePartnerEmployeeMutation,
    useTogglePartnerEmployeeStatusMutation,
    useResetPartnerEmployeePasswordMutation,
    useGetPartnerEmployeeStatsQuery,
} = partnerEmployeeApi;
