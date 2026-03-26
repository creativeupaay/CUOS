import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { PartnerService } from '../services/partner.service';
import asyncHandler from '../../../utils/asyncHandler';

const partnerService = new PartnerService();

/**
 * Get all partners (Admin only)
 */
export const getAllPartners = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
        search: req.query.search as string,
        isActive: req.query.isActive !== undefined
            ? req.query.isActive === 'true'
            : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
    };

    const result = await partnerService.getAllPartners(filters);

    res.json({
        success: true,
        message: 'Partners retrieved successfully',
        data: result,
    });
});

/**
 * Get partner by ID (Admin only)
 */
export const getPartnerById = asyncHandler(async (req: Request, res: Response) => {
    const partner = await partnerService.getPartnerById(req.params.id);

    res.json({
        success: true,
        message: 'Partner retrieved successfully',
        data: partner,
    });
});

/**
 * Create a new partner (Admin only)
 */
export const createPartner = asyncHandler(async (req: Request, res: Response) => {
    const result = await partnerService.createPartner(req.body, new Types.ObjectId(req.user!.id));

    res.status(201).json({
        success: true,
        message: 'Partner created successfully. Registration link generated.',
        data: result,
    });
});

/**
 * Update partner details (Admin only)
 */
export const updatePartner = asyncHandler(async (req: Request, res: Response) => {
    const partner = await partnerService.updatePartner(req.params.id, req.body);

    res.json({
        success: true,
        message: 'Partner updated successfully',
        data: partner,
    });
});

/**
 * Deactivate partner (Admin only)
 */
export const deactivatePartner = asyncHandler(async (req: Request, res: Response) => {
    await partnerService.deactivatePartner(req.params.id);

    res.json({
        success: true,
        message: 'Partner deactivated successfully',
    });
});

/**
 * Activate partner (Admin only)
 */
export const activatePartner = asyncHandler(async (req: Request, res: Response) => {
    await partnerService.activatePartner(req.params.id);

    res.json({
        success: true,
        message: 'Partner activated successfully',
    });
});

/**
 * Delete partner (Admin only)
 */
export const deletePartner = asyncHandler(async (req: Request, res: Response) => {
    await partnerService.deletePartner(req.params.id);

    res.json({
        success: true,
        message: 'Partner deleted successfully',
    });
});

/**
 * Get partner's clients (Admin only)
 */
export const getPartnerClients = asyncHandler(async (req: Request, res: Response) => {
    const clients = await partnerService.getPartnerClients(req.params.id);

    res.json({
        success: true,
        message: 'Partner clients retrieved successfully',
        data: clients,
    });
});

/**
 * Get partner's projects (Admin only)
 */
export const getPartnerProjects = asyncHandler(async (req: Request, res: Response) => {
    const projects = await partnerService.getPartnerProjects(req.params.id);

    res.json({
        success: true,
        message: 'Partner projects retrieved successfully',
        data: projects,
    });
});

/**
 * Get partner statistics (Admin only)
 */
export const getPartnerStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await partnerService.getPartnerStats(req.params.id);

    res.json({
        success: true,
        message: 'Partner statistics retrieved successfully',
        data: stats,
    });
});

// ========== PUBLIC ONBOARDING ENDPOINTS ==========

/**
 * Get partner info by registration token (Public - for onboarding form)
 */
export const getPartnerByToken = asyncHandler(async (req: Request, res: Response) => {
    const partner = await partnerService.getPartnerByToken(req.params.token);

    if (!partner) {
        return res.status(404).json({
            success: false,
            message: 'Invalid or expired registration link',
        });
    }

    res.json({
        success: true,
        message: 'Partner information retrieved successfully',
        data: {
            email: partner.email,
            contactPerson: partner.contactPerson,
        },
    });
});

/**
 * Complete partner onboarding (Public - partner fills out the form)
 */
export const completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
    const result = await partnerService.completeOnboarding(req.params.token, req.body);

    res.json({
        success: true,
        message: 'Partner onboarding completed successfully',
        data: {
            loginUrl: result.loginUrl,
            partner: {
                companyName: result.partner.companyName,
                slug: result.partner.slug,
            },
        },
    });
});

/**
 * Get partner info by slug (Public - for personalized login page)
 */
export const getPartnerBySlug = asyncHandler(async (req: Request, res: Response) => {
    const partner = await partnerService.getPartnerBySlug(req.params.slug);

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

    // Return only public info for login page
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
