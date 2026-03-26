import { z } from 'zod';

const partnerAddressSchema = z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
});

// Minimal partner creation - just name and email
export const createPartnerSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Partner name is required').trim(),
        email: z.string().email('Invalid email').trim().toLowerCase(),
    }),
});

export const updatePartnerSchema = z.object({
    body: z.object({
        companyName: z.string().optional(),
        companyLogo: z.string().optional(),
        contactPerson: z.string().optional(),
        contactPersonPhone: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email('Invalid email').trim().toLowerCase().optional(),
        photo: z.string().optional(),
        websiteLink: z.string().optional(),
        address: partnerAddressSchema.optional(),
    }),
});

export const getPartnerSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid partner ID'),
    }),
});

export const listPartnersSchema = z.object({
    query: z.object({
        search: z.string().optional(),
        isActive: z.enum(['true', 'false']).optional(),
        page: z.string().regex(/^\d+$/).transform(Number).default(() => 1),
        limit: z.string().regex(/^\d+$/).transform(Number).default(() => 20),
    }),
});

// Full onboarding form submission with password
export const submitPartnerRegistrationSchema = z.object({
    params: z.object({
        token: z.string().min(1, 'Registration token is required'),
    }),
    body: z.object({
        name: z.string().min(1, 'Name is required').trim(),
        phone: z.string().min(1, 'Phone number is required').trim(),
        photo: z.string().optional(),
        companyName: z.string().min(1, 'Company name is required').trim(),
        companyLogo: z.string().optional(),
        contactPersonName: z.string().min(1, 'Contact person name is required').trim(),
        contactPersonPhone: z.string().min(1, 'Contact person phone is required').trim(),
        websiteLink: z.string().optional(),
        address: partnerAddressSchema.optional(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string().min(1, 'Please confirm your password'),
    }).refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
    }),
});

export const getPartnerByTokenSchema = z.object({
    params: z.object({
        token: z.string().min(1, 'Registration token is required'),
    }),
});

export const getPartnerBySlugSchema = z.object({
    params: z.object({
        slug: z.string().min(1, 'Partner slug is required'),
    }),
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>['body'];
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>['body'];
export type GetPartnerInput = z.infer<typeof getPartnerSchema>['params'];
export type ListPartnersInput = z.infer<typeof listPartnersSchema>['query'];
export type SubmitPartnerRegistrationInput = z.infer<typeof submitPartnerRegistrationSchema>['body'];
