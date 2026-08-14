import { Request, Response, NextFunction } from 'express';
import { generateHydrationMessage } from '../services/hydrationMessage.service';
import { logger } from '../../../utils/logger';

/**
 * POST /api/v1/wellness/hydration-message
 *
 * Generates a personalized hydration reminder message using Gemini (or fallback).
 * This endpoint is called once per hydration cycle — NOT on every timer tick.
 *
 * Body:
 *   userName?   string   — user's first name for personalization (optional)
 *   workMinutes number   — continuous work duration in minutes
 *   timeOfDay   string   — human-readable current time, e.g. "3:30 PM"
 */
export const getHydrationMessage = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { userName, workMinutes, timeOfDay } = req.body as {
            userName?: string;
            workMinutes?: number;
            timeOfDay?: string;
        };

        // Validate inputs
        if (typeof workMinutes !== 'number' || workMinutes < 0 || workMinutes > 720) {
            res.status(400).json({
                success: false,
                message: 'workMinutes must be a number between 0 and 720.',
            });
            return;
        }

        // Sanitize userName — never pass full display names longer than 30 chars
        const safeUserName = typeof userName === 'string'
            ? userName.split(' ')[0].slice(0, 30) // first name only
            : undefined;

        const safeTimeOfDay = typeof timeOfDay === 'string'
            ? timeOfDay.slice(0, 20)
            : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const result = await generateHydrationMessage({
            userName: safeUserName,
            workMinutes: Math.floor(workMinutes),
            timeOfDay: safeTimeOfDay,
        });

        res.status(200).json({
            success: true,
            data: {
                message: result.message,
                source: result.source,
            },
        });
    } catch (err) {
        logger.error({ err }, '[HydrationController] Unexpected error');
        next(err);
    }
};
