import path from 'path';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Employee, IEmployee } from '../models/Employee.model';
import { uploadDocument, getSignedUrl } from '../../../utils/cloudinary.util';
import { CreateEmployeeInput, UpdateEmployeeInput } from '../validators/employee.validator';
import AppError from '../../../utils/appError';
import { env } from '../../../config/env.config';

class EmployeeService {
    async createEmployee(data: CreateEmployeeInput, createdBy: string): Promise<IEmployee> {
        // Check if user already has an employee record
        const existing = await Employee.findOne({ userId: data.userId });
        if (existing) {
            throw new AppError('Employee record already exists for this user', 400);
        }

        // Check if employeeId is unique
        const existingEmpId = await Employee.findOne({ employeeId: data.employeeId });
        if (existingEmpId) {
            throw new AppError('Employee ID already exists', 400);
        }

        const employee = await Employee.create({
            ...data,
            createdBy,
        });

        return employee;
    }

    async getEmployees(filters: {
        department?: string;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { department, status, search, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;

        // Build pre-lookup match (fast indexed fields)
        const preMatch: any = {};
        if (department) preMatch.department = department;
        if (status) preMatch.status = status;

        // Aggregation pipeline so we can search on joined user.name / user.email
        const pipeline: any[] = [
            { $match: preMatch },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: '_user',
                },
            },
            { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } },
        ];

        // Post-lookup search filter across name, email, employeeId, designation
        if (search && search.trim()) {
            const regex = { $regex: search.trim(), $options: 'i' };
            pipeline.push({
                $match: {
                    $or: [
                        { '_user.name': regex },
                        { '_user.email': regex },
                        { employeeId: regex },
                        { designation: regex },
                        { department: regex },
                    ],
                },
            });
        }

        // Count before pagination
        const countPipeline = [...pipeline, { $count: 'total' }];

