import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import AppError from '../../../utils/appError';
import { Project } from '../models/Project.model';
import { Task } from '../models/Task.model';
import { Credential } from '../models/Credential.model';
import { Meeting } from '../models/Meeting.model';
import { Employee } from '../../hrms/models/Employee.model';
import { PartnerEmployee } from '../../partners/models/PartnerEmployee.model';
import { hasModuleAdminAccess } from '../../../utils/moduleAccess.util';
import { logger } from "../../../utils/logger";

const normalizeRole = (role: any): string => {
    if (typeof role === 'string') return role.toLowerCase();
    if (role && typeof role === 'object') return String(role.name || '').toLowerCase();
    return '';
};

const isAdminRole = (role: any): boolean => {
    const normalized = normalizeRole(role);
    return ['super-admin', 'super_admin', 'admin'].includes(normalized);
};

const isProjectAdmin = (user: any): boolean => isAdminRole(user?.role) || hasModuleAdminAccess(user, 'projectManagement');

const matchesPartnerProject = (project: any, partnerId?: string): boolean => {
    if (!project || !partnerId || !project.partnerId) return false;
    const projectPartnerId = (project.partnerId as any)._id?.toString() || project.partnerId.toString();
    return projectPartnerId === partnerId;
};

const isInternalEmployeeAssigned = (project: any, employeeId: string): boolean => {
    if (!project) return false;
    return project.assignees.some(
        (assignee: any) =>
            assignee.employeeId?.toString() === employeeId &&
            (assignee.memberType === 'employee' || !assignee.memberType)
    );
};

const getInternalEmployeeAssignee = (project: any, employeeId: string) => {
    if (!project) return undefined;
    return project.assignees.find(
        (assignee: any) =>
            assignee.employeeId?.toString() === employeeId &&
            (assignee.memberType === 'employee' || !assignee.memberType)
    );
};

const getPartnerEmployeeAssignee = (project: any, partnerEmployeeId: string) => {
    if (!project) return undefined;
    return project.assignees.find(
        (assignee: any) => assignee.memberType === 'partner-employee' && assignee.partnerEmployeeId?.toString() === partnerEmployeeId
    );
};

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

        // Check if user is super-admin
        if (isProjectAdmin(req.user)) {
            return next();
        }

        // Partner users can access only their own projects.
        if (req.partnerId) {
            if (!matchesPartnerProject(project, req.partnerId)) {
                return next(new AppError('You do not have access to this project', 403));
            }

            if (req.isPartnerEmployee) {
                const assignee = getPartnerEmployeeAssignee(project, userId);
                if (!assignee) {
                    return next(new AppError('You do not have access to this project', 403));
                }
            }

            return next();
        }

        // Check if user is in assignees
        const employee = await Employee.findOne({ userId });
        if (!employee) {
            return next(new AppError('No matching employee record found for user', 403));
        }

        const isAssigned = isInternalEmployeeAssigned(project, employee._id.toString());

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

        // Check if user is super-admin
        if (isProjectAdmin(req.user)) {
            return next();
        }

        // Partner users can manage only their own projects.
        if (req.partnerId) {
            if (!matchesPartnerProject(project, req.partnerId)) {
                return next(new AppError('Only project managers can perform this action', 403));
            }

            if (req.isPartnerEmployee) {
                const assignee = getPartnerEmployeeAssignee(project, userId);
                if (!assignee || assignee.role !== 'manager') {
                    return next(new AppError('Only project managers can perform this action', 403));
                }
            }

            return next();
        }

        // Check if user is a manager
        const employee = await Employee.findOne({ userId });
        if (!employee) {
            return next(new AppError('No matching employee record found for user', 403));
        }

        const assignee = getInternalEmployeeAssignee(project, employee._id.toString());

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
 * Check if user has access to a task.
 * Any project member can edit/update tasks (view or modify metadata, assignees, etc.).
 * Deletion is separately guarded by checkProjectManager.
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
        if (isProjectAdmin(req.user)) {
            return next();
        }

        // Allow any project member to edit tasks (not just assignees/managers).
        // Deletion is separately protected by checkProjectManager.
        const project = await Project.findById(task.projectId);

        if (req.partnerId && matchesPartnerProject(project, req.partnerId)) {
            return next();
        }

        const partnerEmployee = await PartnerEmployee.findById(userId).select('_id');
        if (partnerEmployee && project?.assignees.some(
            (assignee: any) => assignee.memberType === 'partner-employee' && assignee.partnerEmployeeId?.toString() === partnerEmployee._id.toString()
        )) {
            return next();
        }

        const employee = await Employee.findOne({ userId });
        if (employee && isInternalEmployeeAssigned(project, employee._id.toString())) {
            return next();
        }

        return next(new AppError('You do not have access to this task', 403));
    } catch (error) {
        next(error);
    }
};


