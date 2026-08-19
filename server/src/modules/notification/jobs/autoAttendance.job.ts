/**
 * autoAttendance.job.ts
 *
 * Runs automatically during the day to check employee worked hours and mark
 * attendance if they cross the threshold (6 hours for present, 4 hours for half-day).
 *
 * Calculates time based on the 6am-IST to 6am-IST work day boundary.
 */

import cron from 'node-cron';
import { Employee } from '../../hrms/models/Employee.model';
import { AttendanceService } from '../../hrms/services/attendance.service';
import { calculateDailyWorkSummary } from '../../project/services/dailyWorkSummary.service';
import { getWorkDayLabel } from '../../../utils/intervalUtils';
import { notificationService } from '../services/notification.service';
import { logger } from '../../../utils/logger';

/**
 * Main auto-attendance check function
 */
async function runAutoAttendanceCheck() {
    logger.info('[CRON:AutoAttendance] Starting attendance check...');

    try {
        const now = new Date();
        const dateStr = getWorkDayLabel(now); // Gets the current 6am-6am work day label

        // Get all active employees
        const employees = await Employee.find({ status: 'active' }).select('_id userId employeeId').lean();
        
        let markedCount = 0;
        let skipCount = 0;

        for (const emp of employees) {
            try {
                // 1. Calculate unique worked minutes for this work day window
                const summary = await calculateDailyWorkSummary(emp.userId.toString(), dateStr);
                const workedMinutes = summary.uniqueWorkedMinutes;

                // 2. Attempt to auto-mark attendance
                const result = await AttendanceService.autoMarkForEmployee(
                    emp._id.toString(),
                    emp.userId.toString(),
                    dateStr,
                    workedMinutes
                );

                if (result.marked) {
                    markedCount++;
                    // 3. Notify the employee that their attendance was marked
                    await notificationService.createNotification({
                        userId: emp.userId.toString(),
                        type: 'auto_attendance_marked',
                        title: 'Attendance Auto-Marked',
                        message: `Great job! You've logged ${Math.round(workedMinutes / 60)} hours today. Your attendance has been marked as ${result.status}.`,
                        link: '/my-hrms/attendance',
                    });
                    logger.debug(`[CRON:AutoAttendance] Marked ${emp.employeeId} as ${result.status} (${workedMinutes}m)`);
                } else {
                    skipCount++;
                    logger.debug(`[CRON:AutoAttendance] Skipped ${emp.employeeId}: ${result.reason}`);
                }
            } catch (err) {
                logger.error({ err, employeeId: emp.employeeId }, '[CRON:AutoAttendance] Error processing employee');
            }
        }

        logger.info(`[CRON:AutoAttendance] Finished check for ${dateStr}. Marked: ${markedCount}, Skipped: ${skipCount}`);

    } catch (error) {
        logger.error({ err: error }, '[CRON:AutoAttendance] Job failed completely');
    }
}

/**
 * Initialize auto-attendance cron jobs
 * Schedule requested by user: 1pm, 3pm, 5pm, 7pm IST and 7am IST (morning cleanup)
 */
export const initAutoAttendanceJob = () => {
    // 1:00 PM IST
    cron.schedule('0 13 * * *', runAutoAttendanceCheck, { timezone: 'Asia/Kolkata' });
    // 3:00 PM IST
    cron.schedule('0 15 * * *', runAutoAttendanceCheck, { timezone: 'Asia/Kolkata' });
    // 5:00 PM IST
    cron.schedule('0 17 * * *', runAutoAttendanceCheck, { timezone: 'Asia/Kolkata' });
    // 7:00 PM IST
    cron.schedule('0 19 * * *', runAutoAttendanceCheck, { timezone: 'Asia/Kolkata' });
    
    // 7:00 AM IST (Cleanup run for night shift workers, 1 hour after the 6am boundary ends)
    // Note: To check the PREVIOUS day's work, we need to pass a slightly earlier time to getWorkDayLabel
    cron.schedule('0 7 * * *', async () => {
        logger.info('[CRON:AutoAttendance] Running morning cleanup check for previous work day');
        try {
            // At 7:00 AM IST, the current work day has rolled over to "today".
            // We want to evaluate "yesterday's" work day which ended at 6:00 AM IST today.
            // Subtracting 2 hours guarantees we get the label for the previous work day.
            const previousWorkDayDate = new Date(Date.now() - 2 * 60 * 60 * 1000); 
            const dateStr = getWorkDayLabel(previousWorkDayDate); 
            
            const employees = await Employee.find({ status: 'active' }).select('_id userId employeeId').lean();
            let markedCount = 0;
            
            for (const emp of employees) {
                try {
                    const summary = await calculateDailyWorkSummary(emp.userId.toString(), dateStr);
                    const result = await AttendanceService.autoMarkForEmployee(
                        emp._id.toString(),
                        emp.userId.toString(),
                        dateStr,
                        summary.uniqueWorkedMinutes
                    );
                    if (result.marked) markedCount++;
                } catch (err) {
                    logger.error({ err, employeeId: emp.employeeId }, '[CRON:AutoAttendance] Cleanup error');
                }
            }
            logger.info(`[CRON:AutoAttendance] Morning cleanup for ${dateStr} finished. Marked: ${markedCount}`);
        } catch (error) {
            logger.error({ err: error }, '[CRON:AutoAttendance] Morning cleanup failed');
        }
    }, { timezone: 'Asia/Kolkata' });

    logger.info('[CRON] Auto-attendance jobs scheduled (1pm, 3pm, 5pm, 7pm, 7am IST)');
};
