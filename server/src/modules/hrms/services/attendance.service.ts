import { Attendance, IAttendance } from '../models/Attendance.model';
import { Employee } from '../models/Employee.model';
import { Holiday } from '../models/Holiday.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import { getDepartmentCatalog, resolveDepartmentValue } from '../../../utils/department.util';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';
import { getWorkDayBoundsFromDate, getWorkDayBounds } from '../../../utils/intervalUtils';

interface BulkMarkAttendanceOptions extends ArchiveDeleteOptions {
    onlyUnmarked?: boolean;
}

export class AttendanceService {
    static async checkIn(userId: string, data: any) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        // Use 6am-IST work day boundary (00:30 UTC) to determine "today"
        // This avoids the bug where setHours(0,0,0,0) uses server local time (IST)
        const { dayStart } = getWorkDayBoundsFromDate(new Date());

        // Check if already checked in today
        const existingAttendance = await Attendance.findOne({
            employeeId: employee._id,
            date: dayStart,
        });

        if (existingAttendance) {
            throw new AppError('Already checked in today', 400);
        }

        const attendance = await Attendance.create({
            employeeId: employee._id,
            date: dayStart,
            checkIn: new Date(),
            status: 'present',
            source: 'manual',
            ...data,
        });

        return attendance;
    }

    static async checkOut(userId: string, data: any) {
        const employee = await Employee.findOne({ userId });
        if (!employee) throw new AppError('Employee not found for this user', 404);

        // Use 6am-IST work day boundary (00:30 UTC) to determine "today"
        const { dayStart } = getWorkDayBoundsFromDate(new Date());

        const attendance = await Attendance.findOne({
            employeeId: employee._id,
            date: dayStart,
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
        records: Array<{ employeeId: string; status: string; notes?: string }>,
        options: BulkMarkAttendanceOptions = {}
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

        const existingEmployeeIds = new Set<string>();
        if (options.onlyUnmarked && records.length > 0) {
            const employeeIds = records.map((r) => new Types.ObjectId(r.employeeId));
            const existingRecords = await Attendance.find({
                employeeId: { $in: employeeIds },
                date: dateObj,
            }).select('employeeId').lean();

            existingRecords.forEach((record) => {
                existingEmployeeIds.add(record.employeeId.toString());
            });
        }

        let skipped = 0;

        for (const r of records) {
            if (options.onlyUnmarked && existingEmployeeIds.has(r.employeeId)) {
                skipped += 1;
                continue;
            }

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
                                source: 'manual',
                                notes: r.notes || '',
                                ...(['present', 'wfh', 'half-day'].includes(r.status) && {
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
            const clearFilter = {
                employeeId: { $in: clearIds },
                date: dateObj,
            };
            const recordsToClear = await Attendance.find(clearFilter);

            if (!options.skipArchive) {
                await DeletedRecordService.archiveDocuments(recordsToClear, {
                    archiveBatchId: options.archiveBatchId,
                    deletedBy: options.deletedBy,
                    reason: options.reason ?? 'Bulk attendance clear requested',
                    operation: 'delete',
                    session: options.session,
                    metadata: {
                        ...options.metadata,
                        date,
                        employeeIds: clearIds.map((employeeId) => employeeId.toString()),
                    },
                });
            }

            const res = await Attendance.deleteMany(
                { _id: { $in: recordsToClear.map((record) => record._id) } },
                options.session ? { session: options.session } : undefined
            );
            deleted = res.deletedCount;
        }

        if (upsertOps.length > 0) {
            await Attendance.bulkWrite(upsertOps);
        }

        return { saved: upsertOps.length, cleared: deleted, skipped };
    }

    // ── Auto-mark attendance based on worked hours (called by cron job) ────────
    /**
     * Check a specific employee's worked minutes for a given work day and
     * auto-mark their attendance if they crossed the threshold.
     *
     * Thresholds (configurable):
     *   >= 6 hours (360 min) => 'present'
     *   >= 4 hours (240 min) => 'half-day'
     *
     * Skips if:
     *  - A non-auto attendance record already exists (manual or leave-based)
     *  - Employee has on-leave or holiday status
     */
    static async autoMarkForEmployee(
        employeeId: string,
        userId: string,
        dateStr: string,
        uniqueWorkedMinutes: number,
        breakMinutes: number = 0
    ): Promise<{ marked: boolean; status?: string; reason?: string }> {
        const { dayStart } = getWorkDayBounds(dateStr);

        // Check for existing non-auto record
        const existing = await Attendance.findOne({
            employeeId: new Types.ObjectId(employeeId),
            date: dayStart,
        }).lean();

        let autoCalculatedStatus: 'present' | 'half-day' | null = null;
        if (uniqueWorkedMinutes >= 360) {       // >= 6 hours
            autoCalculatedStatus = 'present';
        } else if (uniqueWorkedMinutes >= 240) { // >= 4 hours
            autoCalculatedStatus = 'half-day';
        }

        let finalStatus = existing?.status;
        let isNewStatus = false;

        if (existing) {
            // Don't override leave, holiday, or absent records at all
            if (['on-leave', 'holiday', 'absent'].includes(existing.status)) {
                return { marked: false, reason: `existing ${existing.status} record — skipped` };
            }
            // Admin-override records are never touched by cron
            if (existing.source === 'admin-override') {
                return { marked: false, reason: 'admin-override record — skipped' };
            }
            // Manual records (unless WFH) or approved leaves (except WFH) are protected
            if ((existing.source === 'manual' || existing.source === 'leave') && existing.status !== 'wfh') {
                return { marked: false, reason: `existing ${existing.source} (${existing.status}) record — skipped` };
            }

            // For WFH or auto records:
            // Mark present (>=6h) or half-day (4-6h) only if they actually worked the required hours
            if (autoCalculatedStatus) {
                finalStatus = autoCalculatedStatus;
                if (finalStatus !== existing.status) {
                    isNewStatus = true;
                }
            } else {
                // If employee is on WFH but has not worked >=4 hours, do not mark present
                if (existing.status === 'wfh') {
                    return { marked: false, reason: `WFH employee worked ${uniqueWorkedMinutes} min (< 4h) — not marked present` };
                }
                finalStatus = existing.status;
            }
        } else {
            finalStatus = autoCalculatedStatus || undefined;
            isNewStatus = !!autoCalculatedStatus;
        }

        if (!finalStatus) {
            // Not enough hours and no existing record
            return { marked: false, reason: `only ${uniqueWorkedMinutes} min worked` };
        }

        // If they didn't meet the threshold and they have a stale auto record, remove it
        if (!autoCalculatedStatus && existing?.source === 'auto') {
            await Attendance.deleteOne({ _id: existing._id });
            return { marked: false, reason: `only ${uniqueWorkedMinutes} min worked — stale record removed` };
        }

        const totalHours = Number((uniqueWorkedMinutes / 60).toFixed(2));
        const notes = existing?.status === 'wfh'
            ? `Auto-marked ${finalStatus}: ${uniqueWorkedMinutes} minutes worked (WFH)`
            : existing?.source === 'manual' 
                ? (existing.notes && !existing.notes.includes('Auto-update:') ? `${existing.notes}\nAuto-update: ${uniqueWorkedMinutes} min worked` : `Auto-update: ${uniqueWorkedMinutes} min worked`)
                : `Auto-marked: ${uniqueWorkedMinutes} minutes worked on ${dateStr}${breakMinutes > 0 ? ` (${breakMinutes}m break)` : ''}`;

        await Attendance.findOneAndUpdate(
            { employeeId: new Types.ObjectId(employeeId), date: dayStart },
            {
                $set: {
                    status: finalStatus,
                    source: existing?.source === 'manual' ? 'manual' : 'auto',
                    totalHours,
                    breakMinutes,
                    notes,
                },
                $setOnInsert: {
                    employeeId: new Types.ObjectId(employeeId),
                    date: dayStart,
                },
            },
            { upsert: true, runValidators: false }
        );

        return { marked: isNewStatus, status: finalStatus };
    }

    // ── Admin: Override attendance for a specific employee + date ─────
    /**
     * Allows an admin/super-admin to forcefully set the attendance status
     * for any employee on any date.  The resulting record is tagged
     * source:'admin-override' and will not be touched by future cron runs.
     */
    static async overrideAttendance(
        adminUserId: string,
        employeeId: string,
        date: string,
        status: IAttendance['status'],
        reason?: string
    ): Promise<IAttendance> {
        const { dayStart } = getWorkDayBounds(date);

        const updated = await Attendance.findOneAndUpdate(
            {
                employeeId: new Types.ObjectId(employeeId),
                date: dayStart,
            },
            {
                $set: {
                    status,
                    source: 'admin-override',
                    overriddenBy: new Types.ObjectId(adminUserId),
                    overrideReason: reason?.trim() || '',
                },
                $setOnInsert: {
                    employeeId: new Types.ObjectId(employeeId),
                    date: dayStart,
                    totalHours: 0,
                },
            },
            { upsert: true, new: true, runValidators: false }
        );

        if (!updated) throw new AppError('Failed to override attendance', 500);
        return updated;
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

        const departmentCatalog = await getDepartmentCatalog();
        const [employees, attendanceRecords] = await Promise.all([
            Employee.find({ status: { $ne: 'terminated' } }).populate('userId', 'name email').lean(),
            Attendance.find({ date: { $gte: dateObj, $lte: dateEnd } }).populate('overriddenBy', 'name').lean(),
        ]);

        const attendanceMap = new Map(
            attendanceRecords.map((a) => [a.employeeId.toString(), a])
        );

        const overview = employees.map((emp) => {
            const record: any = attendanceMap.get(emp._id.toString());
            return {
                employeeId: emp._id,
                employeeCode: emp.employeeId,
                name: (emp.userId as any)?.name || 'Unknown',
                email: (emp.userId as any)?.email || '',
                department: resolveDepartmentValue(emp.department, departmentCatalog),
                designation: emp.designation,
                status: record?.status || 'unmarked',
                source: record?.source || (record ? 'manual' : undefined),
                overriddenBy: record?.overriddenBy ? (record.overriddenBy.name || record.overriddenBy) : undefined,
                overrideReason: record?.overrideReason || '',
                checkIn: record?.checkIn || null,
                checkOut: record?.checkOut || null,
                totalHours: record?.totalHours || 0,
                breakMinutes: record?.breakMinutes || 0,
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
            unmarked: overview.filter((e) => e.status === 'unmarked').length,
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

        const departmentCatalog = await getDepartmentCatalog();
        const [employees, records, holidays] = await Promise.all([
            Employee.find({}).populate('userId', 'name email').lean(),
            Attendance.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
            Holiday.find({ 
                date: { $gte: startDate, $lte: endDate },
                type: 'holiday' 
            }).lean(),
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
            const days: Array<{ date: string; status: string | null; source?: string }> = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const rec = empRecords.get(dateStr);
                days.push({ date: dateStr, status: rec?.status || null, source: rec?.source || null });
            }
            return {
                employeeId: emp._id,
                employeeCode: emp.employeeId,
                name: (emp.userId as any)?.name || 'Unknown',
                department: resolveDepartmentValue(emp.department, departmentCatalog),
                days,
            };
        });

        return { month, year, daysInMonth, grid, holidays };
    }

    // ── Universal Timer Sync: Check-in & Check-out ───────────────────────
    /**
     * Called when a user starts or resumes the universal timer.
     * Sets check-in time for today in the Attendance record if not already set.
     */
    static async syncCheckInFromTimer(userId: string, dateKey: string, checkInTime?: Date) {
        try {
            if (!userId) return null;
            const validObjId = Types.ObjectId.isValid(userId);
            let employee = validObjId ? await Employee.findOne({ userId: new Types.ObjectId(userId) }) : await Employee.findOne({ userId });
            if (!employee && validObjId) {
                employee = await Employee.findById(new Types.ObjectId(userId));
            }
            if (!employee) return null;

            const [y, m, d] = dateKey.split('-').map(Number);
            const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
            const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

            let attendance = await Attendance.findOne({
                employeeId: employee._id,
                date: { $gte: dateStart, $lte: dateEnd },
            });

            const effectiveCheckIn = checkInTime || new Date();

            if (!attendance) {
                attendance = new Attendance({
                    employeeId: employee._id,
                    date: dateStart,
                    checkIn: effectiveCheckIn,
                    status: 'present',
                    source: 'auto',
                });
                await attendance.save();
                return attendance;
            }

            let modified = false;
            // Only set checkIn if not already set, preserving the earliest check-in of the day
            if (!attendance.checkIn) {
                attendance.checkIn = effectiveCheckIn;
                modified = true;
            }

            // If status is absent, mark as present since employee is now active
            if (attendance.status === 'absent') {
                attendance.status = 'present';
                modified = true;
            }

            if (modified) {
                await attendance.save();
            }

            return attendance;
        } catch (err) {
            console.error('[AttendanceService] syncCheckInFromTimer error:', err);
            return null;
        }
    }

    /**
     * Called when a user ends the day (EOD) from the universal timer.
     * Sets check-out time, total worked hours, and break time in the Attendance record.
     */
    static async syncCheckOutFromTimer(
        userId: string,
        dateKey: string,
        checkOutTime?: Date,
        accumulatedSeconds: number = 0,
        breakSeconds: number = 0
    ) {
        try {
            if (!userId) return null;
            const validObjId = Types.ObjectId.isValid(userId);
            let employee = validObjId ? await Employee.findOne({ userId: new Types.ObjectId(userId) }) : await Employee.findOne({ userId });
            if (!employee && validObjId) {
                employee = await Employee.findById(new Types.ObjectId(userId));
            }
            if (!employee) return null;

            const [y, m, d] = dateKey.split('-').map(Number);
            const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
            const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

            let attendance = await Attendance.findOne({
                employeeId: employee._id,
                date: { $gte: dateStart, $lte: dateEnd },
            });

            const effectiveCheckOut = checkOutTime || new Date();
            const totalHours = Number((Math.max(0, accumulatedSeconds) / 3600).toFixed(2));
            const breakMinutes = Math.round(Math.max(0, breakSeconds) / 60);

            if (!attendance) {
                attendance = new Attendance({
                    employeeId: employee._id,
                    date: dateStart,
                    checkIn: effectiveCheckOut, // fallback checkIn if none existed
                    checkOut: effectiveCheckOut,
                    totalHours,
                    breakMinutes,
                    status: 'present',
                    source: 'auto',
                });
                await attendance.save();
                return attendance;
            }

            // Always update checkout time to the latest EOD timestamp
            attendance.checkOut = effectiveCheckOut;
            if (totalHours > 0 || !attendance.totalHours) {
                attendance.totalHours = totalHours;
            }
            if (breakMinutes > 0 || !attendance.breakMinutes) {
                attendance.breakMinutes = breakMinutes;
            }

            // If checkIn was somehow missing, default it
            if (!attendance.checkIn) {
                attendance.checkIn = effectiveCheckOut;
            }

            // If status was absent, mark as present
            if (attendance.status === 'absent') {
                attendance.status = 'present';
            }

            await attendance.save();
            return attendance;
        } catch (err) {
            console.error('[AttendanceService] syncCheckOutFromTimer error:', err);
            return null;
        }
    }
}
