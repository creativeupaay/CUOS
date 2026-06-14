import { Payroll, IPayroll } from '../models/Payroll.model';
import { Employee } from '../models/Employee.model';
import { SalaryStructure } from '../models/SalaryStructure.model';
import { Attendance } from '../models/Attendance.model';
import { Task } from '../../project/models/Task.model';
import { Types } from 'mongoose';
import { BankTransaction } from '../../finance/models/BankTransaction.model';
import { BankTransactionService } from '../../finance/services/bankTransaction.service';
import { ExpenseService } from '../../finance/services/expense.service';
import AppError from '../../../utils/appError';
import { ArchiveDeleteOptions, DeletedRecordService, DeleteGraphResult, DeleteGraphService } from '../../archive';

const getGraphNodeIds = (graph: DeleteGraphResult, relationship: string): Types.ObjectId[] => (
    graph.nodes.find((node) => node.relationship === relationship)?.sourceIds ?? []
);

class PayrollService {
    private getArchiveBatchId(options: ArchiveDeleteOptions = {}): string {
        return options.archiveBatchId ?? DeletedRecordService.generateArchiveBatchId();
    }

    private calculateNetSalary(payroll: IPayroll): number {
        const totalDeductions = (payroll.deductions.pf || 0)
            + (payroll.deductions.esi || 0)
            + (payroll.deductions.tax || 0)
            + (payroll.deductions.leaves || 0)
            + (payroll.deductions.penalties || 0)
            + (payroll.deductions.other || 0);

        return Math.round((payroll.grossSalary + (payroll.incentiveAmount || 0) - totalDeductions) * 100) / 100;
    }

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
        generatedBy: string,
        payDate?: string | Date
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

        // Incentives/penalties are intentionally excluded from payslip net salary.
        const incentiveAmount = 0;
        const penaltyAmount = 0;

        // ── Calculate salary ────────────────────────────────────────
        let grossSalary = 0;
        let basicComponent = 0;
        let payableDays = 30;

        if (employee.employmentType === 'contract' && salary.hourlyRate > 0) {
            grossSalary = totalHoursWorked * salary.hourlyRate;
            basicComponent = grossSalary;
        } else {
            const monthlySalary = salary.basic + salary.specialAllowance;
            basicComponent = salary.basic;
            payableDays = this.calculatePayableDays(employee.joiningDate, salary.effectiveFrom, month, year);
            grossSalary = (monthlySalary / 30) * payableDays;
        }

        // Statutory deductions
        // PF and ESI are currently not deducted — set to 0
        const pfDeduction = 0;
        const esiDeduction = 0;
        const taxDeduction = salary.deductions.tax || 0;
        const otherDeduction = salary.deductions.other || 0;

        const totalDeductions = pfDeduction + esiDeduction + taxDeduction + otherDeduction;

        const netSalary = grossSalary + incentiveAmount - totalDeductions;

        // ── Create payroll record ───────────────────────────────────
        const resolvedPayDate = payDate ? new Date(payDate) : new Date(year, month, 1);

