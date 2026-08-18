import { Request, Response, NextFunction } from 'express';
import * as meetingService from '../services/meeting.service';
import asyncHandler from '../../../utils/asyncHandler';
import AppError from '../../../utils/appError';
import { getAccessibleProjectIds } from '../middlewares/projectAccess.middleware';
import { GoogleIntegration } from '../../integration/models/GoogleIntegration.model';
import { getValidAccessToken } from '../../integration/services/google.oauth.service';
import { createCalendarEventWithMeet } from '../../integration/services/google.calendar.service';
import { User } from '../../auth/models/User.model';

async function processMeetLinkGeneration(req: Request, userId: string): Promise<{ meetLink?: string, eventId?: string }> {
    if (!req.body.generateMeetLink) return {};

    const integration = await GoogleIntegration.findOne({ userId }).select('+accessToken +refreshToken');
    if (!integration) {
        throw new AppError('Google Account not connected. Please connect your account in Settings.', 400);
    }

    try {
        const accessToken = await getValidAccessToken(integration as any);
        
        // Collect emails
        const emails: string[] = [];
        const participants = req.body.participants || [];
        
        for (const p of participants) {
            if (p.externalEmail) {
                emails.push(p.externalEmail);
            } else if (p.userId) {
                const user = await User.findById(p.userId).select('email').lean();
                if (user?.email) emails.push(user.email);
            }
        }

        const result = await createCalendarEventWithMeet(
            accessToken,
            req.body.title || req.body.purpose || 'CUOS Meeting',
            req.body.description || req.body.agenda,
            new Date(req.body.scheduledAt),
            req.body.duration || 30,
            emails
        );

        return result;
    } catch (err: any) {
        if (err.message === 'insufficient_permissions') {
            throw new AppError('Google Calendar permissions missing. Please disconnect and reconnect your Google account in Settings.', 403);
        }
        throw new AppError('Failed to generate Google Meet link. ' + err.message, 500);
    }
}

export const createMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const { meetLink, eventId } = await processMeetLinkGeneration(req, userId);

        const meeting = await meetingService.createMeeting({
            ...req.body,
            projectId: req.params.projectId,
            createdBy: userId,
            meetLink,
            googleCalendarEventId: eventId,
        });

        res.status(201).json({
            success: true,
            message: 'Meeting created successfully',
            data: meeting,
        });
    }
);

export const createIndividualMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;

        const { meetLink, eventId } = await processMeetLinkGeneration(req, userId);

        const meeting = await meetingService.createMeeting({
            ...req.body,
            // no projectId passed
            createdBy: userId,
            meetLink,
            googleCalendarEventId: eventId,
        });

        res.status(201).json({
            success: true,
            message: 'Individual meeting created successfully',
            data: meeting,
        });
    }
);

export const getMeetings = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;
        const userRole = req.user?.role!;

        const meetings = await meetingService.getMeetings(
            req.params.projectId,
            userId,
            userRole,
            {
                type: req.query.type as 'internal' | 'external',
                startDate: req.query.startDate
                    ? new Date(req.query.startDate as string)
                    : undefined,
                endDate: req.query.endDate
                    ? new Date(req.query.endDate as string)
                    : undefined,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Meetings retrieved successfully',
            data: meetings,
        });
    }
);

export const getAllMeetings = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const projectIds = (req.query.projectIds as string)?.split(',').filter(Boolean) || [];
        if (projectIds.length === 0) {
            return res.status(200).json({ success: true, message: 'No project IDs provided', data: [] });
        }
        
        const validProjectIds = await getAccessibleProjectIds(req, projectIds);
        if (validProjectIds.length === 0) {
            return res.status(200).json({ success: true, message: 'No accessible projects found', data: [] });
        }

        const userId = req.user?.id!;
        const roleRaw = req.user?.role;
        const userRole = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : typeof roleRaw === 'object' && roleRaw ? String((roleRaw as any).name || '').toLowerCase() : '';

        const results = await Promise.all(
            validProjectIds.map(pid => meetingService.getMeetings(pid, userId, userRole, {
                type: req.query.type as any,
                startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
                endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
            }))
        );

        const allMeetings = results.flat();

        res.status(200).json({
            success: true,
            message: 'Global meetings retrieved successfully',
            data: allMeetings,
        });
    }
);

export const getIndividualMeetings = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.user?.id!;
        const roleRaw = req.user?.role;
        const userRole =
            typeof roleRaw === 'string'
                ? roleRaw.toLowerCase()
                : typeof roleRaw === 'object' && roleRaw
                    ? String((roleRaw as any).name || '').toLowerCase()
                    : '';
        const isAdmin = ['super-admin', 'super_admin', 'admin'].includes(userRole);

        const meetings = await meetingService.getIndividualMeetings(
            userId,
            isAdmin,
            {
                type: req.query.type as 'internal' | 'external',
                startDate: req.query.startDate
                    ? new Date(req.query.startDate as string)
                    : undefined,
                endDate: req.query.endDate
                    ? new Date(req.query.endDate as string)
                    : undefined,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Individual meetings retrieved successfully',
            data: meetings,
        });
    }
);

export const getMeetingById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const meeting = await meetingService.getMeetingById(req.params.id);

        if (!meeting) {
            return next(new AppError('Meeting not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Meeting retrieved successfully',
            data: meeting,
        });
    }
);

export const updateMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        const meeting = await meetingService.updateMeeting(
            req.params.id,
            req.body
        );

        if (!meeting) {
            return next(new AppError('Meeting not found', 404));
        }

        res.status(200).json({
            success: true,
            message: 'Meeting updated successfully',
            data: meeting,
        });
    }
);

export const deleteMeeting = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
        await meetingService.deleteMeeting(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Meeting deleted successfully',
        });
    }
);
