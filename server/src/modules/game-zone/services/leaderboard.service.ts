import { GameScore } from '../models/GameScore.model';
import { LeaderboardQueryInput } from '../validators/game.validator';
import { LeaderboardEntry } from '../types/game.types';

function getDateFilter(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return start;
    }
    case 'month': {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      return start;
    }
    default:
      return null;
  }
}

export async function getLeaderboard(input: LeaderboardQueryInput): Promise<{
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
}> {
  const { gameType, period, limit, page } = input;

  const matchStage: Record<string, any> = { gameType };
  const dateFilter = getDateFilter(period);
  if (dateFilter) {
    matchStage.createdAt = { $gte: dateFilter };
  }

  const skip = (page - 1) * limit;

  const [results, totalGroups] = await Promise.all([
    GameScore.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          userName: { $first: '$userName' },
          gamesPlayed: { $sum: 1 },
          wins: { $sum: { $cond: ['$won', 1, 0] } },
          totalPoints: { $sum: '$points' },
          timesImposter: { $sum: { $cond: [{ $eq: ['$role', 'imposter'] }, 1, 0] } },
          timesNormal: { $sum: { $cond: [{ $eq: ['$role', 'normal'] }, 1, 0] } },
        },
      },
      { $sort: { totalPoints: -1, wins: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    GameScore.aggregate([
      { $match: matchStage },
      { $group: { _id: '$userId' } },
      { $count: 'total' },
    ]),
  ]);

  const total = totalGroups[0]?.total || 0;

  const entries: LeaderboardEntry[] = results.map((r: any, index: number) => ({
    rank: skip + index + 1,
    userId: r._id,
    userName: r.userName,
    gamesPlayed: r.gamesPlayed,
    wins: r.wins,
    totalPoints: r.totalPoints,
    roleStats: {
      timesImposter: r.timesImposter,
      timesNormal: r.timesNormal,
    },
  }));

  return { entries, total, page, limit };
}

export async function getPlayerStats(userId: string, gameType = 'imposter') {
  const stats = await GameScore.aggregate([
    { $match: { userId, gameType } },
    {
      $group: {
        _id: null,
        gamesPlayed: { $sum: 1 },
        wins: { $sum: { $cond: ['$won', 1, 0] } },
        totalPoints: { $sum: '$points' },
        timesImposter: { $sum: { $cond: [{ $eq: ['$role', 'imposter'] }, 1, 0] } },
        avgPoints: { $avg: '$points' },
      },
    },
  ]);

  return stats[0] || { gamesPlayed: 0, wins: 0, totalPoints: 0, timesImposter: 0, avgPoints: 0 };
}
