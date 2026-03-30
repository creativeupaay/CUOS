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
    slug?: string;
    companyName?: string;
    companyLogo?: string;
    contactPerson?: string;
    contactPersonPhone?: string;
    phone?: string;
    email?: string;
    photo?: string;
    websiteLink?: string;
    address?: PartnerAddress;
    registrationStatus?: 'pending' | 'completed';
    registrationToken?: string;
    registrationTokenExpiry?: string;
    loginUrl?: string;
    onboardingUrl?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    stats?: PartnerStats;
}

// Simplified - just name and email for minimal creation
export interface CreatePartnerPayload {
    name: string;
    email: string;
}

export interface UpdatePartnerPayload {
    companyName?: string;
    companyLogo?: string;
    contactPerson?: string;
    contactPersonPhone?: string;
    phone?: string;
    email?: string;
    photo?: string;
    websiteLink?: string;
    address?: PartnerAddress;
}

export interface ListPartnersParams {
    search?: string;
    isActive?: 'true' | 'false' | '';
    page?: number;
    limit?: number;
}

// Full onboarding form with password
export interface PartnerOnboardingPayload {
    name: string;
    phone: string;
    photo?: string;
    companyName: string;
    companyLogo?: string;
    contactPersonName: string;
    contactPersonPhone: string;
    websiteLink?: string;
    address?: PartnerAddress;
    password: string;
    confirmPassword: string;
}

// Partner info for onboarding form
export interface PartnerOnboardingInfo {
    name: string;
    email: string;
    registrationStatus: 'pending' | 'completed';
}

// Partner info for personalized login page
export interface PartnerLoginInfo {
    id: string;
    slug: string;
    companyName?: string;
    companyLogo?: string;
    contactPerson?: string;
    photo?: string;
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

        deletePartner: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/partners/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Partners'],
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

        // Public: Get partner info by registration token (for onboarding form)
        getPartnerOnboardingByToken: builder.query<ApiResponse<PartnerOnboardingInfo>, string>({
            query: (token) => `/partner/onboarding/${token}`,
        }),

        // Public: Submit partner onboarding form
        submitPartnerOnboarding: builder.mutation<
            ApiResponse<{ loginUrl: string; companyName: string; slug: string }>,
            { token: string; data: PartnerOnboardingPayload }
        >({
            query: ({ token, data }) => ({
                url: `/partner/onboarding/${token}`,
                method: 'POST',
                body: data,
            }),
        }),

        // Public: Get partner info by slug (for personalized login page)
        getPartnerBySlug: builder.query<ApiResponse<PartnerLoginInfo>, string>({
            query: (slug) => `/partner/login/${slug}`,
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
    useDeletePartnerMutation,
    useRegeneratePartnerTokenMutation,
    useGetPartnerClientsQuery,
    useGetPartnerProjectsQuery,
    useGetPartnerOnboardingByTokenQuery,
    useSubmitPartnerOnboardingMutation,
    useGetPartnerBySlugQuery,
} = partnersApi;
