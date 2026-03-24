import { Partner, IPartner } from '../models/Partner.model';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';

export interface PartnerRegistrationInput {
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    };
}

export class PartnerAuthService {
    /**
     * Validate registration token and return partner info
     */
    async getPartnerByRegistrationToken(token: string): Promise<{
        partner: IPartner;
        user: any;
    }> {
        const partner = await Partner.findOne({ registrationToken: token })
            .populate('userId', 'name email');

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
            user: partner.userId,
        };
    }

    /**
     * Complete partner registration by submitting form data
     */
    async completePartnerRegistration(
        token: string,
        formData: PartnerRegistrationInput
    ): Promise<IPartner> {
        const { partner } = await this.getPartnerByRegistrationToken(token);

        // Update partner with submitted data
        const updatedPartner = await Partner.findByIdAndUpdate(
            partner._id,
            {
                $set: {
                    ...formData,
                    registrationStatus: 'completed',
                    registrationSubmittedAt: new Date(),
                },
            },
            { new: true, runValidators: true }
        )
            .populate('userId', 'name email')
            .populate('createdBy', 'name email');

        if (!updatedPartner) {
            throw new AppError('Partner not found', 404);
        }

        // Activate the associated user account
        await User.findByIdAndUpdate(partner.userId, {
            $set: { isActive: true },
        });

        // Notify admins about partner registration (optional)
        try {
            const admins = await User.find({
                'role.name': { $in: ['super-admin', 'admin'] },
                isActive: true,
            }).select('email');

            // You can implement email notification here if needed
            console.log('[Partner Registration] Partner completed registration:', updatedPartner.email);
        } catch (err) {
            console.error('[Partner Registration] Failed to notify admins:', err);
        }

        return updatedPartner;
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
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await Partner.findByIdAndUpdate(partnerId, {
            $set: {
                registrationToken: token,
                registrationTokenExpiry: expiresAt,
                registrationStatus: 'pending',
            },
        });

        const { env } = await import('../../../config/env.config');
        const registrationLink = `${env.FRONTEND_URL}/partner-form/${token}`;

        return {
            token,
            expiresAt,
            registrationLink,
        };
    }
}
