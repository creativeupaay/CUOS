import mongoose, { Document, Schema, Types, PopulatedDoc } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { IRole } from './Role.model';

export interface IProjectPermission {
    projectId: string;
    subModules: {
        overview: boolean;
        tasks: boolean;
        timeLogs: boolean;
        meetings: boolean;
        credentials: boolean;
        documents: boolean;
        notes: boolean;
    };
}

export interface IModulePermissions {
    accessControlVersion?: number;
    projectManagement: {
        enabled: boolean;
        adminAccess?: boolean;
        projectPermissions: IProjectPermission[];
    };
    finance: {
        enabled: boolean;
        adminAccess?: boolean;
        subModules: {
            dashboard: boolean;
            expenses: boolean;
            invoices: boolean;
            reports: boolean;
            revenue?: boolean;
            cashInBank?: boolean;
            salariesPayrolls?: boolean;
        };
    };
    crm: {
        enabled: boolean;
        adminAccess?: boolean;
        subModules: { pipeline: boolean; leads: boolean; proposals: boolean; clients: boolean };
    };
    hrms: {
        enabled: boolean;
        adminAccess?: boolean;
        subModules: { dashboard?: boolean; employees?: boolean; attendance: boolean; leaves: boolean; holidays?: boolean; payroll: boolean; announcements?: boolean };
    };
    overallAdmin: {
        enabled: boolean;
        adminAccess?: boolean;
        subModules: { users: boolean; permissions: boolean; settings: boolean; auditLogs: boolean };
    };
    partners?: {
        enabled: boolean;
        adminAccess?: boolean;
    };
    hiring?: {
        enabled: boolean;
        adminAccess?: boolean;
    };
}

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: PopulatedDoc<IRole & Document, Types.ObjectId>;
    department?: string;
    isActive: boolean;
    lastLogin?: Date;
    modulePermissions: IModulePermissions;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: true,
            minlength: 8,
            select: false, // Don't return password by default
        },
        role: {
            type: Schema.Types.ObjectId,
            ref: 'Role',
            required: true,
        },
        department: {
            type: String,
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
        },
        modulePermissions: {
            accessControlVersion: { type: Number },
            projectManagement: {
                enabled: { type: Boolean, default: true },
                adminAccess: { type: Boolean, default: false },
                projectPermissions: [{
                    projectId: { type: String, required: true },
                    subModules: {
                        overview: { type: Boolean, default: false },
                        tasks: { type: Boolean, default: false },
                        timeLogs: { type: Boolean, default: false },
                        meetings: { type: Boolean, default: false },
                        credentials: { type: Boolean, default: false },
                        documents: { type: Boolean, default: false },
                        notes: { type: Boolean, default: false },
                    },
                }],
            },
            finance: {
                enabled: { type: Boolean, default: false },
                adminAccess: { type: Boolean, default: false },
                subModules: {
                    dashboard: { type: Boolean, default: false },
                    expenses: { type: Boolean, default: false },
                    invoices: { type: Boolean, default: false },
                    reports: { type: Boolean, default: false },
                    revenue: { type: Boolean, default: false },
                    cashInBank: { type: Boolean, default: false },
                    salariesPayrolls: { type: Boolean, default: false },
                },
            },
            crm: {
                enabled: { type: Boolean, default: false },
                adminAccess: { type: Boolean, default: false },
                subModules: {
                    pipeline: { type: Boolean, default: false },
                    leads: { type: Boolean, default: false },
                    proposals: { type: Boolean, default: false },
                    clients: { type: Boolean, default: false },
                },
            },
            hrms: {
                enabled: { type: Boolean, default: true },
                adminAccess: { type: Boolean, default: false },
                subModules: {
                    dashboard: { type: Boolean, default: false },
                    employees: { type: Boolean, default: false },
                    attendance: { type: Boolean, default: true },
                    leaves: { type: Boolean, default: true },
                    holidays: { type: Boolean, default: true },
                    payroll: { type: Boolean, default: true },
                    announcements: { type: Boolean, default: true },
                },
            },
            overallAdmin: {
                enabled: { type: Boolean, default: false },
                adminAccess: { type: Boolean, default: false },
                subModules: {
                    users: { type: Boolean, default: false },
                    permissions: { type: Boolean, default: false },
                    settings: { type: Boolean, default: false },
                    auditLogs: { type: Boolean, default: false },
                },
            },
            partners: {
                enabled: { type: Boolean, default: false },
                adminAccess: { type: Boolean, default: false },
            },
            hiring: {
                enabled: { type: Boolean, default: false },
                adminAccess: { type: Boolean, default: false },
            },
        },
    },
    {
        timestamps: true,
    }
);

// Indexes (email is already indexed via unique:true on the field)
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

// Hash password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: unknown) {
        next(error instanceof Error ? error : new Error(String(error)));
    }
});

// Compare password method
UserSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON response
UserSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

export const User = mongoose.model<IUser>('User', UserSchema);
