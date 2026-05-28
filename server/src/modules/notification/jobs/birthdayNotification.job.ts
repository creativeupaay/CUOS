import cron from 'node-cron';
import { Employee } from '../../hrms/models/Employee.model';
import { Notification } from '../models/Notification.model';
import { notificationService } from '../services/notification.service';
import { logger } from "../../../utils/logger";

const getMonthAndDateKey = (value: Date): string => {
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${month}-${day}`;
};

export const initBirthdayNotificationJob = () => {
    cron.schedule(
        '0 0 9 * * *',
        async () => {
            logger.info('[CRON] Running birthday notification job...');

            try {
                const today = new Date();
                const todayKey = getMonthAndDateKey(today);
                const notificationDate = today.toISOString().split('T')[0];

                const birthdayEmployees = await Employee.find({
                    status: 'active',
                    'personalInfo.dob': { $exists: true, $ne: null },
                })
                    .populate('userId', 'name')
                    .select('userId personalInfo.dob')
                    .lean();

                for (const employee of birthdayEmployees) {
                    const dob = employee.personalInfo?.dob;
                    if (!dob || getMonthAndDateKey(dob) !== todayKey) {
                        continue;
                    }

                    const employeeUser = employee.userId as unknown as { _id?: string; name?: string };
                    const birthdayPersonName = employeeUser?.name?.trim();
                    if (!birthdayPersonName) {
                        continue;
                    }

                    const notificationKey = `birthday:${employee._id.toString()}:${notificationDate}`;
                    const alreadySent = await Notification.exists({
                        type: 'employee_birthday',
                        'metadata.notificationKey': notificationKey,
                    });

                    if (alreadySent) {
                        continue;
                    }

                    await notificationService.notifyInternalUsers({
                        type: 'employee_birthday',
                        title: 'Birthday Today',
                        message: `Today is ${birthdayPersonName}'s birthday.`,
                        link: '/hrms/employees',
                        metadata: {
                            notificationKey,
                            notificationDate,
                            employeeId: employee._id.toString(),
                            birthdayUserId: employeeUser?._id,
                            birthdayPersonName,
                        },
                    });
                }

                logger.info('[CRON] Birthday notification job completed');
            } catch (error) {
                logger.error({ context: error }, '[CRON] Error in birthday notification job:');
            }
        },
        {
            timezone: 'Asia/Kolkata',
        }
    );

    logger.info('[CRON] Birthday notification job scheduled for 9:00 AM IST daily');
};
