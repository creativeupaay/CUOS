import { Employee } from '../models/Employee.model';
import { Leave } from '../models/Leave.model';
import { Payroll } from '../models/Payroll.model';
import { Incentive } from '../models/Incentive.model';
import { TimeLog } from '../../project/models/TimeLog.model';
import AppError from '../../../utils/appError';

class AnalyticsService {
    /**
     * Dashboard analytics for HRMS overview.
     */
    async getDashboardStats() {
        const [
            totalEmployees,
            activeEmployees,
            onNotice,
            departments,
            pendingLeaves,
            onboardingCount,
        ] = await Promise.all([
            Employee.countDocuments(),
            Employee.countDocuments({ status: 'active' }),
            Employee.countDocuments({ status: 'on-notice' }),
            Employee.aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: '$department', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            Leave.countDocuments({ status: 'pending' }),
            Employee.countDocuments({ 'onboarding.status': { $in: ['not-started', 'in-progress'] } }),
        ]);

        return {
            totalEmployees,
            activeEmployees,
            onNotice,
            departments,
            pendingLeaves,
            onboardingCount,
        };
    }

    /**
     * Working hours analytics for an employee in a date range.
     * Pulls data from Project Management TimeLog.
     */
    async getWorkingHoursAnalytics(
        userId: string,
        startDate: Date,
        endDate: Date
    ) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found', 404);

