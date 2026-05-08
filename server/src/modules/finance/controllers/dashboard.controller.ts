import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { logger } from "../../../utils/logger";

export class DashboardController {
    /**
     * Get comprehensive dashboard data
     */
    static async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            // Default to current fiscal year if no dates provided
            const now = new Date();
            const currentMonth = now.getMonth();
            const fyStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;

            const defaultStartDate = new Date(fyStartYear, 3, 1); // April 1st
            const defaultEndDate = new Date(fyStartYear + 1, 2, 31, 23, 59, 59); // March 31st

            const startDate = req.query.startDate
                ? new Date(req.query.startDate as string)
                : defaultStartDate;
            const endDate = req.query.endDate
                ? new Date(req.query.endDate as string)
                : defaultEndDate;

            const dashboardData = await DashboardService.getDashboardData(startDate, endDate);

            res.status(200).json({
                success: true,
                data: dashboardData,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching dashboard data:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard data',
                error: error.message,
            });
        }
    }

    /**
     * Get quick stats
     */
    static async getQuickStats(req: Request, res: Response): Promise<void> {
        try {
            const stats = await DashboardService.getQuickStats();

            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching quick stats:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch quick stats',
                error: error.message,
            });
        }
    }

    /**
     * Get top clients by revenue
     */
    static async getTopClients(req: Request, res: Response): Promise<void> {
        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const fyStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;

            const defaultStartDate = new Date(fyStartYear, 3, 1);
            const defaultEndDate = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);

            const startDate = req.query.startDate
                ? new Date(req.query.startDate as string)
                : defaultStartDate;
            const endDate = req.query.endDate
                ? new Date(req.query.endDate as string)
                : defaultEndDate;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

            const topClients = await DashboardService.getTopClients(startDate, endDate, limit);

            res.status(200).json({
                success: true,
                data: topClients,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching top clients:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch top clients',
                error: error.message,
            });
        }
    }

    /**
     * Get expense category breakdown
     */
    static async getExpenseByCategory(req: Request, res: Response): Promise<void> {
        try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const fyStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;

            const defaultStartDate = new Date(fyStartYear, 3, 1);
            const defaultEndDate = new Date(fyStartYear + 1, 2, 31, 23, 59, 59);

            const startDate = req.query.startDate
                ? new Date(req.query.startDate as string)
                : defaultStartDate;
            const endDate = req.query.endDate
                ? new Date(req.query.endDate as string)
                : defaultEndDate;

            const breakdown = await DashboardService.getExpenseByCategory(startDate, endDate);

            res.status(200).json({
                success: true,
                data: breakdown,
            });
        } catch (error: any) {
            logger.error({ context: error }, 'Error fetching expense breakdown:');
            res.status(500).json({
                success: false,
                message: 'Failed to fetch expense breakdown',
                error: error.message,
            });
        }
    }
}
