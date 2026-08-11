import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createQuizSession,
  joinQuizSession,
  leaveQuizSession,
  setQuizPlayerReady,
  startQuizGame,
  getPublicQuizState,
  endQuizSession,
  listQuizSessions,
  getQuizPreparationStatus,
} from '../services/quiz/quizGame.service';
import { getSocketIO } from '../../notification/services/notification.service';
import { cancelQuizTimers } from '../services/quiz/quizStateMachine.service';

function catchAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ─── Validators ────────────────────────────────────────────────────────────

const CreateQuizSessionSchema = z.object({
  gameName: z.string().trim().min(1).max(80).default('Quiz Battle'),
  topic: z.string().trim().min(1, 'Topic is required').max(100),
  totalQuestions: z.number().int().min(5).max(20).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('medium'),
  timePerQuestion: z.number().int().min(10).max(60).default(20),
  maxPlayers: z.number().int().min(2).max(50).default(20),
  minPlayers: z.number().int().min(2).max(20).default(2),
});

// ─── List active sessions ──────────────────────────────────────────────────

export const listQuizSessionsHandler = catchAsync(async (_req, res) => {
  const sessions = await listQuizSessions();
  res.json({ success: true, data: sessions });
});

// ─── Create session ────────────────────────────────────────────────────────

export const createQuizSessionHandler = catchAsync(async (req, res) => {
  const input = CreateQuizSessionSchema.parse(req.body);
  const user = req.user!;

  const session = await createQuizSession(
    user.id,
    (user as any).name || user.email,
    user.email,
    input
  );

  const sessionId = (session._id as any).toString();

  // Start background question generation (fire and forget)
  // We need io here — get from notification service
  const io = getSocketIO();
  if (io) {
    // Slight delay to allow client to join the socket room first
    setTimeout(async () => {
      const { startBackgroundGeneration } = await import('../services/quiz/backgroundGenerator');
      startBackgroundGeneration(sessionId, io).catch(() => {});
    }, 2000);
  }

  res.status(201).json({
    success: true,
    data: { sessionId },
    message: 'Quiz session created. Questions are being prepared.',
  });
});

// ─── Get session (public state) ────────────────────────────────────────────

export const getQuizSessionHandler = catchAsync(async (req, res) => {
  const state = await getPublicQuizState(req.params.sessionId);
  res.json({ success: true, data: state });
});

// ─── Get preparation status ────────────────────────────────────────────────

export const getQuizPreparationHandler = catchAsync(async (req, res) => {
  const status = await getQuizPreparationStatus(req.params.sessionId);
  res.json({ success: true, data: status });
});

// ─── Join session ──────────────────────────────────────────────────────────

export const joinQuizSessionHandler = catchAsync(async (req, res) => {
  const user = req.user!;
  const { session, isSpectator } = await joinQuizSession(
    req.params.sessionId,
    user.id,
    (user as any).name || user.email,
    user.email
  );
  res.json({
    success: true,
    data: { sessionId: (session._id as any).toString(), isSpectator },
    message: isSpectator ? 'Joined as spectator' : 'Joined successfully',
  });
});

// ─── Leave session ─────────────────────────────────────────────────────────

export const leaveQuizSessionHandler = catchAsync(async (req, res) => {
  await leaveQuizSession(req.params.sessionId, req.user!.id);
  res.json({ success: true, message: 'Left session' });
});

// ─── Ready up ─────────────────────────────────────────────────────────────

export const readyQuizHandler = catchAsync(async (req, res) => {
  const isReady = Boolean(req.body.isReady);
  await setQuizPlayerReady(req.params.sessionId, req.user!.id, isReady);
  res.json({ success: true, message: isReady ? 'Marked ready' : 'Marked not ready' });
});

// ─── Start game (host) ─────────────────────────────────────────────────────

export const startQuizGameHandler = catchAsync(async (req, res) => {
  const io = getSocketIO();
  if (!io) throw new Error('Socket.IO not available');

  await startQuizGame(req.params.sessionId, req.user!.id);

  // Notify all players
  io.to(`quiz:${req.params.sessionId}`).emit('quiz:started', {
    sessionId: req.params.sessionId,
  });

  // Start the first question after a brief countdown
  const { startAndScheduleQuestion } = await import('../services/quiz/quizStateMachine.service');
  setTimeout(async () => {
    await startAndScheduleQuestion(req.params.sessionId, 0, io);
  }, 2000);

  res.json({ success: true, message: 'Game started' });
});

// ─── End game (host) ───────────────────────────────────────────────────────

export const endQuizGameHandler = catchAsync(async (req, res) => {
  const session = await endQuizSession(req.params.sessionId, req.user!.id);
  cancelQuizTimers(req.params.sessionId);
  const io = getSocketIO();
  if (io) {
    io.to(`quiz:${req.params.sessionId}`).emit('quiz:game_ended', {
      sessionId: req.params.sessionId,
      reason: 'Host ended the game',
    });
  }
  res.json({ success: true, message: 'Game ended' });
});
