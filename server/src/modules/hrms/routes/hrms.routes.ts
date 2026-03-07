import { Router } from 'express';
import { authenticate } from '../../auth/middlewares/authenticate.middleware';
import { validateRequest } from '../../../middlewares/validateRequest';
import { checkHrmsAccess, hrAdminOnly } from '../middlewares/hrmsAccess.middleware';

// Validators
import { createEmployeeSchema, updateEmployeeSchema } from '../validators/employee.validator';
import { createSalarySchema, updateSalarySchema } from '../validators/salary.validator';
import { createLeaveSchema, updateLeaveStatusSchema } from '../validators/leave.validator';
import { generatePayrollSchema, generateBulkPayrollSchema, updatePayrollStatusSchema } from '../validators/payroll.validator';

import { checkInSchema, checkOutSchema } from '../validators/attendance.validator';

// Controllers
import * as employeeController from '../controllers/employee.controller';
import * as salaryController from '../controllers/salary.controller';
import * as leaveController from '../controllers/leave.controller';
import * as payrollController from '../controllers/payroll.controller';
import * as attendanceController from '../controllers/attendance.controller';
import * as holidayController from '../controllers/holiday.controller';


const router = Router();

// All HRMS routes require authentication
router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════
// EMPLOYEE ROUTES
// ══════════════════════════════════════════════════════════════════════
router.get('/employees/me', employeeController.getMyProfile);
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
router.delete('/employees/:id', hrAdminOnly, employeeController.deleteEmployee);
router.patch(
    '/employees/:id/onboarding',
    hrAdminOnly,
    employeeController.updateOnboardingChecklist
);

// Self-onboarding form management
router.post('/employees/:id/generate-form-token', hrAdminOnly, employeeController.generateFormToken);
router.get('/employees/:id/identity-document', hrAdminOnly, employeeController.getIdentityDocumentUrl);

// ══════════════════════════════════════════════════════════════════════
// ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════════════════════
router.post(
    '/attendance/check-in',
    validateRequest(checkInSchema),
    attendanceController.checkIn
);
router.post(
    '/attendance/check-out',
    validateRequest(checkOutSchema),
    attendanceController.checkOut
);
router.get('/attendance/me', attendanceController.getMyAttendance);
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
    validateRequest(createLeaveSchema),
    leaveController.createLeave
);
router.get('/leaves/me', leaveController.getMyLeaves);
router.get('/leaves/balance', leaveController.getLeaveBalance);
router.get('/leaves', hrAdminOnly, leaveController.getLeaves);
router.get('/leaves/:id', leaveController.getLeaveById);
router.patch(
    '/leaves/:id/status',
    hrAdminOnly,
    validateRequest(updateLeaveStatusSchema),
    leaveController.updateLeaveStatus
);

// ══════════════════════════════════════════════════════════════════════
// HOLIDAY ROUTES
// ══════════════════════════════════════════════════════════════════════
router.post('/holidays', hrAdminOnly, holidayController.createHoliday);
router.get('/holidays', holidayController.getHolidays);
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
router.get('/payroll/me', payrollController.getMyPayrolls);
router.get('/payroll/:id', checkHrmsAccess(true), payrollController.getPayrollById);
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

export default router;