/**
 * Check if user has access to a credential.
 * - super-admins: always allowed
 * - project credentialAdmins: always allowed (edit-level)
 * - viewAccess users: allowed for read operations only
 */
export const checkCredentialAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const credentialId = req.params.id;
        const userId = req.user?.id;
        const projectId = req.params.projectId;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        if (!credentialId) {
            return next(new AppError('Credential ID is required', 400));
        }

        // super-admins and admins bypass all checks
        if (
            isProjectAdmin(req.user)
        ) {
            return next();
        }

        // Check if user is a credential admin on the project
        if (projectId) {
            const project = await Project.findById(projectId).select('credentialAdmins');
            if (project) {
                const isCredAdmin = project.credentialAdmins.some(
                    (id) => id.toString() === userId
                );
                if (isCredAdmin) return next();
            }
        }

        // Fall back to per-credential viewAccess
        const credential = await Credential.findById(credentialId);
        if (!credential) {
            return next(new AppError('Credential not found', 404));
        }

        const hasViewAccess = credential.viewAccess.some(
            (accessUserId) => accessUserId.toString() === userId.toString()
        );

        if (!hasViewAccess) {
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
 * Check if user is a credential admin on the project or super-admin.
 * Used for routes like shareCredentials and updateCredentialAdmins.
 */
export const checkCredentialAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const projectId = req.params.projectId;
        const userId = req.user?.id;

        if (!userId) {
            return next(new AppError('Authentication required', 401));
        }

        // super-admins and admins bypass
        if (
            isProjectAdmin(req.user)
        ) {
            return next();
        }

        if (!projectId) {
            return next(new AppError('Project ID is required', 400));
        }

        const project = await Project.findById(projectId).select('credentialAdmins');
        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        const isCredAdmin = project.credentialAdmins.some(
            (id) => id.toString() === userId
        );

        if (!isCredAdmin) {
            return next(
                new AppError('Only credential admins can perform this action', 403)
            );
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Check if user is a document admin on the project or super-admin.
 * Used for document access management routes.
 */
export const checkDocAdmin = async (
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

        // super-admins and admins bypass
        if (
            isProjectAdmin(req.user)
        ) {
            return next();
        }

        if (!projectId) {
            return next(new AppError('Project ID is required', 400));
        }

        const project = await Project.findById(projectId).select('docAdmins');
        if (!project) {
            return next(new AppError('Project not found', 404));
        }

        const isDocAdmin = project.docAdmins.some(
            (id) => id.toString() === userId
        );

        // Debug logging for admin check
        logger.info({ context: {
                        projectId,
                        userId,
                        userRole: req.user?.role,
                        docAdmins: project.docAdmins.map(id => id.toString()),
                        isDocAdmin,
                    } }, '[checkDocAdmin] Debug Info:');

        if (!isDocAdmin) {
            return next(
                new AppError('Only document admins can perform this action', 403)
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

        // Check if user is super-admin
        if (isProjectAdmin(req.user)) {
            return next();
        }

        // Check access level
        if (meeting.accessLevel === 'project-team') {
            const project = await Project.findById(meeting.projectId);

            if (req.partnerId && matchesPartnerProject(project, req.partnerId)) {
                return next();
            }

            // Check if user is in project
            const employee = await Employee.findOne({ userId });
            if (!employee) return next(new AppError('No matching employee record found', 403));

            if (isInternalEmployeeAssigned(project, employee._id.toString())) {
                return next();
            }
        } else if (meeting.accessLevel === 'managers-only') {
            const project = await Project.findById(meeting.projectId);

            if (req.partnerId && matchesPartnerProject(project, req.partnerId)) {
                return next();
            }

            // Check if user is project manager
            const employee = await Employee.findOne({ userId });
            if (!employee) return next(new AppError('No matching employee record found', 403));

            if (project) {
                const assignee = getInternalEmployeeAssignee(project, employee._id.toString());
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
 * Check if user is super-admin
 */
export const checkAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (isProjectAdmin(req.user)) {
        return next();
    }
    return next(new AppError('Super Admin access required', 403));
};
