import { Task, ITask } from '../models/Task.model';
import AppError from '../../../utils/appError';
import { Types } from 'mongoose';

export interface CreateTaskData {
    title: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'completed';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    projectId: string;
    parentTaskId?: string;
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    estimatedHours?: number;
    assignees?: string[];
    createdBy: string;
}

export interface UpdateTaskData {
    title?: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'completed';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    startDate?: Date;
    endDate?: Date;
    deadline?: Date;
    estimatedHours?: number;
    assignees?: string[];
}

export const createTask = async (data: CreateTaskData): Promise<ITask> => {
    const task = await Task.create(data);
    return task;
};

export const getTasks = async (
    projectId: string,
    filters?: { status?: string; assignee?: string }
): Promise<ITask[]> => {
    const query: any = { projectId, parentTaskId: null }; // Only main tasks

    if (filters?.status) query.status = filters.status;
    if (filters?.assignee) query.assignees = filters.assignee;

    const tasks = await Task.find(query)
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

    return tasks;
};

export const getTaskById = async (taskId: string): Promise<ITask | null> => {
    const task = await Task.findById(taskId)
        .populate('assignees', 'name email role')
        .populate('createdBy', 'name email');

    return task;
};

export const updateTask = async (
    taskId: string,
    data: UpdateTaskData
): Promise<ITask | null> => {
    // Explicitly set completedAt when status changes to completed
    // (findByIdAndUpdate bypasses the pre-save hook)
    const updatePayload: any = { $set: { ...data } };
    if (data.status === 'completed') {
        updatePayload.$set.completedAt = new Date();
    }

    const task = await Task.findByIdAndUpdate(
        taskId,
        updatePayload,
        { new: true, runValidators: true }
    );

    return task;
};

export const deleteTask = async (taskId: string): Promise<void> => {
    // Delete task and all its subtasks
    await Task.deleteMany({ $or: [{ _id: taskId }, { parentTaskId: taskId }] });
};

export const getSubtasks = async (parentTaskId: string): Promise<ITask[]> => {
    const subtasks = await Task.find({ parentTaskId })
        .populate('assignees', 'name email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: 1 });

    return subtasks;
};
