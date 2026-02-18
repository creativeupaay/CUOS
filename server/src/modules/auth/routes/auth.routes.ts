import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateRequest } from '../../../middlewares/validateRequest';
import * as authValidators from '../validators/auth.validator';
import { authenticate } from '../middlewares/authenticate.middleware';
import { isAdmin } from '../middlewares/authorize.middleware';

const router = Router();

// Public routes
router.post(
    '/login',
    validateRequest(authValidators.loginSchema),
    authController.login
);

router.post(
    '/refresh',
    validateRequest(authValidators.refreshTokenSchema),
    authController.refreshToken
);

// Protected routes
router.post(
    '/register',
    authenticate,
    isAdmin,
    validateRequest(authValidators.registerSchema),
    authController.register
);

router.post('/logout', authenticate, authController.logout);

router.get('/me', authenticate, authController.getMe);

export default router;
