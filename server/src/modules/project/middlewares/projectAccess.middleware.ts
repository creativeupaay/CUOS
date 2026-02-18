import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import AppError from '../../../utils/appError';
import { Project } from '../models/Project.model';
import { Task } from '../models/Task.model';
import { Credential } from '../models/Credential.model';
import { Meeting } from '../models/Meeting.model';

/**
 * Check if user has access to a project
 * User must be in project.assignees array OR be an admin
 */
export const checkProjectAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const projectId = req.params.id || req.params.projectId;
        const userId = req.user?.id;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        if (!projectId) {
            return next(new AppError('Project ID is required', 400));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        // Check if user is admin (assuming role field exists)
        if (req.user?.role === 'admin' || req.user?.role === 'super-admin') {
            return next();
        }

        // Check if user is in assignees
        const isAssigned = project.assignees.some(
            (assignee) => assignee.userId.toString() === userId.toString()
        );

        if (!isAssigned) {
            return next(
                new AppError('You do not have access to this project', 403)
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Check if user is a project manager OR admin
 */
export const checkProjectManager = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const projectId = req.params.id || req.params.projectId;
        const userId = req.user?.id;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        if (!projectId) {
            return next(new AppError('Project ID is required', 400));
        }

        const project = await Project.findById(projectId);

        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        // Check if user is admin
        if (req.user?.role === 'admin' || req.user?.role === 'super-admin') {
            return next();
        }

        // Check if user is a manager
        const assignee = project.assignees.find(
            (a) => a.userId.toString() === userId.toString()
        );

        if (!assignee || assignee.role !== 'manager') {
            return next(
                new AppError('Only project managers can perform this action', 403)
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Check if user has access to a task
 * User must be task assignee OR project manager OR admin
 */
export const checkTaskAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const taskId = req.params.taskId;
        const userId = req.user?.id;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        if (!taskId) {
            return next(new AppError('Task ID is required', 400));
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return next(new AppError('Task not found', 404));
        }

        // Check if user is admin
        if (req.user?.role === 'admin' || req.user?.role === 'super-admin') {
            return next();
        }

        // Check if user is task assignee
        const isAssignee = task.assignees.some(
            (assigneeId) => assigneeId.toString() === userId.toString()
        );

        if (isAssignee) {
            return next();
        }

        // Check if user is project manager
        const project = await Project.findById(task.projectId);
        if (project) {
            const assignee = project.assignees.find(
                (a) => a.userId.toString() === userId.toString()
            );

            if (assignee && assignee.role === 'manager') {
                return next();
            }
        }

        return next(new AppError('You do not have access to this task', 403));
    } catch (error) {
        next(error);
    }
};

/**
 * Check if user has access to a credential
 * User must be in credential.accessUsers array OR be an admin
 */
export const checkCredentialAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const credentialId = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        if (!credentialId) {
            return next(new AppError('Credential ID is required', 400));
        }

        const credential = await Credential.findById(credentialId);

        if (!credential) {
            return next(new AppError('Credential not found', 404));
        }

        // Check if user is admin
        if (req.user?.role === 'admin' || req.user?.role === 'super-admin') {
            return next();
        }

        // Check if user is in accessUsers
        const hasAccess = credential.accessUsers.some(
            (accessUserId) => accessUserId.toString() === userId.toString()
        );

        if (!hasAccess) {
            return next(
                new AppError('You do not have access to this credential', 403)
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Check if user has access to a meeting
 * Based on meeting.accessLevel
 */
export const checkMeetingAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const meetingId = req.params.id;
        const userId = req.user?.id;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        if (!meetingId) {
            return next(new AppError('Meeting ID is required', 400));
        }

        const meeting = await Meeting.findById(meetingId);

        if (!meeting) {
            return next(new AppError('Meeting not found', 404));
        }

        // Check if user is admin
        if (req.user?.role === 'admin' || req.user?.role === 'super-admin') {
            return next();
        }

        // Check access level
        if (meeting.accessLevel === 'project-team') {
            // Check if user is in project
            const project = await Project.findById(meeting.projectId);
            if (project) {
                const isAssigned = project.assignees.some(
                    (assignee) => assignee.userId.toString() === userId.toString()
                );
                if (isAssigned) {
                    return next();
                }
            }
        } else if (meeting.accessLevel === 'managers-only') {
            // Check if user is project manager
            const project = await Project.findById(meeting.projectId);
            if (project) {
                const assignee = project.assignees.find(
                    (a) => a.userId.toString() === userId.toString()
                );
                if (assignee && assignee.role === 'manager') {
                    return next();
                }
            }
        } else if (meeting.accessLevel === 'custom') {
            // Check if user is in customAccessUsers
            const hasAccess = meeting.customAccessUsers?.some(
                (accessUserId) => accessUserId.toString() === userId.toString()
            );
            if (hasAccess) {
                return next();
            }
        }

        return next(new AppError('You do not have access to this meeting', 403));
    } catch (error) {
        next(error);
    }
};

/**
 * Check if user is admin
 */
export const checkAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role === 'admin' || req.user?.role === 'super-admin') {
        return next();
    }
    return next(new AppError('Admin access required', 403));
};
