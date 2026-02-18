export interface Client {
    _id: string;
    name: string;
    companyName?: string;
    email: string;
    phone?: string;
    address?: ClientAddress;
    billingDetails?: ClientBillingDetails;
    contacts: ClientContact[];
    status: 'active' | 'inactive' | 'archived';
    notes?: string;
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
