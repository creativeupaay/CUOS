// ============================================
// CRM Feature — Public API
// ============================================

// Types
export type {
    Lead,
    LeadActivity,
    LeadMeeting,
    Proposal,
    ProposalLineItem,
    ProposalDocument,
    ProposalAuditEntry,
    PipelineStageSummary,
    PipelineSummary,
    User,
    Client,
} from './types/types';

// API Types
export type {
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

// API & Hooks
export {
    crmApi,
    // Lead hooks
    useCreateLeadMutation,
    useGetLeadsQuery,
    useGetLeadByIdQuery,
    useUpdateLeadMutation,
    useDeleteLeadMutation,
    useAddLeadActivityMutation,
    useAddLeadMeetingMutation,
    useCloseLeadDealMutation,
    useGetPipelineSummaryQuery,
    // Proposal hooks
    useCreateProposalMutation,
    useGetProposalsQuery,
    useGetProposalByIdQuery,
    useUpdateProposalMutation,
    useDeleteProposalMutation,
    useUpdateProposalStatusMutation,
} from './crmApi';
