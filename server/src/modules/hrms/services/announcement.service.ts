import { Types } from 'mongoose';
import { Announcement, IAnnouncement } from '../models/Announcement.model';
import { Employee } from '../models/Employee.model';
import { User } from '../../auth/models/User.model';
import AppError from '../../../utils/appError';
import { notificationService, getSocketIO } from '../../notification/services/notification.service';
import { ArchiveDeleteOptions, DeletedRecordService } from '../../archive';

export interface CreateAnnouncementInput {
    title?: string;
    content: string;
    priority?: 'normal' | 'urgent';
    isPinned?: boolean;
    targetType?: 'all' | 'department' | 'users';
    targetDepartments?: string[];
    targetUsers?: string[];
    poll?: {
        question: string;
        options: string[];
        allowMultiple?: boolean;
    };
}

export interface AnnouncementReceiptUser {
    _id: string;
    name: string;
    email: string;
    department: string;
    designation: string;
    profilePhotoUrl?: string;
}

export interface FormattedPollOption {
    _id: string;
    text: string;
    voteCount: number;
    percentage: number;
    hasVoted: boolean;
}

export interface FormattedPoll {
    question: string;
    options: FormattedPollOption[];
    allowMultiple: boolean;
    isClosed: boolean;
    totalVotes: number;
    userVotedOptionIds: string[];
    hasVoted: boolean;
}

export interface PollVoterDetail {
    user: AnnouncementReceiptUser;
    votedAt: Date;
}

export interface PollOptionResult {
    _id: string;
    text: string;
    voteCount: number;
    percentage: number;
    voters: PollVoterDetail[];
}

export interface PollResultsDetail {
    question: string;
    totalVotes: number;
    allowMultiple: boolean;
    isClosed: boolean;
    options: PollOptionResult[];
}

export interface AnnouncementReceiptsResponse {
    announcementId: string;
    totalTargeted: number;
    seenCount: number;
    unseenCount: number;
    seen: Array<{ user: AnnouncementReceiptUser; seenAt: Date }>;
    unseen: Array<{ user: AnnouncementReceiptUser }>;
    pollResults?: PollResultsDetail;
}

function formatPoll(poll: any, userId?: string): FormattedPoll | undefined {
    if (!poll || !poll.question || !Array.isArray(poll.options)) return undefined;

    const totalVotes = poll.options.reduce(
        (sum: number, opt: any) => sum + (Array.isArray(opt.votes) ? opt.votes.length : 0),
        0
    );
    const userVotedOptionIds: string[] = [];

    const options = poll.options.map((opt: any) => {
        const votes = Array.isArray(opt.votes) ? opt.votes : [];
        const optIdStr = opt._id?.toString() || '';
        const hasVoted = userId ? votes.some((v: any) => v.userId?.toString() === userId) : false;
        if (hasVoted) {
            userVotedOptionIds.push(optIdStr);
        }
        const voteCount = votes.length;
        const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
        return {
            _id: optIdStr,
            text: opt.text,
            voteCount,
            percentage,
            hasVoted,
        };
    });

    return {
        question: poll.question,
        options,
        allowMultiple: Boolean(poll.allowMultiple),
        isClosed: Boolean(poll.isClosed),
        totalVotes,
        userVotedOptionIds,
        hasVoted: userVotedOptionIds.length > 0,
    };
}

