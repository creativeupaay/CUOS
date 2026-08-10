import { Request, Response, NextFunction } from 'express';
import { getLeaderboard, getPlayerStats } from '../services/leaderboard.service';
import { LeaderboardQuerySchema } from '../validators/game.validator';

function catchAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export const getLeaderboardHandler = catchAsync(async (req, res) => {
  const input = LeaderboardQuerySchema.parse({
    gameType: req.query.gameType || 'all',
    period: req.query.period || 'all',
    view: req.query.view || 'overall',
    limit: req.query.limit ? Number(req.query.limit) : 20,
    page: req.query.page ? Number(req.query.page) : 1,
  });

  const result = await getLeaderboard(input);
  res.json({ success: true, data: result });
});

export const getMyStatsHandler = catchAsync(async (req, res) => {
  const gameType = (req.query.gameType as string) || 'all';
  const period = (req.query.period as string) || 'all';
  const stats = await getPlayerStats(req.user!.id, gameType, period);
  res.json({ success: true, data: stats });
});
