import { Router } from 'express';
import authRoutes from '../../modules/auth/routes/auth.routes';
import projectRoutes from '../../modules/project/routes/project.routes';
import clientRoutes from '../../modules/client/routes/client.routes';
import clientOnboardingRoutes from '../../modules/client/routes/clientOnboarding.routes';
import clientPortalRoutes from '../../modules/client-portal/routes/clientPortal.routes';
import crmRoutes from '../../modules/crm/routes/crm.routes';
import hrmsRoutes from '../../modules/hrms/routes/hrms.routes';
import employeeFormRoutes from '../../modules/hrms/routes/employeeForm.routes';
import adminRoutes from '../../modules/overall-admin/routes/admin.routes';
import financeRoutes from '../../modules/finance/routes/finance.routes';
import hiringRoutes from '../../modules/hiring/routes/hiring.routes';
import partnerRoutes from '../../modules/partners/routes/partner.routes';
import partnerAuthRoutes from '../../modules/partners/routes/partnerAuth.routes';
import partnerEmployeeRoutes from '../../modules/partners/routes/partnerEmployee.routes';
import partnerPortalRoutes from '../../modules/partners/routes/partnerPortal.routes';
import notificationRoutes from '../../modules/notification/routes/notification.routes';
import gameZoneRoutes from '../../modules/game-zone/routes/game.routes';
import wordleRoutes from '../../modules/game-zone/routes/wordle.routes';

const router = Router();

router.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
    });
});

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/projects', projectRoutes);
router.use('/crm', crmRoutes);
router.use('/hrms', hrmsRoutes);
// Public self-onboarding form (no auth required)
router.use('/employee-form', employeeFormRoutes);
// Public client onboarding form (no auth required)
router.use('/client-onboarding', clientOnboardingRoutes);
// Client portal (public login + protected client routes)
router.use('/client-portal', clientPortalRoutes);
router.use('/admin', adminRoutes);
router.use('/finance', financeRoutes);
// Hiring Management — also registers /public/jobs (no auth)
router.use('/hiring', hiringRoutes);
// Partner Management (Admin routes)
router.use('/partners', partnerRoutes);
// Public partner onboarding and login info (no auth required)
router.use('/partner', partnerAuthRoutes);
// Partner Employee Management (Partner's own employee management)
router.use('/partner-employees', partnerEmployeeRoutes);
// Partner Portal (Partner's own portal - projects, documents, etc.)
router.use('/partner-portal', partnerPortalRoutes);
// Notifications
router.use('/notifications', notificationRoutes);
// Game Zone (Imposter)
router.use('/game-zone', gameZoneRoutes);
// Wordle (isolated from Imposter)
router.use('/wordle', wordleRoutes);

export default router;
