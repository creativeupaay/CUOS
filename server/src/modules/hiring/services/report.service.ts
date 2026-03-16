import { Application } from '../models/Application.model';
import { Job } from '../models/Job.model';
import { Offer } from '../models/Offer.model';
import { ApplicationActivity } from '../models/ApplicationActivity.model';

const PIPELINE_ORDER = [
    'new',
    'screening',
    'shortlisted',
    'assignment-round',
    'assignment-submitted',
    'interview',
    'offered',
    'hired',
    'rejected',
] as const;

export class HiringReportService {
    async getSummary(lastDays = 30) {
        const [
            totalApplications,
            activeJobs,
            stageCountsRaw,
            stageAgingRaw,
            hiredCount,
            rejectedCount,
            offersCount,
            recruiterPerformance,
        ] = await Promise.all([
            Application.countDocuments(),
            Job.countDocuments({ isHiring: true }),
            Application.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
            Application.aggregate([
                {
                    $project: {
                        status: 1,
                        agingDays: {
                            $divide: [{ $subtract: [new Date(), '$updatedAt'] }, 1000 * 60 * 60 * 24],
                        },
                    },
                },
                {
                    $group: {
                        _id: '$status',
                        avgAgingDays: { $avg: '$agingDays' },
                    },
                },
            ]),
            Application.countDocuments({ status: 'hired' }),
            Application.countDocuments({ status: 'rejected' }),
            Offer.countDocuments(),
            this.getRecruiterPerformance(lastDays),
        ]);

        const stageCountMap = new Map<string, number>(
            stageCountsRaw.map((item: any) => [String(item._id), Number(item.count)])
        );

        const stageAgingMap = new Map<string, number>(
            stageAgingRaw.map((item: any) => [String(item._id), Number(item.avgAgingDays || 0)])
        );

        const pipeline = PIPELINE_ORDER.map((status, index) => {
            const count = stageCountMap.get(status) || 0;
            const prevStatus = PIPELINE_ORDER[index - 1];
            const prevCount = prevStatus ? stageCountMap.get(prevStatus) || 0 : 0;

            let conversionFromPrevious: number | null = null;
            if (index > 0 && prevCount > 0) {
                conversionFromPrevious = Number(((count / prevCount) * 100).toFixed(1));
            }

            return {
                status,
                count,
                avgAgingDays: Number((stageAgingMap.get(status) || 0).toFixed(1)),
                conversionFromPrevious,
            };
        });

        const rejectionRate =
            totalApplications > 0
                ? Number(((rejectedCount / totalApplications) * 100).toFixed(1))
                : 0;

        return {
            overview: {
                totalApplications,
                activeJobs,
                hiredCount,
                offersCount,
                rejectedCount,
                rejectionRate,
            },
            pipeline,
            recruiterPerformance,
        };
    }

    private async getRecruiterPerformance(lastDays: number) {
        const since = new Date(Date.now() - lastDays * 24 * 60 * 60 * 1000);

        return ApplicationActivity.aggregate([
            {
                $match: {
                    actorType: 'user',
                    actorId: { $exists: true, $ne: null },
                    createdAt: { $gte: since },
                },
            },
            {
                $group: {
                    _id: '$actorId',
                    totalActions: { $sum: 1 },
                    statusChanges: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'application.status_changed'] }, 1, 0],
                        },
                    },
                    offersSent: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'application.offer_sent'] }, 1, 0],
                        },
                    },
                    rejections: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'application.rejected'] }, 1, 0],
                        },
                    },
                    interviewNotes: {
                        $sum: {
                            $cond: [{ $eq: ['$type', 'interview.notes_saved'] }, 1, 0],
                        },
                    },
                    lastActiveAt: { $max: '$createdAt' },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    name: '$user.name',
                    email: '$user.email',
                    totalActions: 1,
                    statusChanges: 1,
                    offersSent: 1,
                    rejections: 1,
                    interviewNotes: 1,
                    lastActiveAt: 1,
                },
            },
            { $sort: { totalActions: -1, offersSent: -1, statusChanges: -1 } },
            { $limit: 20 },
        ]);
    }
}
