import { Request, Response, NextFunction } from 'express';
import {
  createWordleSession,
  joinWordleSession,
  leaveWordleSession,
  setWordlePlayerReady,
  getWordlePublicState,
  getMyWordleGuesses,
  submitWordleGuess,
  endWordleSession,
  listWordleSessions,
} from '../services/wordle/wordleGame.service';
import { startWordleGame } from '../services/wordle/wordleStateMachine.service';
import { getSocketIO } from '../../notification/services/notification.service';
import { CreateWordleSessionSchema, SubmitWordleGuessSchema } from '../validators/wordle.validator';

function catchAsync(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

// ─── List sessions ─────────────────────────────────────────────────────────

export const listWordleSessionsHandler = catchAsync(async (_req, res) => {
  const sessions = await listWordleSessions();
  res.json({ success: true, data: sessions });
});

// ─── Create session ────────────────────────────────────────────────────────

export const createWordleSessionHandler = catchAsync(async (req, res) => {
  const input = CreateWordleSessionSchema.parse(req.body);
  const user = req.user!;
  const session = await createWordleSession(
    user.id,
    (user as any).name || user.email,
    user.email,
    input
  );
  res.status(201).json({ success: true, data: { sessionId: (session._id as any).toString() } });
});

// ─── Get session (public state) ────────────────────────────────────────────

export const getWordleSessionHandler = catchAsync(async (req, res) => {
  const state = await getWordlePublicState(req.params.sessionId);
  res.json({ success: true, data: state });
});

// ─── Join session ──────────────────────────────────────────────────────────

export const joinWordleSessionHandler = catchAsync(async (req, res) => {
  const user = req.user!;
  const { session, isSpectator } = await joinWordleSession(
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

export const leaveWordleSessionHandler = catchAsync(async (req, res) => {
  await leaveWordleSession(req.params.sessionId, req.user!.id);
  res.json({ success: true, message: 'Left session' });
});

// ─── Ready up ─────────────────────────────────────────────────────────────

export const readyWordleHandler = catchAsync(async (req, res) => {
  const isReady = Boolean(req.body.isReady);
  await setWordlePlayerReady(req.params.sessionId, req.user!.id, isReady);
  res.json({ success: true, message: isReady ? 'Marked ready' : 'Marked not ready' });
});

// ─── Start game (host) ─────────────────────────────────────────────────────

export const startWordleGameHandler = catchAsync(async (req, res) => {
  const io = getSocketIO();
  if (!io) throw new Error('Socket.IO not available');
  await startWordleGame(req.params.sessionId, req.user!.id, io);
  res.json({ success: true, message: 'Game started' });
});

// ─── Submit guess ──────────────────────────────────────────────────────────

export const submitWordleGuessHandler = catchAsync(async (req, res) => {
  const { guess } = SubmitWordleGuessSchema.parse(req.body);
  const user = req.user!;
  const io = getSocketIO();

  const { guessResult, allPlayersFinished } = await submitWordleGuess(
    req.params.sessionId,
    user.id,
    (user as any).name || user.email,
    guess
  );

  // Emit guess result privately to the submitting player only (via their user room)
  if (io) {
    io.to(`user:${user.id}`).emit('wordle:guess_result', {
      sessionId: req.params.sessionId,
      ...guessResult,
    });

    // Broadcast safe progress to all players
    const state = await getWordlePublicState(req.params.sessionId);
    const round = state.currentRound;
    if (round) {
      io.to(`wordle:${req.params.sessionId}`).emit('wordle:player_progress', {
        sessionId: req.params.sessionId,
        roundNumber: round.roundNumber,
        playerProgress: round.playerProgress,
      });
    }

    // If all finished, trigger early round end
    if (allPlayersFinished) {
      const { endRound } = await import('../services/wordle/wordleStateMachine.service');
      const sessionState = await getWordlePublicState(req.params.sessionId);
      if (sessionState.currentRound) {
        endRound(req.params.sessionId, sessionState.currentRound.roundNumber, 'all_finished', io).catch(() => {});
      }
    }
  }

  res.json({ success: true, data: guessResult });
});

// ─── Get my guesses (reconnect) ───────────────────────────────────────────

export const getMyWordleGuessesHandler = catchAsync(async (req, res) => {
  const roundNumber = Number(req.query.roundNumber) || 1;
  const guesses = await getMyWordleGuesses(req.params.sessionId, roundNumber, req.user!.id);
  res.json({ success: true, data: guesses });
});

// ─── End game (host) ───────────────────────────────────────────────────────

export const endWordleGameHandler = catchAsync(async (req, res) => {
  const session = await endWordleSession(req.params.sessionId, req.user!.id);
  const io = getSocketIO();
  if (io) {
    io.to(`wordle:${req.params.sessionId}`).emit('wordle:game_ended', { reason: 'Host ended the game' });
  }
  res.json({ success: true, message: 'Game ended' });
});
