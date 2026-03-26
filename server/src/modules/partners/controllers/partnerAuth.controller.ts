import { Request, Response } from 'express';
import { PartnerAuthService } from '../services/partnerAuth.service';
import asyncHandler from '../../../utils/asyncHandler';

const partnerAuthService = new PartnerAuthService();

/**
 * Get partner info by registration token (Public route - for onboarding form)
 */
export const getPartnerByToken = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const result = await partnerAuthService.getPartnerByRegistrationToken(token);

    res.json({
        success: true,
        message: 'Registration details retrieved successfully',
        data: {
            name: result.name,
            email: result.email,
            registrationStatus: result.partner.registrationStatus,
        },
    });
});

/**
 * Complete partner onboarding (Public route - partner submits form with password)
 */
export const submitPartnerRegistration = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    const result = await partnerAuthService.completePartnerOnboarding(token, req.body);

    res.json({
        success: true,
        message: 'Onboarding completed successfully. You can now login with your credentials.',
        data: {
            loginUrl: result.loginUrl,
            companyName: result.partner.companyName,
            slug: result.partner.slug,
        },
    });
});

/**
 * Get partner info by slug (Public route - for personalized login page)
 */
export const getPartnerBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;

    const partner = await partnerAuthService.getPartnerBySlug(slug);

    if (!partner) {
        return res.status(404).json({
            success: false,
            message: 'Partner not found',
        });
    }

    // Check if partner has completed onboarding
    if (partner.registrationStatus !== 'completed') {
        return res.status(400).json({
            success: false,
            message: 'Partner has not completed onboarding',
        });
    }

    // Check if partner is active
    if (!partner.isActive) {
        return res.status(403).json({
            success: false,
            message: 'This partner account is deactivated',
        });
    }

    // Return only public info for personalized login page
    res.json({
        success: true,
        data: {
            id: partner._id,
            slug: partner.slug,
            companyName: partner.companyName,
            companyLogo: partner.companyLogo,
            contactPerson: partner.contactPerson,
            photo: partner.photo,
        },
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