class AnnouncementService {
    /**
     * Create a new announcement, determine targeted recipients,
     * send in-app notifications, and emit real-time Socket.io events.
     */
    async createAnnouncement(
        data: CreateAnnouncementInput,
        publishedBy: string
    ): Promise<IAnnouncement> {
        const content = String(data.content || '').trim();
        if (!content) {
            throw new AppError('Announcement content is required', 400);
        }

        const title = String(data.title || '').trim() || 'Company Announcement';
        const priority = data.priority === 'urgent' ? 'urgent' : 'normal';
        const isPinned = Boolean(data.isPinned);
        const targetType = data.targetType && ['department', 'users'].includes(data.targetType)
            ? data.targetType
            : 'all';

        const targetDepartments = Array.isArray(data.targetDepartments)
            ? data.targetDepartments.map((d) => String(d).trim()).filter(Boolean)
            : [];

        const targetUsers = Array.isArray(data.targetUsers)
            ? data.targetUsers
                .filter((id) => Types.ObjectId.isValid(id))
                .map((id) => new Types.ObjectId(id))
            : [];

        if (targetType === 'department' && targetDepartments.length === 0) {
            throw new AppError('Please select at least one department for department-targeted announcement', 400);
        }

        if (targetType === 'users' && targetUsers.length === 0) {
            throw new AppError('Please select at least one employee for user-targeted announcement', 400);
        }

        let pollData: any = undefined;
        if (
            data.poll &&
            typeof data.poll.question === 'string' &&
            data.poll.question.trim() &&
            Array.isArray(data.poll.options) &&
            data.poll.options.length >= 2
        ) {
            pollData = {
                question: data.poll.question.trim(),
                options: data.poll.options.map((opt) => ({
                    text: String(opt).trim(),
                    votes: [],
                })),
                allowMultiple: Boolean(data.poll.allowMultiple),
                isClosed: false,
            };
        }

        const announcement = await Announcement.create({
            title,
            content,
            priority,
            isPinned,
            targetType,
            targetDepartments,
            targetUsers,
            publishedBy,
            acknowledgedBy: [],
            poll: pollData,
        });

        await announcement.populate('publishedBy', 'name email');

        // Determine recipient user IDs for notifications and sockets
        let recipientUserIds: string[] = [];

        if (targetType === 'all') {
            await notificationService.notifyInternalUsers({
                type: 'company_announcement',
                title: priority === 'urgent' ? `🚨 URGENT: ${title}` : title,
                message: content.length > 140 ? `${content.slice(0, 137)}...` : content,
                link: '/my-hrms/announcements',
                metadata: {
                    announcementId: announcement._id.toString(),
                    priority,
                },
            });
        } else if (targetType === 'department') {
            const employees = await Employee.find({
                department: { $in: targetDepartments },
                status: 'active',
            })
                .select('userId')
                .lean();

            recipientUserIds = employees
                .map((e) => e.userId?.toString())
                .filter((id): id is string => Boolean(id));

            if (recipientUserIds.length > 0) {
                await notificationService.createBulkNotifications(recipientUserIds, {
                    type: 'company_announcement',
                    title: priority === 'urgent' ? `🚨 URGENT: ${title}` : title,
                    message: content.length > 140 ? `${content.slice(0, 137)}...` : content,
                    link: '/my-hrms/announcements',
                    metadata: {
                        announcementId: announcement._id.toString(),
                        priority,
                    },
                });
            }
        } else if (targetType === 'users') {
            recipientUserIds = targetUsers.map((u) => u.toString());
            if (recipientUserIds.length > 0) {
                await notificationService.createBulkNotifications(recipientUserIds, {
                    type: 'company_announcement',
                    title: priority === 'urgent' ? `🚨 URGENT: ${title}` : title,
                    message: content.length > 140 ? `${content.slice(0, 137)}...` : content,
                    link: '/my-hrms/announcements',
                    metadata: {
                        announcementId: announcement._id.toString(),
                        priority,
                    },
                });
            }
        }

        // Real-time socket event for immediate popup/update on connected clients
        const io = getSocketIO();
        if (io) {
            const socketPayload = {
                announcement: {
                    ...announcement.toObject(),
                    isAcknowledged: false,
                },
            };

            if (targetType === 'all') {
                io.emit('announcement:new', socketPayload);
            } else {
                for (const uid of recipientUserIds) {
                    io.to(`user:${uid}`).emit('announcement:new', socketPayload);
                }
            }
        }

        return announcement;
    }

