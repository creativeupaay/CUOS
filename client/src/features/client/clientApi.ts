import { api } from '@/services/api';
import type {
    CreateClientRequest,
    UpdateClientRequest,
    ListClientsRequest,
    ClientResponse,
    ClientsListResponse,
    ClientProjectsResponse,
    AddClientActivityRequest,
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
            invalidatesTags: ['Clients'],
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
    }),
});

export const {
    useCreateClientMutation,
    useGetClientsQuery,
    useGetClientQuery,
    useUpdateClientMutation,
    useDeleteClientMutation,
    useGetClientProjectsQuery,
    useAddClientActivityMutation,
} = clientApi;

