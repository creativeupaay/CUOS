import { z } from 'zod';

const clientContactSchema = z.object({
    name: z.string().min(1, 'Contact name is required').trim(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().optional(),
    role: z.string().optional(),
    isPrimary: z.boolean().default(false),
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
        email: z.string().email('Invalid email').trim(),
        phone: z.string().optional(),
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
        email: z.string().email().trim().optional(),
        phone: z.string().optional(),
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

export type CreateClientInput = z.infer<typeof createClientSchema>['body'];
export type UpdateClientInput = z.infer<typeof updateClientSchema>['body'];
export type GetClientInput = z.infer<typeof getClientSchema>['params'];
export type ListClientsInput = z.infer<typeof listClientsSchema>['query'];