    /**
     * Get announcements list.
     * - Admins see all announcements with read counts and total targeted count.
     * - Regular employees see only announcements targeted to them with `isAcknowledged` status.
     */
    async getAnnouncements(userId?: string, isAdmin: boolean = false): Promise<any[]> {
        const query: any = {};

        let userDepartment: string | undefined;
        if (userId && !isAdmin) {
            const emp = await Employee.findOne({ userId: new Types.ObjectId(userId) })
                .select('department status')
                .lean();
            userDepartment = emp?.department;

            query.$or = [
                { targetType: 'all' },
                { targetType: { $exists: false } }, // backward compatibility
                ...(userDepartment ? [{ targetType: 'department', targetDepartments: userDepartment }] : []),
                { targetType: 'users', targetUsers: new Types.ObjectId(userId) },
            ];
        }

        const announcements = await Announcement.find(query)
            .populate('publishedBy', 'name email')
            .populate('targetUsers', 'name email')
            .sort({ isPinned: -1, createdAt: -1 })
            .lean();

        // Total active employees count for 'all' announcements
        const totalActiveEmployees = await Employee.countDocuments({ status: 'active' });

        return announcements.map((item: any) => {
            const acks = Array.isArray(item.acknowledgedBy) ? item.acknowledgedBy : [];
            const isAcknowledged = userId
                ? acks.some((a: any) => a.userId?.toString() === userId)
                : false;
            const myAck = userId
                ? acks.find((a: any) => a.userId?.toString() === userId)
                : undefined;

            let totalTargetedCount = totalActiveEmployees;
            if (item.targetType === 'users') {
                totalTargetedCount = Array.isArray(item.targetUsers) ? item.targetUsers.length : 0;
            } else if (item.targetType === 'department') {
                // If department-targeted, we compute roughly or load
                totalTargetedCount = totalActiveEmployees; // fallback, exact computed in receipts
            }

            return {
                ...item,
                title: item.title || 'Company Announcement',
                priority: item.priority || 'normal',
                isPinned: Boolean(item.isPinned),
                targetType: item.targetType || 'all',
                targetDepartments: item.targetDepartments || [],
                acknowledgedCount: acks.length,
                totalTargetedCount,
                isAcknowledged,
                acknowledgedAt: myAck?.seenAt || null,
                poll: formatPoll(item.poll, userId),
            };
        });
    }

    /**
     * Get unread/unacknowledged announcements for a specific user (for popup modal on login/app load)
     */
    async getUnreadAnnouncements(userId: string): Promise<any[]> {
        const userObjId = new Types.ObjectId(userId);
        const emp = await Employee.findOne({ userId: userObjId })
            .select('department status')
            .lean();
        const userDepartment = emp?.department;

        const query: any = {
            'acknowledgedBy.userId': { $ne: userObjId },
            $or: [
                { targetType: 'all' },
                { targetType: { $exists: false } },
                ...(userDepartment ? [{ targetType: 'department', targetDepartments: userDepartment }] : []),
                { targetType: 'users', targetUsers: userObjId },
            ],
        };

        const unread = await Announcement.find(query)
            .populate('publishedBy', 'name email')
            .sort({ priority: -1, isPinned: -1, createdAt: -1 })
            .limit(10)
            .lean();

        return unread.map((item: any) => ({
            ...item,
            title: item.title || 'Company Announcement',
            priority: item.priority || 'normal',
            isPinned: Boolean(item.isPinned),
            targetType: item.targetType || 'all',
            targetDepartments: item.targetDepartments || [],
            isAcknowledged: false,
            poll: formatPoll(item.poll, userId),
        }));
    }

    /**
     * Mark an announcement as seen / acknowledged by user
     */
    async acknowledgeAnnouncement(
        announcementId: string,
        userId: string
    ): Promise<{ success: boolean; seenAt: Date }> {
        const userObjId = new Types.ObjectId(userId);
        const announcement = await Announcement.findById(announcementId);
        if (!announcement) {
            throw new AppError('Announcement not found', 404);
        }

        const alreadyAcknowledged = announcement.acknowledgedBy.some(
            (a) => a.userId.toString() === userId
        );

        const seenAt = new Date();
        if (!alreadyAcknowledged) {
            announcement.acknowledgedBy.push({
                userId: userObjId,
                seenAt,
            });
            await announcement.save();
        }

        return { success: true, seenAt };
    }

