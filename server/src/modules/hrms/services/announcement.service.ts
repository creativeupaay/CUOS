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
        pollType?: 'choice' | 'text';
        options?: string[];
        allowMultiple?: boolean;
        allowTextResponse?: boolean;
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

export interface FormattedTextResponse {
    _id: string;
    user: AnnouncementReceiptUser;
    text: string;
    optionId?: string;
    optionText?: string;
    submittedAt: Date;
}

export interface FormattedPoll {
    question: string;
    pollType: 'choice' | 'text';
    options: FormattedPollOption[];
    allowMultiple: boolean;
    allowTextResponse: boolean;
    isClosed: boolean;
    totalVotes: number;
    userVotedOptionIds: string[];
    userTextResponse?: string;
    hasVoted: boolean;
    textResponsesCount: number;
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
    pollType: 'choice' | 'text';
    totalVotes: number;
    allowMultiple: boolean;
    allowTextResponse: boolean;
    isClosed: boolean;
    options: PollOptionResult[];
    textResponses?: FormattedTextResponse[];
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
    if (!poll || !poll.question) return undefined;

    const pollType: 'choice' | 'text' =
        poll.pollType === 'text' || (!Array.isArray(poll.options) || poll.options.length === 0)
            ? 'text'
            : 'choice';

    const rawOptions = Array.isArray(poll.options) ? poll.options : [];
    const totalOptionVotes = rawOptions.reduce(
        (sum: number, opt: any) => sum + (Array.isArray(opt.votes) ? opt.votes.length : 0),
        0
    );
    const textResponses = Array.isArray(poll.textResponses) ? poll.textResponses : [];
    const totalVotes = pollType === 'text' ? textResponses.length : totalOptionVotes;

    const userVotedOptionIds: string[] = [];
    const myTextResponseObj = userId
        ? textResponses.find((tr: any) => tr.userId?.toString() === userId)
        : undefined;

    const options = rawOptions.map((opt: any) => {
        const votes = Array.isArray(opt.votes) ? opt.votes : [];
        const optIdStr = opt._id?.toString() || '';
        const hasVoted = userId ? votes.some((v: any) => v.userId?.toString() === userId) : false;
        if (hasVoted) {
            userVotedOptionIds.push(optIdStr);
        }
        const voteCount = votes.length;
        const percentage = totalOptionVotes > 0 ? Math.round((voteCount / totalOptionVotes) * 100) : 0;
        return {
            _id: optIdStr,
            text: opt.text,
            voteCount,
            percentage,
            hasVoted,
        };
    });

    const hasVoted = userVotedOptionIds.length > 0 || Boolean(myTextResponseObj);

