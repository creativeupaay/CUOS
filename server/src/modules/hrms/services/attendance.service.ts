import { Attendance, IAttendance } from '../models/Attendance.model';
import { Employee } from '../models/Employee.model';
import { Holiday } from '../models/Holiday.model';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';
import { getDepartmentCatalog, resolveDepartmentValue } from '../../../utils/department.util';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';
import { getWorkDayBoundsFromDate, getWorkDayBounds } from '../../../utils/intervalUtils';

interface BulkMarkAttendanceOptions extends ArchiveDeleteOptions {
    onlyUnmarked?: boolean;
    /** User._id of the admin performing the bulk mark — stored as overriddenBy */
    adminUserId?: string;
}

export class AttendanceService {
    static async checkIn(userId: string, data: any) {
        const employee = await Employee.findOne({ userId });
        if (!employee || ['terminated', 'relieved'].includes(employee.status)) {
            throw new AppError('Employee not found or inactive', 404);
        }

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
        if (!employee || ['terminated', 'relieved'].includes(employee.status)) {
            throw new AppError('Employee not found or inactive', 404);
        }

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
        const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
        const { dayStart } = getWorkDayBounds(date);
        const checkInTime = new Date(Date.UTC(y, m - 1, d, 3, 30, 0, 0));

        // Separate clear vs upsert operations
        const clearIds: Types.ObjectId[] = [];
        const upsertOps: any[] = [];

        const employeeIds = records.map((r) => new Types.ObjectId(r.employeeId));
        const existingRecords = await Attendance.find({
            employeeId: { $in: employeeIds },
            date: { $gte: dateStart, $lte: dateEnd },
        });
        const existingMap = new Map(existingRecords.map((rec) => [rec.employeeId.toString(), rec]));

        const existingEmployeeIds = new Set<string>();
        if (options.onlyUnmarked && records.length > 0) {
            existingRecords.forEach((record) => {
                existingEmployeeIds.add(record.employeeId.toString());
            });
        }

        let skipped = 0;

        // Only allow marking attendance for active employees whose linked user is active
        const activeEmployees = await Employee.find({
            _id: { $in: employeeIds },
            status: { $nin: ['terminated', 'relieved'] },
        }).populate('userId', 'isActive').lean();
        const activeEmpIdSet = new Set(
            activeEmployees
                .filter((emp) => emp.userId && (emp.userId as any).isActive !== false)
                .map((emp) => emp._id.toString())
        );

        for (const r of records) {
            if (!activeEmpIdSet.has(r.employeeId)) {
                skipped += 1;
                continue;
            }

            if (options.onlyUnmarked && existingEmployeeIds.has(r.employeeId)) {
                skipped += 1;
                continue;
            }

            if (r.status === 'clear') {
                clearIds.push(new Types.ObjectId(r.employeeId));
            } else {
                const existingRec = existingMap.get(r.employeeId);
                if (existingRec) {
                    upsertOps.push({
                        updateOne: {
                            filter: { _id: existingRec._id },
                            update: {
                                $set: {
                                    status: r.status,
                                    source: 'admin-override',
                                    notes: r.notes || '',
                                    date: dayStart,
                                    ...(options.adminUserId && {
                                        overriddenBy: new Types.ObjectId(options.adminUserId),
                                    }),
                                    ...(['present', 'wfh', 'half-day'].includes(r.status) && {
                                        checkIn: existingRec.checkIn || checkInTime,
                                    }),
                                },
                            },
                        },
                    });
                } else {
                    upsertOps.push({
                        insertOne: {
                            document: {
                                employeeId: new Types.ObjectId(r.employeeId),
                                date: dayStart,
                                status: r.status,
                                source: 'admin-override',
                                notes: r.notes || '',
                                totalHours: 0,
                                ...(options.adminUserId && {
                                    overriddenBy: new Types.ObjectId(options.adminUserId),
                                }),
                                ...(['present', 'wfh', 'half-day'].includes(r.status) && {
                                    checkIn: checkInTime,
                                }),
                            },
                        },
                    });
                }
            }
        }

        let deleted = 0;
        if (clearIds.length > 0) {
            const clearFilter = {
                employeeId: { $in: clearIds },
                date: { $gte: dateStart, $lte: dateEnd },
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
        const emp = await Employee.findById(employeeId).populate('userId', 'isActive').lean();
        if (!emp || ['terminated', 'relieved'].includes(emp.status) || !emp.userId || (emp.userId as any).isActive === false) {
            return { marked: false, reason: 'Employee is inactive' };
        }

        const { dayStart } = getWorkDayBounds(dateStr);

        const [y, m, d] = dateStr.split('-').map(Number);
        const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

        // Check for existing record across day window
        const existing = await Attendance.findOne({
            employeeId: new Types.ObjectId(employeeId),
            date: { $gte: dateStart, $lte: dateEnd },
        }).sort({ updatedAt: -1 }).lean();

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
            if (existing.source === 'admin-override' || existing.overriddenBy) {
                return { marked: false, reason: 'admin-override record — skipped' };
            }
            // Manual records and approved leaves are fully protected — cron never overwrites them.
            // (Admin bulk-marks now use 'admin-override', but we keep the 'manual' guard here
            //  for employee self-check-ins and any legacy records.)
            if (existing.source === 'manual' || existing.source === 'leave') {
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
        const emp = await Employee.findById(employeeId).populate('userId', 'isActive').lean();
        if (!emp || ['terminated', 'relieved'].includes(emp.status) || !emp.userId || (emp.userId as any).isActive === false) {
            throw new AppError('Cannot override attendance for an inactive employee', 400);
        }

        const { dayStart } = getWorkDayBounds(date);
        const [y, m, d] = date.split('-').map(Number);
        const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

        const existing = await Attendance.findOne({
            employeeId: new Types.ObjectId(employeeId),
            date: { $gte: dateStart, $lte: dateEnd },
        }).sort({ updatedAt: -1 });

        let updated: IAttendance | null;
        if (existing) {
            existing.status = status;
            existing.source = 'admin-override';
            existing.overriddenBy = new Types.ObjectId(adminUserId);
            existing.overrideReason = reason?.trim() || '';
            existing.date = dayStart;
            updated = await existing.save();

            // Clean up any remaining duplicate records for this employee on this date
            await Attendance.deleteMany({
                employeeId: new Types.ObjectId(employeeId),
                date: { $gte: dateStart, $lte: dateEnd },
                _id: { $ne: existing._id },
            });
        } else {
            updated = await Attendance.create({
                employeeId: new Types.ObjectId(employeeId),
                date: dayStart,
                status,
                source: 'admin-override',
                overriddenBy: new Types.ObjectId(adminUserId),
                overrideReason: reason?.trim() || '',
                totalHours: 0,
            });
        }

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
        const [rawEmployees, attendanceRecords] = await Promise.all([
            Employee.find({ status: { $nin: ['terminated', 'relieved'] } }).populate('userId', 'name email isActive').lean(),
            Attendance.find({ date: { $gte: dateObj, $lte: dateEnd } }).populate('overriddenBy', 'name').lean(),
        ]);

        const employees = rawEmployees.filter(
            (emp) => emp.userId && (emp.userId as any).isActive !== false
        );

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
        const [rawEmployees, records, holidays] = await Promise.all([
            Employee.find({ status: { $nin: ['terminated', 'relieved'] } }).populate('userId', 'name email isActive').lean(),
            Attendance.find({ date: { $gte: startDate, $lte: endDate } }).lean(),
            Holiday.find({ 
                date: { $gte: startDate, $lte: endDate },
                type: 'holiday' 
            }).lean(),
        ]);

        const employees = rawEmployees.filter(
            (emp) => emp.userId && (emp.userId as any).isActive !== false
        );

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
     *
     * IMPORTANT: Admin manual overrides (source:'admin-override', overriddenBy)
     * as well as approved leaves (source:'leave') and manual records (source:'manual')
     * are strictly PROTECTED and take absolute priority. Their status and source will
     * NEVER be changed by the timer.
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
            if (['terminated', 'relieved'].includes(employee.status)) return null;
            if (employee.userId) {
                const user = await User.findById(employee.userId).select('isActive').lean();
                if (user && user.isActive === false) return null;
            }

            const [y, m, d] = dateKey.split('-').map(Number);
            const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
            const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
            const { dayStart } = getWorkDayBounds(dateKey);

            let attendance = await Attendance.findOne({
                employeeId: employee._id,
                date: { $gte: dateStart, $lte: dateEnd },
            }).sort({ updatedAt: -1 });

            const effectiveCheckIn = checkInTime || new Date();

            if (!attendance) {
                attendance = new Attendance({
                    employeeId: employee._id,
                    date: dayStart,
                    checkIn: effectiveCheckIn,
                    status: 'present',
                    source: 'auto',
                });
                await attendance.save();
                return attendance;
            }

            // CRITICAL: Protect admin overrides, approved leaves, and manual records.
            // Admin manual actions have absolute priority and can NEVER be overwritten by the timer.
            const isProtected =
                attendance.source === 'admin-override' ||
                attendance.source === 'leave' ||
                attendance.source === 'manual' ||
                !!attendance.overriddenBy;

            let modified = false;

            // Only set checkIn if not already set, preserving the earliest check-in of the day
            if (!attendance.checkIn) {
                attendance.checkIn = effectiveCheckIn;
                modified = true;
            }

            // If protected by admin, leave, or manual: do NOT touch status or source under any condition!
            if (isProtected) {
                if (modified) {
                    await attendance.save();
                }
                return attendance;
            }

            // If not protected and status was absent, we do NOT blindly promote to present.
            // Status promotion is earned by reaching the 6-hour threshold (evaluated via cron and EOD checkout).

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
     *
     * IMPORTANT: Admin manual overrides (source:'admin-override', overriddenBy)
     * as well as approved leaves (source:'leave') and manual records (source:'manual')
     * are strictly PROTECTED and take absolute priority. Their status and source will
     * NEVER be changed by the timer.
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
            if (['terminated', 'relieved'].includes(employee.status)) return null;
            if (employee.userId) {
                const user = await User.findById(employee.userId).select('isActive').lean();
                if (user && user.isActive === false) return null;
            }

            const [y, m, d] = dateKey.split('-').map(Number);
            const dateStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
            const dateEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
            const { dayStart } = getWorkDayBounds(dateKey);

            let attendance = await Attendance.findOne({
                employeeId: employee._id,
                date: { $gte: dateStart, $lte: dateEnd },
            }).sort({ updatedAt: -1 });

            const effectiveCheckOut = checkOutTime || new Date();
            const totalHours = Number((Math.max(0, accumulatedSeconds) / 3600).toFixed(2));
            const breakMinutes = Math.round(Math.max(0, breakSeconds) / 60);

            if (!attendance) {
                // If ending day and no record exists, evaluate status based on 6h/4h rule
                let status: IAttendance['status'] = 'absent';
                if (accumulatedSeconds >= 21600) {       // >= 6 hours
                    status = 'present';
                } else if (accumulatedSeconds >= 14400) { // >= 4 hours
                    status = 'half-day';
                }

                attendance = new Attendance({
                    employeeId: employee._id,
                    date: dayStart,
                    checkIn: effectiveCheckOut, // fallback checkIn if none existed
                    checkOut: effectiveCheckOut,
                    totalHours,
                    breakMinutes,
                    status,
                    source: 'auto',
                });
                await attendance.save();
                return attendance;
            }

            // CRITICAL: Protect admin overrides, approved leaves, and manual records.
            // Admin manual actions have absolute priority and can NEVER have their status changed by the timer.
            const isProtected =
                attendance.source === 'admin-override' ||
                attendance.source === 'leave' ||
                attendance.source === 'manual' ||
                !!attendance.overriddenBy;

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

            // ONLY adjust status if record is NOT protected by admin or approved leave
            if (!isProtected) {
                if (accumulatedSeconds >= 21600) {       // >= 6 hours
                    attendance.status = 'present';
                } else if (accumulatedSeconds >= 14400) { // >= 4 hours
                    attendance.status = 'half-day';
                } else if (attendance.source === 'auto') {
                    // Worked < 4 hours and day ended: mark absent
                    attendance.status = 'absent';
                }
            }

            await attendance.save();
            return attendance;
        } catch (err) {
            console.error('[AttendanceService] syncCheckOutFromTimer error:', err);
            return null;
        }
    }
}
