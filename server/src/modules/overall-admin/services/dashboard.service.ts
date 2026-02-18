import { User } from '../../auth/models/User.model';
import { Role } from '../../auth/models/Role.model';
import { AuditLog } from '../models/AuditLog.model';

/**
 * Get dashboard stats for the admin overview
 */
export const getDashboardStats = async () => {
    const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalRoles,
        recentUsers,
        recentAuditLogs,
        roleDistribution,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
        Role.countDocuments(),
        User.find()
            .populate('role', 'name')
            .select('name email role isActive createdAt lastLogin')
            .sort({ createdAt: -1 })
            .limit(5),
        AuditLog.find()
            .populate('userId', 'name email')
            .sort({ createdAt: -1 })
            .limit(10),
        User.aggregate([
            {
                $lookup: {
                    from: 'roles',
                    localField: 'role',
                    foreignField: '_id',
                    as: 'roleInfo',
                },
            },
            { $unwind: '$roleInfo' },
            {
                $group: {
                    _id: '$roleInfo.name',
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
        ]),
    ]);

    return {
        stats: {
            totalUsers,
            activeUsers,
            inactiveUsers,
            totalRoles,
        },
        recentUsers,
        recentAuditLogs,
        roleDistribution,
    };
};
