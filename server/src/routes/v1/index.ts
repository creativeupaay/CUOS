import { Router } from 'express';
import authRoutes from '../../modules/auth/routes/auth.routes';
import projectRoutes from '../../modules/project/routes/project.routes';
import clientRoutes from '../../modules/client/routes/client.routes';
import crmRoutes from '../../modules/crm/routes/crm.routes';
import hrmsRoutes from '../../modules/hrms/routes/hrms.routes';
import adminRoutes from '../../modules/overall-admin/routes/admin.routes';
import financeRoutes from '../../modules/finance/routes/finance.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/projects', projectRoutes);
router.use('/crm', crmRoutes);
router.use('/hrms', hrmsRoutes);
router.use('/admin', adminRoutes);
router.use('/finance', financeRoutes);

export default router;
