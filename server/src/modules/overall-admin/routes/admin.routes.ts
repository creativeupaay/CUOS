import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { isSuperAdmin, isAdmin } from '../../auth/middlewares/authorize.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';

// Controllers
import * as userController from '../controllers/admin-user.controller';
import * as roleController from '../controllers/admin-role.controller';
import * as auditController from '../controllers/audit.controller';
import * as settingsController from '../controllers/org-settings.controller';

// Validators
import {
    createUserSchema,
    updateUserSchema,
    resetPasswordSchema,
    createRoleSchema,
    updateRoleSchema,
    cloneRoleSchema,
    createPermissionSchema,
    updateSettingsSchema,
} from '../validators/admin.validators';

const router = Router();

// All admin routes require authentication
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════
router.get('/dashboard-stats', isAdmin, settingsController.getDashboardStats);

// ══════════════════════════════════════════════════════════════════════
// USER MANAGEMENT (Admin + Super Admin)
// ══════════════════════════════════════════════════════════════════════
router.get('/users', isAdmin, userController.getAllUsers);
router.get('/users/:id', isAdmin, userController.getUserById);
router.post(
    '/users',
    isAdmin,
    validateRequest(createUserSchema),
    userController.createUser
);
router.patch(
    '/users/:id',
    isAdmin,
    validateRequest(updateUserSchema),
    userController.updateUser
);
router.patch('/users/:id/deactivate', isAdmin, userController.deactivateUser);
router.patch('/users/:id/activate', isAdmin, userController.activateUser);
router.patch(
    '/users/:id/reset-password',
    isSuperAdmin,
    validateRequest(resetPasswordSchema),
    userController.resetPassword
);

// ══════════════════════════════════════════════════════════════════════
// ROLE MANAGEMENT (Super Admin only)
// ══════════════════════════════════════════════════════════════════════
router.get('/roles', isAdmin, roleController.getAllRoles);
router.get('/roles/:id', isAdmin, roleController.getRoleById);
router.post(
    '/roles',
    isSuperAdmin,
    validateRequest(createRoleSchema),
    roleController.createRole
);
router.patch(
    '/roles/:id',
    isSuperAdmin,
    validateRequest(updateRoleSchema),
    roleController.updateRole
);
router.delete('/roles/:id', isSuperAdmin, roleController.deleteRole);
router.post(
    '/roles/:id/clone',
    isSuperAdmin,
    validateRequest(cloneRoleSchema),
    roleController.cloneRole
);

// ══════════════════════════════════════════════════════════════════════
// PERMISSION MANAGEMENT (Super Admin only)
// ══════════════════════════════════════════════════════════════════════
router.get('/permissions', isAdmin, roleController.getAllPermissions);
router.post(
    '/permissions',
    isSuperAdmin,
    validateRequest(createPermissionSchema),
    roleController.createPermission
);
router.delete('/permissions/:id', isSuperAdmin, roleController.deletePermission);

// ══════════════════════════════════════════════════════════════════════
// AUDIT LOGS (Admin + Super Admin)
// ══════════════════════════════════════════════════════════════════════
router.get('/audit-logs', isAdmin, auditController.getAuditLogs);

// ══════════════════════════════════════════════════════════════════════
// ORGANIZATION SETTINGS (Super Admin only)
// ══════════════════════════════════════════════════════════════════════
router.get('/settings', isAdmin, settingsController.getSettings);
router.patch(
    '/settings',
    isSuperAdmin,
    validateRequest(updateSettingsSchema),
    settingsController.updateSettings
);

export default router;
