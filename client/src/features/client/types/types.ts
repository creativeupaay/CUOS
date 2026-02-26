import type { User } from '@/features/auth/types/types';

export interface ClientActivity {
    _id: string;
    type: 'call' | 'email' | 'meeting' | 'note';
    description: string;
    date: string;
    createdBy: User | string;
}

export interface Client {
    _id: string;
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
    contacts: ClientContact[];
    status: 'active' | 'inactive' | 'archived';
    notes?: string;

    activities?: ClientActivity[];

    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface ClientContact {
    _id?: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    isPrimary: boolean;
}

export interface ClientAddress {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

export interface ClientBillingDetails {
    billingEmail?: string;
    taxId?: string;
    paymentTerms?: string;
    currency: string;
}

export interface ClientPhone {
    number: string;
    label: string;
}

export interface ClientCustomDetail {
    key: string;
    value: string;
}
