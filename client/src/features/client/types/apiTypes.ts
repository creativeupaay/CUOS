import type { Client, ClientContact, ClientAddress, ClientBillingDetails, ClientPhone, ClientCustomDetail } from './types';

export interface CreateClientRequest {
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    otherPhones?: ClientPhone[];
    registrationType?: 'Registered' | 'Unregistered' | 'Overseas';
    gstNumber?: string;
    vatNumber?: string;
    customDetails?: ClientCustomDetail[];
    address?: ClientAddress;
    billingDetails?: ClientBillingDetails;
    contacts?: ClientContact[];
    status?: 'active' | 'inactive' | 'archived';
    notes?: string;
}

export interface UpdateClientRequest {
    name?: string;
    companyName?: string;
    email?: string;
    phone?: string;
    otherPhones?: ClientPhone[];
    registrationType?: 'Registered' | 'Unregistered' | 'Overseas';
    gstNumber?: string;
    vatNumber?: string;
    customDetails?: ClientCustomDetail[];
    address?: ClientAddress;
    billingDetails?: ClientBillingDetails;
    contacts?: ClientContact[];
    status?: 'active' | 'inactive' | 'archived';
    notes?: string;
}

export interface ListClientsRequest {
    status?: 'active' | 'inactive' | 'archived';
    search?: string;
    page?: number;
    limit?: number;
}

export interface ListClientsResponse {
    clients: Client[];
    total: number;
    page: number;
    totalPages: number;
}

export interface ClientResponse {
    status: string;
    data: {
        client: Client;
    };
}

export interface ClientsListResponse {
    status: string;
    data: ListClientsResponse;
}

export interface ClientProjectsResponse {
    status: string;
    data: {
        projects: any[];
    };
}

export interface AddClientActivityRequest {
    type: 'call' | 'email' | 'meeting' | 'note';
    description: string;
    date?: string;
}
