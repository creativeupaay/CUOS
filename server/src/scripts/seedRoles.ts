import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Role } from '../modules/auth/models/Role.model';
import { Permission } from '../modules/auth/models/Permission.model';
import { User } from '../modules/auth/models/User.model';

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/cuos';

/**
 * Seed roles and permissions
 */
async function seedRolesAndPermissions() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Permission.deleteMany({});
        await Role.deleteMany({});
        console.log('Cleared existing roles and permissions');

        // Create permissions
        const permissions = await Permission.insertMany([
            // Project permissions
            { resource: 'projects', action: 'create', description: 'Create projects' },
            { resource: 'projects', action: 'read', description: 'View projects' },
            { resource: 'projects', action: 'update', description: 'Update projects' },
            { resource: 'projects', action: 'delete', description: 'Delete projects' },
            { resource: 'projects', action: 'manage', description: 'Full project management' },

            // User permissions
            { resource: 'users', action: 'create', description: 'Create users' },
            { resource: 'users', action: 'read', description: 'View users' },
            { resource: 'users', action: 'update', description: 'Update users' },
            { resource: 'users', action: 'delete', description: 'Delete users' },
            { resource: 'users', action: 'manage', description: 'Full user management' },

            // Finance permissions
            { resource: 'finance', action: 'create', description: 'Create finance records' },
            { resource: 'finance', action: 'read', description: 'View finance records' },
            { resource: 'finance', action: 'update', description: 'Update finance records' },
            { resource: 'finance', action: 'delete', description: 'Delete finance records' },
            { resource: 'finance', action: 'manage', description: 'Full finance management' },

            // CRM permissions
            { resource: 'crm', action: 'create', description: 'Create CRM records' },
            { resource: 'crm', action: 'read', description: 'View CRM records' },
            { resource: 'crm', action: 'update', description: 'Update CRM records' },
            { resource: 'crm', action: 'delete', description: 'Delete CRM records' },
            { resource: 'crm', action: 'manage', description: 'Full CRM management' },

            // HRMS permissions
            { resource: 'hrms', action: 'create', description: 'Create HRMS records' },
            { resource: 'hrms', action: 'read', description: 'View HRMS records' },
            { resource: 'hrms', action: 'update', description: 'Update HRMS records' },
            { resource: 'hrms', action: 'delete', description: 'Delete HRMS records' },
            { resource: 'hrms', action: 'manage', description: 'Full HRMS management' },
        ]);

        console.log(`Created ${permissions.length} permissions`);

        // Get permission IDs
        const allPermissions = permissions.map((p) => p._id);
        const projectPerms = permissions.filter((p) => p.resource === 'projects').map((p) => p._id);
        const userPerms = permissions.filter((p) => p.resource === 'users').map((p) => p._id);
        const financePerms = permissions.filter((p) => p.resource === 'finance').map((p) => p._id);
        const crmPerms = permissions.filter((p) => p.resource === 'crm').map((p) => p._id);
        const hrmsPerms = permissions.filter((p) => p.resource === 'hrms').map((p) => p._id);

        // Create roles
        const roles = await Role.insertMany([
            {
                name: 'super-admin',
                description: 'Full system access',
                permissions: allPermissions,
                level: 1,
            },
            {
                name: 'admin',
                description: 'Department-wide access',
                permissions: [...projectPerms, ...userPerms],
                level: 2,
            },
            {
                name: 'manager',
                description: 'Team management access',
                permissions: projectPerms.filter((_, i) => i < 4), // create, read, update, delete (no manage)
                level: 3,
            },
            {
                name: 'finance',
                description: 'Finance module access',
                permissions: financePerms,
                level: 4,
            },
            {
                name: 'hr',
                description: 'HRMS module access',
                permissions: hrmsPerms,
                level: 4,
            },
            {
                name: 'employee',
                description: 'Limited access',
                permissions: [
                    permissions.find((p) => p.resource === 'projects' && p.action === 'read')?._id,
                ].filter(Boolean),
                level: 5,
            },
        ]);

        console.log(`Created ${roles.length} roles`);

        // Create super admin user if not exists
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@creativeupaay.com';
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

        const existingSuperAdmin = await User.findOne({ email: superAdminEmail });

        if (!existingSuperAdmin) {
            const superAdminRole = roles.find((r) => r.name === 'super-admin');

            await User.create({
                name: 'Super Admin',
                email: superAdminEmail,
                password: superAdminPassword,
                role: superAdminRole!._id,
                isActive: true,
            });

            console.log(`Created super admin user: ${superAdminEmail}`);
        } else {
            console.log('Super admin user already exists');
        }

        console.log('\n✅ Seeding completed successfully!');
        console.log('\nRoles created:');
        roles.forEach((role) => {
            console.log(`  - ${role.name} (Level ${role.level})`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

// Run seeding
seedRolesAndPermissions();
