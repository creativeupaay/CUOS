import { Payroll, IPayroll } from '../models/Payroll.model';
import { Incentive } from '../models/Incentive.model';
import { Leave } from '../models/Leave.model';
import { Employee } from '../models/Employee.model';
import { SalaryStructure } from '../models/SalaryStructure.model';
import { Attendance } from '../models/Attendance.model';
import { Task } from '../../project/models/Task.model';
import AppError from '../../../utils/appError';

class PayrollService {
    /**
     * Generate payroll for an employee for a given month/year.
     * Cross-links with:
     *   - TimeLog (working hours from Project Management)
     *   - Task (deadline-based incentive scoring)
     *   - Leave (unpaid leave deductions)
     */
    async generatePayroll(
        employeeId: string,
        month: number,
        year: number,
        generatedBy: string
    ): Promise<IPayroll> {
        // Check if payroll already exists
        const existing = await Payroll.findOne({ employeeId, month, year });
        if (existing) {
            throw new AppError('Payroll already generated for this month', 400);
        }

        // Get employee & salary
        const employee = await Employee.findById(employeeId);
        if (!employee) throw new AppError('Employee not found', 404);

        const salary = await SalaryStructure.findOne({ employeeId });
        if (!salary) throw new AppError('Salary structure not found for employee', 404);

        // ── Date range for the month ────────────────────────────────
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // ── Working hours from Attendance ──────────────────────────────
        const attendanceLogs = await Attendance.aggregate([
            {
                $match: {
                    employeeId: employee._id,
                    date: { $gte: startDate, $lte: endDate },
                    status: { $in: ['present', 'half-day'] },
                },
            },
            {
                $group: {
                    _id: null,
                    totalHours: { $sum: '$totalHours' },
                    distinctDays: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } },
                },
            },
        ]);

        const totalHoursWorked = attendanceLogs.length > 0 ? attendanceLogs[0].totalHours : 0;
        const presentDays = attendanceLogs.length > 0 ? attendanceLogs[0].distinctDays.length : 0;

        // Calculate working days (business days in month)
        const workingDays = this.getWorkingDaysInMonth(year, month, employee.workSchedule.workingDaysPerWeek);
        const expectedHours = workingDays * employee.workSchedule.hoursPerDay;
        const overtime = Math.max(0, totalHoursWorked - expectedHours);

        // ── Incentive scoring from Tasks ────────────────────────────
        const { incentiveAmount, penaltyAmount, incentiveRecords } = await this.calculateIncentives(
            employee.userId.toString(),
            employeeId,
            month,
            year,
            startDate,
            endDate,
            salary.basic
        );

        // Save incentive records
        if (incentiveRecords.length > 0) {
            await Incentive.insertMany(incentiveRecords);
        }

        // ── Leave deductions ────────────────────────────────────────
        const unpaidLeaves = await Leave.aggregate([
            {
                $match: {
                    employeeId: employee._id,
                    type: 'unpaid',
                    status: 'approved',
                    startDate: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: null,
                    totalDays: { $sum: '$days' },
                },
            },
        ]);

        const unpaidLeaveDays = unpaidLeaves.length > 0 ? unpaidLeaves[0].totalDays : 0;
        const leaveDeduction = (employee.employmentType !== 'contract' && workingDays > 0)
            ? (salary.basic / workingDays) * unpaidLeaveDays
            : 0;

        // ── Calculate salary ────────────────────────────────────────
        let grossSalary = 0;
        let basicComponent = 0;

        if (employee.employmentType === 'contract' && salary.hourlyRate > 0) {
            grossSalary = totalHoursWorked * salary.hourlyRate;
            basicComponent = grossSalary;
        } else {
            grossSalary = salary.basic + salary.hra + salary.da + salary.specialAllowance;
            basicComponent = salary.basic;
        }

        // Statutory deductions
        // PF and ESI are currently not deducted — set to 0
        const pfDeduction = 0;
        const esiDeduction = 0;
        const taxDeduction = salary.deductions.tax || 0;

        const totalDeductions = pfDeduction + esiDeduction + taxDeduction + leaveDeduction + penaltyAmount;

        const netSalary = grossSalary + incentiveAmount - totalDeductions;

        // ── Create payroll record ───────────────────────────────────
        const payroll = await Payroll.create({
            employeeId,
            month,
            year,
            workingDays,
            presentDays,
            totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
            overtime: Math.round(overtime * 100) / 100,
            grossSalary,
            incentiveAmount: Math.round(incentiveAmount * 100) / 100,
            penaltyAmount: Math.round(penaltyAmount * 100) / 100,
            deductions: {
                pf: Math.round(pfDeduction * 100) / 100,
                esi: Math.round(esiDeduction * 100) / 100,
                tax: Math.round(taxDeduction * 100) / 100,
                leaves: Math.round(leaveDeduction * 100) / 100,
                penalties: Math.round(penaltyAmount * 100) / 100,
                other: salary.deductions.other || 0,
            },
            netSalary: Math.round(netSalary * 100) / 100,
            generatedBy,
        });

        return payroll;
    }

    /**
     * Bulk generate payroll for ALL active employees for a given month/year.
     * Skips employees who already have payroll or who have no salary structure.
     */
    async generateBulkPayroll(
        month: number,
        year: number,
        generatedBy: string
    ): Promise<{ generated: number; skipped: number; failed: number; errors: string[] }> {
        // Fetch all active employees
        const employees = await Employee.find({ status: { $in: ['active', 'probation'] } });

        let generated = 0;
        let skipped = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const emp of employees) {
            try {
                // Skip if payroll already exists for this period
                const existing = await Payroll.findOne({ employeeId: emp._id, month, year });
                if (existing) { skipped++; continue; }

                // Skip if no salary structure
                const salary = await SalaryStructure.findOne({ employeeId: emp._id });
                if (!salary) { skipped++; continue; }

                await this.generatePayroll(emp._id.toString(), month, year, generatedBy);
                generated++;
            } catch (err: any) {
                failed++;
                const empName = emp.employeeId || emp._id.toString();
                errors.push(`${empName}: ${err.message || 'Unknown error'}`);
            }
        }

        return { generated, skipped, failed, errors };
    }

    /**
     * Deadline-based incentive scoring from Tasks.
     */
    private async calculateIncentives(
        userId: string,
        employeeId: string,
        month: number,
        year: number,
        startDate: Date,
        endDate: Date,
        basicSalary: number
    ) {
        // Get tasks assigned to user that were completed or overdue in this month
        const tasks = await Task.find({
            assignees: userId,
            $or: [
                { completedAt: { $gte: startDate, $lte: endDate } },
                { deadline: { $gte: startDate, $lte: endDate }, status: { $ne: 'completed' } },
            ],
        }).populate('projectId', 'name');

        let totalScore = 0;
        const incentiveRecords: any[] = [];

        for (const task of tasks) {
            let score = 0;
            let type: 'bonus' | 'penalty' = 'bonus';
            let reason = '';

            if (task.status === 'completed' && task.completedAt && task.deadline) {
                const diffDays = (task.completedAt.getTime() - task.deadline.getTime()) / (1000 * 60 * 60 * 24);

                if (diffDays <= 0) {
                    score = 10;
                    type = 'bonus';
                    reason = `Task "${task.title}" completed on time`;
                } else if (diffDays <= 3) {
                    score = 0;
                    reason = `Task "${task.title}" completed within grace period`;
                } else {
                    score = -5;
                    type = 'penalty';
                    reason = `Task "${task.title}" completed ${Math.round(diffDays)} days late`;
                }
            } else if (task.deadline && new Date() > task.deadline && task.status !== 'completed') {
                score = -10;
                type = 'penalty';
                reason = `Task "${task.title}" overdue and incomplete`;
            }

            if (score !== 0) {
                totalScore += score;
                incentiveRecords.push({
                    employeeId,
                    taskId: task._id,
                    projectId: task.projectId,
                    month,
                    year,
                    type,
                    score,
                    amount: Math.abs(score) * basicSalary * 0.005,
                    reason,
                    calculatedAt: new Date(),
                });
            }
        }

        const incentiveAmount = totalScore > 0 ? totalScore * basicSalary * 0.005 : 0;
        const penaltyAmount = totalScore < 0 ? Math.abs(totalScore) * basicSalary * 0.003 : 0;

        return { incentiveAmount, penaltyAmount, incentiveRecords };
    }

    private getWorkingDaysInMonth(year: number, month: number, workingDaysPerWeek: number): number {
        const daysInMonth = new Date(year, month, 0).getDate();
        let workingDays = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            // 0 = Sun, 6 = Sat
            if (workingDaysPerWeek >= 6) {
                if (dayOfWeek !== 0) workingDays++; // 6-day week: skip Sunday
            } else {
                if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++; // 5-day week: skip Sat+Sun
            }
        }

        return workingDays;
    }

    async getPayrolls(filters: {
        month?: number;
        year?: number;
        status?: string;
        page?: number;
        limit?: number;
    }) {
        const { month, year, status, page = 1, limit = 20 } = filters;
        const query: any = {};

        if (month) query.month = month;
        if (year) query.year = year;
        if (status) query.status = status;

        const skip = (page - 1) * limit;
        const [payrolls, total] = await Promise.all([
            Payroll.find(query)
                .populate({
                    path: 'employeeId',
                    populate: { path: 'userId', select: 'name email' },
                })
                .sort({ year: -1, month: -1 })
                .skip(skip)
                .limit(limit),
            Payroll.countDocuments(query),
        ]);

        return {
            payrolls,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    }

    async getPayrollById(id: string): Promise<IPayroll> {
        const payroll = await Payroll.findById(id)
            .populate({
                path: 'employeeId',
                populate: { path: 'userId', select: 'name email' },
            });

        if (!payroll) throw new AppError('Payroll not found', 404);
        return payroll;
    }

    async updatePayrollStatus(
        id: string,
        status: 'approved' | 'paid',
        userId: string
    ): Promise<IPayroll> {
        const payroll = await Payroll.findById(id);
        if (!payroll) throw new AppError('Payroll not found', 404);

        if (status === 'approved' && payroll.status !== 'draft') {
            throw new AppError('Only draft payrolls can be approved', 400);
        }
        if (status === 'paid' && payroll.status !== 'approved') {
            throw new AppError('Only approved payrolls can be marked as paid', 400);
        }

        payroll.status = status;
        if (status === 'approved') payroll.approvedBy = userId as any;
        if (status === 'paid') payroll.paidAt = new Date();

        await payroll.save();
        return payroll;
    }

    // ── Employee: fetch own payslips ──────────────────────────────────
    async getMyPayrolls(userId: string): Promise<IPayroll[]> {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee record not found', 404);

        return Payroll.find({ employeeId: employee._id })
            .populate({
                path: 'employeeId',
                populate: { path: 'userId', select: 'name email' },
            })
            .sort({ year: -1, month: -1 });
    }
}

export const payrollService = new PayrollService();

