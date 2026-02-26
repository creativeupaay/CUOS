import { Meeting, IMeeting } from '../models/Meeting.model';
import { Project } from '../models/Project.model';
import AppError from '../../../utils/appError';
import { Employee } from '../../hrms/models/Employee.model';

export interface CreateMeetingData {
    title: string;
    description?: string;
    type: 'internal' | 'external';
    projectId: string;
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
): Promise<IMeeting> => {
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

        const employee = await Employee.findOne({ userId });
        const userAssignee = employee && project?.assignees.find(
            (a) => a.employeeId.toString() === employee._id.toString()
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
