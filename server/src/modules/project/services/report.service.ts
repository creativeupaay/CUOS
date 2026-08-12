import { Task } from '../models/Task.model';
import { TimeLog } from '../models/TimeLog.model';
import { Meeting } from '../models/Meeting.model';
import { Project } from '../models/Project.model';
import mongoose from 'mongoose';

export const getDashboardReports = async (filters: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
}) => {
    const { userId, startDate, endDate } = filters;

    // Define current period
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // default 7 days

    // Define previous period for comparisons
    const duration = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - duration);
    const prevEnd = new Date(start.getTime() - 1);

    // Build common match criteria
    const userMatch = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};
    
    const archivedProjects = await Project.find({ isArchived: true }).select('_id').lean();
    const archivedProjectIds = archivedProjects.map(p => p._id);

    const taskUserMatch = {
        ...(userId ? { $or: [{ createdBy: new mongoose.Types.ObjectId(userId) }, { assignees: new mongoose.Types.ObjectId(userId) }] } : {}),
        parentTaskId: null,
        projectId: { $nin: archivedProjectIds }
    };

    // 1. Total Tasks in period
    const tasksCurrent = await Task.aggregate([
        { $match: { ...taskUserMatch, createdAt: { $lte: end } } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    const totalTasks = {
        completed: tasksCurrent.find(t => t._id === 'completed')?.count || 0,
        inProgress: tasksCurrent.find(t => t._id === 'in-progress')?.count || 0,
        toDo: tasksCurrent.find(t => t._id === 'todo')?.count || 0,
        paused: tasksCurrent.find(t => t._id === 'paused')?.count || 0,
        total: 0
    };
    totalTasks.total = totalTasks.completed + totalTasks.inProgress + totalTasks.toDo + totalTasks.paused;

    // Overdue Tasks
    const overdueCount = await Task.countDocuments({
        ...taskUserMatch,
        status: { $ne: 'completed' },
        deadline: { $lt: new Date() }
    });
    const dueSoonCount = await Task.countDocuments({
        ...taskUserMatch,
        status: { $ne: 'completed' },
        deadline: {
            $gte: new Date(),
            $lte: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // next 48 hours
        }
    });

    // 2. Time Tracked
    const timeCurrent = await TimeLog.aggregate([
        { $match: { ...userMatch, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$duration' } } }
    ]);
    const timePrev = await TimeLog.aggregate([
        { $match: { ...userMatch, date: { $gte: prevStart, $lte: prevEnd } } },
        { $group: { _id: null, total: { $sum: '$duration' } } }
    ]);

    const currentMinutes = timeCurrent[0]?.total || 0;
    const prevMinutes = timePrev[0]?.total || 0;

    // 3. Work Consistency
    const activeDaysRaw = await TimeLog.aggregate([
        { $match: { ...userMatch, date: { $gte: start, $lte: end } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }
            }
        }
    ]);
    const activeDays = activeDaysRaw.filter(d => new Date(d._id).getDay() !== 0).length;
    let totalDays = 0;
    
    const loopStart = new Date(start);
    loopStart.setHours(0,0,0,0);
    const loopEnd = new Date(end);
    loopEnd.setHours(23,59,59,999);
    
    for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== 0) totalDays++; // Exclude Sundays
    }
    if (totalDays === 0) totalDays = 1;
    const dailyAvgMinutes = activeDays > 0 ? Math.round(currentMinutes / activeDays) : 0;

    // 4. Time Spent Trend
    const timeSpentTrendRaw = await TimeLog.aggregate([
        { $match: { ...userMatch, date: { $gte: start, $lte: end } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                minutes: { $sum: '$duration' },
                uniqueTasks: { $addToSet: '$taskId' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    
    // Fill empty days for trend
    const timeSpentTrend = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const found = timeSpentTrendRaw.find(x => x._id === dateStr);
        timeSpentTrend.push({
            date: dateStr,
            minutes: found ? found.minutes : 0,
            tasksCount: found ? found.uniqueTasks.filter((tid: any) => tid?.toString() !== '000000000000000000000000').length : 0
        });
    }

    // 5. Top Projects
    const topProjectsRaw = await TimeLog.aggregate([
        { $match: { ...userMatch, date: { $gte: start, $lte: end } } },
        {
            $group: {
                _id: '$projectId',
                minutes: { $sum: '$duration' }
            }
        },
        { $sort: { minutes: -1 } },
        { $limit: 5 }
    ]);

    const topProjects = [];
    for (const p of topProjectsRaw) {
        if (!p._id) {
            topProjects.push({ projectName: 'Other/General', minutes: p.minutes });
            continue;
        }
        const proj = await Project.findById(p._id).select('name');
        topProjects.push({
            projectName: proj?.name || 'Unknown Project',
            minutes: p.minutes
        });
    }

    // 6. Time Distribution
    // Calculate accurate time distribution based on time logs
    const timeLogsForPeriod = await TimeLog.find({ ...userMatch, date: { $gte: start, $lte: end } }).lean();
    
    let timeOnTasks = 0;
    let timeInMeetings = 0;
    let timeOnOthers = 0;

    for (const log of timeLogsForPeriod) {
        if (log.description === 'Unallocated Time') {
            timeOnOthers += log.duration || 0;
        } else if (log.description?.startsWith('Meeting:')) {
            timeInMeetings += log.duration || 0;
        } else {
            timeOnTasks += log.duration || 0;
        }
    }

    // Fallback: If no meeting timelogs exist, use scheduled meetings duration for backward compatibility
    if (timeInMeetings === 0) {
        const meetingMatch = userId ? { $or: [{ createdBy: new mongoose.Types.ObjectId(userId) }, { 'participants.userId': new mongoose.Types.ObjectId(userId) }] } : {};
        const scheduledMeetings = await Meeting.find({
            ...meetingMatch,
            scheduledAt: { $gte: start, $lte: end }
        });
        timeInMeetings = scheduledMeetings.reduce((acc, m) => acc + (m.duration || 0), 0);
    }
    
    const timeDistribution = [
        { category: 'Time on Tasks', minutes: timeOnTasks },
        { category: 'Time in Meetings', minutes: timeInMeetings },
        { category: 'Others', minutes: timeOnOthers },
    ];

    // 7. Daily Time Log (last 10 days or within period)
    const dailyTimeLog = [...timeSpentTrend].reverse().map(t => ({
        date: t.date,
        tasksCount: t.tasksCount,
        minutes: t.minutes
    }));

    // 8. Completed Tasks
    const completedTasksRaw = await Task.find({
        ...taskUserMatch,
        status: 'completed',
        completedAt: { $gte: start, $lte: end }
    }).populate('projectId', 'name').sort({ completedAt: -1 }).limit(10);

    const completedTasks = completedTasksRaw.map(t => ({
        id: t._id,
        name: t.title,
        project: (t.projectId as any)?.name || 'General',
        completedOn: t.completedAt,
        priority: t.priority,
        // Calculate time taken from TimeLog
    }));

    // Calculate time taken for completed tasks
    for (const t of completedTasks) {
        const tLogs = await TimeLog.aggregate([
            { $match: { taskId: new mongoose.Types.ObjectId(t.id.toString()) } },
            { $group: { _id: null, total: { $sum: '$duration' } } }
        ]);
        (t as any).timeTakenMinutes = tLogs[0]?.total || 0;
    }

    return {
        totalTasks,
        timeTracked: {
            thisPeriodMinutes: currentMinutes,
            lastPeriodMinutes: prevMinutes,
        },
        overdueTasks: {
            overdue: overdueCount,
            dueSoon: dueSoonCount,
        },
        workConsistency: {
            activeDays,
            totalDays,
            dailyAvgMinutes,
        },
        timeSpentTrend,
        topProjects,
        timeDistribution,
        dailyTimeLog,
        completedTasks,
    };
};
