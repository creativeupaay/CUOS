// Types
export type {
    Lead,
    LeadActivity,
    Proposal,
    ProposalLineItem,
    PipelineSummary,
    PipelineStageSummary,
} from './types/types';

// API Types
export type {
    CreateLeadRequest,
    UpdateLeadRequest,
    ListLeadsParams,
    ListLeadsResponse,
    AddActivityRequest,
    CreateProposalRequest,
    UpdateProposalRequest,
    ListProposalsParams,
    ListProposalsResponse,
    UpdateProposalStatusRequest,
} from './types/apiTypes';

// API Hooks
export {
    useCreateLeadMutation,
    useGetLeadsQuery,
    useGetLeadByIdQuery,
    useUpdateLeadMutation,
    useDeleteLeadMutation,
    useAddLeadActivityMutation,
    useConvertLeadToClientMutation,
    useGetPipelineSummaryQuery,
    useCreateProposalMutation,
    useGetProposalsQuery,
    useGetProposalByIdQuery,
    useUpdateProposalMutation,
    useDeleteProposalMutation,
    useUpdateProposalStatusMutation,
} from './crmApi';
