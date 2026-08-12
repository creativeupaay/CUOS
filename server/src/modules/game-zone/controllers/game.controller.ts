import { Request, Response, NextFunction } from 'express';
import {
  createGameSession,
  joinGameSession,
  leaveGameSession,
  setPlayerReady,
  startGame,
  confirmRole,
  submitClue,
  submitVote,
  getMyRole,
  getPublicGameState,
  getCluesForCycle,
  endGame,
  listGameSessions,
  updateSessionConfig,
} from '../services/game.service';
import { listWordleSessions } from '../services/wordle/wordleGame.service';
import { listQuizSessions } from '../services/quiz/quizGame.service';
import { getSocketIO } from '../../notification/services/notification.service';
import {
  CreateSessionSchema,
  SubmitClueSchema,
  SubmitVoteSchema,
  UpdateConfigSchema,
} from '../validators/game.validator';

function catchAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ─── List active game sessions ─────────────────────────────────────────────

export const listSessions = catchAsync(async (req, res) => {
  const imposterSessions = await listGameSessions();
  const wordleSessions = await listWordleSessions();
  const quizSessions = await listQuizSessions();
  
  const allSessions = [...imposterSessions, ...wordleSessions, ...quizSessions].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  
  res.json({ success: true, data: allSessions });
});

// ─── Create game session ───────────────────────────────────────────────────

export const createSession = catchAsync(async (req, res) => {
  const input = CreateSessionSchema.parse(req.body);
  const user = req.user!;

  // Only admins can create official sessions
  if (input.sessionType === 'official') {
    const isAdmin = ['super-admin', 'admin'].includes(user.role);
    const hasAdminAccess = (user.modulePermissions as any)?.overallAdmin?.adminAccess === true;
    if (!isAdmin && !hasAdminAccess) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create official game sessions',
      });
    }
  }

  const session = await createGameSession(user.id, (user as any).name || user.email, user.email, input);
  res.status(201).json({ success: true, data: { sessionId: (session._id as any).toString() } });
});

// ─── Get game session (public state) ──────────────────────────────────────

export const getSession = catchAsync(async (req, res) => {
  const state = await getPublicGameState(req.params.sessionId);
  res.json({ success: true, data: state });
});

// ─── Join game session ─────────────────────────────────────────────────────

export const joinSession = catchAsync(async (req, res) => {
  const user = req.user!;
  const { session, isSpectator } = await joinGameSession(
    req.params.sessionId,
    user.id,
    (user as any).name || user.email,
    user.email
  );
  res.json({
    success: true,
    data: { sessionId: (session._id as any).toString(), isSpectator },
    message: isSpectator ? 'Joined as spectator (game in progress)' : 'Joined successfully',
  });
});

// ─── Leave game session ────────────────────────────────────────────────────

export const leaveSession = catchAsync(async (req, res) => {
  await leaveGameSession(req.params.sessionId, req.user!.id);
  res.json({ success: true, message: 'Left game session' });
});

// ─── Toggle ready state ────────────────────────────────────────────────────

export const readyUp = catchAsync(async (req, res) => {
  const isReady = Boolean(req.body.isReady);
  await setPlayerReady(req.params.sessionId, req.user!.id, isReady);
  res.json({ success: true, message: isReady ? 'Marked as ready' : 'Marked as not ready' });
});

// ─── Update session config (host only) ────────────────────────────────────

export const updateConfig = catchAsync(async (req, res) => {
  const input = UpdateConfigSchema.parse(req.body);
  const session = await updateSessionConfig(req.params.sessionId, req.user!.id, input as any);
  res.json({ success: true, data: session.config });
});

// ─── Start game (host only) ────────────────────────────────────────────────

export const startGameSession = catchAsync(async (req, res) => {
  const { session } = await startGame(req.params.sessionId, req.user!.id);
  
  const io = getSocketIO();
  if (io && session.currentRound) {
    const round = session.currentRound;
    io.to(`game:${req.params.sessionId}`).emit('game:phase_updated', {
      phase: session.phase,
      phaseStartedAt: round.phaseStartedAt,
      phaseEndsAt: round.phaseEndsAt,
      currentTurnPlayerId: round.currentTurnPlayerId,
      turnOrder: round.turnOrder,
    });
  }

  res.json({
    success: true,
    data: { sessionId: (session._id as any).toString(), phase: session.phase },
  });
});

// ─── Get my private role ───────────────────────────────────────────────────

export const getMyRoleHandler = catchAsync(async (req, res) => {
  const rolePayload = await getMyRole(req.params.sessionId, req.user!.id);
  // This endpoint returns ONLY the requesting player's role. Never all roles.
  res.json({ success: true, data: rolePayload });
});

// ─── Confirm role ("I've Seen It") ────────────────────────────────────────

export const confirmRoleHandler = catchAsync(async (req, res) => {
  const { allConfirmed } = await confirmRole(req.params.sessionId, req.user!.id);
  res.json({ success: true, data: { allConfirmed } });
});

// ─── Submit clue ──────────────────────────────────────────────────────────

export const submitClueHandler = catchAsync(async (req, res) => {
  const { clue } = SubmitClueSchema.parse(req.body);
  const { allCluesIn } = await submitClue(req.params.sessionId, req.user!.id, clue);
  res.json({ success: true, data: { allCluesIn } });
});

// ─── Submit vote ──────────────────────────────────────────────────────────

export const submitVoteHandler = catchAsync(async (req, res) => {
  const { targetPlayerId } = SubmitVoteSchema.parse(req.body);
  await submitVote(req.params.sessionId, req.user!.id, targetPlayerId);
  res.json({ success: true, message: 'Vote recorded' });
});

// ─── Get clues for current cycle ──────────────────────────────────────────

export const getClues = catchAsync(async (req, res) => {
  const { roundNumber, cycleNumber } = req.query;
  const clues = await getCluesForCycle(
    req.params.sessionId,
    Number(roundNumber) || 1,
    Number(cycleNumber) || 1
  );
  res.json({ success: true, data: clues });
});

// ─── End game (host/admin) ─────────────────────────────────────────────────

export const endGameHandler = catchAsync(async (req, res) => {
  const session = await endGame(req.params.sessionId, req.user!.id);
  
  const io = getSocketIO();
  if (io) {
    io.to(`game:${req.params.sessionId}`).emit('game:phase_updated', {
      phase: session.phase,
      phaseStartedAt: null,
      phaseEndsAt: null,
      currentTurnPlayerId: null,
      turnOrder: [],
    });
  }
  
  res.json({ success: true, message: 'Game ended' });
});
