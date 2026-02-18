import { TimeLog, ITimeLog } from '../models/TimeLog.model';
import AppError from '../../../utils/appError';

export interface CreateTimeLogData {
    projectId: string;
    taskId: string;
    userId: string;
    date: Date;
    duration: number;
    startTime?: Date;
    endTime?: Date;
    description?: string;
    hourlyRate?: number;
    billable?: boolean;
}

export interface UpdateTimeLogData {
    date?: Date;
    duration?: number;
    startTime?: Date;
    endTime?: Date;
    description?: string;
    hourlyRate?: number;
    billable?: boolean;
}

export const createTimeLog = async (
    data: CreateTimeLogData
): Promise<ITimeLog> => {
    const timeLog = await TimeLog.create(data);
    return timeLog;
};

export const getProjectTimeLogs = async (
    projectId: string,
    filters?: {
        userId?: string;
        startDate?: Date;
        endDate?: Date;
        billable?: boolean;
    }
): Promise<ITimeLog[]> => {
    const query: any = { projectId };

    if (filters?.userId) query.userId = filters.userId;
    if (filters?.billable !== undefined) query.billable = filters.billable;
    if (filters?.startDate || filters?.endDate) {
        query.date = {};
        if (filters.startDate) query.date.$gte = filters.startDate;
        if (filters.endDate) query.date.$lte = filters.endDate;
    }

    const timeLogs = await TimeLog.find(query)
        .populate('userId', 'name email')
        .populate('taskId', 'title')
        .sort({ date: -1 });

    return timeLogs;
};

export const getTaskTimeLogs = async (taskId: string): Promise<ITimeLog[]> => {
    const timeLogs = await TimeLog.find({ taskId })
        .populate('userId', 'name email')
        .sort({ date: -1 });

    return timeLogs;
};

export const getMyTimeLogs = async (
    userId: string,
    filters?: {
        startDate?: Date;
        endDate?: Date;
        projectId?: string;
    }
): Promise<ITimeLog[]> => {
    const query: any = { userId };

    if (filters?.projectId) query.projectId = filters.projectId;
    if (filters?.startDate || filters?.endDate) {
        query.date = {};
        if (filters.startDate) query.date.$gte = filters.startDate;
        if (filters.endDate) query.date.$lte = filters.endDate;
    }

    const timeLogs = await TimeLog.find(query)
        .populate('projectId', 'name')
        .populate('taskId', 'title')
        .sort({ date: -1 });

    return timeLogs;
};

export const updateTimeLog = async (
    timeLogId: string,
    data: UpdateTimeLogData
): Promise<ITimeLog | null> => {
    const timeLog = await TimeLog.findByIdAndUpdate(
        timeLogId,
        { $set: data },
        { new: true, runValidators: true }
    );

    return timeLog;
};

export const deleteTimeLog = async (timeLogId: string): Promise<void> => {
    await TimeLog.findByIdAndDelete(timeLogId);
};
