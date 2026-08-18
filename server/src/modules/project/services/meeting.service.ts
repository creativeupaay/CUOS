import { Meeting, IMeeting } from '../models/Meeting.model';
import { Project } from '../models/Project.model';
import AppError from '../../../utils/appError';
import { Employee } from '../../hrms/models/Employee.model';
import { Partner } from '../../partners/models/Partner.model';
import { PartnerEmployee } from '../../partners/models/PartnerEmployee.model';
import { addDays, isBefore, isSameDay, getDay } from 'date-fns';

export interface CreateMeetingData {
    title: string;
    description?: string;
    type: 'internal' | 'external';
    projectId?: string;
    participants: Array<{
        userId?: string;
        externalEmail?: string;
        name?: string;
        role?: 'organizer' | 'required' | 'optional';
    }>;
    scheduledAt: Date;
    duration: number;
    location?: string;
    agenda?: string;
    notes?: string;
    actionItems?: Array<{
        description: string;
        assignedTo?: string;
        dueDate?: Date;
        completed: boolean;
    }>;
    accessLevel?: 'project-team' | 'managers-only' | 'custom';
    customAccessUsers?: string[];
    createdBy: string;
    meetLink?: string;
    googleCalendarEventId?: string;
    recurrence?: {
        frequency: 'daily' | 'weekly';
        endDate: string;
        daysOfWeek?: number[];
    };
}

export interface UpdateMeetingData {
    title?: string;
    description?: string;
    type?: 'internal' | 'external';
    participants?: Array<{
        userId?: string;
        externalEmail?: string;
        name?: string;
        role?: 'organizer' | 'required' | 'optional';
    }>;
    scheduledAt?: Date;
    duration?: number;
    location?: string;
    agenda?: string;
    notes?: string;
    actionItems?: Array<{
        description: string;
        assignedTo?: string;
        dueDate?: Date;
        completed: boolean;
    }>;
    accessLevel?: 'project-team' | 'managers-only' | 'custom';
    customAccessUsers?: string[];
}

export const createMeeting = async (
    data: CreateMeetingData
): Promise<IMeeting | IMeeting[]> => {
    if (data.recurrence) {
        const { frequency, endDate, daysOfWeek } = data.recurrence;
        const end = new Date(endDate);
        const start = new Date(data.scheduledAt);
        end.setHours(23, 59, 59, 999);

        const meetingsToCreate: any[] = [];
        let current = new Date(start);
        
        let iterations = 0;
        const maxIterations = 365;

        while ((isBefore(current, end) || isSameDay(current, end)) && iterations < maxIterations) {
            iterations++;
            
            let shouldCreate = false;
            if (frequency === 'daily') {
                shouldCreate = true;
            } else if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
                if (daysOfWeek.includes(getDay(current))) {
                    shouldCreate = true;
                }
            }

            if (shouldCreate) {
                meetingsToCreate.push({
                    ...data,
                    scheduledAt: new Date(current),
                });
            }

            current = addDays(current, 1);
        }

        if (meetingsToCreate.length === 0) {
            meetingsToCreate.push(data);
        }

        const meetings = await Meeting.insertMany(meetingsToCreate);
        return meetings as any;
    }

    const meeting = await Meeting.create(data);
    return meeting;
};

export const getMeetings = async (
    projectId: string,
    userId: string,
    userRole: string,
    filters?: {
        type?: 'internal' | 'external';
        startDate?: Date;
        endDate?: Date;
    }
): Promise<IMeeting[]> => {
    const query: any = { projectId };

    if (filters?.type) query.type = filters.type;
    if (filters?.startDate || filters?.endDate) {
        query.scheduledAt = {};
        if (filters.startDate) query.scheduledAt.$gte = filters.startDate;
        if (filters.endDate) query.scheduledAt.$lte = filters.endDate;
    }

    let meetings = await Meeting.find(query)
        .populate('participants.userId', 'name email')
        .populate('createdBy', 'name email')
        .sort({ scheduledAt: -1 });

    // Filter by access level (if not admin)
    if (userRole !== 'admin' && userRole !== 'super-admin') {
        const project = await Project.findById(projectId);

        if (userRole === 'partner' && project?.partnerId) {
            const partner = await Partner.findOne({ userId }).select('_id').lean();
            const partnerEmployee = partner ? null : await PartnerEmployee.findById(userId).select('partnerId').lean();
            const viewerPartnerId = partner?._id?.toString() || partnerEmployee?.partnerId?.toString();
            const projectPartnerId = (project.partnerId as any)._id?.toString() || project.partnerId.toString();

            if (viewerPartnerId && viewerPartnerId === projectPartnerId) {
                meetings = meetings.filter((meeting) => {
                    if (meeting.accessLevel === 'custom') {
                        return meeting.customAccessUsers?.some((id) => id.toString() === userId);
                    }
                    return true;
                });
                return meetings;
            }
        }

        const employee = await Employee.findOne({ userId });
        const userAssignee = employee && project?.assignees.find(
            (a) => a.memberType === 'employee' && a.employeeId?.toString() === employee._id.toString()
        );

        meetings = meetings.filter((meeting) => {
            if (meeting.accessLevel === 'project-team') {
                return !!userAssignee;
            } else if (meeting.accessLevel === 'managers-only') {
                return userAssignee?.role === 'manager';
            } else if (meeting.accessLevel === 'custom') {
                return meeting.customAccessUsers?.some(
                    (id) => id.toString() === userId
                );
            }
            return false;
        });
    }

    return meetings;
};

export const getIndividualMeetings = async (
    userId: string,
    isAdmin: boolean,
    filters?: {
        type?: 'internal' | 'external';
        startDate?: Date;
        endDate?: Date;
    }
): Promise<IMeeting[]> => {
    // We only fetch meetings where projectId is not set (individual meetings)
    // AND the user is either the creator or a participant (unless admin)
    const query: any = {
        projectId: { $exists: false },
    };

    if (!isAdmin) {
        query.$or = [
            { createdBy: userId },
            { 'participants.userId': userId },
        ];
    }

    if (filters?.type) query.type = filters.type;
    if (filters?.startDate || filters?.endDate) {
        query.scheduledAt = {};
        if (filters.startDate) query.scheduledAt.$gte = filters.startDate;
        if (filters.endDate) query.scheduledAt.$lte = filters.endDate;
    }

    const meetings = await Meeting.find(query)
        .populate('participants.userId', 'name email')
        .populate('createdBy', 'name email')
        .sort({ scheduledAt: -1 });

    return meetings;
};

export const getMeetingById = async (
    meetingId: string
): Promise<IMeeting | null> => {
    const meeting = await Meeting.findById(meetingId)
        .populate('participants.userId', 'name email role')
        .populate('actionItems.assignedTo', 'name email')
        .populate('createdBy', 'name email');

    return meeting;
};

export const updateMeeting = async (
    meetingId: string,
    data: UpdateMeetingData
): Promise<IMeeting | null> => {
    const meeting = await Meeting.findByIdAndUpdate(
        meetingId,
        { $set: data },
        { new: true, runValidators: true }
    );

    return meeting;
};

export const deleteMeeting = async (meetingId: string): Promise<void> => {
    await Meeting.findByIdAndDelete(meetingId);
};