        // Add sort + pagination
        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            // Re-shape: move _user back into userId so the frontend interface stays the same
            {
                $addFields: {
                    userId: {
                        _id: '$_user._id',
                        name: '$_user.name',
                        email: '$_user.email',
                    },
                },
            },
            { $unset: '_user' },
        );

        const [employees, countResult] = await Promise.all([
            Employee.aggregate(pipeline),
            Employee.aggregate(countPipeline),
        ]);

        const total = countResult[0]?.total ?? 0;

        return {
            employees,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async getEmployeeById(id: string): Promise<IEmployee> {
        const employee = await Employee.findById(id)
            .populate('userId', 'name email')
            .populate('reportingTo', 'employeeId designation');

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        return employee;
    }

    async getEmployeeByUserId(userId: string): Promise<IEmployee | null> {
        return Employee.findOne({ userId })
            .populate('userId', 'name email')
            .populate('reportingTo', 'employeeId designation');
    }

    async updateEmployee(id: string, data: UpdateEmployeeInput): Promise<IEmployee> {
        const employee = await Employee.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        })
            .populate('userId', 'name email')
            .populate('reportingTo', 'employeeId designation');

        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        return employee;
    }

    async deleteEmployee(id: string): Promise<void> {
        const employee = await Employee.findByIdAndDelete(id);
        if (!employee) {
            throw new AppError('Employee not found', 404);
        }
    }

    async getTeamMembers(managerId: string) {
        return Employee.find({ reportingTo: managerId })
            .populate('userId', 'name email')
            .sort({ employeeId: 1 });
    }

    async getOnboardingEmployees() {
        return Employee.find({
            'onboarding.status': { $in: ['not-started', 'in-progress'] },
        })
            .populate('userId', 'name email')
            .sort({ joiningDate: -1 });
    }

    async updateOnboardingChecklist(
        employeeId: string,
        checklist: { item: string; completed: boolean }[]
    ): Promise<IEmployee> {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        employee.onboarding.checklist = checklist.map((c) => ({
            ...c,
            completedAt: c.completed ? new Date() : undefined,
        })) as any;

        // Auto-update onboarding status
        const allDone = checklist.every((c) => c.completed);
        const anyDone = checklist.some((c) => c.completed);

        if (allDone && checklist.length > 0) {
            employee.onboarding.status = 'completed';
            employee.onboarding.completedAt = new Date();
        } else if (anyDone) {
            employee.onboarding.status = 'in-progress';
            if (!employee.onboarding.startedAt) {
                employee.onboarding.startedAt = new Date();
            }
        }

        await employee.save();
        return employee;
    }

    // ── Self-Onboarding Form ──────────────────────────────────────

    /**
     * Generate a unique form token for an employee (idempotent — returns existing token if already set).
     */
    async generateFormToken(employeeId: string): Promise<{ token: string; formUrl: string }> {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            throw new AppError('Employee not found', 404);
        }

        // Idempotent: if token already exists, return it
        if (employee.formToken) {
            const formUrl = `${env.FRONTEND_URL}/employee-form/${employee.formToken}`;
            return { token: employee.formToken, formUrl };
        }

        const token = uuidv4();
        employee.formToken = token;
        await employee.save();

        const formUrl = `${env.FRONTEND_URL}/employee-form/${token}`;
        return { token, formUrl };
    }

    /**
     * Get employee by form token (public — no auth).
     */
    async getEmployeeByFormToken(token: string): Promise<IEmployee> {
        const employee = await Employee.findOne({ formToken: token })
            .populate('userId', 'name email');

        if (!employee) {
            throw new AppError('Invalid or expired form link', 404);
        }

        return employee;
    }

    /**
     * Submit the self-onboarding form. Called from the public endpoint.
     */
    async submitOnboardingForm(
        token: string,
        data: {
            // Personal info
            phone?: string;
            alternatePhone?: string;
            gender?: string;
            dob?: string;
            fatherName?: string;
            fatherPhone?: string;
            fullAddress?: string;
            state?: string;
            pincode?: string;
            // Bank details
            bankName?: string;
            accountNumber?: string;
            ifscCode?: string;
            bankBranch?: string;
            upiId?: string;
            // Identity
            identityType?: string;
            identityIdNumber?: string;
            // T-shirt size
            tshirtSize?: string;
        },
        files?: {
            profilePhoto?: Express.Multer.File;
            identityDocument?: Express.Multer.File;
        }
    ): Promise<IEmployee> {
        const employee = await Employee.findOne({ formToken: token });
        if (!employee) {
            throw new AppError('Invalid or expired form link', 404);
        }

        if (employee.formSubmitted) {
            throw new AppError('This form has already been submitted', 400);
        }

        // ── Personal info ──────────────────────────────────────
        employee.personalInfo = {
            ...employee.personalInfo,
            phone: data.phone,
            alternatePhone: data.alternatePhone,
            gender: data.gender as any,
            dob: data.dob ? new Date(data.dob) : undefined,
            fatherName: data.fatherName,
            fatherPhone: data.fatherPhone,
            address: {
                street: data.fullAddress,
                state: data.state,
                postalCode: data.pincode,
                city: employee.personalInfo?.address?.city,
                country: 'India',
            },
        };

        // ── Bank details ───────────────────────────────────────
        employee.bankDetails = {
            ...employee.bankDetails,
            bankName: data.bankName,
            accountNumber: data.accountNumber,
            ifscCode: data.ifscCode,
            bankBranch: data.bankBranch,
            upiId: data.upiId,
        };

        // ── Identity ───────────────────────────────────────────
        if (data.identityType || data.identityIdNumber) {
            employee.identityVerification = {
                type: data.identityType as any,
                idNumber: data.identityIdNumber,
            };
        }

        // ── T-shirt size ───────────────────────────────────────
        if (data.tshirtSize) {
            employee.tshirtSize = data.tshirtSize as any;
        }

        // ── Profile photo upload ───────────────────────────────
        if (files?.profilePhoto) {
            const photoExt = path.extname(files.profilePhoto.originalname) || '.jpg';
            const result = await uploadDocument(
                files.profilePhoto.buffer,
                `hrms/employees/${employee._id}/profile`,
                `profile-${Date.now()}${photoExt}`,
                false  // public — needed for <img src> to work
            );
            employee.profilePhoto = {
                cloudinaryId: result.cloudinaryId,
                url: result.url,
            };
        }

        // ── Identity document upload ───────────────────────────
        if (files?.identityDocument) {
            const docExt = path.extname(files.identityDocument.originalname) || '.pdf';
            const result = await uploadDocument(
                files.identityDocument.buffer,
                `hrms/employees/${employee._id}/identity`,
                `identity-${Date.now()}${docExt}`,
                true  // private — accessed only via signed URL
            );
            employee.identityVerification = {
                ...employee.identityVerification,
                documentCloudinaryId: result.cloudinaryId,
                documentUrl: result.url,
            };
        }

        // ── Mark as submitted ──────────────────────────────────
        employee.formSubmitted = true;
        employee.formSubmittedAt = new Date();

        await employee.save();
        await employee.populate('userId', 'name email');

        return employee;
    }

    /**
     * Get a signed (temporary) URL for an identity document.
     */
    async getIdentityDocumentUrl(employeeId: string): Promise<string> {
        const employee = await Employee.findById(employeeId);
        if (!employee) throw new AppError('Employee not found', 404);

        const cloudId = employee.identityVerification?.documentCloudinaryId;
        const docUrl = employee.identityVerification?.documentUrl;
        if (!cloudId) throw new AppError('No identity document uploaded', 404);

        // Extract resource_type from the stored Cloudinary URL.
        // Cloudinary's own upload response embeds the correct type in the URL path:
        // https://res.cloudinary.com/{cloud}/{resource_type}/{type}/...
        let resourceType: string | undefined;
        let isLegacyPublic = false;

        if (docUrl) {
            // Remove protocol + host, then split path segments
            const parts = docUrl.replace(/^https?:\/\/[^/]+\/[^/]+\//, '').split('/');
            // parts[0] is resource_type (image | raw | video)
            if (parts[0] && ['image', 'raw', 'video'].includes(parts[0])) {
                resourceType = parts[0];
            }
            // parts[1] is the delivery type. If it is 'upload' instead of 'authenticated',
            // then it is a legacy public upload and signing it as authenticated will 404.
            if (parts[1] === 'upload') {
                isLegacyPublic = true;
            }
        }

        // Fix for legacy public uploads that lack the explicit private prefix mapping 
        // in their `documentCloudinaryId`. If they are public, Cloudinary 404s the 
        // signed authenticated attempts completely.
        if (isLegacyPublic) {
            return docUrl!;
        }

        // For new uploads where the extension is preserved safely in the db URL but correctly stripped
        // from the cloudId natively, we append it back temporarily here so `getSignedUrl` extracts it as format.
        const docExtMatch = docUrl?.match(/\.([a-z0-9]+)$/i);
        let finalCloudId = cloudId;
        if (docExtMatch && !finalCloudId.match(/\.[a-z0-9]+$/i)) {
            finalCloudId += docExtMatch[0]; // append `.pdf` etc
        }

        return getSignedUrl(finalCloudId, 3600, resourceType);
    }
}

export const employeeService = new EmployeeService();
