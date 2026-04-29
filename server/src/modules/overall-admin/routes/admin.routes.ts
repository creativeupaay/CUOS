import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import AppError from '../../../utils/appError';
import { hasModuleAdminAccess, hasModuleViewAccess } from '../../../utils/moduleAccess.util';
import { NextFunction, Request, Response } from 'express';

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

const overallAdminView = (req: Request, _res: Response, next: NextFunction) => {
    if (hasModuleViewAccess(req.user, 'overallAdmin')) return next();
    return next(new AppError('You do not have permission to access overall admin', 403));
};

const overallAdminManage = (req: Request, _res: Response, next: NextFunction) => {
    if (hasModuleAdminAccess(req.user, 'overallAdmin')) return next();
    return next(new AppError('Overall admin access is required', 403));
};

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════
router.get('/dashboard-stats', overallAdminView, settingsController.getDashboardStats);

// ══════════════════════════════════════════════════════════════════════
// USER MANAGEMENT (Admin + Super Admin)
// ══════════════════════════════════════════════════════════════════════
router.get('/users', overallAdminManage, userController.getAllUsers);
router.get('/users/:id', overallAdminManage, userController.getUserById);
router.post(
    '/users',
    overallAdminManage,
    validateRequest(createUserSchema),
    userController.createUser
);
router.patch(
    '/users/:id',
    overallAdminManage,
    validateRequest(updateUserSchema),
    userController.updateUser
);
router.patch('/users/:id/deactivate', overallAdminManage, userController.deactivateUser);
router.patch('/users/:id/activate', overallAdminManage, userController.activateUser);
router.patch(
    '/users/:id/reset-password',
    overallAdminManage,
    validateRequest(resetPasswordSchema),
    userController.resetPassword
);
router.delete('/users/:id', overallAdminManage, userController.deleteUser);

// ══════════════════════════════════════════════════════════════════════
// ROLE MANAGEMENT (Super Admin only)
// ══════════════════════════════════════════════════════════════════════
router.get('/roles', overallAdminManage, roleController.getAllRoles);
router.get('/roles/:id', overallAdminManage, roleController.getRoleById);
router.post(
    '/roles',
    overallAdminManage,
    validateRequest(createRoleSchema),
    roleController.createRole
);
router.patch(
    '/roles/:id',
    overallAdminManage,
    validateRequest(updateRoleSchema),
    roleController.updateRole
);
router.delete('/roles/:id', overallAdminManage, roleController.deleteRole);
router.post(
    '/roles/:id/clone',
    overallAdminManage,
    validateRequest(cloneRoleSchema),
    roleController.cloneRole
);

// ══════════════════════════════════════════════════════════════════════
// PERMISSION MANAGEMENT (Super Admin only)
// ══════════════════════════════════════════════════════════════════════
router.get('/permissions', overallAdminManage, roleController.getAllPermissions);
router.post(
    '/permissions',
    overallAdminManage,
    validateRequest(createPermissionSchema),
    roleController.createPermission
);
router.delete('/permissions/:id', overallAdminManage, roleController.deletePermission);

// ══════════════════════════════════════════════════════════════════════
// AUDIT LOGS (Admin + Super Admin)
// ══════════════════════════════════════════════════════════════════════
router.get('/audit-logs', overallAdminView, auditController.getAuditLogs);

// ══════════════════════════════════════════════════════════════════════
// ORGANIZATION SETTINGS (Super Admin only)
// ══════════════════════════════════════════════════════════════════════
router.get('/settings', overallAdminManage, settingsController.getSettings);
router.patch(
    '/settings',
    overallAdminManage,
    validateRequest(updateSettingsSchema),
    settingsController.updateSettings
);

export default router;
