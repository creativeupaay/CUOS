import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import { checkHrmsAccess, hrAdminOnly, hrmsSelfSubmoduleOnly, internalHrmsOnly } from '../middlewares/hrmsAccess.middleware';

// Validators
import { createEmployeeSchema, updateEmployeeSchema, selfUpdateSchema } from '../validators/employee.validator';
import { createAnnouncementSchema, deleteAnnouncementSchema } from '../validators/announcement.validator';
import { createSalarySchema, updateSalarySchema } from '../validators/salary.validator';
import { createLeaveSchema, updateLeaveStatusSchema, deleteLeaveSchema } from '../validators/leave.validator';
import { generatePayrollSchema, generateBulkPayrollSchema, updatePayrollSchema, updatePayrollStatusSchema, deletePayrollSchema } from '../validators/payroll.validator';
import { checkInSchema, checkOutSchema } from '../validators/attendance.validator';
import { createReimbursementSchema, updateReimbursementSchema, submitReimbursementSchema, updateReimbursementStatusSchema } from '../validators/reimbursement.validator';

// Controllers
import * as employeeController from '../controllers/employee.controller';
import * as announcementController from '../controllers/announcement.controller';
import * as salaryController from '../controllers/salary.controller';
import * as leaveController from '../controllers/leave.controller';
import * as payrollController from '../controllers/payroll.controller';
import * as attendanceController from '../controllers/attendance.controller';
import * as holidayController from '../controllers/holiday.controller';
import * as reimbursementController from '../controllers/reimbursement.controller';


const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
    },
});

// Multer for receipt uploads — allows images + PDFs up to 10 MB
const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error('Only JPG, PNG, WEBP and PDF files are allowed for receipts'));
    },
});

// All HRMS routes require authentication
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════
// EMPLOYEE ROUTES
// ══════════════════════════════════════════════════════════════════════
router.get('/employees/me', employeeController.getMyProfile);
router.patch('/employees/me', validateRequest(selfUpdateSchema), employeeController.updateMyProfile);
router.post('/employees/me/profile-photo', upload.single('profilePhoto'), employeeController.updateMyProfilePhoto);
router.post('/employees/me/photo', upload.single('profilePhoto'), employeeController.updateMyProfilePhoto);
router.get('/employees/onboarding', hrAdminOnly, employeeController.getOnboardingEmployees);
router.get('/employees/:managerId/team', employeeController.getTeamMembers);

router.post(
    '/employees',
    hrAdminOnly,
    validateRequest(createEmployeeSchema),
    employeeController.createEmployee
);
router.get('/employees', hrAdminOnly, employeeController.getEmployees);
router.get('/employees/:id', checkHrmsAccess(true), employeeController.getEmployee);
router.patch(
    '/employees/:id',
    hrAdminOnly,
    validateRequest(updateEmployeeSchema),
    employeeController.updateEmployee
);
router.post('/employees/:id/profile-photo', hrAdminOnly, upload.single('profilePhoto'), employeeController.updateEmployeeProfilePhoto);
router.post('/employees/:id/photo', hrAdminOnly, upload.single('profilePhoto'), employeeController.updateEmployeeProfilePhoto);
router.delete('/employees/:id', hrAdminOnly, employeeController.deleteEmployee);
router.patch(
    '/employees/:id/onboarding',
    hrAdminOnly,
    employeeController.updateOnboardingChecklist
);

// Company announcements
router.get('/announcements', internalHrmsOnly, hrmsSelfSubmoduleOnly('announcements'), announcementController.getAnnouncements);
router.post(
    '/announcements',
    hrAdminOnly,
    validateRequest(createAnnouncementSchema),
    announcementController.createAnnouncement
);
router.delete(
    '/announcements/:id',
    hrAdminOnly,
    validateRequest(deleteAnnouncementSchema),
    announcementController.deleteAnnouncement
);

// Self-onboarding form management
router.post('/employees/:id/generate-form-token', hrAdminOnly, employeeController.generateFormToken);
router.get('/employees/:id/identity-document', hrAdminOnly, employeeController.getIdentityDocumentUrl);

