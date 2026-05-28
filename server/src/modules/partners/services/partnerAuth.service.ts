import { Partner, IPartner } from '../models/Partner.model';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import { notificationService } from '../../notification/services/notification.service';
import { logger } from "../../../utils/logger";

export interface PartnerOnboardingInput {
    name: string;
    phone: string;
    photo?: string;
    companyName: string;
    companyLogo?: string;
    contactPersonName: string;
    contactPersonPhone: string;
    websiteLink?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    };
    password: string;
    confirmPassword: string;
}

export class PartnerAuthService {
    /**
     * Ensure partner role exists
     */
    private async ensurePartnerRole() {
        const { Role } = await import('../../auth/models/Role.model');

        let partnerRole = await Role.findOne({ name: /^partner$/i });
        if (partnerRole) {
            return partnerRole;
        }

        const { Permission } = await import('../../auth/models/Permission.model');
        const permissions = await Permission.find({
            $or: [
                { resource: 'crm', action: { $in: ['create', 'read', 'update'] } },
                { resource: 'projects', action: { $in: ['create', 'read', 'update'] } },
            ],
        }).select('_id');

        try {
            partnerRole = await Role.create({
                name: 'partner',
                description: 'External partner with limited CRM and Project access',
                permissions: permissions.map((p) => p._id),
                level: 6,
            });

            return partnerRole;
        } catch (error: unknown) {
            if ((error as { code?: number })?.code === 11000) {
                const existing = await Role.findOne({ name: /^partner$/i });
                if (existing) {
                    return existing;
                }
            }

            throw error;
        }
    }

    /**
     * Validate registration token and return partner info
     */
    async getPartnerByRegistrationToken(token: string): Promise<{
        partner: IPartner;
        email: string;
        name: string;
    }> {
        const partner = await Partner.findOne({ registrationToken: token });

        if (!partner) {
            throw new AppError('Invalid or expired registration link', 404);
        }

        if (partner.registrationStatus === 'completed') {
            throw new AppError('This registration form has already been submitted', 400);
        }

        if (partner.registrationTokenExpiry && partner.registrationTokenExpiry < new Date()) {
            throw new AppError('This registration link has expired', 400);
        }

        return {
            partner,
            email: partner.email || '',
            name: partner.contactPerson || '',
        };
    }

    /**
     * Complete partner onboarding - creates user and updates partner with full details
     */
    async completePartnerOnboarding(
        token: string,
        formData: PartnerOnboardingInput
    ): Promise<{
        partner: IPartner;
        loginUrl: string;
    }> {
        const { partner } = await this.getPartnerByRegistrationToken(token);

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            throw new AppError('Passwords do not match', 400);
        }

        // Validate password strength
        if (formData.password.length < 8) {
            throw new AppError('Password must be at least 8 characters long', 400);
        }

        const partnerRole = await this.ensurePartnerRole();

        // Store password before hashing (for email only)
        const plainPassword = formData.password;

        // Create User with Partner role
        const user = await User.create({
            name: formData.name,
            email: partner.email,
            password: formData.password,
            role: partnerRole._id,
            isActive: true,
            modulePermissions: {
                projectManagement: {
                    enabled: true,
                    projectPermissions: [],
                },
                crm: {
                    enabled: true,
                    subModules: {
                        pipeline: false,
                        leads: false,
                        proposals: false,
                        clients: true,
                    },
                },
                finance: { enabled: false, subModules: {} },
                hrms: { enabled: false, subModules: {} },
                overallAdmin: { enabled: false, subModules: {} },
            },
        });

        // Update partner with full details
        const updatedPartner = await Partner.findByIdAndUpdate(
            partner._id,
            {
                $set: {
                    userId: user._id,
                    contactPerson: formData.contactPersonName,
                    contactPersonPhone: formData.contactPersonPhone,
                    companyName: formData.companyName,
                    companyLogo: formData.companyLogo,
                    phone: formData.phone,
                    photo: formData.photo,
                    websiteLink: formData.websiteLink,
                    address: formData.address,
                    registrationStatus: 'completed',
                    registrationSubmittedAt: new Date(),
                    isActive: true,
                },
                $unset: {
                    registrationToken: 1,
                    registrationTokenExpiry: 1,
                },
            },
            { new: true, runValidators: true }
        );

        if (!updatedPartner) {
            throw new AppError('Partner not found', 404);
        }

        // Notify superadmins about partner onboarding completion
        notificationService.notifySuperadmins({
            type: 'partner_onboarding',
            title: 'Partner Onboarding Completed',
            message: `${formData.companyName} has completed their partner onboarding form.`,
            link: '/admin/partners/manage',
            metadata: {
                partnerId: updatedPartner._id.toString(),
                companyName: formData.companyName,
                contactPerson: formData.contactPersonName,
                submittedAt: updatedPartner.registrationSubmittedAt?.toISOString(),
            },
        });

        const { env } = await import('../../../config/env.config');
        const loginUrl = `${env.FRONTEND_URL}/partner/${updatedPartner.slug}/login`;

        // Send credentials email to partner
        try {
            const { sendPartnerCredentialsEmail } = await import('../../../services/email.service');
            await sendPartnerCredentialsEmail({
                to: updatedPartner.email!,
                partnerName: formData.name,
                companyName: formData.companyName,
                email: updatedPartner.email!,
                password: plainPassword,
                loginUrl,
            });
        } catch (emailError: unknown) {
            logger.error({ context: (emailError as Error).message }, 'Failed to send partner credentials email:');
            // Don't fail onboarding if email fails
        }

        return {
            partner: updatedPartner,
            loginUrl,
        };
    }

    /**
     * Get partner by slug (for personalized login page)
     */
    async getPartnerBySlug(slug: string): Promise<IPartner | null> {
        const partner = await Partner.findOne({ slug })
            .populate('userId', 'name email isActive');

        return partner;
    }

    /**
     * Regenerate registration token for a partner
     */
    async regenerateRegistrationToken(partnerId: string): Promise<{
        token: string;
        expiresAt: Date;
        registrationLink: string;
    }> {
        const partner = await Partner.findById(partnerId);

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        const crypto = await import('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await Partner.findByIdAndUpdate(partnerId, {
            $set: {
                registrationToken: token,
                registrationTokenExpiry: expiresAt,
                registrationStatus: 'pending',
            },
        });

        // Also deactivate the user if they had one
        if (partner.userId) {
            await User.findByIdAndUpdate(partner.userId, {
                $set: { isActive: false },
            });
        }

        const { env } = await import('../../../config/env.config');
        const registrationLink = `${env.FRONTEND_URL}/partner/onboarding/${token}`;

        return {
            token,
            expiresAt,
            registrationLink,
        };
    }
}