    /**
     * Get detailed read receipts (Seen vs Unseen list) for an announcement (Admin view)
     */
    async getAnnouncementReceipts(announcementId: string): Promise<AnnouncementReceiptsResponse> {
        const announcement = await Announcement.findById(announcementId).lean();
        if (!announcement) {
            throw new AppError('Announcement not found', 404);
        }

        const targetType = announcement.targetType || 'all';

        let employeeFilter: any = { status: 'active' };

        if (targetType === 'department') {
            const depts = announcement.targetDepartments || [];
            employeeFilter = {
                status: 'active',
                department: { $in: depts },
            };
        } else if (targetType === 'users') {
            const uids = announcement.targetUsers || [];
            employeeFilter = {
                userId: { $in: uids },
            };
        }

        const targetedEmployees = await Employee.find(employeeFilter)
            .populate({ path: 'userId', select: 'name email profilePhoto' })
            .select('userId department designation profilePhoto')
            .lean();

        // Build acknowledgment lookup
        const ackMap = new Map<string, Date>();
        if (Array.isArray(announcement.acknowledgedBy)) {
            for (const ack of announcement.acknowledgedBy) {
                if (ack?.userId) {
                    ackMap.set(ack.userId.toString(), new Date(ack.seenAt));
                }
            }
        }

        const seen: Array<{ user: AnnouncementReceiptUser; seenAt: Date }> = [];
        const unseen: Array<{ user: AnnouncementReceiptUser }> = [];

        for (const emp of targetedEmployees) {
            if (!emp.userId || typeof emp.userId !== 'object') continue;
            const u = emp.userId as any;
            const uidStr = u._id?.toString();
            if (!uidStr) continue;

            const userObj: AnnouncementReceiptUser = {
                _id: uidStr,
                name: u.name || 'Team Member',
                email: u.email || '',
                department: emp.department || 'General',
                designation: emp.designation || 'Employee',
                profilePhotoUrl: emp.profilePhoto?.url,
            };

            const seenAt = ackMap.get(uidStr);
            if (seenAt) {
                seen.push({ user: userObj, seenAt });
            } else {
                unseen.push({ user: userObj });
            }
        }

        // Sort seen by most recent seenAt first
        seen.sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime());
        // Sort unseen alphabetically by name
        unseen.sort((a, b) => a.user.name.localeCompare(b.user.name));

        // Compute detailed poll results if announcement has a poll
        let pollResults: PollResultsDetail | undefined;
        if (announcement.poll && Array.isArray(announcement.poll.options)) {
            const allVoterUserIds: Types.ObjectId[] = [];
            for (const opt of announcement.poll.options) {
                if (Array.isArray(opt.votes)) {
                    for (const v of opt.votes) {
                        if (v?.userId) {
                            allVoterUserIds.push(new Types.ObjectId(v.userId.toString()));
                        }
                    }
                }
            }

            const voterEmployees = await Employee.find({ userId: { $in: allVoterUserIds } })
                .populate({ path: 'userId', select: 'name email profilePhoto' })
                .select('userId department designation profilePhoto')
                .lean();

            const voterUserMap = new Map<string, AnnouncementReceiptUser>();
            for (const emp of voterEmployees) {
                const u = emp.userId as any;
                if (!u?._id) continue;
                voterUserMap.set(u._id.toString(), {
                    _id: u._id.toString(),
                    name: u.name || 'Team Member',
                    email: u.email || '',
                    department: emp.department || 'General',
                    designation: emp.designation || 'Employee',
                    profilePhotoUrl: emp.profilePhoto?.url,
                });
            }

            const totalVotes = announcement.poll.options.reduce(
                (sum, opt) => sum + (Array.isArray(opt.votes) ? opt.votes.length : 0),
                0
            );

            const options: PollOptionResult[] = announcement.poll.options.map((opt: any) => {
                const votes = Array.isArray(opt.votes) ? opt.votes : [];
                const voters: PollVoterDetail[] = votes.map((v: any) => {
                    const uidStr = v.userId?.toString();
                    const userObj = voterUserMap.get(uidStr) || {
                        _id: uidStr,
                        name: 'Team Member',
                        email: '',
                        department: 'General',
                        designation: 'Employee',
                    };
                    return {
                        user: userObj,
                        votedAt: new Date(v.votedAt),
                    };
                });

                return {
                    _id: opt._id.toString(),
                    text: opt.text,
                    voteCount: votes.length,
                    percentage: totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0,
                    voters,
                };
            });

            pollResults = {
                question: announcement.poll.question,
                totalVotes,
                allowMultiple: Boolean(announcement.poll.allowMultiple),
                isClosed: Boolean(announcement.poll.isClosed),
                options,
            };
        }

