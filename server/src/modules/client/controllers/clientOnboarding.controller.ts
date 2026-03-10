import { Request, Response, NextFunction } from 'express';
import { ClientService } from '../services/client.service';
import asyncHandler from '../../../utils/asyncHandler';

const clientService = new ClientService();

/**
 * GET /api/v1/client-onboarding/:token
 * Public — returns initial client data for the pre-fill onboarding form.
 */
export const getOnboardingForm = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { token } = req.params;

        const client = await clientService.getClientByOnboardingToken(token);

        // Return only the fields the public form needs — never expose internal data
        res.status(200).json({
            status: 'success',
            data: {
                clientId: client._id,
                name: client.name,
                companyName: client.companyName,
                email: client.email,
                phone: client.phone,
                otherPhones: client.otherPhones,
                registrationType: client.registrationType,
                gstNumber: client.gstNumber,
                vatNumber: client.vatNumber,
                address: client.address,
                billingDetails: client.billingDetails,
                contacts: client.contacts,
                customDetails: client.customDetails,
                notes: client.notes,
                onboardingStatus: client.onboardingStatus,
                onboardingTokenExpiry: client.onboardingTokenExpiry,
            },
        });
    }
);

/**
 * POST /api/v1/client-onboarding/:token/submit
 * Public — accepts the client-filled form and updates the record.
 */
export const submitOnboardingForm = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { token } = req.params;
        const formData = req.body;

        await clientService.submitOnboardingForm(token, formData);

        res.status(200).json({
            status: 'success',
            message: 'Thank you! Your details have been saved successfully.',
        });
    }
);

/**
 * POST /api/v1/clients/:id/send-onboarding
 * Protected — (re)send the onboarding form email to the client.
 */
export const sendOnboardingEmail = asyncHandler(
    async (req: Request, res: Response, _next: NextFunction) => {
        const { id } = req.params;

        // Fetch the client to get email + name
        const client = await clientService.getClientById(id);

        if (!client.email) {
            res.status(400).json({
                status: 'fail',
                message: 'Client does not have an email address. Please add one before sending the form.',
            });
            return;
        }

        const result = await clientService.issueOnboardingToken(
            id,
            client.email,
            client.name
        );

        res.status(200).json({
            status: 'success',
            message: `Onboarding form sent to ${client.email}`,
            data: { expiresAt: result.expiresAt },
        });
    }
);