        // Daily breakdown
        const dailyHours = await TimeLog.aggregate([
            {
                $match: {
                    userId: employee.userId,
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    totalMinutes: { $sum: '$duration' },
                    entries: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Summary
        const totalMinutes = dailyHours.reduce((sum, d) => sum + d.totalMinutes, 0);
        const totalHours = totalMinutes / 60;
        const daysLogged = dailyHours.length;
        const avgHoursPerDay = daysLogged > 0 ? totalHours / daysLogged : 0;

        const expectedHoursPerDay = employee.workSchedule.hoursPerDay;
        const expectedTotalHours = daysLogged * expectedHoursPerDay;
        const efficiency = expectedTotalHours > 0 ? (totalHours / expectedTotalHours) * 100 : 0;

        return {
            employee: {
                id: employee._id,
                employeeId: employee.employeeId,
                name: (employee as any).userId?.name,
            },
            summary: {
                totalHours: Math.round(totalHours * 100) / 100,
                daysLogged,
                avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
                expectedHoursPerDay,
                efficiency: Math.round(efficiency * 100) / 100,
            },
            dailyBreakdown: dailyHours.map((d) => ({
                date: d._id,
                hours: Math.round((d.totalMinutes / 60) * 100) / 100,
                entries: d.entries,
            })),
        };
    }

    /**
     * Team working hours summary for a manager.
     */
    async getTeamAnalytics(managerId: string, month: number, year: number) {
        const teamMembers = await Employee.find({ reportingTo: managerId })
            .populate('userId', 'name email');

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const teamAnalytics = await Promise.all(
            teamMembers.map(async (member) => {
                const timeLogs = await TimeLog.aggregate([
                    {
                        $match: {
                            userId: member.userId,
                            date: { $gte: startDate, $lte: endDate },
                        },
                    },
                    {
                        $group: {
                            _id: null,
                            totalMinutes: { $sum: '$duration' },
                            days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } },
                        },
                    },
                ]);

                const totalHours = timeLogs.length > 0 ? timeLogs[0].totalMinutes / 60 : 0;
                const daysWorked = timeLogs.length > 0 ? timeLogs[0].days.length : 0;

                // Get leave count
                const leaveDays = await Leave.aggregate([
                    {
                        $match: {
                            employeeId: member._id,
                            status: 'approved',
                            startDate: { $gte: startDate, $lte: endDate },
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$days' } } },
                ]);

                return {
                    employee: {
                        id: member._id,
                        employeeId: member.employeeId,
                        name: (member.userId as any)?.name,
                        designation: member.designation,
                    },
                    totalHours: Math.round(totalHours * 100) / 100,
                    daysWorked,
                    leaveDays: leaveDays.length > 0 ? leaveDays[0].total : 0,
                };
            })
        );

        return teamAnalytics;
    }

    /**
     * Upcoming events for the HRMS dashboard:
     * - Employee birthdays in next 30 days
     * - Probation periods ending in next 30 days
     * - Employees without payroll for current month (salary due reminder)
     */
    async getUpcomingEvents() {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // All active employees with personal info
        const employees = await Employee.find({ status: 'active' })
            .populate('userId', 'name email')
            .lean();

        const events: Array<{
            type: 'birthday' | 'probation' | 'salary';
            title: string;
            subtitle: string;
            date: Date;
            daysUntil: number;
            employeeId: string;
        }> = [];

        for (const emp of employees) {
            const name = (emp.userId as any)?.name || emp.employeeId;

            // ── Birthdays ──────────────────────────────────
            if (emp.personalInfo?.dob) {
                const dob = new Date(emp.personalInfo.dob);
                // Create birth date for this year
                const thisYearBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
                // If already passed this year, check next year
                if (thisYearBirthday < today) {
                    thisYearBirthday.setFullYear(currentYear + 1);
                }
                const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntil <= 30) {
                    events.push({
                        type: 'birthday',
                        title: `${name}'s Birthday`,
                        subtitle: daysUntil === 0 ? 'Today! 🎂' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`,
                        date: thisYearBirthday,
                        daysUntil,
                        employeeId: emp._id.toString(),
                    });
                }
            }

            // ── Probation endings ──────────────────────────
            if (emp.probationEndDate) {
                const probEnd = new Date(emp.probationEndDate);
                const daysUntil = Math.ceil((probEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysUntil >= 0 && daysUntil <= 30) {
                    events.push({
                        type: 'probation',
                        title: `${name}'s Probation Ending`,
                        subtitle: daysUntil === 0 ? 'Ends today' : daysUntil === 1 ? 'Ends tomorrow' : `Ends in ${daysUntil} days`,
                        date: probEnd,
                        daysUntil,
                        employeeId: emp._id.toString(),
                    });
                }
            }
        }

        // ── Salary cycle reminder ──────────────────────────
        // Count employees without payroll for current month
        const { Payroll } = await import('../models/Payroll.model');
        const paidThisMonth = await Payroll.distinct('employeeId', {
            month: currentMonth,
            year: currentYear,
        });
        const unpaidCount = employees.length - paidThisMonth.length;
        if (unpaidCount > 0) {
            const salaryDueDate = new Date(currentYear, currentMonth - 1, 28); // 28th of month
            const daysUntil = Math.ceil((salaryDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            events.push({
                type: 'salary',
                title: `Salary Due — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
                subtitle: `${unpaidCount} employee${unpaidCount > 1 ? 's' : ''} pending payroll`,
                date: salaryDueDate,
                daysUntil: Math.max(daysUntil, 0),
                employeeId: '',
            });
        }

        // Sort by daysUntil ascending
        events.sort((a, b) => a.daysUntil - b.daysUntil);

        return events.slice(0, 10); // Return top 10 upcoming events
    }

    /**
     * Incentive summary for an employee.
     */
    async getIncentiveSummary(employeeId: string, month: number, year: number) {
        const incentives = await Incentive.find({ employeeId, month, year })
            .populate('taskId', 'title')
            .populate('projectId', 'name');

        const bonuses = incentives.filter((i) => i.type === 'bonus');
        const penalties = incentives.filter((i) => i.type === 'penalty');

        return {
            incentives,
            summary: {
                totalBonusScore: bonuses.reduce((sum, b) => sum + b.score, 0),
                totalBonusAmount: bonuses.reduce((sum, b) => sum + b.amount, 0),
                totalPenaltyScore: penalties.reduce((sum, p) => sum + Math.abs(p.score), 0),
                totalPenaltyAmount: penalties.reduce((sum, p) => sum + p.amount, 0),
                netScore: incentives.reduce((sum, i) => sum + i.score, 0),
                taskCount: incentives.length,
            },
        };
    }
}

export const analyticsService = new AnalyticsService();
