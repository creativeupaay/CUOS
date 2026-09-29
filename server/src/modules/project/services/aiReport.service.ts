import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../../config/env.config';
import { logger } from '../../../utils/logger';
import { Task } from '../models/Task.model';
import { TimeLog } from '../models/TimeLog.model';
import { Meeting } from '../models/Meeting.model';
import { Project } from '../models/Project.model';
import { User } from '../../auth/models/User.model';
import { Employee } from '../../hrms/models/Employee.model';
import { Attendance } from '../../hrms/models/Attendance.model';
import { Holiday } from '../../hrms/models/Holiday.model';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Explicit model registrations to ensure schemas are registered in Mongoose
import '../models/Project.model';
import '../models/Task.model';
import '../models/TimeLog.model';
import '../models/Meeting.model';
import '../../auth/models/User.model';
import '../../hrms/models/Employee.model';
import '../../hrms/models/Attendance.model';
import '../../hrms/models/Holiday.model';

// Reference Project to prevent tree-shaking
void Project;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AiWorkstream {
    name: string;
    summary: string;
    relatedTaskIds: string[];
    relatedTaskNames: string[];
    activeDates: string[];
    activeDays: number;
    totalTime: string;
    observation: string;
}

export interface AiMultiDayWork {
    title: string;
    description: string;
    dates: string[];
    totalTime: string;
}

