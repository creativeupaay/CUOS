import { api } from '@/services/api';
import type {
    CreateClientRequest,
    UpdateClientRequest,
    ListClientsRequest,
    ClientResponse,
    ClientsListResponse,
    ClientProjectsResponse,
    AddClientActivityRequest,
    UploadClientDocumentsRequest,
} from './types/apiTypes';

export const clientApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // Create client
        createClient: builder.mutation<ClientResponse, CreateClientRequest>({
            query: (data) => ({
                url: '/clients',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Clients', 'Partners'],
        }),

        // Get all clients
        getClients: builder.query<ClientsListResponse, ListClientsRequest | void>({
            query: (params) => ({
                url: '/clients',
                method: 'GET',
                params: params || {},
            }),
            providesTags: ['Clients'],
        }),

        // Get client by ID
        getClient: builder.query<ClientResponse, string>({
            query: (id) => ({
                url: `/clients/${id}`,
                method: 'GET',
            }),
            providesTags: (_result, _error, id) => [{ type: 'Clients', id }],
        }),

        // Update client
        updateClient: builder.mutation<ClientResponse, { id: string; data: UpdateClientRequest }>({
            query: ({ id, data }) => ({
                url: `/clients/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'Clients', id }, 'Clients'],
        }),

        uploadClientDocuments: builder.mutation<ClientResponse, UploadClientDocumentsRequest>({
            query: ({ clientId, files }) => {
                const formData = new FormData();
                files.forEach((file) => formData.append('files', file));

                return {
                    url: `/clients/${clientId}/documents/upload`,
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: (_result, _error, { clientId }) => [{ type: 'Clients', id: clientId }, 'Clients'],
        }),

        // Delete client
        deleteClient: builder.mutation<void, string>({
            query: (id) => ({
                url: `/clients/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Clients'],
        }),

        getClientProjects: builder.query<ClientProjectsResponse, string>({
            query: (id) => ({
                url: `/clients/${id}/projects`,
                method: 'GET',
            }),
            providesTags: (_result, _error, id) => [{ type: 'Projects', id: `client-${id}` }],
        }),

        // Add activity
        addClientActivity: builder.mutation<ClientResponse, { clientId: string; data: AddClientActivityRequest }>({
            query: ({ clientId, data }) => ({
                url: `/clients/${clientId}/activities`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { clientId }) => [{ type: 'Clients', id: clientId }, 'Clients'],
        }),

        // Send (or resend) onboarding form email to the client
        sendClientOnboarding: builder.mutation<{ status: string; message: string; data: { expiresAt: string } }, string>({
            query: (clientId) => ({
                url: `/clients/${clientId}/send-onboarding`,
                method: 'POST',
            }),
            invalidatesTags: (_result, _error, clientId) => [{ type: 'Clients', id: clientId }],
        }),

        // ── Client Portal Management ─────────────────────────────────────────
        generatePortalToken: builder.mutation<
            { status: string; message: string; data: { clientId: string; portalToken: string } },
            string
        >({
            query: (clientId) => ({
                url: `/clients/${clientId}/portal/generate-link`,
                method: 'POST',
            }),
            invalidatesTags: (_result, _error, clientId) => [{ type: 'Clients', id: clientId }],
        }),

        revokePortalToken: builder.mutation<{ status: string; message: string }, string>({
            query: (clientId) => ({
                url: `/clients/${clientId}/portal/revoke`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, clientId) => [{ type: 'Clients', id: clientId }],
        }),

        togglePortal: builder.mutation<{ status: string; message: string }, { clientId: string; enabled: boolean }>({
            query: ({ clientId, enabled }) => ({
                url: `/clients/${clientId}/portal/toggle`,
                method: 'PATCH',
                body: { enabled },
            }),
            invalidatesTags: (_result, _error, { clientId }) => [{ type: 'Clients', id: clientId }],
        }),
    }),
});

export const {
    useCreateClientMutation,
    useGetClientsQuery,
    useGetClientQuery,
    useUpdateClientMutation,
    useUploadClientDocumentsMutation,
    useDeleteClientMutation,
    useGetClientProjectsQuery,
    useAddClientActivityMutation,
    useSendClientOnboardingMutation,
    useGeneratePortalTokenMutation,
    useRevokePortalTokenMutation,
    useTogglePortalMutation,
} = clientApi;

