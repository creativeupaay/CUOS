import { api } from '@/services/api';
import toast from 'react-hot-toast';
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
    UploadLeadDocumentRequest,
    UploadLeadDocumentsRequest,
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
            async onQueryStarted({ id, data }, { dispatch, queryFulfilled }) {
                // Optimistic update for the leads cache
                const patchResult = dispatch(
                    crmApi.util.updateQueryData('getLeads', { limit: 200, search: '' }, (draft) => {
                        const leadDraft = draft.data.leads.find((l) => l._id === id);
                        if (leadDraft && data.stage) {
                            leadDraft.stage = data.stage;
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
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
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                toast.promise(queryFulfilled, {
                    loading: 'Deleting lead...',
                    success: 'Lead deleted successfully',
                    error: 'Failed to delete lead',
                });
                const patchResult = dispatch(
                    api.util.updateQueryData('getLeads' as never, undefined as never, (draft: any) => {
                       if (draft?.data?.leads) {
                           draft.data.leads = draft.data.leads.filter((l: any) => l._id !== id);
                       }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
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

        uploadLeadDocument: builder.mutation<
            ApiResponse<{ lead: Lead }>,
            UploadLeadDocumentRequest
        >({
            query: ({ leadId, file }) => {
                const formData = new FormData();
                formData.append('file', file);

                return {
                    url: `/crm/leads/${leadId}/documents/upload`,
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: (_result, _error, { leadId }) => [
                { type: 'Leads', id: leadId },
                'Leads',
            ],
        }),

        uploadLeadDocuments: builder.mutation<
            ApiResponse<{ lead: Lead }>,
            UploadLeadDocumentsRequest
        >({
            query: ({ leadId, files }) => {
                const formData = new FormData();
                files.forEach((file) => formData.append('files', file));

                return {
                    url: `/crm/leads/${leadId}/documents/upload`,
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: (_result, _error, { leadId }) => [
                { type: 'Leads', id: leadId },
                'Leads',
            ],
        }),

        closeLeadDeal: builder.mutation<
            ApiResponse<{ lead: Lead }>,
            string
        >({
            query: (id) => ({
                url: `/crm/leads/${id}/close`,
                method: 'POST',
            }),
            invalidatesTags: ['Leads', 'Pipeline'],
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
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                toast.promise(queryFulfilled, {
                    loading: 'Deleting proposal...',
                    success: 'Proposal deleted successfully',
                    error: 'Failed to delete proposal',
                });
                const patchResult = dispatch(
                    api.util.updateQueryData('getProposals' as never, undefined as never, (draft: any) => {
                       if (draft?.data?.proposals) {
                           draft.data.proposals = draft.data.proposals.filter((p: any) => p._id !== id);
                       }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
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
    useUploadLeadDocumentMutation,
    useUploadLeadDocumentsMutation,
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
