import { z } from 'zod';

export const createTaskSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    body: z.object({
        title: z.string().min(1, 'Task title is required').trim(),
        description: z.string().optional(),
        status: z.enum(['todo', 'in-progress', 'completed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),

        parentTaskId: z.string().optional(), // For subtasks

        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        deadline: z.string().or(z.date()).optional(),
        estimatedHours: z.number().positive().optional(),

        assignees: z.array(z.string()).optional(),
    }),
});

export const updateTaskSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        taskId: z.string().min(1, 'Task ID is required'),
    }),
    body: z.object({
        title: z.string().min(1).trim().optional(),
        description: z.string().optional(),
        status: z.enum(['todo', 'in-progress', 'completed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),

        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        deadline: z.string().or(z.date()).optional(),
        estimatedHours: z.number().positive().optional(),

        assignees: z.array(z.string()).optional(),
    }),
});

export const getTasksSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
    }),
    query: z.object({
        status: z.enum(['todo', 'in-progress', 'completed']).optional(),
        assignee: z.string().optional(),
    }).optional(),
});

export const getTaskByIdSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        taskId: z.string().min(1, 'Task ID is required'),
    }),
});

export const deleteTaskSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        taskId: z.string().min(1, 'Task ID is required'),
    }),
});

export const createSubtaskSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        taskId: z.string().min(1, 'Parent task ID is required'),
    }),
    body: z.object({
        title: z.string().min(1, 'Subtask title is required').trim(),
        description: z.string().optional(),
        status: z.enum(['todo', 'in-progress', 'completed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),

        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        deadline: z.string().or(z.date()).optional(),
        estimatedHours: z.number().positive().optional(),

        assignees: z.array(z.string()).optional(),
    }),
});

export const getSubtasksSchema = z.object({
    params: z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        taskId: z.string().min(1, 'Parent task ID is required'),
    }),
});