    return {
        question: poll.question,
        pollType,
        options,
        allowMultiple: Boolean(poll.allowMultiple),
        allowTextResponse: Boolean(poll.allowTextResponse),
        isClosed: Boolean(poll.isClosed),
        totalVotes,
        userVotedOptionIds,
        userTextResponse: myTextResponseObj?.text || '',
        hasVoted,
        textResponsesCount: textResponses.length,
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
            data.poll.question.trim()
        ) {
            const isTextPoll = data.poll.pollType === 'text';
            const rawOptions = Array.isArray(data.poll.options) ? data.poll.options : [];
            const options = isTextPoll
                ? []
                : rawOptions.map((opt) => ({
                      text: String(opt).trim(),
                      votes: [],
                  }));

            pollData = {
                question: data.poll.question.trim(),
                pollType: isTextPoll ? 'text' : 'choice',
                options,
                allowMultiple: Boolean(data.poll.allowMultiple),
                allowTextResponse: Boolean(data.poll.allowTextResponse),
                textResponses: [],
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
                link: '/announcements',
                metadata: {
                    announcementId: announcement._id.toString(),
                    priority,
                },
            });
        } else if (targetType === 'department') {
            const activeUsers = await User.find({ isActive: true }).select('_id').lean();
            const activeUserIds = activeUsers.map((u) => u._id);

            const employees = await Employee.find({
                department: { $in: targetDepartments },
                status: { $in: ['active', 'on-notice'] },
                userId: { $in: activeUserIds },
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
                    link: '/announcements',
                    metadata: {
                        announcementId: announcement._id.toString(),
                        priority,
                    },
                });
            }
        } else if (targetType === 'users') {
            const activeTargetUsers = await User.find({
                _id: { $in: targetUsers },
                isActive: true,
            })
                .select('_id')
                .lean();

            recipientUserIds = activeTargetUsers.map((u) => u._id.toString());
            if (recipientUserIds.length > 0) {
                await notificationService.createBulkNotifications(recipientUserIds, {
                    type: 'company_announcement',
                    title: priority === 'urgent' ? `🚨 URGENT: ${title}` : title,
                    message: content.length > 140 ? `${content.slice(0, 137)}...` : content,
                    link: '/announcements',
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
        const activeUsers = await User.find({ isActive: true }).select('_id').lean();
        const activeUserIds = activeUsers.map((u) => u._id);
        const activeUserIdSet = new Set(activeUsers.map((u) => u._id.toString()));

        const totalActiveEmployees = await Employee.countDocuments({
            status: { $in: ['active', 'on-notice'] },
            userId: { $in: activeUserIds },
        });

        // Compute active employees count by department
        const activeEmployeesPerDept = await Employee.aggregate([
            {
                $match: {
                    status: { $in: ['active', 'on-notice'] },
                    userId: { $in: activeUserIds },
                },
            },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 },
                },
            },
        ]);
        const deptCountMap = new Map<string, number>();
        for (const item of activeEmployeesPerDept) {
            if (item._id) {
                deptCountMap.set(item._id.toLowerCase(), item.count);
            }
        }

        return announcements.map((item: any) => {
            const acks = Array.isArray(item.acknowledgedBy) ? item.acknowledgedBy : [];
            // Filter acknowledgments to active users only
            const activeAcks = acks.filter(
                (a: any) => a.userId && activeUserIdSet.has(a.userId.toString())
            );
            const isAcknowledged = userId
                ? activeAcks.some((a: any) => a.userId?.toString() === userId)
                : false;
            const myAck = userId
                ? activeAcks.find((a: any) => a.userId?.toString() === userId)
                : undefined;

            let totalTargetedCount = totalActiveEmployees;
            if (item.targetType === 'users') {
                const targetUids = Array.isArray(item.targetUsers) ? item.targetUsers : [];
                totalTargetedCount = targetUids.filter((tu: any) => {
                    const uid = tu?._id?.toString() || tu?.toString();
                    return activeUserIdSet.has(uid);
                }).length;
            } else if (item.targetType === 'department') {
                const depts = item.targetDepartments || [];
                let deptSum = 0;
                for (const d of depts) {
                    deptSum += deptCountMap.get(d.toLowerCase()) || 0;
                }
                totalTargetedCount = deptSum > 0 ? deptSum : totalActiveEmployees;
            }

            return {
                ...item,
                title: item.title || 'Company Announcement',
                priority: item.priority || 'normal',
                isPinned: Boolean(item.isPinned),
                targetType: item.targetType || 'all',
                targetDepartments: item.targetDepartments || [],
                acknowledgedCount: activeAcks.length,
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

        const activeUsers = await User.find({ isActive: true }).select('_id').lean();
        const activeUserIds = activeUsers.map((u) => u._id);
        const activeUserIdSet = new Set(activeUsers.map((u) => u._id.toString()));

        let employeeFilter: any = {
            status: { $in: ['active', 'on-notice'] },
            userId: { $in: activeUserIds },
        };

        if (targetType === 'department') {
            const depts = announcement.targetDepartments || [];
            employeeFilter.department = { $in: depts };
        } else if (targetType === 'users') {
            const targetUids = (announcement.targetUsers || []).map((id: any) => id.toString());
            const validTargetUserIds = activeUserIds.filter((id) =>
                targetUids.includes(id.toString())
            );
            employeeFilter.userId = { $in: validTargetUserIds };
        }

        const targetedEmployees = await Employee.find(employeeFilter)
            .populate({ path: 'userId', select: 'name email profilePhoto isActive' })
            .select('userId department designation profilePhoto status')
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
            if (u.isActive === false) continue;
            const uidStr = u._id?.toString();
            if (!uidStr) continue;
            if (!activeUserIdSet.has(uidStr)) continue;

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
        if (announcement.poll) {
            const allVoterUserIds: Types.ObjectId[] = [];
            const rawOptions = Array.isArray(announcement.poll.options) ? announcement.poll.options : [];
            for (const opt of rawOptions) {
                if (Array.isArray(opt.votes)) {
                    for (const v of opt.votes) {
                        if (v?.userId) {
                            allVoterUserIds.push(new Types.ObjectId(v.userId.toString()));
                        }
                    }
                }
            }

            const rawTextResponses = Array.isArray(announcement.poll.textResponses)
                ? announcement.poll.textResponses
                : [];
            for (const tr of rawTextResponses) {
                if (tr?.userId) {
                    allVoterUserIds.push(new Types.ObjectId(tr.userId.toString()));
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

            const totalOptionVotes = rawOptions.reduce(
                (sum, opt) => sum + (Array.isArray(opt.votes) ? opt.votes.length : 0),
                0
            );

            const options: PollOptionResult[] = rawOptions.map((opt: any) => {
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
                    percentage: totalOptionVotes > 0 ? Math.round((votes.length / totalOptionVotes) * 100) : 0,
                    voters,
                };
            });

            const textResponses: FormattedTextResponse[] = rawTextResponses.map((tr: any) => {
                const uidStr = tr.userId?.toString();
                const userObj = voterUserMap.get(uidStr) || {
                    _id: uidStr,
                    name: 'Team Member',
                    email: '',
                    department: 'General',
                    designation: 'Employee',
                };
                const optIdStr = tr.optionId?.toString();
                const matchedOpt = rawOptions.find((o: any) => o._id.toString() === optIdStr);
                return {
                    _id: tr._id?.toString() || '',
                    user: userObj,
                    text: tr.text,
                    optionId: optIdStr,
                    optionText: matchedOpt?.text,
                    submittedAt: new Date(tr.submittedAt),
                };
            });

            const pollType: 'choice' | 'text' =
                announcement.poll.pollType === 'text' || options.length === 0 ? 'text' : 'choice';

            pollResults = {
                question: announcement.poll.question,
                pollType,
                totalVotes: pollType === 'text' ? textResponses.length : totalOptionVotes,
                allowMultiple: Boolean(announcement.poll.allowMultiple),
                allowTextResponse: Boolean(announcement.poll.allowTextResponse),
                isClosed: Boolean(announcement.poll.isClosed),
                options,
                textResponses,
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
     * Submit vote and/or text response for an announcement poll
     */
    async votePoll(
        announcementId: string,
        input: { optionIds?: string[]; textResponse?: string },
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

        const isTextPoll = announcement.poll.pollType === 'text';
        const rawOptionIds = Array.isArray(input.optionIds) ? input.optionIds : [];
        const textResponse = typeof input.textResponse === 'string' ? input.textResponse.trim() : '';

        const now = new Date();

        if (isTextPoll) {
            if (!textResponse) {
                throw new AppError('Please enter your response before submitting', 400);
            }
        } else {
            // Choice poll
            const availableOptionIds = (announcement.poll.options || []).map((o) => o._id.toString());
            const validOptionIds = rawOptionIds.filter((id) => availableOptionIds.includes(id));

            if (validOptionIds.length === 0 && !textResponse) {
                throw new AppError('Please select at least one option or enter your response', 400);
            }

            if (!announcement.poll.allowMultiple && validOptionIds.length > 1) {
                throw new AppError('You can only select one option in this poll', 400);
            }

            // Remove previous votes from this user across all options
            for (const opt of announcement.poll.options) {
                opt.votes = opt.votes.filter((v) => v.userId.toString() !== userId);
            }

            // Add new votes
            for (const opt of announcement.poll.options) {
                if (validOptionIds.includes(opt._id.toString())) {
                    opt.votes.push({
                        userId: userObjId,
                        votedAt: now,
                        textResponse: textResponse || undefined,
                    });
                }
            }
        }

        // Store user text response in announcement.poll.textResponses
        if (!Array.isArray(announcement.poll.textResponses)) {
            announcement.poll.textResponses = [];
        }

        // Remove previous text response from this user
        announcement.poll.textResponses = announcement.poll.textResponses.filter(
            (tr) => tr.userId.toString() !== userId
        );

        if (textResponse) {
            const firstOptId =
                !isTextPoll && rawOptionIds.length > 0 && Types.ObjectId.isValid(rawOptionIds[0])
                    ? new Types.ObjectId(rawOptionIds[0])
                    : null;

            announcement.poll.textResponses.push({
                _id: new Types.ObjectId(),
                userId: userObjId,
                text: textResponse,
                optionId: firstOptId,
                submittedAt: now,
            });
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
            link: '/announcements',
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
