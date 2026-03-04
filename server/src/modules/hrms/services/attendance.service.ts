import { Attendance } from '../models/Attendance.model';
import { Employee } from '../models/Employee.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';

export class AttendanceService {
    static async checkIn(userId: string, data: any) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Check if already checked in today
        const existingAttendance = await Attendance.findOne({
            employeeId: employee._id,
            date: today,
        });

        if (existingAttendance) {
            throw new AppError('Already checked in today', 400);
        }

        const attendance = await Attendance.create({
            employeeId: employee._id,
            date: today,
            checkIn: new Date(),
            status: 'present',
            ...data,
        });

        return attendance;
    }

    static async checkOut(userId: string, data: any) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await Attendance.findOne({
            employeeId: employee._id,
            date: today,
        });

        if (!attendance) {
            throw new AppError('No check-in record found for today', 400);
        }
        if (attendance.checkOut) {
            throw new AppError('Already checked out today', 400);
        }

        const checkOutTime = new Date();
        const checkInTime = attendance.checkIn || checkOutTime;

        // Calculate total hours
        const diffInMs = checkOutTime.getTime() - checkInTime.getTime();
        const totalHours = diffInMs / (1000 * 60 * 60);

        attendance.checkOut = checkOutTime;
        attendance.totalHours = Number(totalHours.toFixed(2));
        if (data.notes) {
            attendance.notes = attendance.notes ? `${attendance.notes}\n${data.notes}` : data.notes;
        }

        await attendance.save();
        return attendance;
    }

    static async getMyAttendance(userId: string, startDate?: string, endDate?: string) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        const query: any = { employeeId: employee._id };
        if (startDate && endDate) {
            // Use Date.UTC to avoid IST server timezone shifting dates by -5:30
            const [sy, sm, sd] = startDate.split('-').map(Number);
            const [ey, em, ed] = endDate.split('-').map(Number);
            const start = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0));
            const end = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
            query.date = { $gte: start, $lte: end };
        }

        return Attendance.find(query).sort({ date: 1 });
    }

    static async getEmployeeAttendance(employeeId: string, startDate?: string, endDate?: string) {
        const query: any = { employeeId: new Types.ObjectId(employeeId) };
        if (startDate && endDate) {
            const [sy, sm, sd] = startDate.split('-').map(Number);
            const [ey, em, ed] = endDate.split('-').map(Number);
            const start = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0));
            const end = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
            query.date = { $gte: start, $lte: end };
        }

        return Attendance.find(query).sort({ date: 1 });
    }


    // ── Admin: Bulk mark attendance for a single date ─────────────────
    static async bulkMarkAttendance(
        date: string,
        records: Array<{ employeeId: string; status: string; notes?: string }>
    ) {
        // Always use Date.UTC so the date is stored as UTC midnight,
        // regardless of the server's local timezone (e.g. IST = UTC+5:30)
        const [y, m, d] = date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        // 9 AM IST = 03:30 UTC
        const checkInTime = new Date(Date.UTC(y, m - 1, d, 3, 30, 0, 0));

        // Separate clear vs upsert operations
        const clearIds: Types.ObjectId[] = [];
        const upsertOps: any[] = [];

        for (const r of records) {
            if (r.status === 'clear') {
                clearIds.push(new Types.ObjectId(r.employeeId));
            } else {
                upsertOps.push({
                    updateOne: {
                        filter: {
                            employeeId: new Types.ObjectId(r.employeeId),
                            date: dateObj,
                        },
                        update: {
                            $set: {
                                status: r.status,
                                notes: r.notes || '',
                                ...((['present', 'wfh', 'half-day'].includes(r.status)) && {
                                    checkIn: checkInTime,
                                }),
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }

        let deleted = 0;
        if (clearIds.length > 0) {
            const res = await Attendance.deleteMany({
                employeeId: { $in: clearIds },
                date: dateObj,
            });
            deleted = res.deletedCount;
        }

        if (upsertOps.length > 0) {
            await Attendance.bulkWrite(upsertOps);
        }

        return { saved: upsertOps.length, cleared: deleted };
    }

    // ── Admin: Today's overview — all employees + their status ────────
    static async getDailyOverview(date?: string) {
        let dateObj: Date;
        if (date) {
            const [y, m, d] = date.split('-').map(Number);
            dateObj = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        } else {
            // Use today in UTC
            const now = new Date();
            dateObj = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        }
        const dateEnd = new Date(dateObj.getTime() + 24 * 60 * 60 * 1000 - 1);

        const [employees, attendanceRecords] = await Promise.all([
            Employee.find({ status: { $ne: 'terminated' } }).populate('userId', 'name email').lean(),
            Attendance.find({ date: { $gte: dateObj, $lte: dateEnd } }).lean(),
        ]);

        const attendanceMap = new Map(
            attendanceRecords.map((a) => [a.employeeId.toString(), a])
        );

        const overview = employees.map((emp) => {
            const record = attendanceMap.get(emp._id.toString());
            return {
                employeeId: emp._id,
                employeeCode: emp.employeeId,
                name: (emp.userId as any)?.name || 'Unknown',
                email: (emp.userId as any)?.email || '',
                department: emp.department,
                designation: emp.designation,
                status: record?.status || 'absent',
                checkIn: record?.checkIn || null,
                checkOut: record?.checkOut || null,
                totalHours: record?.totalHours || 0,
                notes: record?.notes || '',
            };
        });

        const summary = {
            present: overview.filter((e) => e.status === 'present').length,
            wfh: overview.filter((e) => e.status === 'wfh').length,
            halfDay: overview.filter((e) => e.status === 'half-day').length,
            onLeave: overview.filter((e) => e.status === 'on-leave').length,
            absent: overview.filter((e) => e.status === 'absent').length,
            holiday: overview.filter((e) => e.status === 'holiday').length,
            total: overview.length,
        };

        return { date: dateObj, summary, employees: overview };
    }

    // ── Admin: Monthly attendance for grid view ───────────────────────
    static async getMonthlyAttendance(month: number, year: number) {
        // Use UTC boundaries to avoid IST server shift
        const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
        // IMPORTANT: use getUTCDate() — getDate() would return the IST local day
        // which can be 1 more than the UTC date (e.g. March 31 23:59 UTC = April 1 IST)
        const daysInMonth = endDate.getUTCDate();

        const [employees, records] = await Promise.all([
            Employee.find({}).populate('userId', 'name email').lean(),
            Attendance.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
        ]);

        // Build lookup: employeeId → { dateStr → record }
        const recordMap = new Map<string, Map<string, any>>();
        for (const r of records) {
            const empKey = r.employeeId.toString();
            const recordDate = new Date(r.date);
            // Use UTC methods — dates are stored at UTC midnight
            const rY = recordDate.getUTCFullYear();
            const rM = String(recordDate.getUTCMonth() + 1).padStart(2, '0');
            const rD = String(recordDate.getUTCDate()).padStart(2, '0');
            const dateKey = `${rY}-${rM}-${rD}`;
            if (!recordMap.has(empKey)) recordMap.set(empKey, new Map());
            recordMap.get(empKey)!.set(dateKey, r);
        }

        const grid = employees.map((emp) => {
            const empRecords = recordMap.get(emp._id.toString()) || new Map();
            const days: Array<{ date: string; status: string | null }> = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const rec = empRecords.get(dateStr);
                days.push({ date: dateStr, status: rec?.status || null });
            }
            return {
                employeeId: emp._id,
                employeeCode: emp.employeeId,
                name: (emp.userId as any)?.name || 'Unknown',
                department: emp.department,
                days,
            };
        });

        return { month, year, daysInMonth, grid };
    }
}