// ══════════════════════════════════════════════════════════════════════
// ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════════════════════
router.post(
    '/attendance/check-in',
    hrmsSelfSubmoduleOnly('attendance'),
    validateRequest(checkInSchema),
    attendanceController.checkIn
);
router.post(
    '/attendance/check-out',
    hrmsSelfSubmoduleOnly('attendance'),
    validateRequest(checkOutSchema),
    attendanceController.checkOut
);
router.get('/attendance/me', hrmsSelfSubmoduleOnly('attendance'), attendanceController.getMyAttendance);
router.get('/attendance/employee/:id', checkHrmsAccess(true), attendanceController.getEmployeeAttendance);
// Admin attendance management
router.post('/attendance/bulk', hrAdminOnly, attendanceController.bulkMarkAttendance);
router.get('/attendance/overview', hrAdminOnly, attendanceController.getDailyOverview);
router.get('/attendance/monthly', hrAdminOnly, attendanceController.getMonthlyAttendance);

// ══════════════════════════════════════════════════════════════════════
// SALARY ROUTES
// ══════════════════════════════════════════════════════════════════════
router.post(
    '/salary',
    hrAdminOnly,
    validateRequest(createSalarySchema),
    salaryController.createSalary
);
router.get('/salary', hrAdminOnly, salaryController.getSalaries);
router.get('/salary/employee/:employeeId', checkHrmsAccess(true), salaryController.getSalaryByEmployee);
router.get('/salary/:id', checkHrmsAccess(true), salaryController.getSalaryById);
router.patch(
    '/salary/:id',
    hrAdminOnly,
    validateRequest(updateSalarySchema),
    salaryController.updateSalary
);
router.delete('/salary/:id', hrAdminOnly, salaryController.deleteSalary);

// ══════════════════════════════════════════════════════════════════════
// LEAVE ROUTES
// ══════════════════════════════════════════════════════════════════════
router.post(
    '/leaves',
    hrmsSelfSubmoduleOnly('leaves'),
    validateRequest(createLeaveSchema),
    leaveController.createLeave
);
router.get('/leaves/me', hrmsSelfSubmoduleOnly('leaves'), leaveController.getMyLeaves);
router.get('/leaves/balance', hrmsSelfSubmoduleOnly('leaves'), leaveController.getLeaveBalance);
// Admin route: get leave balance for a specific employee
router.get('/leaves/balance/employee/:employeeId', hrAdminOnly, leaveController.getLeaveBalance);
router.get('/leaves', hrAdminOnly, leaveController.getLeaves);
router.get('/leaves/:id', leaveController.getLeaveById);
router.patch(
    '/leaves/:id/status',
    hrAdminOnly,
    validateRequest(updateLeaveStatusSchema),
    leaveController.updateLeaveStatus
);
router.delete(
    '/leaves/:id',
    hrAdminOnly,
    validateRequest(deleteLeaveSchema),
    leaveController.deleteLeave
);

// ══════════════════════════════════════════════════════════════════════
// HOLIDAY ROUTES
// ══════════════════════════════════════════════════════════════════════
router.post('/holidays', hrAdminOnly, holidayController.createHoliday);
router.get('/holidays', hrmsSelfSubmoduleOnly('holidays'), holidayController.getHolidays);
router.patch('/holidays/:id', hrAdminOnly, holidayController.updateHoliday);
router.delete('/holidays/:id', hrAdminOnly, holidayController.deleteHoliday);

// ══════════════════════════════════════════════════════════════════════
// PAYROLL ROUTES
// ══════════════════════════════════════════════════════════════════════
router.post(
    '/payroll',
    hrAdminOnly,
    validateRequest(generatePayrollSchema),
    payrollController.generatePayroll
);
router.post(
    '/payroll/bulk',
    hrAdminOnly,
    validateRequest(generateBulkPayrollSchema),
    payrollController.generateBulkPayroll
);

