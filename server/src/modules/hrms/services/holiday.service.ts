import { Holiday, IHoliday } from '../models/Holiday.model';
import { Employee } from '../models/Employee.model';
import { Attendance } from '../models/Attendance.model';
import AppError from '../../../utils/appError';

class HolidayService {
    /**
     * Create a holiday and (optionally) auto-mark attendance for all active employees.
     */
    async createHoliday(
        data: {
            name: string;
            date: string;
            type: 'holiday' | 'half-day' | 'wfh';
            description?: string;
            isPaid: boolean;
        },
        createdByUserId: string
    ): Promise<IHoliday> {
        // Always store as UTC midnight to avoid IST server timezone shift
        const [y, m, d] = data.date.split('-').map(Number);
        const targetDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));


        // Prevent duplicate holiday on same date + type
        const existing = await Holiday.findOne({
            date: targetDate,
            type: data.type,
            name: data.name,
        });
        if (existing) {
            throw new AppError('A holiday with that name and type already exists on this date', 409);
        }

        const holiday = await Holiday.create({
            ...data,
            date: targetDate,
            createdBy: createdByUserId,
        });

        // Auto-mark attendance for all active employees
        await this.applyHolidayAttendance(holiday);

        return holiday;
    }

    /**
     * Apply holiday → auto-upsert attendance records for all active employees.
     */
    private async applyHolidayAttendance(holiday: IHoliday) {
        const employees = await Employee.find({ status: 'active' }).select('_id');
        if (!employees.length) return;

        // Map holiday type to attendance status
        const statusMap: Record<string, string> = {
            holiday: 'on-leave',
            'half-day': 'half-day',
            wfh: 'wfh',
        };
        const attendanceStatus = statusMap[holiday.type] || 'on-leave';

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
