import { Holiday, IHoliday } from '../models/Holiday.model';
import { Employee } from '../models/Employee.model';
import { Attendance } from '../models/Attendance.model';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';
import { notificationService } from '../../notification/services/notification.service';

class HolidayService {
    /**
     * Create a holiday and (optionally) auto-mark attendance for all active employees.
     * Supports single dates or date ranges.
     */
    async createHoliday(
        data: {
            name: string;
            date?: string; // Legacy/single date
            startDate?: string;
            endDate?: string;
            type: 'holiday' | 'half-day' | 'wfh';
            description?: string;
            isPaid: boolean;
        },
        createdByUserId: string
    ): Promise<IHoliday | IHoliday[]> {
        const startStr = data.startDate || data.date;
        if (!startStr) throw new AppError('Date or Start Date is required', 400);

        const endStr = data.endDate || startStr;

        const [sy, sm, sd] = startStr.split('-').map(Number);
        const [ey, em, ed] = endStr.split('-').map(Number);

        const startDate = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(ey, em - 1, ed, 0, 0, 0, 0));

        if (endDate < startDate) {
            throw new AppError('End date cannot be before start date', 400);
        }

        const dates: Date[] = [];
        let current = new Date(startDate);
        while (current <= endDate) {
            dates.push(new Date(current));
            current.setUTCDate(current.getUTCDate() + 1);
        }

        const createdHolidays: IHoliday[] = [];

        for (const targetDate of dates) {
            // Prevent duplicate holiday on same date + type + name
            const existing = await Holiday.findOne({
                date: targetDate,
                type: data.type,
                name: data.name,
            });
            
            if (existing) continue; // Skip duplicates in a range or existing ones

            const holiday = await Holiday.create({
                ...data,
                date: targetDate,
                createdBy: createdByUserId,
            });

            // Auto-mark attendance for all active employees
            await this.applyHolidayAttendance(holiday);
            createdHolidays.push(holiday);
        }

        if (createdHolidays.length === 0) {
            throw new AppError('All dates in the range already have this holiday declared.', 409);
        }

        // Notify all active users about the holiday (send one notification for the range)
        const activeUsers = await User.find({ isActive: true }).select('_id').lean();
        const userIds = activeUsers.map((u) => u._id as any);

        if (userIds.length > 0) {
            const rangeStr = dates.length > 1 
                ? `${startStr} to ${endStr}` 
                : startStr;
            const typeText = data.type === 'holiday' ? 'holiday' : data.type === 'wfh' ? 'WFH day' : 'half-day';

            notificationService.createBulkNotifications(userIds, {
                type: 'holiday_declared',
                title: 'Holiday Declared',
                message: `${data.name} on ${rangeStr} has been declared as a ${typeText}.`,
                link: '/hrms/holidays',
                metadata: {
                    holidayName: data.name,
                    startDate: startStr,
                    endDate: endStr,
                    type: data.type,
                },
            });
        }

        return createdHolidays.length === 1 ? createdHolidays[0] : createdHolidays;
    }

    /**
     * Apply holiday → auto-upsert attendance records for all active employees.
     */
    private async applyHolidayAttendance(holiday: IHoliday) {
        const employees = await Employee.find({ status: 'active' }).select('_id');
        if (!employees.length) return;

        // Map holiday type to attendance status
        const statusMap: Record<string, string> = {
            holiday: 'holiday',
            'half-day': 'half-day',
            wfh: 'wfh',
        };
        const attendanceStatus = statusMap[holiday.type] || 'holiday';

        const dateStr = holiday.date.toISOString().slice(0, 10);

        const ops = employees.map((emp) => ({
            updateOne: {
                filter: { employeeId: emp._id, date: holiday.date },
                update: {
                    $setOnInsert: {
                        employeeId: emp._id,
                        date: holiday.date,
                        dateStr,
                    },
                    $set: {
                        status: attendanceStatus,
                        notes: `Office Holiday: ${holiday.name}`,
                    },
                },
                upsert: true,
            },
        }));

        await Attendance.bulkWrite(ops);
    }

    async getHolidays(filters: {
        year?: number;
        month?: number;
        type?: string;
        upcoming?: boolean;
    }) {
        const query: any = {};

        if (filters.year || filters.month) {
            const year = filters.year || new Date().getFullYear();
            if (filters.month) {
                // Use UTC boundaries so date matching is consistent with UTC-stored dates
                const start = new Date(Date.UTC(year, filters.month - 1, 1, 0, 0, 0, 0));
                const end = new Date(Date.UTC(year, filters.month, 0, 23, 59, 59, 999));
                query.date = { $gte: start, $lte: end };
            } else {
                const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
                const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
                query.date = { $gte: start, $lte: end };
            }
        }

        if (filters.upcoming) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query.date = { $gte: today };
        }

        if (filters.type) query.type = filters.type;

        const holidays = await Holiday.find(query)
            .populate('createdBy', 'name')
            .sort({ date: 1 });

        return holidays;
    }

    async updateHoliday(
        id: string,
        data: Partial<{ name: string; type: string; description: string; isPaid: boolean }>
    ): Promise<IHoliday> {
        const holiday = await Holiday.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        if (!holiday) throw new AppError('Holiday not found', 404);
        return holiday;
    }

    async deleteHoliday(id: string): Promise<void> {
        const holiday = await Holiday.findById(id);
        if (!holiday) throw new AppError('Holiday not found', 404);

        // Remove the auto-applied attendance records for this holiday
        await Attendance.deleteMany({
            date: holiday.date,
            notes: `Office Holiday: ${holiday.name}`
        });

        await holiday.deleteOne();
    }
}

export const holidayService = new HolidayService();
