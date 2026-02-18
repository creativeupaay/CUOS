import { api } from '@/services/api';
import type { Lead, Proposal, PipelineSummary } from './types/types';
import type {
    ApiResponse,
    CreateLeadRequest,
    UpdateLeadRequest,
    ListLeadsParams,
    ListLeadsResponse,
    AddActivityRequest,
    AddMeetingRequest,
    CreateProposalRequest,
    UpdateProposalRequest,
    ListProposalsParams,
    ListProposalsResponse,
    UpdateProposalStatusRequest,
} from './types/apiTypes';

export const crmApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // ============================================
        // LEAD ENDPOINTS
        // ============================================
        createLead: builder.mutation<ApiResponse<{ lead: Lead }>, CreateLeadRequest>({
            query: (data) => ({
                url: '/crm/leads',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Leads', 'Pipeline'],
        }),

        getLeads: builder.query<ApiResponse<ListLeadsResponse>, ListLeadsParams>({
            query: (params) => ({
                url: '/crm/leads',
                params,
            }),
            providesTags: ['Leads'],
        }),

        getLeadById: builder.query<ApiResponse<{ lead: Lead }>, string>({
            query: (id) => `/crm/leads/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Leads', id }],
        }),

        updateLead: builder.mutation<
            ApiResponse<{ lead: Lead }>,
            { id: string; data: UpdateLeadRequest }
        >({
            query: ({ id, data }) => ({
                url: `/crm/leads/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Leads', id },
                'Leads',
                'Pipeline',
            ],
        }),

        deleteLead: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/crm/leads/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Leads', 'Pipeline'],
        }),

        addLeadActivity: builder.mutation<
            ApiResponse<{ lead: Lead }>,
            { leadId: string; data: AddActivityRequest }
        >({
            query: ({ leadId, data }) => ({
                url: `/crm/leads/${leadId}/activities`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { leadId }) => [
                { type: 'Leads', id: leadId },
            ],
        }),

        addLeadMeeting: builder.mutation<
            ApiResponse<{ lead: Lead }>,
            { leadId: string; data: AddMeetingRequest }
        >({
            query: ({ leadId, data }) => ({
                url: `/crm/leads/${leadId}/meetings`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { leadId }) => [
                { type: 'Leads', id: leadId },
            ],
        }),

        closeLeadDeal: builder.mutation<
            ApiResponse<{ lead: Lead; client: any }>,
            string
        >({
            query: (id) => ({
                url: `/crm/leads/${id}/close`,
                method: 'POST',
            }),
            invalidatesTags: ['Leads', 'Pipeline', 'Clients'],
        }),

        getPipelineSummary: builder.query<
            ApiResponse<PipelineSummary>,
            { assignedTo?: string } | void
        >({
            query: (params) => ({
                url: '/crm/leads/pipeline',
                params: params || {},
            }),
            providesTags: ['Pipeline'],
        }),

        // ============================================
        // PROPOSAL ENDPOINTS
        // ============================================
        createProposal: builder.mutation<
            ApiResponse<{ proposal: Proposal }>,
            CreateProposalRequest
        >({
            query: (data) => ({
                url: '/crm/proposals',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Proposals', 'Leads'],
        }),

        getProposals: builder.query<
            ApiResponse<ListProposalsResponse>,
            ListProposalsParams
        >({
            query: (params) => ({
                url: '/crm/proposals',
                params,
            }),
            providesTags: ['Proposals'],
        }),

        getProposalById: builder.query<
            ApiResponse<{ proposal: Proposal }>,
            string
        >({
            query: (id) => `/crm/proposals/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Proposals', id }],
        }),

        updateProposal: builder.mutation<
            ApiResponse<{ proposal: Proposal }>,
            { id: string; data: UpdateProposalRequest }
        >({
            query: ({ id, data }) => ({
                url: `/crm/proposals/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Proposals', id },
                'Proposals',
            ],
        }),

        deleteProposal: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/crm/proposals/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Proposals'],
        }),

        updateProposalStatus: builder.mutation<
            ApiResponse<{ proposal: Proposal }>,
            { id: string; data: UpdateProposalStatusRequest }
        >({
            query: ({ id, data }) => ({
                url: `/crm/proposals/${id}/status`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Proposals', id },
                'Proposals',
                'Leads',
                'Pipeline',
            ],
        }),
    }),
    overrideExisting: false,
});

export const {
    // Leads
    useCreateLeadMutation,
    useGetLeadsQuery,
    useGetLeadByIdQuery,
    useUpdateLeadMutation,
    useDeleteLeadMutation,
    useAddLeadActivityMutation,
    useAddLeadMeetingMutation,
    useCloseLeadDealMutation,
    useGetPipelineSummaryQuery,

    // Proposals
    useCreateProposalMutation,
    useGetProposalsQuery,
    useGetProposalByIdQuery,
    useUpdateProposalMutation,
    useDeleteProposalMutation,
    useUpdateProposalStatusMutation,
} = crmApi;
