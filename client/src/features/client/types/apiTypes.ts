import type { Client, ClientContact, ClientAddress, ClientBillingDetails } from './types';

export interface CreateClientRequest {
    name: string;
    companyName?: string;
    email: string;
    phone?: string;
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
