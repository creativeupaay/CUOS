// ============================================
// CRM Feature — Public API
// ============================================

// Types
export type {
    Lead,
    LeadActivity,
    LeadMeeting,
    LeadDocument,
    LeadLink,
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
    UploadLeadDocumentRequest,
    UploadLeadDocumentsRequest,
    LeadDocumentPayload,
    LeadLinkPayload,
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
    useUploadLeadDocumentMutation,
    useUploadLeadDocumentsMutation,
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
