import type { Client, ClientContact, ClientAddress, ClientBillingDetails, ClientPhone, ClientCustomDetail, ClientDocument, ClientLink } from './types';

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
    documents?: ClientDocument[];
    links?: ClientLink[];
    // Lead conversion link
    leadId?: string;
    // Send onboarding form email to client
    sendOnboardingForm?: boolean;
    partnerId?: string;
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
    partnerId?: string;
    documents?: ClientDocument[];
    links?: ClientLink[];
}

export interface UploadClientDocumentsRequest {
    clientId: string;
    files: File[];
}

export interface ListClientsRequest {
    status?: 'active' | 'inactive' | 'archived';
    search?: string;
    page?: number;
    limit?: number;
    partnerId?: string;
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
