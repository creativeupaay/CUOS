import { Types } from 'mongoose';
import { Project, IProject } from '../models/Project.model';
import { TimeLog } from '../models/TimeLog.model';
import AppError from '../../../utils/appError';

export interface ProjectCostSummary {
    projectId: string;
    projectName: string;
    budget?: number;
    currency: string;
    billingType: string;
    hourlyRate?: number;

    totalLoggedHours: number;
    totalLoggedMinutes: number;
    totalBillableHours: number;
    totalBillableMinutes: number;

    actualCost: number;
    budgetRemaining?: number;
    budgetUtilization?: number; // percentage

    costByUser: Array<{
        userId: string;
        userName: string;
        hours: number;
        cost: number;
    }>;
}

/**
 * Calculate project cost summary
 */
export const getProjectCostSummary = async (
    projectId: string
): Promise<ProjectCostSummary> => {
    const project = await Project.findById(projectId)
        .populate('assignees.userId', 'name');

    if (!project) {
        throw new AppError('Project not found', 404);
    }

    // Get all time logs for this project
    const timeLogs = await TimeLog.find({ projectId })
        .populate('userId', 'name');

    // Calculate totals
    let totalMinutes = 0;
    let totalBillableMinutes = 0;
    const userCosts: Map<string, { name: string; minutes: number; cost: number }> = new Map();

    for (const log of timeLogs) {
        totalMinutes += log.duration;

        if (log.billable) {
            totalBillableMinutes += log.duration;
        }

        // Calculate cost for this log
        const hourlyRate = log.hourlyRate || project.hourlyRate || 0;
        const hours = log.duration / 60;
        const cost = hours * hourlyRate;

        // Aggregate by user
        const userId = log.userId._id.toString();
        const userName = (log.userId as any).name || 'Unknown';

        if (userCosts.has(userId)) {
            const existing = userCosts.get(userId)!;
            existing.minutes += log.duration;
            existing.cost += cost;
        } else {
            userCosts.set(userId, {
                name: userName,
                minutes: log.duration,
                cost: cost,
            });
        }
    }

    // Calculate actual cost based on billing type
    let actualCost = 0;
    if (project.billingType === 'hourly') {
        const billableHours = totalBillableMinutes / 60;
        actualCost = billableHours * (project.hourlyRate || 0);
    } else if (project.billingType === 'fixed') {
        actualCost = project.budget || 0;
    }

    // Calculate budget metrics
    let budgetRemaining: number | undefined;
    let budgetUtilization: number | undefined;

    if (project.budget) {
        budgetRemaining = project.budget - actualCost;
        budgetUtilization = (actualCost / project.budget) * 100;
    }

    // Format cost by user
    const costByUser = Array.from(userCosts.entries()).map(([userId, data]) => ({
        userId,
        userName: data.name,
        hours: Math.round((data.minutes / 60) * 100) / 100,
        cost: Math.round(data.cost * 100) / 100,
    }));

    return {
        projectId: project._id.toString(),
        projectName: project.name,
        budget: project.budget,
        currency: project.currency,
        billingType: project.billingType,
        hourlyRate: project.hourlyRate,

        totalLoggedHours: Math.round((totalMinutes / 60) * 100) / 100,
        totalLoggedMinutes: totalMinutes,
        totalBillableHours: Math.round((totalBillableMinutes / 60) * 100) / 100,
        totalBillableMinutes: totalBillableMinutes,

        actualCost: Math.round(actualCost * 100) / 100,
        budgetRemaining: budgetRemaining !== undefined ? Math.round(budgetRemaining * 100) / 100 : undefined,
        budgetUtilization: budgetUtilization !== undefined ? Math.round(budgetUtilization * 100) / 100 : undefined,

        costByUser,
    };
};
