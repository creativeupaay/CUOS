import { api } from '@/services/api';

interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data: T;
}

export interface PartnerAddress {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

export interface PartnerStats {
    clientsCount: number;
    projectsCount: number;
    activeProjectsCount?: number;
    completedProjectsCount?: number;
}

export interface Partner {
    _id: string;
    userId?: {
        _id: string;
        name: string;
        email: string;
        isActive?: boolean;
    };
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: PartnerAddress;
    registrationStatus?: 'pending' | 'completed';
    registrationToken?: string;
    registrationTokenExpiry?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    stats?: PartnerStats;
}

export interface CreatePartnerPayload {
    name: string;
    email: string;
    password: string;
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    address?: PartnerAddress;
}

export interface UpdatePartnerPayload {
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: PartnerAddress;
}

export interface ListPartnersParams {
    search?: string;
    isActive?: 'true' | 'false' | '';
    page?: number;
    limit?: number;
}

export interface PartnerRegistrationPayload {
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    address?: PartnerAddress;
}

export const partnersApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getPartners: builder.query<
            ApiResponse<{ partners: Partner[]; total: number; page: number; totalPages: number }>,
            ListPartnersParams | void
        >({
            query: (params) => ({
                url: '/partners',
                params: params || {},
            }),
            providesTags: ['Partners'],
        }),

        getPartnerById: builder.query<ApiResponse<Partner>, string>({
            query: (id) => `/partners/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Partners', id }],
        }),

        createPartner: builder.mutation<
            ApiResponse<{ partner: Partner; registrationToken: string; registrationLink: string }>,
            CreatePartnerPayload
        >({
            query: (body) => ({
                url: '/partners',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Partners'],
        }),

        updatePartner: builder.mutation<ApiResponse<Partner>, { id: string; data: UpdatePartnerPayload }>({
            query: ({ id, data }) => ({
                url: `/partners/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'Partners', id }, 'Partners'],
        }),

        deactivatePartner: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/partners/${id}/deactivate`,
                method: 'PATCH',
            }),
            invalidatesTags: (_result, _error, id) => [{ type: 'Partners', id }, 'Partners'],
        }),

        activatePartner: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/partners/${id}/activate`,
                method: 'PATCH',
            }),
            invalidatesTags: (_result, _error, id) => [{ type: 'Partners', id }, 'Partners'],
        }),

        regeneratePartnerToken: builder.mutation<ApiResponse<{ token: string; expiresAt: string; registrationLink: string }>, string>({
            query: (id) => ({
                url: `/partners/${id}/regenerate-token`,
                method: 'POST',
            }),
            invalidatesTags: (_result, _error, id) => [{ type: 'Partners', id }, 'Partners'],
        }),

        getPartnerClients: builder.query<ApiResponse<any[]>, string>({
            query: (id) => `/partners/${id}/clients`,
            providesTags: (_result, _error, id) => [{ type: 'Partners', id: `${id}-clients` }],
        }),

        getPartnerProjects: builder.query<ApiResponse<any[]>, string>({
            query: (id) => `/partners/${id}/projects`,
            providesTags: (_result, _error, id) => [{ type: 'Partners', id: `${id}-projects` }],
        }),

        getPartnerRegistrationByToken: builder.query<
            ApiResponse<{ name: string; email: string; registrationStatus: 'pending' | 'completed' }>,
            string
        >({
            query: (token) => `/partner-form/${token}`,
        }),

        submitPartnerRegistration: builder.mutation<ApiResponse<Partner>, { token: string; data: PartnerRegistrationPayload }>({
            query: ({ token, data }) => ({
                url: `/partner-form/${token}`,
                method: 'POST',
                body: data,
            }),
        }),
    }),
});

export const {
    useGetPartnersQuery,
    useGetPartnerByIdQuery,
    useCreatePartnerMutation,
    useUpdatePartnerMutation,
    useDeactivatePartnerMutation,
    useActivatePartnerMutation,
    useRegeneratePartnerTokenMutation,
    useGetPartnerClientsQuery,
    useGetPartnerProjectsQuery,
    useGetPartnerRegistrationByTokenQuery,
    useSubmitPartnerRegistrationMutation,
} = partnersApi;
