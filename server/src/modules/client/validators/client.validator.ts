import { z } from 'zod';

const clientContactSchema = z.object({
    name: z.string().min(1, 'Contact name is required').trim(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    role: z.string().optional(),
    isPrimary: z.boolean().default(false),
});

const clientPhoneSchema = z.object({
    number: z.string().min(1, 'Phone number is required').trim(),
    label: z.string().min(1, 'Label is required').trim(),
});

const clientCustomDetailSchema = z.object({
    key: z.string().min(1, 'Key is required').trim(),
    value: z.string().min(1, 'Value is required').trim(),
});

const clientAddressSchema = z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
});

const clientBillingDetailsSchema = z.object({
    billingEmail: z.string().email('Invalid billing email').optional().or(z.literal('')),
    taxId: z.string().optional(),
    paymentTerms: z.string().optional(),
    currency: z.string().default('USD'),
});

export const createClientSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Client name is required').trim(),
        companyName: z.string().optional(),
        email: z.string().email('Invalid email').trim().optional().or(z.literal('')),
        phone: z.string().optional(),
        otherPhones: z.array(clientPhoneSchema).optional(),
        registrationType: z.enum(['Registered', 'Unregistered', 'Overseas']).default('Unregistered'),
        gstNumber: z.string().optional(),
        vatNumber: z.string().optional(),
        customDetails: z.array(clientCustomDetailSchema).optional(),
        address: clientAddressSchema.optional(),
        billingDetails: clientBillingDetailsSchema.optional(),
        contacts: z.array(clientContactSchema).default([]),
        status: z.enum(['active', 'inactive', 'archived']).default('active'),
        notes: z.string().optional(),
    }),
});

export const updateClientSchema = z.object({
    body: z.object({
        name: z.string().min(1).trim().optional(),
        companyName: z.string().optional(),
        email: z.string().email().trim().optional().or(z.literal('')),
        phone: z.string().optional(),
        otherPhones: z.array(clientPhoneSchema).optional(),
        registrationType: z.enum(['Registered', 'Unregistered', 'Overseas']).optional(),
        gstNumber: z.string().optional(),
        vatNumber: z.string().optional(),
        customDetails: z.array(clientCustomDetailSchema).optional(),
        address: clientAddressSchema.optional(),
        billingDetails: clientBillingDetailsSchema.optional(),
        contacts: z.array(clientContactSchema).optional(),
        status: z.enum(['active', 'inactive', 'archived']).optional(),
        notes: z.string().optional(),
    }),
});

export const getClientSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid client ID'),
    }),
});

export const listClientsSchema = z.object({
    query: z.object({
        status: z.enum(['active', 'inactive', 'archived']).optional(),
        search: z.string().optional(),
        page: z.string().regex(/^\d+$/).transform(Number).default(() => 1),
        limit: z.string().regex(/^\d+$/).transform(Number).default(() => 20),
    }),
});

export const addClientActivitySchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid client ID'),
    }),
    body: z.object({
        type: z.enum(['call', 'email', 'meeting', 'note']),
        description: z.string().min(1, 'Description is required').trim(),
        date: z.string().datetime().optional(),
    }),
});

export type CreateClientInput = z.infer<typeof createClientSchema>['body'];
export type UpdateClientInput = z.infer<typeof updateClientSchema>['body'];
export type GetClientInput = z.infer<typeof getClientSchema>['params'];
export type ListClientsInput = z.infer<typeof listClientsSchema>['query'];
export type AddClientActivityInput = z.infer<typeof addClientActivitySchema>['body'];
