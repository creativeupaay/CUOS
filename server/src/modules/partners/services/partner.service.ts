import { Partner, IPartner } from '../models/Partner.model';
import { User } from '../../auth/models/User.model';
import { Client } from '../../client/models/Client.model';
import { Project } from '../../project/models/Project.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import crypto from 'crypto';

export interface CreatePartnerInput {
    name: string;
    email: string;
    password: string;
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

export interface UpdatePartnerInput {
    companyName?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    };
}

export interface ListPartnersFilters {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export class PartnerService {
    /**
     * Ensure partner role exists so partner onboarding does not hard-depend on seed script execution.
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
        } catch (error: any) {
            // If another request created it concurrently, fetch and proceed.
            if (error?.code === 11000) {
                const existing = await Role.findOne({ name: /^partner$/i });
                if (existing) {
                    return existing;
                }
            }

            throw error;
        }
    }

    /**
     * Get all partners with optional filters
     */
    async getAllPartners(filters: ListPartnersFilters): Promise<{
        partners: any[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { search, isActive, page = 1, limit = 20 } = filters;

        const query: any = {};

        if (isActive !== undefined) {
            query.isActive = isActive;
        }

        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [partners, total] = await Promise.all([
            Partner.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name email isActive')
                .populate('createdBy', 'name email')
                .lean(),
            Partner.countDocuments(query),
        ]);

        // Attach statistics for each partner
        const partnersWithStats = await Promise.all(
            partners.map(async (partner) => {
                const [clientsCount, projectsCount] = await Promise.all([
                    Client.countDocuments({ partnerId: partner._id }),
                    Project.countDocuments({ partnerId: partner._id }),
                ]);

                return {
                    ...partner,
                    stats: {
                        clientsCount,
                        projectsCount,
                    },
                };
            })
        );

        return {
            partners: partnersWithStats,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get partner by ID
     */
    async getPartnerById(id: string): Promise<any> {
        const partner = await Partner.findById(id)
            .populate('userId', 'name email isActive')
            .populate('createdBy', 'name email');

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        // Get statistics
        const [clientsCount, projectsCount] = await Promise.all([
            Client.countDocuments({ partnerId: partner._id }),
            Project.countDocuments({ partnerId: partner._id }),
        ]);

        return {
            ...partner.toObject(),
            stats: {
                clientsCount,
                projectsCount,
            },
        };
    }

    /**
     * Get partner by user ID
     */
    async getPartnerByUserId(userId: string): Promise<IPartner | null> {
        const partner = await Partner.findOne({ userId })
            .populate('userId', 'name email isActive')
            .populate('createdBy', 'name email');

        return partner;
    }

    /**
     * Create a new partner
     * This creates both a User record (for authentication) and a Partner record (for partner-specific data)
     */
    async createPartner(data: CreatePartnerInput, createdBy: Types.ObjectId): Promise<{
        partner: IPartner;
        registrationToken: string;
        registrationLink: string;
    }> {
        const partnerRole = await this.ensurePartnerRole();

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
            throw new AppError('A user with this email already exists', 400);
        }

        // Create User with Partner role
        const user = await User.create({
            name: data.name,
            email: data.email,
            password: data.password,
            role: partnerRole._id,
            isActive: false, // Inactive until registration is completed
            modulePermissions: {
                projectManagement: {
                    enabled: true,
                    projectPermissions: [], // Will be populated as they create projects
                },
                crm: {
                    enabled: true,
                    subModules: {
                        pipeline: false,
                        leads: false,
                        proposals: false,
                        clients: true, // Only clients module
                    },
                },
                finance: { enabled: false, subModules: {} },
                hrms: { enabled: false, subModules: {} },
                overallAdmin: { enabled: false, subModules: {} },
            },
        });

        // Generate registration token
        const registrationToken = crypto.randomBytes(32).toString('hex');
        const registrationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Create Partner record
        const partner = await Partner.create({
            userId: user._id,
            companyName: data.companyName,
            contactPerson: data.contactPerson,
            phone: data.phone,
            email: data.email,
            address: data.address,
            registrationToken,
            registrationTokenExpiry,
            registrationStatus: 'pending',
            isActive: false,
            createdBy,
        });

        const { env } = await import('../../../config/env.config');
        const registrationLink = `${env.FRONTEND_URL}/partner-form/${registrationToken}`;

        return {
            partner,
            registrationToken,
            registrationLink,
        };
    }

    /**
     * Update partner details
     */
    async updatePartner(id: string, data: UpdatePartnerInput): Promise<IPartner> {
        const partner = await Partner.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true }
        )
            .populate('userId', 'name email isActive')
            .populate('createdBy', 'name email');

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        return partner;
    }

    /**
     * Deactivate partner
     */
    async deactivatePartner(id: string): Promise<void> {
        const partner = await Partner.findById(id);

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        // Deactivate both partner and associated user
        await Promise.all([
            Partner.findByIdAndUpdate(id, { $set: { isActive: false } }),
            User.findByIdAndUpdate(partner.userId, { $set: { isActive: false } }),
        ]);
    }

    /**
     * Activate partner
     */
    async activatePartner(id: string): Promise<void> {
        const partner = await Partner.findById(id);

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        // Activate both partner and associated user
        await Promise.all([
            Partner.findByIdAndUpdate(id, { $set: { isActive: true } }),
            User.findByIdAndUpdate(partner.userId, { $set: { isActive: true } }),
        ]);
    }

    /**
     * Delete partner (hard delete)
     */
    async deletePartner(id: string): Promise<void> {
        const partner = await Partner.findById(id);

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        // Check if partner has any clients or projects
        const [clientsCount, projectsCount] = await Promise.all([
            Client.countDocuments({ partnerId: partner._id }),
            Project.countDocuments({ partnerId: partner._id }),
        ]);

        if (clientsCount > 0 || projectsCount > 0) {
            throw new AppError(
                'Cannot delete partner with existing clients or projects. Please reassign them first.',
                400
            );
        }

        // Delete both partner and associated user
        await Promise.all([
            Partner.findByIdAndDelete(id),
            User.findByIdAndDelete(partner.userId),
        ]);
    }

    /**
     * Get partner's clients
     */
    async getPartnerClients(partnerId: string): Promise<any[]> {
        const clients = await Client.find({ partnerId })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email')
            .lean();

        return clients;
    }

    /**
     * Get partner's projects
     */
    async getPartnerProjects(partnerId: string): Promise<any[]> {
        const projects = await Project.find({ partnerId })
            .sort({ createdAt: -1 })
            .populate('clientId', 'name companyName')
            .populate('createdBy', 'name email')
            .select('-documents') // Exclude documents for list view
            .lean();

        return projects;
    }

    /**
     * Get partner statistics
     */
    async getPartnerStats(partnerId: string): Promise<{
        clientsCount: number;
        projectsCount: number;
        activeProjectsCount: number;
        completedProjectsCount: number;
    }> {
        const [clientsCount, projectsCount, activeProjectsCount, completedProjectsCount] =
            await Promise.all([
                Client.countDocuments({ partnerId }),
                Project.countDocuments({ partnerId }),
                Project.countDocuments({ partnerId, status: 'active' }),
                Project.countDocuments({ partnerId, status: 'completed' }),
            ]);

        return {
            clientsCount,
            projectsCount,
            activeProjectsCount,
            completedProjectsCount,
        };
    }
}