router.get('/payroll', hrAdminOnly, payrollController.getPayrolls);
router.get('/payroll/me', hrmsSelfSubmoduleOnly('payroll'), payrollController.getMyPayrolls);
router.get('/payroll/:id', checkHrmsAccess(true), payrollController.getPayrollById);
router.delete(
    '/payroll/:id',
    hrAdminOnly,
    validateRequest(deletePayrollSchema),
    payrollController.deletePayroll
);
router.patch(
    '/payroll/:id',
    hrAdminOnly,
    validateRequest(updatePayrollSchema),
    payrollController.updatePayroll
);
router.patch(
    '/payroll/:id/status',
    hrAdminOnly,
    validateRequest(updatePayrollStatusSchema),
    payrollController.updatePayrollStatus
);

// ══════════════════════════════════════════════════════════════════════
// ANALYTICS ROUTES
// ══════════════════════════════════════════════════════════════════════
router.get('/analytics/dashboard', hrAdminOnly, payrollController.getDashboardStats);
router.get('/analytics/events', hrAdminOnly, payrollController.getUpcomingEvents);
router.get('/analytics/working-hours', payrollController.getWorkingHoursAnalytics);
router.get('/analytics/team/:managerId', payrollController.getTeamAnalytics);
router.get('/analytics/incentives/:employeeId', payrollController.getIncentiveSummary);

// ══════════════════════════════════════════════════════════════════════
// REIMBURSEMENT ROUTES
// ══════════════════════════════════════════════════════════════════════

// Employee self-service (own claims)
router.post(
    '/reimbursements',
    hrmsSelfSubmoduleOnly('reimbursements' as any),
    validateRequest(createReimbursementSchema),
    reimbursementController.createReimbursement
);
router.get('/reimbursements/me', hrmsSelfSubmoduleOnly('reimbursements' as any), reimbursementController.getMyReimbursements);
router.get('/reimbursements/me/summary', hrmsSelfSubmoduleOnly('reimbursements' as any), reimbursementController.getMyReimbursementSummary);
router.post('/reimbursements/:id/submit', hrmsSelfSubmoduleOnly('reimbursements' as any), validateRequest(submitReimbursementSchema), reimbursementController.submitReimbursement);
router.post('/reimbursements/:id/receipt', hrmsSelfSubmoduleOnly('reimbursements' as any), receiptUpload.single('receipt'), reimbursementController.uploadReceipt);
router.patch(
    '/reimbursements/:id',
    hrmsSelfSubmoduleOnly('reimbursements' as any),
    validateRequest(updateReimbursementSchema),
    reimbursementController.updateReimbursement
);
router.delete('/reimbursements/:id', hrmsSelfSubmoduleOnly('reimbursements' as any), reimbursementController.deleteReimbursement);

// Admin routes (HR/Admin)
// IMPORTANT: /summary and /me/* must come BEFORE /:id to avoid Express matching them as the id param
router.get('/reimbursements/summary', hrAdminOnly, reimbursementController.getReimbursementSummary);
router.get('/reimbursements/employees/overview', hrAdminOnly, reimbursementController.getEmployeesReimbursementOverview);
router.get('/reimbursements/employee/:employeeId', hrAdminOnly, reimbursementController.getReimbursementsByEmployee);
router.get(
    '/reimbursements',
    hrAdminOnly,
    (req, _res, next) => { req.isHrmsAdmin = true; next(); },
    reimbursementController.getReimbursements
);
// Single claim — accessible by the owning employee OR any HRMS admin
router.get(
    '/reimbursements/:id',
    (req, _res, next) => {
        if (req.user) {
            const { hasModuleAdminAccess } = require('../../../utils/moduleAccess.util');
            req.isHrmsAdmin = hasModuleAdminAccess(req.user, 'hrms');
        }
        next();
    },
    reimbursementController.getReimbursementById
);
router.patch(
    '/reimbursements/:id/status',
    hrAdminOnly,
    validateRequest(updateReimbursementStatusSchema),
    reimbursementController.updateReimbursementStatus
);

export default router;