        return {
            announcementId,
            totalTargeted: targetedEmployees.length,
            seenCount: seen.length,
            unseenCount: unseen.length,
            seen,
            unseen,
            pollResults,
        };
    }

    /**
     * Submit vote for an announcement poll
     */
    async votePoll(
        announcementId: string,
        optionIds: string[],
        userId: string
    ): Promise<{ success: boolean; poll: FormattedPoll }> {
        const userObjId = new Types.ObjectId(userId);
        const announcement = await Announcement.findById(announcementId);
        if (!announcement) {
            throw new AppError('Announcement not found', 404);
        }
        if (!announcement.poll) {
            throw new AppError('This announcement does not have a poll', 400);
        }
        if (announcement.poll.isClosed) {
            throw new AppError('This poll is closed', 400);
        }

        const availableOptionIds = announcement.poll.options.map((o) => o._id.toString());
        const validOptionIds = optionIds.filter((id) => availableOptionIds.includes(id));
        if (validOptionIds.length === 0) {
            throw new AppError('Please select a valid option', 400);
        }

        if (!announcement.poll.allowMultiple && validOptionIds.length > 1) {
            throw new AppError('You can only select one option in this poll', 400);
        }

        // Remove previous votes from this user across all options
        for (const opt of announcement.poll.options) {
            opt.votes = opt.votes.filter((v) => v.userId.toString() !== userId);
        }

        // Add user vote to the selected options
        const now = new Date();
        for (const opt of announcement.poll.options) {
            if (validOptionIds.includes(opt._id.toString())) {
                opt.votes.push({
                    userId: userObjId,
                    votedAt: now,
                });
            }
        }

        // Also mark announcement as acknowledged if not already acknowledged
        const alreadyAcked = announcement.acknowledgedBy.some((a) => a.userId.toString() === userId);
        if (!alreadyAcked) {
            announcement.acknowledgedBy.push({
                userId: userObjId,
                seenAt: now,
            });
        }

        await announcement.save();

        const formatted = formatPoll(announcement.poll, userId)!;

        // Broadcast real-time update
        const io = getSocketIO();
        if (io) {
            io.emit('announcement:pollUpdated', {
                announcementId,
                poll: formatPoll(announcement.poll),
            });
        }

        return {
            success: true,
            poll: formatted,
        };
    }

    /**
     * Send a notification nudge / reminder to all employees who haven't acknowledged the announcement
     */
    async nudgeUnseen(
        announcementId: string,
        _senderUserId: string
    ): Promise<{ nudgedCount: number }> {
        const receipts = await this.getAnnouncementReceipts(announcementId);
        const unseenIds = receipts.unseen.map((item) => item.user._id);

        if (unseenIds.length === 0) {
            throw new AppError('All targeted team members have already acknowledged this announcement', 400);
        }

        const announcement = await Announcement.findById(announcementId).select('title priority').lean();
        const title = announcement?.title || 'Company Announcement';

        await notificationService.createBulkNotifications(unseenIds, {
            type: 'company_announcement',
            title: `🔔 Reminder: ${title}`,
            message: 'Please review and acknowledge the company announcement.',
            link: '/my-hrms/announcements',
            metadata: {
                announcementId,
                isNudge: true,
            },
        });

        return { nudgedCount: unseenIds.length };
    }

    /**
     * Delete an announcement and archive it
     */
    async deleteAnnouncement(id: string, options: ArchiveDeleteOptions = {}): Promise<void> {
        const announcement = await Announcement.findById(id);
        if (!announcement) {
            throw new AppError('Announcement not found', 404);
        }

        await DeletedRecordService.archiveDocument(announcement, {
            archiveBatchId: options.archiveBatchId,
            deletedBy: options.deletedBy,
            reason: options.reason ?? 'Announcement delete requested',
            operation: 'delete',
            session: options.session,
            metadata: {
                ...options.metadata,
                announcementId: announcement._id.toString(),
            },
        });

        await announcement.deleteOne(options.session ? { session: options.session } : undefined);
    }
}

export const announcementService = new AnnouncementService();
