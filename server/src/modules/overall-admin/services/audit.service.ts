import { AuditLog } from '../models/AuditLog.model';

export interface AuditLogFilters {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

/**
 * Log an admin action
 */
export const logAction = async (
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string
) => {
    return AuditLog.create({
        userId,
        action,
        resource,
        resourceId,
        details,
        ipAddress,
    });
};

/**
 * Get audit logs with filters and pagination
 */
export const getAuditLogs = async (filters: AuditLogFilters) => {
    const { userId, action, resource, startDate, endDate, page = 1, limit = 30 } = filters;

    const query: any = {};

    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (resource) query.resource = resource;

    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
        AuditLog.find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
        AuditLog.countDocuments(query),
    ]);

    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};