export interface AiOverlappingTasks {
    tasks: string[];
    description: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface AiOverdueWork {
    title: string;
    description: string;
    relatedWorkstream?: string;
}

export interface AiWorkProgression {
    title: string;
    description: string;
}

export interface AiWorkProgressionStep {
    dateRange: string;
    stageTitle: string;
    description: string;
    status: 'completed' | 'in-progress' | 'ongoing';
    tasksInvolved: string[];
    timeSpent?: string;
}

export interface AiPeriodComparison {
    periodLabel: string;
    previousPeriodRange: string;
    currentTimeFormatted: string;
    previousTimeFormatted: string;
    currentMinutes: number;
    previousMinutes: number;
    timeChangePercentage: number;
    timeChangeDirection: 'increase' | 'decrease' | 'steady';
    currentCompletedTasks: number;
    previousCompletedTasks: number;
    completedTasksChange: number;
    currentActiveDays: number;
    previousActiveDays: number;
    velocitySummary: string;
}

export interface AiWorkAuditSignal {
    severity: 'positive' | 'warning' | 'flag' | 'info';
    category: 'repetitive_tasks' | 'output_ratio' | 'attendance_match' | 'task_clarity' | 'positive_signal';
    title: string;
    description: string;
    impact?: string;
    relatedTasks?: string[];
}

export interface AiWorkAudit {
    overallHealth: 'healthy' | 'needs_review' | 'flagged';
    healthScoreLabel: string;
    summary: string;
    signals: AiWorkAuditSignal[];
}

export interface AiInsightItem {
    title: string;
    description: string;
}

export interface AiSuggestion {
    title: string;
    description: string;
}

export interface AiWorkReport {
    executiveSummary: string;
    overview: string;
    managerSummary: string;
    workAudit: AiWorkAudit;
    periodComparison: AiPeriodComparison;
    workstreams: AiWorkstream[];
    workProgression: AiWorkProgressionStep[];
    multiDayWork: AiMultiDayWork[];
    overlappingTasks: AiOverlappingTasks[];
    overdueWork: AiOverdueWork[];
    timePatterns: AiInsightItem[];
    attendanceInsights: AiInsightItem[];
    taskOrganizationInsights: AiInsightItem[];
    suggestions: AiSuggestion[];
    meta: {
        employeeName: string;
        designation?: string;
        startDate: string;
        endDate: string;
        totalTrackedTime: string;
        generatedAt: string;
        source: 'gemini' | 'cache' | 'analytics';
    };
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

interface CacheEntry {
    report: AiWorkReport;
    expiresAt: number;
}

const reportCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedReport(key: string): AiWorkReport | null {
    const entry = reportCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        reportCache.delete(key);
        return null;
    }
    return entry.report;
}

function setCachedReport(key: string, report: AiWorkReport): void {
    reportCache.set(key, {
        report,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMinutes(mins: number): string {
    if (!mins || isNaN(mins) || mins <= 0) return '0h 0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`AI generation timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}

const GENERATION_TIMEOUT_MS = 25_000; // 25 seconds per model attempt

const MODEL_CANDIDATES = [
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
];

// ─── Deterministic Analytics Synthesis (Fallback) ─────────────────────────────

function buildDeterministicReport(
    payload: any,
    employeeName: string,
    designation: string | undefined,
    start: Date,
    end: Date,
    totalTrackedMinutes: number,
    periodComparison: AiPeriodComparison,
    workAudit: AiWorkAudit,
    progressionSteps: AiWorkProgressionStep[]
): AiWorkReport {
    const tasks = payload.tasks || [];
    const projects = payload.projects || [];
    const attendance = payload.attendanceSummary || {};
    const timeTracked = payload.timeTracked || {};

    const workstreams: AiWorkstream[] = projects.map((p: any) => {
        const relatedTasks = tasks.filter((t: any) => t.project === p.name);
        const datesSet = new Set<string>();
        relatedTasks.forEach((t: any) => (t.workDates || []).forEach((d: string) => datesSet.add(d)));
        const activeDates = Array.from(datesSet).sort();
        const compCount = relatedTasks.filter((t: any) => t.status === 'completed').length;
        const overdueCount = relatedTasks.filter((t: any) => t.isOverdue).length;

        return {
            name: `${p.name} Workstream`,
            summary: `Focused on ${p.name}, completing work across ${relatedTasks.length} task(s) and accounting for ${p.percentage}% of weekly logged time.`,
            relatedTaskIds: relatedTasks.map((t: any) => t.id),
            relatedTaskNames: relatedTasks.map((t: any) => t.title),
            activeDates,
            activeDays: activeDates.length,
            totalTime: p.totalTimeFormatted || '0h 0m',
            observation: `${compCount} completed, ${relatedTasks.length - compCount} in progress${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}.`,
        };
    });

    const multiDayWork: AiMultiDayWork[] = tasks
        .filter((t: any) => t.workDates && t.workDates.length > 1)
        .map((t: any) => ({
            title: t.title,
            description: `Work spanned across ${t.workDates.length} days with ${t.totalTime} of focused time logged.`,
            dates: t.workDates,
            totalTime: t.totalTime,
        }));

    const overdueWork: AiOverdueWork[] = tasks
        .filter((t: any) => t.isOverdue)
        .map((t: any) => ({
            title: t.title,
            description: `Scheduled with deadline ${t.dueDate || 'earlier this week'}, currently marked '${t.status}' with ${t.totalTime} logged.`,
            relatedWorkstream: `${t.project} Workstream`,
        }));

    const timePatterns: AiInsightItem[] = [];
    if (projects.length > 0) {
        timePatterns.push({
            title: 'Project Focus Distribution',
            description: `Primary focus was on ${projects[0].name} (${projects[0].percentage}% of total logged time).`,
        });
    }
    if (timeTracked.meetingMinutes > 0) {
        const meetPct = Math.round((timeTracked.meetingMinutes / (totalTrackedMinutes || 1)) * 100);
        timePatterns.push({
            title: 'Collaboration vs Deep Work',
            description: `${meetPct}% of logged time was spent in meetings (${timeTracked.meetingTimeFormatted}), leaving ${100 - meetPct}% for task execution.`,
        });
    }

    const attendanceInsights: AiInsightItem[] = [
        {
            title: 'Attendance Consistency',
            description: `Recorded ${attendance.presentDays || 0} Present day(s), ${attendance.wfhDays || 0} WFH day(s), and ${attendance.absentDays || 0} Absent day(s). Average daily active time was ${attendance.averageWorkHours || '0h 0m'}.`,
        },
    ];

    const taskOrganizationInsights: AiInsightItem[] = [
        {
            title: 'Task Granularity',
            description: `Total of ${tasks.length} distinct task(s) logged during the period, averaging ${(totalTrackedMinutes / (tasks.length || 1) / 60).toFixed(1)} hours per task.`,
        },
    ];

    const completedTasksCount = tasks.filter((t: any) => t.status === 'completed').length;
    const inProgressTasksCount = tasks.filter((t: any) => t.status === 'in-progress').length;

    const topProject = projects[0]?.name || 'assigned tasks';
    const topPct = projects[0]?.percentage || '0%';

    const healthSentence = workAudit.overallHealth === 'healthy'
        ? 'Overall work progress is on track with clean time logs and consistent task completions.'
        : workAudit.overallHealth === 'flagged'
        ? `Review recommended: ${workAudit.summary}`
        : `Work activity is steady, with minor structuring adjustments recommended: ${workAudit.summary}`;

    const executiveSummary = `${employeeName} logged ${timeTracked.totalTimeFormatted || formatMinutes(totalTrackedMinutes)} across ${projects.length} project(s) between ${start.toISOString().split('T')[0]} and ${end.toISOString().split('T')[0]}, focusing ${topPct} of effort on ${topProject}. The employee completed ${completedTasksCount} task(s) with ${inProgressTasksCount} currently in progress across ${attendance.presentDays || 0} working day(s). ${healthSentence}`;

    const suggestions: AiSuggestion[] = [];
    if (overdueWork.length > 0) {
        suggestions.push({
            title: 'Prioritize Overdue Tasks',
            description: `Focus on closing the ${overdueWork.length} overdue task(s) before picking up new assignments.`,
        });
    }
    if (tasks.length > 8) {
        suggestions.push({
            title: 'Group Related Subtasks',
            description: 'Group short related tasks under a single main task to keep time tracking clear and organized.',
        });
    }
    if (suggestions.length === 0) {
        suggestions.push({
            title: 'Maintain Consistent Progress',
            description: 'Work is well distributed across projects and deliverables are progressing steadily.',
        });
    }

    return {
        executiveSummary,
        overview: executiveSummary,
        managerSummary: executiveSummary,
        workAudit,
        periodComparison,
        workstreams,
        workProgression: progressionSteps,
        multiDayWork,
        overlappingTasks: [],
        overdueWork,
        timePatterns,
        attendanceInsights,
        taskOrganizationInsights,
        suggestions,
        meta: {
            employeeName,
            designation,
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            totalTrackedTime: formatMinutes(totalTrackedMinutes),
            generatedAt: new Date().toISOString(),
            source: 'analytics',
        },
    };
}

// ─── Main Service Function ───────────────────────────────────────────────────

export async function generateEmployeeAiReport(params: {
    targetUserId: string;
    startDate?: Date;
    endDate?: Date;
}): Promise<AiWorkReport> {
    const { targetUserId } = params;

    // Default dates: last 7 days if not provided
    const end = params.endDate ? new Date(params.endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = params.startDate ? new Date(params.startDate) : new Date(end);
    if (!params.startDate) {
        start.setDate(end.getDate() - 6);
    }
    start.setHours(0, 0, 0, 0);

    const userObjId = new mongoose.Types.ObjectId(targetUserId);

    // 1. Fetch User & Employee Details
    const user = await User.findById(userObjId).select('name email role').lean();
    if (!user) {
        throw new Error('User not found');
    }
    const employeeName = user.name || user.email.split('@')[0];

    const employee = await Employee.findOne({ userId: userObjId })
        .select('_id employeeId designation department')
        .lean();

    // 2. Fetch TimeLogs in Date Range
    const timeLogs = await TimeLog.find({
        userId: userObjId,
        date: { $gte: start, $lte: end },
    })
        .populate({ path: 'taskId', select: 'title description status priority deadline completedAt' })
        .populate({ path: 'projectId', select: 'name' })
        .lean();

    // 3. Aggregate Task Activity from TimeLogs
    const taskMap = new Map<string, {
        id: string;
        title: string;
        description?: string;
        project: string;
        status: string;
        priority: string;
        deadline?: string;
        completedAt?: string;
        isOverdue: boolean;
        totalMinutes: number;
        workDatesSet: Set<string>;
    }>();

    let totalWorkMinutes = 0;
    let totalMeetingMinutes = 0;

    for (const log of timeLogs) {
        const dur = log.duration || 0;
        const isMeeting = log.description?.startsWith('Meeting:') || log.source === 'google_meet';
        if (isMeeting) {
            totalMeetingMinutes += dur;
        } else {
            totalWorkMinutes += dur;
        }

        const dateStr = log.date ? new Date(log.date).toISOString().split('T')[0] : '';

        if (log.taskId && typeof log.taskId === 'object') {
            const t = log.taskId as any;
            const tid = t._id?.toString();
            if (tid && tid !== '000000000000000000000000') {
                if (!taskMap.has(tid)) {
                    const isOverdue = t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date();
                    taskMap.set(tid, {
                        id: tid,
                        title: t.title || 'Untitled Task',
                        description: t.description ? t.description.slice(0, 250) : undefined,
                        project: (log.projectId as any)?.name || 'General',
                        status: t.status || 'in-progress',
                        priority: t.priority || 'medium',
                        deadline: t.deadline ? new Date(t.deadline).toISOString().split('T')[0] : undefined,
                        completedAt: t.completedAt ? new Date(t.completedAt).toISOString().split('T')[0] : undefined,
                        isOverdue: !!isOverdue,
                        totalMinutes: 0,
                        workDatesSet: new Set<string>(),
                    });
                }
                const entry = taskMap.get(tid)!;
                entry.totalMinutes += dur;
                if (dateStr) entry.workDatesSet.add(dateStr);
            }
        }
    }

    // 4. Fetch Completed & Overdue Tasks assigned to employee in period (even if no time log recorded)
    const assignedTasks = await Task.find({
        assignees: userObjId,
        $or: [
            { completedAt: { $gte: start, $lte: end } },
            { deadline: { $gte: start, $lte: end } },
            { status: 'in-progress' },
        ],
    })
        .populate('projectId', 'name')
        .select('title description status priority deadline completedAt projectId')
        .lean();

    for (const at of assignedTasks) {
        const tid = at._id.toString();
        if (!taskMap.has(tid)) {
            const isOverdue = at.status !== 'completed' && at.deadline && new Date(at.deadline) < new Date();
            taskMap.set(tid, {
                id: tid,
                title: at.title || 'Untitled Task',
                description: at.description ? at.description.slice(0, 250) : undefined,
                project: (at.projectId as any)?.name || 'General',
                status: at.status || 'todo',
                priority: at.priority || 'medium',
                deadline: at.deadline ? new Date(at.deadline).toISOString().split('T')[0] : undefined,
                completedAt: at.completedAt ? new Date(at.completedAt).toISOString().split('T')[0] : undefined,
                isOverdue: !!isOverdue,
                totalMinutes: 0,
                workDatesSet: new Set<string>(),
            });
        }
    }

    const tasksList = Array.from(taskMap.values()).map(t => ({
        id: t.id,
        name: t.title,
        description: t.description,
        project: t.project,
        status: t.status,
        priority: t.priority,
        dueDate: t.deadline,
        completedAt: t.completedAt,
        isOverdue: t.isOverdue,
        totalTime: formatMinutes(t.totalMinutes),
        totalMinutes: t.totalMinutes,
        workDates: Array.from(t.workDatesSet).sort(),
    }));

    // 5. Fetch Attendance Records
    let attendanceSummary = 'Attendance records were not available for this period.';
    const attendanceRecordsFormatted: any[] = [];
    if (employee?._id) {
        const attRecords = await Attendance.find({
            employeeId: employee._id,
            date: { $gte: start, $lte: end },
        }).lean();

        let presentCount = 0;
        let wfhCount = 0;
        let absentCount = 0;
        let halfDayCount = 0;
        let leaveCount = 0;
        let holidayCount = 0;

        for (const att of attRecords) {
            const dateStr = att.date ? new Date(att.date).toISOString().split('T')[0] : '';
            attendanceRecordsFormatted.push({
                date: dateStr,
                status: att.status,
                totalHours: att.totalHours || 0,
            });
            if (att.status === 'present') presentCount++;
            else if (att.status === 'wfh') wfhCount++;
            else if (att.status === 'absent') absentCount++;
            else if (att.status === 'half-day') halfDayCount++;
            else if (att.status === 'on-leave') leaveCount++;
            else if (att.status === 'holiday') holidayCount++;
        }

        const parts: string[] = [];
        if (presentCount > 0) parts.push(`${presentCount} Present`);
        if (wfhCount > 0) parts.push(`${wfhCount} WFH`);
        if (halfDayCount > 0) parts.push(`${halfDayCount} Half-day`);
        if (leaveCount > 0) parts.push(`${leaveCount} On-leave`);
        if (holidayCount > 0) parts.push(`${holidayCount} Holiday`);
        if (absentCount > 0) parts.push(`${absentCount} Absent`);

        if (parts.length > 0) {
            attendanceSummary = `Attendance records show: ${parts.join(', ')}.`;
        }
    }

    // 6. Fetch Meetings
    const meetings = await Meeting.find({
        $or: [
            { createdBy: userObjId },
            { 'participants.userId': userObjId },
        ],
        scheduledAt: { $gte: start, $lte: end },
    })
        .select('title scheduledAt duration type')
        .lean();

    const meetingsList = meetings.map(m => ({
        title: m.title || 'Meeting',
        date: m.scheduledAt ? new Date(m.scheduledAt).toISOString().split('T')[0] : '',
        duration: formatMinutes(m.duration || 0),
        durationMinutes: m.duration || 0,
    }));

    // 7. Calculate Project Breakdown & Percentages
    const projectMinutesMap = new Map<string, number>();
    for (const t of tasksList) {
        projectMinutesMap.set(t.project, (projectMinutesMap.get(t.project) || 0) + t.totalMinutes);
    }
    const projectsList = Array.from(projectMinutesMap.entries())
        .map(([projectName, minutes]) => {
            const percentage = totalWorkMinutes > 0 ? Math.round((minutes / totalWorkMinutes) * 100) : 0;
            return {
                name: projectName,
                trackedTime: formatMinutes(minutes),
                minutes,
                percentage: `${percentage}%`,
            };
        })
        .sort((a, b) => b.minutes - a.minutes);

    // 8. Previous Period Comparison Metrics
    const periodDurationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodDurationMs);
    const prevEnd = new Date(start.getTime() - 1);
    const prevLogs = await TimeLog.find({
        userId: userObjId,
        date: { $gte: prevStart, $lte: prevEnd },
    }).select('duration date').lean();
    const prevMinutes = prevLogs.reduce((acc, l) => acc + (l.duration || 0), 0);
    const prevDatesSet = new Set(prevLogs.map(l => l.date ? new Date(l.date).toISOString().split('T')[0] : ''));
    prevDatesSet.delete('');
    const prevActiveDays = prevDatesSet.size;

    const prevCompletedTasks = await Task.countDocuments({
        assignees: userObjId,
        status: 'completed',
        completedAt: { $gte: prevStart, $lte: prevEnd },
    });

    const totalTrackedMinutes = totalWorkMinutes + totalMeetingMinutes;
    const currentCompletedTasks = tasksList.filter(t => t.status === 'completed').length;
    const currentActiveDatesSet = new Set(timeLogs.map(l => l.date ? new Date(l.date).toISOString().split('T')[0] : ''));
    currentActiveDatesSet.delete('');
    const currentActiveDays = currentActiveDatesSet.size;

    const timeChangePercentage = prevMinutes > 0
        ? Math.round(((totalTrackedMinutes - prevMinutes) / prevMinutes) * 100)
        : (totalTrackedMinutes > 0 ? 100 : 0);

    const timeChangeDirection: 'increase' | 'decrease' | 'steady' =
        timeChangePercentage > 3 ? 'increase' : timeChangePercentage < -3 ? 'decrease' : 'steady';

    const completedTasksChange = currentCompletedTasks - prevCompletedTasks;

    const periodDaysCount = Math.round(periodDurationMs / (24 * 60 * 60 * 1000));
    const periodLabel = periodDaysCount <= 8 ? 'vs Previous 7 Days' : periodDaysCount <= 35 ? 'vs Previous Month' : 'vs Previous Period';

    let velocitySummary = '';
    if (prevMinutes === 0) {
        velocitySummary = `Logged ${formatMinutes(totalTrackedMinutes)} across ${currentActiveDays} working day(s) with ${currentCompletedTasks} task(s) completed (no previous period activity recorded).`;
    } else if (timeChangeDirection === 'increase') {
        velocitySummary = `Tracked hours increased by ${timeChangePercentage}% compared to the previous period (${formatMinutes(prevMinutes)} previously). Completed ${currentCompletedTasks} task(s) across ${currentActiveDays} working day(s).`;
    } else if (timeChangeDirection === 'decrease') {
        const compSentence = currentCompletedTasks > prevCompletedTasks
            ? `However, output improved with ${currentCompletedTasks} task(s) completed (up from ${prevCompletedTasks} previously).`
            : `Completed ${currentCompletedTasks} task(s) across ${currentActiveDays} working day(s).`;
        velocitySummary = `Tracked hours decreased by ${Math.abs(timeChangePercentage)}% compared to the previous period (${formatMinutes(prevMinutes)} previously). ${compSentence}`;
    } else {
        velocitySummary = `Work hours remained steady compared to the previous period (${formatMinutes(totalTrackedMinutes)} vs ${formatMinutes(prevMinutes)}), closing ${currentCompletedTasks} task(s) across ${currentActiveDays} working day(s).`;
    }

    const periodComparison: AiPeriodComparison = {
        periodLabel,
        previousPeriodRange: `${prevStart.toISOString().split('T')[0]} to ${prevEnd.toISOString().split('T')[0]}`,
        currentTimeFormatted: formatMinutes(totalTrackedMinutes),
        previousTimeFormatted: formatMinutes(prevMinutes),
        currentMinutes: totalTrackedMinutes,
        previousMinutes: prevMinutes,
        timeChangePercentage,
        timeChangeDirection,
        currentCompletedTasks,
        previousCompletedTasks: prevCompletedTasks,
        completedTasksChange,
        currentActiveDays,
        previousActiveDays: prevActiveDays,
        velocitySummary,
    };

    // 9. Work Audit & Quality Signals
    const auditSignals: AiWorkAuditSignal[] = [];
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    // Group tasks by normalized title to detect duplicate task creation
    const titleGroupMap = new Map<string, { tasks: typeof tasksList; totalMins: number; allDates: Set<string> }>();
    for (const t of tasksList) {
        const norm = normalize(t.name);
        if (!norm) continue;
        if (!titleGroupMap.has(norm)) {
            titleGroupMap.set(norm, { tasks: [], totalMins: 0, allDates: new Set() });
        }
        const grp = titleGroupMap.get(norm)!;
        grp.tasks.push(t);
        grp.totalMins += t.totalMinutes;
        t.workDates.forEach(d => grp.allDates.add(d));
    }

    let repetitiveTaskCount = 0;
    for (const [, grp] of titleGroupMap.entries()) {
        const isDuplicateTask = grp.tasks.length > 1;
        const isMultiDaySameTask = grp.allDates.size >= 2 && grp.totalMins >= 120;
        const repTask = grp.tasks[0];

        if (isDuplicateTask || isMultiDaySameTask) {
            repetitiveTaskCount++;
            const daysCount = grp.allDates.size;
            const timeStr = formatMinutes(grp.totalMins);

            if (isDuplicateTask) {
                auditSignals.push({
                    severity: 'flag',
                    category: 'repetitive_tasks',
                    title: `Duplicate Task Entries: "${repTask.name}"`,
                    description: `${grp.tasks.length} separate tasks were created with the exact same title ("${repTask.name}"), with ${timeStr} logged across ${daysCount} day(s). Creating duplicate tasks makes it difficult to track real progress.`,
                    impact: 'Makes task tracking unclear and splits progress metrics',
                    relatedTasks: grp.tasks.map(t => t.name),
                });
            } else if (daysCount >= 3 || grp.totalMins >= 240) {
                auditSignals.push({
                    severity: 'warning',
                    category: 'repetitive_tasks',
                    title: `Same Task Logged Over Multiple Days: "${repTask.name}"`,
                    description: `This task was worked on across ${daysCount} separate days (${timeStr} total) without being completed or broken into smaller subtasks.`,
                    impact: 'Task may be stuck or needs to be broken down',
                    relatedTasks: [repTask.name],
                });
            }
        }
    }

    // Output vs effort ratio
    if (totalWorkMinutes >= 480 && currentCompletedTasks === 0) {
        auditSignals.push({
            severity: 'warning',
            category: 'output_ratio',
            title: 'High Hours Logged With 0 Tasks Completed',
            description: `${formatMinutes(totalWorkMinutes)} of effort was logged across ${tasksList.length} task(s), but no tasks were marked as completed. Please check if work is blocked or pending review.`,
            impact: 'Risk of project delivery delay',
        });
    } else if (currentCompletedTasks >= 3) {
        auditSignals.push({
            severity: 'positive',
            category: 'positive_signal',
            title: `Consistent Progress (${currentCompletedTasks} Tasks Completed)`,
            description: `Successfully completed ${currentCompletedTasks} task(s) during this period, showing consistent progress on deliverables.`,
        });
    }

    // Attendance alignment
    if (attendanceRecordsFormatted.length > 0) {
        const attPresentDates = new Set(attendanceRecordsFormatted.filter(a => a.status === 'present' || a.status === 'half_day' || a.status === 'wfh').map(a => a.date));
        const loggedWithoutAtt: string[] = [];
        for (const lDate of currentActiveDatesSet) {
            if (!attPresentDates.has(lDate)) loggedWithoutAtt.push(lDate);
        }
        if (loggedWithoutAtt.length > 0) {
            auditSignals.push({
                severity: 'flag',
                category: 'attendance_match',
                title: 'Time Logged Without Attendance Check-In',
                description: `Time entries were submitted on ${loggedWithoutAtt.join(', ')}, but attendance was not marked for those dates.`,
                impact: 'Discrepancy between time logs and attendance records',
            });
        } else {
            auditSignals.push({
                severity: 'positive',
                category: 'positive_signal',
                title: 'Attendance and Work Logs Match',
                description: `Daily time entries match recorded attendance (${currentActiveDays} active days).`,
            });
        }
    }

    const hasFlags = auditSignals.some(s => s.severity === 'flag');
    const hasWarnings = auditSignals.some(s => s.severity === 'warning');

    if (!hasFlags && !hasWarnings) {
        auditSignals.unshift({
            severity: 'positive',
            category: 'positive_signal',
            title: 'Work Activity Is Healthy & On Track',
            description: 'No duplicate tasks, idle logs, or unusual patterns were detected. Work is well distributed across projects.',
        });
    }

    const overallHealth: 'healthy' | 'needs_review' | 'flagged' =
        hasFlags ? 'flagged' : hasWarnings ? 'needs_review' : 'healthy';

    const healthScoreLabel =
        overallHealth === 'flagged'
            ? 'Review Needed: Repetitive Tasks Found'
            : overallHealth === 'needs_review'
            ? 'Needs Attention: Review Task Updates'
            : 'On Track & Clean Record';

    const auditSummary =
        overallHealth === 'flagged'
            ? `Review recommended: ${repetitiveTaskCount > 0 ? `${repetitiveTaskCount} duplicate or repetitive task(s) were logged across working days.` : 'Discrepancies found in work logs or attendance records.'}`
            : overallHealth === 'needs_review'
            ? 'Work is steady, but some tasks stayed open across multiple days without closure. Breaking them into smaller steps is recommended.'
            : 'Work is on track. Tasks were completed on schedule with accurate time logging.';

    const workAudit: AiWorkAudit = {
        overallHealth,
        healthScoreLabel,
        summary: auditSummary,
        signals: auditSignals,
    };

    // 10. Chronological Work Progression Steps
    const dayMap = new Map<string, { date: string; taskNames: Set<string>; minutes: number; projects: Set<string> }>();
    for (const log of timeLogs) {
        const dateStr = log.date ? new Date(log.date).toISOString().split('T')[0] : '';
        if (!dateStr) continue;
        if (!dayMap.has(dateStr)) {
            dayMap.set(dateStr, { date: dateStr, taskNames: new Set(), minutes: 0, projects: new Set() });
        }
        const entry = dayMap.get(dateStr)!;
        entry.minutes += (log.duration || 0);
        if (log.taskId && typeof log.taskId === 'object') {
            const t = log.taskId as any;
            if (t.title) entry.taskNames.add(t.title);
        }
        if (log.projectId && typeof log.projectId === 'object') {
            const p = log.projectId as any;
            if (p.name) entry.projects.add(p.name);
        }
    }

    const sortedDays = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const progressionSteps: AiWorkProgressionStep[] = [];
    if (sortedDays.length <= 3) {
        for (const day of sortedDays) {
            const pArr = Array.from(day.projects);
            const tArr = Array.from(day.taskNames);
            const stageTitle = pArr.length > 0 ? `${pArr.join(', ')} Activity` : 'Daily Work Execution';
            progressionSteps.push({
                dateRange: day.date,
                stageTitle,
                description: `Logged ${formatMinutes(day.minutes)} across ${tArr.length} task(s)${pArr.length > 0 ? ` on ${pArr.join(', ')}` : ''}.`,
                status: tArr.length > 0 ? 'completed' : 'in-progress',
                tasksInvolved: tArr,
                timeSpent: formatMinutes(day.minutes),
            });
        }
    } else {
        const chunkSize = Math.ceil(sortedDays.length / 3);
        for (let i = 0; i < sortedDays.length; i += chunkSize) {
            const chunk = sortedDays.slice(i, i + chunkSize);
            const startDateStr = chunk[0].date;
            const endDateStr = chunk[chunk.length - 1].date;
            const dateRange = startDateStr === endDateStr ? startDateStr : `${startDateStr} to ${endDateStr}`;
            const chunkMinutes = chunk.reduce((sum, d) => sum + d.minutes, 0);
            const chunkTasksSet = new Set<string>();
            const chunkProjectsSet = new Set<string>();
            chunk.forEach(d => {
                d.taskNames.forEach(t => chunkTasksSet.add(t));
                d.projects.forEach(p => chunkProjectsSet.add(p));
            });
            const pArr = Array.from(chunkProjectsSet);
            const tArr = Array.from(chunkTasksSet);
            const phaseNum = Math.floor(i / chunkSize) + 1;
            const stageTitle = `Phase ${phaseNum}: ${pArr.slice(0, 2).join(' & ') || 'General Execution'}`;

            progressionSteps.push({
                dateRange,
                stageTitle,
                description: `Progressed ${tArr.length} task(s) totaling ${formatMinutes(chunkMinutes)}${pArr.length > 0 ? ` across ${pArr.join(', ')}` : ''}.`,
                status: phaseNum === 3 ? 'in-progress' : 'completed',
                tasksInvolved: tArr,
                timeSpent: formatMinutes(chunkMinutes),
            });
        }
    }

    // 11. Check for Insufficient Data
    if (tasksList.length === 0 && totalTrackedMinutes === 0 && meetingsList.length === 0) {
        return {
            executiveSummary: 'No work activity, tasks, or time logs were recorded for this employee during the selected date range.',
            overview: 'There is not enough work data or tracked activity in this period to generate meaningful AI insights.',
            managerSummary: 'No work activity, tasks, or time logs were recorded for this employee during the selected date range.',
            workAudit: {
                overallHealth: 'healthy',
                healthScoreLabel: 'No Activity Recorded',
                summary: 'No time logs or task activities were logged in this period.',
                signals: [],
            },
            periodComparison: {
                periodLabel: 'vs Previous Period',
                previousPeriodRange: '',
                currentTimeFormatted: '0h 0m',
                previousTimeFormatted: '0h 0m',
                currentMinutes: 0,
                previousMinutes: 0,
                timeChangePercentage: 0,
                timeChangeDirection: 'steady',
                currentCompletedTasks: 0,
                previousCompletedTasks: 0,
                completedTasksChange: 0,
                currentActiveDays: 0,
                previousActiveDays: 0,
                velocitySummary: 'No activity recorded during this period.',
            },
            workstreams: [],
            workProgression: [],
            multiDayWork: [],
            overlappingTasks: [],
            overdueWork: [],
            timePatterns: [],
            attendanceInsights: [],
            taskOrganizationInsights: [],
            suggestions: [
                {
                    title: 'Verify Time Period',
                    description: 'Check if another date range has recorded task activity or attendance logs for this employee.',
                },
            ],
            meta: {
                employeeName,
                designation: employee?.designation,
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                totalTrackedTime: '0h 0m',
                generatedAt: new Date().toISOString(),
                source: 'analytics',
            },
        };
    }

    // 12. Check Cache
    const dataHash = crypto
        .createHash('md5')
        .update(JSON.stringify({
            userId: targetUserId,
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
            taskCount: tasksList.length,
            totalWorkMinutes,
            totalMeetingMinutes,
            prevMinutes,
        }))
        .digest('hex');

    const cacheKey = `${targetUserId}_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}_${dataHash}`;
    const cached = getCachedReport(cacheKey);
    if (cached) {
        logger.info(`[AiReport] Serving cached AI work report for user ${targetUserId}`);
        return { ...cached, meta: { ...cached.meta, source: 'cache' } };
    }

    // 13. Build Compact Gemini Payload
    const compactPayload = {
        employee: {
            name: employeeName,
            designation: employee?.designation || 'Team Member',
            department: employee?.department || 'Operations',
        },
        period: {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
        },
        periodComparison,
        workAudit,
        progressionSteps,
        attendanceSummary,
        attendanceRecords: attendanceRecordsFormatted,
        timeTracked: {
            taskMinutes: totalWorkMinutes,
            taskTimeFormatted: formatMinutes(totalWorkMinutes),
            meetingMinutes: totalMeetingMinutes,
            meetingTimeFormatted: formatMinutes(totalMeetingMinutes),
            totalMinutes: totalTrackedMinutes,
            totalTimeFormatted: formatMinutes(totalTrackedMinutes),
            previousPeriodMinutes: prevMinutes,
            previousPeriodFormatted: formatMinutes(prevMinutes),
        },
        projects: projectsList,
        tasks: tasksList.map(t => ({
            id: t.id,
            title: t.name,
            description: t.description || '',
            project: t.project,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate || null,
            completedAt: t.completedAt || null,
            isOverdue: t.isOverdue,
            totalTime: t.totalTime,
            totalMinutes: t.totalMinutes,
            workDates: t.workDates,
            activeDayCount: t.workDates.length,
        })),
        meetings: meetingsList,
    };

    // 14. Build System Prompt & Call Gemini
    const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('AI generation is unavailable: GEMINI_API_KEY is not configured on the server.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const systemPrompt = `You are an executive work analyst for CUOS (Creative Upaay Operating System).
Your task is to analyze the weekly/monthly work of an employee based ONLY on the provided structured JSON data and answer:
"What does this period's work actually represent?"

WRITING STYLE & TONE (CRITICAL):
- Use clean, professional corporate English that is moderate, clear, and easily understood by managers and team members.
- Avoid overly academic, dense, or robotic vocabulary (do NOT use words like "synthesized cadence", "semantic grouping", "distortion", "fragmentation", "granularity", "progression trajectory").
- Use standard business terms: "deliverables", "key initiatives", "completed tasks", "milestones", "logged hours", "work pace", "on track", "needs attention", "action items".
- Keep sentences concise, direct, and natural (15–20 words per sentence).
- Be constructive and balanced: clearly outline what was achieved, note any repetitive tasks or roadblocks, and highlight positive deliverable progress.

CORE RESPONSIBILITIES:
1. EXECUTIVE SUMMARY: Provide a SINGLE concise 3-4 sentence managerial review in clear business English:
   (a) Primary projects and initiatives worked on,
   (b) Key milestones/deliverables completed,
   (c) Performance and work pace compared to the previous period,
   (d) Any repetitive tasks, blockers, or clean on-track progress.
   DO NOT output multiple paragraphs that repeat the same information.
2. WORK QUALITY & SIGNALS: Note if the employee worked on the same repetitive task across multiple days, if tasks were duplicated, or if deliverables were closed on schedule.
3. WORK PROGRESSION: Refine the chronological progression steps across days/phases into clear stages with descriptive summaries, milestone status, and covered tasks.
4. KEY WORKSTREAMS: Group related tasks under clear, simple workstream names (e.g. "Tender Portal - Proposal Module").
5. ACTIONABLE RECOMMENDATIONS: Maximum 3 practical, actionable suggestions for the employee or manager.

STRICT CONSTRAINTS:
- Use ONLY facts provided in the payload. Never invent tasks, times, dates, attendance, or reasons for delays.
- NEVER accuse the employee of fraud or manipulation. Keep language strictly professional, analytical, and objective.
- Output approximately 400 to 700 words across the JSON structure.

OUTPUT SCHEMA:
Respond ONLY with a valid JSON object matching this exact schema:
{
  "executiveSummary": "A single comprehensive 3-4 sentence managerial review.",
  "workstreams": [
    {
      "name": "Workstream Name",
      "summary": "Concise summary of what this workstream accomplished.",
      "relatedTaskIds": ["id1", "id2"],
      "relatedTaskNames": ["Task Name 1", "Task Name 2"],
      "activeDates": ["2026-09-22", "2026-09-24"],
      "activeDays": 2,
      "totalTime": "4h 30m",
      "observation": "Observation regarding this workstream."
    }
  ],
  "workProgression": [
    {
      "dateRange": "2026-09-22 to 2026-09-24",
      "stageTitle": "Phase 1: Architecture Review",
      "description": "Narrative explanation of activities and accomplishments during this phase.",
      "status": "completed|in-progress|ongoing",
      "tasksInvolved": ["Task Name 1", "Task Name 2"],
      "timeSpent": "4h 35m"
    }
  ],
  "multiDayWork": [
    {
      "title": "Work Title",
      "description": "Explanation of multi-day activity.",
      "dates": ["2026-09-22", "2026-09-23"],
      "totalTime": "5h 15m"
    }
  ],
  "overlappingTasks": [
    {
      "tasks": ["Task A", "Task B"],
      "description": "Explanation of how these entries relate.",
      "confidence": "high|medium|low"
    }
  ],
  "overdueWork": [
    {
      "title": "Task / Work Title",
      "description": "Context about the overdue item.",
      "relatedWorkstream": "Workstream Name or General"
    }
  ],
  "timePatterns": [
    {
      "title": "Pattern Title",
      "description": "Observation regarding time concentration."
    }
  ],
  "attendanceInsights": [
    {
      "title": "Attendance & Activity Context",
      "description": "Factual attendance context."
    }
  ],
  "taskOrganizationInsights": [
    {
      "title": "Task Structuring Pattern",
      "description": "Observation and recommendation regarding task granularity."
    }
  ],
  "suggestions": [
    {
      "title": "Suggestion Title",
      "description": "Constructive advice."
    }
  ]
}

DATA PAYLOAD:
${JSON.stringify(compactPayload, null, 2)}`;

    let generatedJson: any = null;

    for (const modelName of MODEL_CANDIDATES) {
        try {
            logger.info(`[AiReport] Requesting AI report for ${employeeName} using ${modelName}`);

            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 8192,
                    responseMimeType: 'application/json',
                },
            });

            const result = await withTimeout(
                model.generateContent(systemPrompt),
                GENERATION_TIMEOUT_MS
            );

            const text = result.response.text().trim();

            let cleaned = text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleaned = jsonMatch[0];
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(cleaned);
            if (parsed && typeof parsed === 'object') {
                generatedJson = parsed;
                logger.info(`[AiReport] Successfully generated report using ${modelName}`);
                break;
            }
        } catch (err: any) {
            logger.warn({ err: err.message }, `[AiReport] Failed with model ${modelName}, trying next fallback...`);
            await new Promise((resolve) => setTimeout(resolve, 600));
        }
    }

    let finalReport: AiWorkReport;

    if (generatedJson) {
        // 15. Validate & Structure Final Report from AI
        const execSummary = generatedJson.executiveSummary || generatedJson.managerSummary || generatedJson.overview || 'Weekly summary of employee work activity and task distribution.';

        const finalProgression: AiWorkProgressionStep[] = Array.isArray(generatedJson.workProgression) && generatedJson.workProgression.length > 0
            ? generatedJson.workProgression.map((wp: any, idx: number) => ({
                dateRange: wp.dateRange || progressionSteps[idx]?.dateRange || 'In Period',
                stageTitle: wp.stageTitle || wp.title || `Phase ${idx + 1}`,
                description: wp.description || '',
                status: (wp.status === 'completed' || wp.status === 'in-progress' || wp.status === 'ongoing') ? wp.status : 'completed',
                tasksInvolved: Array.isArray(wp.tasksInvolved) && wp.tasksInvolved.length > 0 ? wp.tasksInvolved : (progressionSteps[idx]?.tasksInvolved || []),
                timeSpent: wp.timeSpent || progressionSteps[idx]?.timeSpent || '',
            }))
            : progressionSteps;

        finalReport = {
            executiveSummary: execSummary,
            overview: execSummary,
            managerSummary: execSummary,
            workAudit,
            periodComparison,
            workstreams: Array.isArray(generatedJson.workstreams) ? generatedJson.workstreams : [],
            workProgression: finalProgression,
            multiDayWork: Array.isArray(generatedJson.multiDayWork) ? generatedJson.multiDayWork : [],
            overlappingTasks: Array.isArray(generatedJson.overlappingTasks) ? generatedJson.overlappingTasks : [],
            overdueWork: Array.isArray(generatedJson.overdueWork) ? generatedJson.overdueWork : [],
            timePatterns: Array.isArray(generatedJson.timePatterns) ? generatedJson.timePatterns : [],
            attendanceInsights: Array.isArray(generatedJson.attendanceInsights) ? generatedJson.attendanceInsights : [],
            taskOrganizationInsights: Array.isArray(generatedJson.taskOrganizationInsights) ? generatedJson.taskOrganizationInsights : [],
            suggestions: Array.isArray(generatedJson.suggestions) ? generatedJson.suggestions.slice(0, 3) : [],
            meta: {
                employeeName,
                designation: employee?.designation,
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0],
                totalTrackedTime: formatMinutes(totalTrackedMinutes),
                generatedAt: new Date().toISOString(),
                source: 'gemini',
            },
        };
    } else {
        logger.warn(`[AiReport] AI service unavailable, synthesizing report deterministically from activity data for ${employeeName}`);
        finalReport = buildDeterministicReport(
            compactPayload,
            employeeName,
            employee?.designation,
            start,
            end,
            totalTrackedMinutes,
            periodComparison,
            workAudit,
            progressionSteps
        );
    }

    // Cache the report
    setCachedReport(cacheKey, finalReport);

    return finalReport;
}