        const payroll = await Payroll.create({
            employeeId,
            month,
            year,
            payDate: resolvedPayDate,
            workingDays,
            presentDays,
            totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
            overtime: Math.round(overtime * 100) / 100,
            grossSalary: Math.round(grossSalary * 100) / 100,
            payableDays,
            incentiveAmount: Math.round(incentiveAmount * 100) / 100,
            penaltyAmount: Math.round(penaltyAmount * 100) / 100,
            deductions: {
                pf: Math.round(pfDeduction * 100) / 100,
                esi: Math.round(esiDeduction * 100) / 100,
                tax: Math.round(taxDeduction * 100) / 100,
                leaves: 0,
                penalties: Math.round(penaltyAmount * 100) / 100,
                other: Math.round(otherDeduction * 100) / 100,
            },
            netSalary: Math.round(netSalary * 100) / 100,
            ...(salary.payoutAccountKey ? { payoutAccountKey: salary.payoutAccountKey } : {}),
            status: salary.payoutAccountKey ? 'draft' : 'pending_account',
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
        generatedBy: string,
        payDate?: string | Date
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

                await this.generatePayroll(emp._id.toString(), month, year, generatedBy, payDate);
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

    private calculatePayableDays(
        joiningDate: Date,
        salaryEffectiveFrom: Date,
        month: number,
        year: number
    ): number {
        const periodStart = new Date(year, month - 1, 1);
        const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
        const payableFrom = new Date(
            Math.max(
                new Date(joiningDate).getTime(),
                new Date(salaryEffectiveFrom).getTime(),
                periodStart.getTime()
            )
        );

        if (payableFrom > periodEnd) {
            return 0;
        }

        if (payableFrom.getMonth() !== month - 1 || payableFrom.getFullYear() !== year) {
            return 30;
        }

        const effectiveDay = payableFrom.getDate();
        if (effectiveDay <= 1) {
            return 30;
        }

        // Company payroll uses a 30-day basis and expects 15th -> 15 payable days.
        return Math.max(1, 30 - effectiveDay);
    }

    private getMonthLabel(month: number): string {
        return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'short' });
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

    async deletePayroll(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const payroll = await Payroll.findById(id);
        if (!payroll) throw new AppError('Payroll not found', 404);

        const archiveBatchId = this.getArchiveBatchId(options);
        const graph = await DeleteGraphService.archiveGraph('Payroll', payroll._id, {
            archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Payroll delete requested',
            session: options.session,
            metadata: {
                ...options.metadata,
                payrollId: payroll._id.toString(),
                employeeId: payroll.employeeId.toString(),
                month: payroll.month,
                year: payroll.year,
                status: payroll.status,
            },
        });

        const expenseIds = getGraphNodeIds(graph, 'payroll_expenses');
        for (const expenseId of expenseIds) {
            await ExpenseService.delete(expenseId, {
                ...options,
                archiveBatchId,
                reason: options.reason ?? 'Payroll delete requested',
                skipArchive: true,
                metadata: {
                    ...options.metadata,
                    payrollId: payroll._id.toString(),
                    linkedFrom: 'Payroll',
                },
            });
        }

        const bankTransactionIds = getGraphNodeIds(graph, 'payroll_bank_transactions');
        for (const bankTransactionId of bankTransactionIds) {
            await BankTransactionService.delete(bankTransactionId, {
                ...options,
                archiveBatchId,
                reason: options.reason ?? 'Payroll delete requested',
                skipArchive: true,
                metadata: {
                    ...options.metadata,
                    payrollId: payroll._id.toString(),
                    linkedFrom: 'Payroll',
                },
            });
        }

        await payroll.deleteOne(options.session ? { session: options.session } : undefined);
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
        if (status === 'paid') {
            payroll.paidAt = new Date();

            const employee = await Employee.findById(payroll.employeeId).populate('userId', 'name');
            const employeeName = (employee?.userId as any)?.name || employee?.employeeId || 'Employee';

            let payoutTransaction = await BankTransaction.findOne({ payrollId: payroll._id });
            if (!payoutTransaction) {
                const createdTransaction = await BankTransactionService.create({
                    accountKey: payroll.payoutAccountKey || 'hdfc_gst',
                    transactionType: 'debit',
                    amount: payroll.netSalary,
                    date: payroll.paidAt,
                    description: `Salary payout - ${employeeName} (${this.getMonthLabel(payroll.month)} ${payroll.year})`,
                    notes: `Payroll payment for ${this.getMonthLabel(payroll.month)} ${payroll.year}`,
                    source: 'automatic',
                    payrollId: payroll._id as Types.ObjectId,
                    createdBy: new Types.ObjectId(userId),
                });
                payoutTransaction = await BankTransaction.findById(createdTransaction._id);
            }

            if (employee?._id) {
                await ExpenseService.upsertPayrollSalaryExpense({
                    payrollId: payroll._id as Types.ObjectId,
                    employeeId: employee._id as Types.ObjectId,
                    employeeName,
                    month: payroll.month,
                    year: payroll.year,
                    amount: payroll.netSalary,
                    paidAt: payroll.paidAt,
                    sourceAccountKey: payroll.payoutAccountKey,
                    bankTransactionId: payoutTransaction?._id as Types.ObjectId | undefined,
                    createdBy: new Types.ObjectId(userId),
                    updatedBy: new Types.ObjectId(userId),
                });
            }
        }

        await payroll.save();
        return payroll;
    }

    async updatePayroll(
        id: string,
        data: {
            incentiveAmount?: number;
            payoutAccountKey?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
            deductions?: { tax?: number; other?: number };
        },
        userId: string
    ): Promise<IPayroll> {
        const payroll = await Payroll.findById(id);
        if (!payroll) throw new AppError('Payroll not found', 404);

        if (data.incentiveAmount !== undefined) {
            payroll.incentiveAmount = Math.round(data.incentiveAmount * 100) / 100;
        }

        if (data.payoutAccountKey !== undefined) {
            payroll.payoutAccountKey = data.payoutAccountKey;
        }

        if (data.deductions?.tax !== undefined) {
            payroll.deductions.tax = Math.round(data.deductions.tax * 100) / 100;
        }

        if (data.deductions?.other !== undefined) {
            payroll.deductions.other = Math.round(data.deductions.other * 100) / 100;
        }

        payroll.netSalary = this.calculateNetSalary(payroll);

        await payroll.save();

        if (payroll.status === 'paid') {
            const employee = await Employee.findById(payroll.employeeId).populate('userId', 'name');
            const employeeName = (employee?.userId as any)?.name || employee?.employeeId || 'Employee';
            const linkedTransaction = await BankTransaction.findOne({ payrollId: payroll._id });
            if (linkedTransaction) {
                await BankTransactionService.update(linkedTransaction._id, {
                    accountKey: payroll.payoutAccountKey,
                    transactionType: 'debit',
                    amount: payroll.netSalary,
                    date: payroll.paidAt || new Date(),
                    description: linkedTransaction.description,
                    notes: `Payroll payment for ${this.getMonthLabel(payroll.month)} ${payroll.year}`,
                    source: 'automatic',
                    updatedBy: new Types.ObjectId(userId),
                });
            }

            if (employee?._id) {
                await ExpenseService.upsertPayrollSalaryExpense({
                    payrollId: payroll._id as Types.ObjectId,
                    employeeId: employee._id as Types.ObjectId,
                    employeeName,
                    month: payroll.month,
                    year: payroll.year,
                    amount: payroll.netSalary,
                    paidAt: payroll.paidAt,
                    sourceAccountKey: payroll.payoutAccountKey,
                    bankTransactionId: linkedTransaction?._id as Types.ObjectId | undefined,
                    createdBy: new Types.ObjectId(userId),
                    updatedBy: new Types.ObjectId(userId),
                });
            }
        }

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
