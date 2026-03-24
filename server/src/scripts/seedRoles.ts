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

        // Define all permissions
        const permissionsData = [
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
        ];

        // Upsert permissions (create if not exists, skip if exists)
        const upsertedPermissions = [];
        for (const permData of permissionsData) {
            const permission = await Permission.findOneAndUpdate(
                { resource: permData.resource, action: permData.action },
                { $set: permData },
                { upsert: true, new: true }
            );
            upsertedPermissions.push(permission);
        }

        console.log(`Upserted ${upsertedPermissions.length} permissions`);

        // Get permission IDs for role creation
        const allPermissions = upsertedPermissions.map((p) => p._id);
        const projectPerms = upsertedPermissions.filter((p) => p.resource === 'projects').map((p) => p._id);
        const userPerms = upsertedPermissions.filter((p) => p.resource === 'users').map((p) => p._id);
        const financePerms = upsertedPermissions.filter((p) => p.resource === 'finance').map((p) => p._id);
        const crmPerms = upsertedPermissions.filter((p) => p.resource === 'crm').map((p) => p._id);
        const hrmsPerms = upsertedPermissions.filter((p) => p.resource === 'hrms').map((p) => p._id);

        // Define roles
        const rolesData = [
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
                    upsertedPermissions.find((p) => p.resource === 'projects' && p.action === 'read')?._id,
                ].filter(Boolean),
                level: 5,
            },
            {
                name: 'partner',
                description: 'External partner with limited CRM and Project access',
                permissions: [
                    upsertedPermissions.find((p) => p.resource === 'crm' && p.action === 'create')?._id,
                    upsertedPermissions.find((p) => p.resource === 'crm' && p.action === 'read')?._id,
                    upsertedPermissions.find((p) => p.resource === 'crm' && p.action === 'update')?._id,
                    upsertedPermissions.find((p) => p.resource === 'projects' && p.action === 'create')?._id,
                    upsertedPermissions.find((p) => p.resource === 'projects' && p.action === 'read')?._id,
                    upsertedPermissions.find((p) => p.resource === 'projects' && p.action === 'update')?._id,
                ].filter(Boolean),
                level: 6,
            },
        ];

        // Upsert roles (create if not exists, update permissions if exists)
        const upsertedRoles = [];
        for (const roleData of rolesData) {
            const role = await Role.findOneAndUpdate(
                { name: roleData.name },
                { $set: roleData },
                { upsert: true, new: true }
            );
            upsertedRoles.push(role);
        }

        console.log(`Upserted ${upsertedRoles.length} roles`);

        // Create super admin user if not exists
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@creativeupaay.com';
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

        const existingSuperAdmin = await User.findOne({ email: superAdminEmail });

        if (!existingSuperAdmin) {
            const superAdminRole = upsertedRoles.find((r) => r.name === 'super-admin');

            await User.create({
                name: 'Super Admin',
                email: superAdminEmail,
                password: superAdminPassword,
                role: superAdminRole!._id,
                isActive: true,
            });

            console.log(`\nCreated super admin user: ${superAdminEmail}`);
        } else {
            console.log(`\nSuper admin user already exists: ${superAdminEmail}`);
            console.log('Existing users\' roles have been preserved.');
        }

        console.log('\n✅ Seeding completed successfully!');
        console.log('\n⚠️  NOTE: All existing user role assignments have been preserved.');
        console.log('This script only creates/updates role and permission definitions.');
        console.log('\nRoles upserted:');
        upsertedRoles.forEach((role) => {
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
