import { z } from 'zod';
import { getWordPackNames } from '../utils/wordPacks';

// ─── Create Session ───────────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  sessionType: z.enum(['official', 'casual']).default('casual'),
  numImposters: z.number().int().min(1).max(5).default(2),
  wordPack: z.string().refine(
    (v) => getWordPackNames().includes(v),
    { message: 'Invalid word pack' }
  ).default('general'),
  maxPlayers: z.number().int().min(4).max(20).default(10),
  minPlayers: z.number().int().min(4).max(20).default(4),
  discussionTimeSec: z.number().int().min(30).max(300).default(90),
  votingTimeSec: z.number().int().min(15).max(120).default(30),
  maxRounds: z.number().int().min(0).max(10).default(0),
}).refine(
  (data) => data.minPlayers <= data.maxPlayers,
  { message: 'minPlayers must be ≤ maxPlayers', path: ['minPlayers'] }
);

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// ─── Submit Clue ──────────────────────────────────────────────────────────────

export const SubmitClueSchema = z.object({
  clue: z
    .string()
    .trim()
    .min(1, 'Clue cannot be empty')
    .max(30, 'Clue must be 30 characters or fewer')
    .regex(/^\S+$/, 'Clue must be a single word'),
});

export type SubmitClueInput = z.infer<typeof SubmitClueSchema>;

// ─── Submit Vote ──────────────────────────────────────────────────────────────

export const SubmitVoteSchema = z.object({
  targetPlayerId: z.string().min(1, 'Target player is required'),
});

export type SubmitVoteInput = z.infer<typeof SubmitVoteSchema>;

// ─── Update Config ────────────────────────────────────────────────────────────

export const UpdateConfigSchema = z.object({
  numImposters: z.number().int().min(1).max(5).optional(),
  wordPack: z.string().refine(
    (v) => getWordPackNames().includes(v),
    { message: 'Invalid word pack' }
  ).optional(),
  discussionTimeSec: z.number().int().min(30).max(300).optional(),
  votingTimeSec: z.number().int().min(15).max(120).optional(),
  maxPlayers: z.number().int().min(4).max(20).optional(),
});

export type UpdateConfigInput = z.infer<typeof UpdateConfigSchema>;

// ─── Leaderboard Query ────────────────────────────────────────────────────────

export const LeaderboardQuerySchema = z.object({
  gameType: z.string().default('imposter'),
  period: z.enum(['today', 'week', 'month', 'all']).default('all'),
  view: z.enum(['overall', 'friends', 'my-stats']).default('overall'),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
});

export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;
