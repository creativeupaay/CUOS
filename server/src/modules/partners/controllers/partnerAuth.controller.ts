import { Request, Response } from 'express';
import { PartnerAuthService } from '../services/partnerAuth.service';
import asyncHandler from '../../../utils/asyncHandler';

const partnerAuthService = new PartnerAuthService();

/**
 * Get partner info by registration token (Public route)
 */
export const getPartnerByToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const result = await partnerAuthService.getPartnerByRegistrationToken(token);

    res.json({
        success: true,
        message: 'Registration details retrieved successfully',
        data: {
            name: (result.user as any).name,
            email: (result.user as any).email,
            registrationStatus: result.partner.registrationStatus,
        },
    });
});

/**
 * Submit partner registration form (Public route)
 */
export const submitPartnerRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const partner = await partnerAuthService.completePartnerRegistration(token, req.body);

    res.json({
        success: true,
        message: 'Registration completed successfully. You can now login with your credentials.',
        data: partner,
    });
});

/**
 * Regenerate registration token (Admin only)
 */
export const regenerateRegistrationToken = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await partnerAuthService.regenerateRegistrationToken(id);

    res.json({
        success: true,
        message: 'Registration token regenerated successfully',
        data: result,
    });
});
