import { Partner, IPartner } from '../models/Partner.model';
import { User } from '../../auth/models/User.model';
import { Client } from '../../client/models/Client.model';
import { Lead } from '../../crm/models/Lead.model';
import { Proposal } from '../../crm/models/Proposal.model';
import { Project } from '../../project/models/Project.model';
import { PartnerEmployee } from '../models/PartnerEmployee.model';
import AppError from '../../../utils/appError';
import { FilterQuery, Types } from 'mongoose';
import crypto from 'crypto';
import { logger } from "../../../utils/logger";
import { ArchiveDeleteOptions, DeletedRecordService, DeleteGraphResult, DeleteGraphService } from '../../archive';
import { RevenueService } from '../../finance/services/revenue.service';
import { deleteProject } from '../../project/services/project.service';

// Minimal input for initial partner creation (just name and email)
export interface CreatePartnerInput {
    name: string;
    email: string;
}

// Full input for partner onboarding completion
export interface CompleteOnboardingInput {
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

export interface UpdatePartnerInput {
    companyName?: string;
    companyLogo?: string;
    contactPerson?: string;
    contactPersonPhone?: string;
    phone?: string;
    email?: string;
    photo?: string;
    websiteLink?: string;
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

const getGraphNodeIds = (graph: DeleteGraphResult, relationship: string): Types.ObjectId[] => (
    graph.nodes.find((node) => node.relationship === relationship)?.sourceIds ?? []
);

export class PartnerService {
    private getArchiveBatchId(options: ArchiveDeleteOptions = {}): string {
        return options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
    }

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
        } catch (error: unknown) {
            // If another request created it concurrently, fetch and proceed.
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
     * Get all partners with optional filters
     */
    async getAllPartners(filters: ListPartnersFilters): Promise<{
        partners: Record<string, unknown>[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        const { search, isActive, page = 1, limit = 20 } = filters;

        const query: FilterQuery<IPartner> = {};

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

        // Optimize: Fetch all counts in bulk using aggregation
        const partnerIds = partners.map(p => p._id);

        const [clientCounts, projectCounts] = await Promise.all([
            Client.aggregate([
                { $match: { partnerId: { $in: partnerIds } } },
                { $group: { _id: '$partnerId', count: { $sum: 1 } } }
            ]),
            Project.aggregate([
                { $match: { partnerId: { $in: partnerIds } } },
                { $group: { _id: '$partnerId', count: { $sum: 1 } } }
            ])
        ]);

        const clientCountMap = new Map(clientCounts.map(c => [c._id.toString(), c.count]));
        const projectCountMap = new Map(projectCounts.map(p => [p._id.toString(), p.count]));

        const partnersWithStats = partners.map((partner) => ({
            ...partner,
            stats: {
                clientsCount: clientCountMap.get(partner._id.toString()) || 0,
                projectsCount: projectCountMap.get(partner._id.toString()) || 0,
            },
        }));

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
    async getPartnerById(id: string): Promise<Record<string, unknown>> {
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

        const { env } = await import('../../../config/env.config');
        const loginUrl = partner.slug ? `${env.FRONTEND_URL}/partner/${partner.slug}/login` : null;
        const onboardingUrl = partner.registrationToken && partner.registrationStatus === 'pending'
            ? `${env.FRONTEND_URL}/partner/onboarding/${partner.registrationToken}`
            : null;

        return {
            ...partner.toObject(),
            loginUrl,
            onboardingUrl,
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
     * Generate unique slug from name
     */
    private async generateUniqueSlug(name: string): Promise<string> {
        // Create base slug from name
        let baseSlug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        // If slug is empty, use a random string
        if (!baseSlug) {
            baseSlug = 'partner';
        }

        // Check if slug exists
        let slug = baseSlug;
        let counter = 1;

        while (await Partner.findOne({ slug })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        return slug;
    }

    /**
     * Create a new partner (minimal - just name and email)
     * This creates a pending Partner record and sends an onboarding form link
     */
    async createPartner(data: CreatePartnerInput, createdBy: Types.ObjectId): Promise<{
        partner: IPartner;
        registrationToken: string;
        registrationLink: string;
    }> {
        // Check if partner with this email already exists
        const existingPartner = await Partner.findOne({ email: data.email });
        if (existingPartner) {
            throw new AppError('A partner with this email already exists', 400);
        }

        // Check if user with this email already exists
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
            throw new AppError('A user with this email already exists', 400);
        }

        // Generate unique slug
        const slug = await this.generateUniqueSlug(data.name);

        // Generate registration token
        const registrationToken = crypto.randomBytes(32).toString('hex');
        const registrationTokenExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        // Create Partner record (without userId for now - will be created on onboarding completion)
        const partner = await Partner.create({
            slug,
            email: data.email,
            contactPerson: data.name, // Initially use name as contact person
            registrationToken,
            registrationTokenExpiry,
            registrationStatus: 'pending',
            isActive: false, // Inactive until onboarding is complete
            createdBy,
        });

        const {env } = await import('../../../config/env.config');
        const registrationLink = `${env.FRONTEND_URL}/partner/onboarding/${registrationToken}`;

        // Send onboarding email
        try {
            const { sendPartnerOnboardingEmail } = await import('../../../services/email.service');
            await sendPartnerOnboardingEmail({
                to: data.email,
                partnerName: data.name,
                formUrl: registrationLink,
                expiresAt: registrationTokenExpiry,
            });
        } catch (emailError: unknown) {
            logger.error({ context: (emailError as Error).message }, 'Failed to send partner onboarding email:');
            // Don't fail partner creation if email fails
        }

        return {
            partner,
            registrationToken,
            registrationLink,
        };
    }

    /**
     * Get partner by registration token (for onboarding form)
     */
    async getPartnerByToken(token: string): Promise<IPartner | null> {
        const partner = await Partner.findOne({
            registrationToken: token,
            registrationStatus: 'pending'
        });

        if (!partner) {
            return null;
        }

        // Check if token has expired
        if (partner.registrationTokenExpiry && partner.registrationTokenExpiry < new Date()) {
            throw new AppError('This registration link has expired. Please contact the administrator.', 400);
        }

        return partner;
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
     * Complete partner onboarding - creates user account and updates partner details
     */
    async completeOnboarding(token: string, data: CompleteOnboardingInput): Promise<{
        partner: IPartner;
        loginUrl: string;
    }> {
        // Find partner by token
        const partner = await this.getPartnerByToken(token);
        if (!partner) {
            throw new AppError('Invalid or expired registration token', 400);
        }

        // Validate passwords match
        if (data.password !== data.confirmPassword) {
            throw new AppError('Passwords do not match', 400);
        }

        // Validate password strength
        if (data.password.length < 8) {
            throw new AppError('Password must be at least 8 characters long', 400);
        }

        const partnerRole = await this.ensurePartnerRole();

        // Store password before hashing (for email only)
        const plainPassword = data.password;

        // Create User with Partner role
        const user = await User.create({
            name: data.name,
            email: partner.email,
            password: data.password,
            role: partnerRole._id,
            isActive: true, // Active immediately after onboarding
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
        partner.userId = user._id as Types.ObjectId;
        partner.contactPerson = data.contactPersonName;
        partner.contactPersonPhone = data.contactPersonPhone;
        partner.companyName = data.companyName;
        partner.companyLogo = data.companyLogo;
        partner.phone = data.phone;
        partner.photo = data.photo;
        partner.websiteLink = data.websiteLink;
        partner.address = data.address;
        partner.registrationStatus = 'completed';
        partner.registrationSubmittedAt = new Date();
        partner.registrationToken = undefined; // Clear token after use
        partner.registrationTokenExpiry = undefined;
        partner.isActive = true;

        await partner.save();

        const { env } = await import('../../../config/env.config');
        const loginUrl = `${env.FRONTEND_URL}/partner/${partner.slug}/login`;

        // Send credentials email to partner
        try {
            const { sendPartnerCredentialsEmail } = await import('../../../services/email.service');
            await sendPartnerCredentialsEmail({
                to: partner.email!,
                partnerName: data.name,
                companyName: data.companyName,
                email: partner.email!,
                password: plainPassword,
                loginUrl,
            });
        } catch (emailError: unknown) {
            logger.error({ context: (emailError as Error).message }, 'Failed to send partner credentials email:');
            // Don't fail onboarding if email fails
        }

        return {
            partner,
            loginUrl,
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
     * Deactivate partner and all associated team members
     */
    async deactivatePartner(id: string): Promise<void> {
        const partner = await Partner.findById(id);

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        // Get PartnerEmployee model
        const { PartnerEmployee } = await import('../models/PartnerEmployee.model');

        // Get all partner employees
        const partnerEmployees = await PartnerEmployee.find({ partnerId: partner._id });

        // Store current status and deactivate all partner employees
        const employeeUpdates = partnerEmployees.map(employee => {
            return PartnerEmployee.findByIdAndUpdate(employee._id, {
                $set: {
                    statusBeforePartnerDeactivation: employee.isActive,
                    isActive: false,
                },
            });
        });

        // Deactivate partner, partner user, and all partner employees in parallel
        await Promise.all([
            Partner.findByIdAndUpdate(id, { $set: { isActive: false } }),
            ...(partner.userId ? [User.findByIdAndUpdate(partner.userId, { $set: { isActive: false } })] : []),
            ...employeeUpdates,
        ]);
    }

    /**
     * Activate partner and restore team members to their previous status
     */
    async activatePartner(id: string): Promise<void> {
        const partner = await Partner.findById(id);

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        // Get PartnerEmployee model
        const { PartnerEmployee } = await import('../models/PartnerEmployee.model');

        // Get all partner employees
        const partnerEmployees = await PartnerEmployee.find({ partnerId: partner._id });

        // Restore partner employees to their previous status
        const employeeUpdates = partnerEmployees.map(employee => {
            // If statusBeforePartnerDeactivation is set, restore it; otherwise activate by default
            const restoredStatus = employee.statusBeforePartnerDeactivation !== undefined
                ? employee.statusBeforePartnerDeactivation
                : true;

            return PartnerEmployee.findByIdAndUpdate(employee._id, {
                $set: {
                    isActive: restoredStatus,
                },
                $unset: {
                    statusBeforePartnerDeactivation: 1,
                },
            });
        });

        // Activate partner, partner user, and restore all partner employees in parallel
        await Promise.all([
            Partner.findByIdAndUpdate(id, { $set: { isActive: true } }),
            ...(partner.userId ? [User.findByIdAndUpdate(partner.userId, { $set: { isActive: true } })] : []),
            ...employeeUpdates,
        ]);
    }

    /**
     * Delete partner and linked partner-owned records after archiving the full partner graph.
     */
    async deletePartner(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const partner = await Partner.findById(id);

        if (!partner) {
            throw new AppError('Partner not found', 404);
        }

        const archiveBatchId = this.getArchiveBatchId(options);
        const graph = await DeleteGraphService.archiveGraph('Partner', partner._id, {
            archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Partner delete requested',
            session: options.session,
            metadata: {
                ...options.metadata,
                partnerId: partner._id.toString(),
                userId: partner.userId?.toString(),
                companyName: partner.companyName,
                email: partner.email,
            },
        });

        for (const projectId of getGraphNodeIds(graph, 'partner_projects')) {
            await deleteProject(projectId.toString(), {
                archiveBatchId,
                deletedBy: options.deletedBy?.toString(),
                reason: options.reason ?? 'Partner delete requested',
            });
        }

        for (const revenueId of getGraphNodeIds(graph, 'partner_revenue')) {
            await RevenueService.delete(revenueId, {
                ...options,
                archiveBatchId,
                skipArchive: true,
                metadata: {
                    ...options.metadata,
                    partnerId: partner._id.toString(),
                    linkedFrom: 'Partner',
                },
            });
        }

        const deleteOptions = options.session ? { session: options.session } : undefined;
        await Promise.all([
            Proposal.deleteMany({ _id: { $in: getGraphNodeIds(graph, 'partner_proposals') } }, deleteOptions),
            Lead.deleteMany({ _id: { $in: getGraphNodeIds(graph, 'partner_leads') } }, deleteOptions),
            Client.deleteMany({ _id: { $in: getGraphNodeIds(graph, 'partner_clients') } }, deleteOptions),
            PartnerEmployee.deleteMany({ _id: { $in: getGraphNodeIds(graph, 'partner_employees') } }, deleteOptions),
            ...(partner.userId ? [User.deleteOne({ _id: partner.userId }, deleteOptions)] : []),
        ]);

        await partner.deleteOne(deleteOptions);
    }

    /**
     * Get partner's clients
     */
    async getPartnerClients(partnerId: string): Promise<ReturnType<typeof Client.find>['_mongooseOptions'] extends never ? object[] : object[]> {
        const clients = await Client.find({ partnerId })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email')
            .lean();

        // Deduplicate clients by _id just in case there are duplicates
        const uniqueClients = Array.from(
            new Map(clients.map((client) => [client._id.toString(), client])).values()
        );

        return uniqueClients;
    }

    /**
     * Get partner's projects
     */
    async getPartnerProjects(partnerId: string): Promise<object[]> {
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
