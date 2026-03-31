import cron from 'node-cron';
import { Attendance } from '../../hrms/models/Attendance.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Holiday } from '../../hrms/models/Holiday.model';
import { notificationService } from '../services/notification.service';

/**
 * Get today's date range in UTC
 */
const getTodayRange = (): { startOfDay: Date; endOfDay: Date } => {
    const today = new Date();
    const startOfDay = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfDay = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999)
    );
    return { startOfDay, endOfDay };
};

/**
 * Check if today is a declared holiday
 */
const isTodayHoliday = async (): Promise<boolean> => {
    const { startOfDay, endOfDay } = getTodayRange();
    const holiday = await Holiday.findOne({
        date: { $gte: startOfDay, $lte: endOfDay },
        type: 'holiday', // Only full holidays, not half-day or WFH
    });
    return !!holiday;
};

/**
 * Attendance reminder job
 * Runs daily at 4:00 PM IST and notifies superadmins if attendance is missing
 */
export const initAttendanceReminderJob = () => {
    // 4:00 PM IST = 10:30 UTC (IST is UTC+5:30)
    // Cron format: second minute hour day month weekday
    cron.schedule(
        '0 30 10 * * *',
        async () => {
            console.log('[CRON] Running attendance reminder check...');

            try {
                const today = new Date();
                const dayOfWeek = today.getDay();

                // Skip weekends (Saturday = 6, Sunday = 0)
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    console.log('[CRON] Weekend - skipping attendance reminder');
                    return;
                }

                // Skip if today is a declared holiday
                const isHoliday = await isTodayHoliday();
                if (isHoliday) {
                    console.log('[CRON] Holiday - skipping attendance reminder');
                    return;
                }

                const { startOfDay, endOfDay } = getTodayRange();

                // Count active employees
                const activeEmployeeCount = await Employee.countDocuments({ status: 'active' });

                // Count attendance records for today
                const attendanceCount = await Attendance.countDocuments({
                    date: { $gte: startOfDay, $lte: endOfDay },
                });

                // If not all employees have attendance marked, send reminder
                if (attendanceCount < activeEmployeeCount) {
                    const missing = activeEmployeeCount - attendanceCount;

                    await notificationService.notifySuperadmins({
                        type: 'attendance_reminder',
                        title: 'Daily Attendance Reminder',
                        message: `${missing} employee(s) do not have attendance marked for today.`,
                        link: '/hrms/attendance',
                        metadata: {
                            date: startOfDay.toISOString().split('T')[0],
                            totalEmployees: activeEmployeeCount,
                            markedCount: attendanceCount,
                            missingCount: missing,
                        },
                    });

                    console.log(`[CRON] Sent attendance reminder: ${missing} employees missing`);
                } else {
                    console.log('[CRON] All employees have attendance marked');
                }
            } catch (error) {
                console.error('[CRON] Error in attendance reminder job:', error);
            }
        },
        {
            timezone: 'Asia/Kolkata',
        }
    );

    console.log('[CRON] Attendance reminder job scheduled for 4:00 PM IST daily');
};
