import { Types } from 'mongoose';
import { WordleSession, IWordleSession } from '../../models/WordleSession.model';
import { WordleRound } from '../../models/WordleRound.model';
import { WordleGuess } from '../../models/WordleGuess.model';
import { selectWordleWords } from '../../utils/wordle/selectWordleWords';
import { evaluateGuess, isSolved } from '../../utils/wordle/evaluateGuess';
import { validateWordleGuess, GUESS_VALIDATION_MESSAGES } from '../../utils/wordle/validateWordleGuess';
import { calculateRoundScore } from './wordleScore.service';
import type {
  WordlePublicSessionState,
  WordlePublicPlayer,
  WordlePublicRoundState,
  WordlePlayerProgress,
  WordleGuessResult,
} from '../../types/wordle.types';
import type { WordleSessionPlayer } from '../../models/WordleSession.model';
import AppError from '../../../../utils/appError';

/**
 * Wordle Game Service — core business logic.
 * HTTP-agnostic: no req/res, no socket references.
 * All functions are called by the controller or socket handlers.
 */

// ─── Create Session ───────────────────────────────────────────────────────────

export interface CreateWordleSessionInput {
  gameName?: string;
  totalRounds: number;
  roundDurationSec: number;
  wordPack?: string;
  maxPlayers?: number;
  minPlayers?: number;
}

export async function createWordleSession(
  hostUserId: string,
  hostName: string,
  hostEmail: string,
  input: CreateWordleSessionInput
): Promise<IWordleSession> {
  if (input.totalRounds < 1 || input.totalRounds > 10) {
    throw new AppError('Rounds must be between 1 and 10', 400);
  }
  if (input.roundDurationSec < 30 || input.roundDurationSec > 600) {
    throw new AppError('Round duration must be between 30 and 600 seconds', 400);
  }

  // Pre-select all words for all rounds (server-side, never sent to client during play)
  const roundWords = selectWordleWords(input.totalRounds);

  const session = await WordleSession.create({
    gameType: 'wordle',
    hostUserId: new Types.ObjectId(hostUserId),
    status: 'lobby',
    phase: 'LOBBY',
    config: {
      gameName: input.gameName || 'Wordle Battle',
      totalRounds: input.totalRounds,
      roundDurationSec: input.roundDurationSec,
      maxGuesses: 6,
      wordPack: input.wordPack || 'general',
      maxPlayers: input.maxPlayers || 20,
      minPlayers: input.minPlayers || 2,
    },
    players: [
      {
        userId: hostUserId,
        userName: hostName,
        userEmail: hostEmail,
        isHost: true,
        isSpectator: false,
        isReady: false,
        totalScore: 0,
        joinedAt: new Date(),
      },
    ],
    currentRoundNumber: 0,
    roundWords,
  });

  return session;
}

// ─── Join Session ─────────────────────────────────────────────────────────────

export async function joinWordleSession(
  sessionId: string,
  userId: string,
  userName: string,
  userEmail: string
): Promise<{ session: IWordleSession; isSpectator: boolean }> {
  const session = await WordleSession.findById(sessionId).select('+roundWords');
  if (!session) throw new AppError('Wordle session not found', 404);
  if (session.status === 'finished' || session.status === 'cancelled') {
    throw new AppError('This game has already ended', 400);
  }

  const existing = session.players.find((p) => p.userId === userId);
  if (existing) {
    return { session, isSpectator: existing.isSpectator };
  }

  const isLobby = session.status === 'lobby';
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  const isFull = activePlayers.length >= session.config.maxPlayers;
  const isSpectator = !isLobby || isFull;

  const newPlayer = {
    userId,
    userName,
    userEmail,
    isHost: false,
    isSpectator,
    isReady: false,
    totalScore: 0,
    joinedAt: new Date(),
  };

  const updatedSession = await WordleSession.findOneAndUpdate(
    { _id: sessionId, 'players.userId': { $ne: userId } },
    { $push: { players: newPlayer } },
    { new: true }
  ).select('+roundWords');

  if (!updatedSession) {
    // Player was already inserted by a concurrent request
    const reloadedSession = await WordleSession.findById(sessionId).select('+roundWords') as IWordleSession;
    const player = reloadedSession.players.find((p) => p.userId === userId);
    return { session: reloadedSession, isSpectator: player!.isSpectator };
  }

  return { session: updatedSession as IWordleSession, isSpectator };
}

// ─── Leave Session ────────────────────────────────────────────────────────────

export async function leaveWordleSession(
  sessionId: string,
  userId: string
): Promise<IWordleSession> {
  const session = await WordleSession.findById(sessionId).select('+roundWords');
  if (!session) throw new AppError('Wordle session not found', 404);

  const idx = session.players.findIndex((p) => p.userId === userId);
  if (idx === -1) return session;

  session.players.splice(idx, 1);

  if (session.players.length > 0) {
    const newHost = session.players.find((p) => !p.isSpectator) || session.players[0];
    if (newHost && !session.players.some((p) => p.isHost)) {
      newHost.isHost = true;
      session.hostUserId = new Types.ObjectId(newHost.userId);
    }
  } else {
    session.status = 'cancelled';
  }

  await session.save();
  return session;
}

// ─── Toggle Ready ─────────────────────────────────────────────────────────────

export async function setWordlePlayerReady(
  sessionId: string,
  userId: string,
  isReady: boolean
): Promise<IWordleSession> {
  const session = await WordleSession.findById(sessionId);
  if (!session) throw new AppError('Wordle session not found', 404);
  if (session.phase !== 'LOBBY') throw new AppError('Game has already started', 400);

  const player = session.players.find((p) => p.userId === userId);
  if (!player) throw new AppError('You are not in this session', 403);
  if (player.isSpectator) throw new AppError('Spectators cannot ready up', 403);

  player.isReady = isReady;
  await session.save();
  return session;
}

// ─── Get Public Session State ─────────────────────────────────────────────────

export async function getWordlePublicState(sessionId: string): Promise<WordlePublicSessionState> {
  const session = await WordleSession.findById(sessionId);
  if (!session) throw new AppError('Wordle session not found', 404);

  const publicPlayers: WordlePublicPlayer[] = session.players.map((p) => ({
    userId: p.userId,
    userName: p.userName,
    isHost: p.isHost,
    isSpectator: p.isSpectator,
    isReady: p.isReady,
    totalScore: p.totalScore,
  }));

  let currentRound: WordlePublicRoundState | null = null;

  if (session.currentRoundNumber > 0) {
    const round = await WordleRound.findOne({
      sessionId: session._id,
      roundNumber: session.currentRoundNumber,
    });

    if (round) {
      const playerProgress: WordlePlayerProgress[] = round.players.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        status: p.status,
        guessCount: p.guessCount,
        roundScore: p.roundScore,
      }));

      currentRound = {
        roundNumber: round.roundNumber,
        totalRounds: session.config.totalRounds,
        startedAt: round.startedAt?.toISOString() || null,
        endsAt: round.endsAt?.toISOString() || null,
        status: round.status,
        playerProgress,
        // Only reveal targetWord after round ends
        ...(round.status === 'finished' ? { targetWord: round.targetWord } : {}),
      };
    }
  }

  return {
    sessionId: (session._id as any).toString(),
    gameType: 'wordle',
    hostUserId: session.hostUserId.toString(),
    status: session.status,
    phase: session.phase,
    config: session.config,
    players: publicPlayers,
    currentRound,
    createdAt: session.createdAt.toISOString(),
  };
}

// ─── Get Player's Guesses (for reconnect) ─────────────────────────────────────

export async function getMyWordleGuesses(
  sessionId: string,
  roundNumber: number,
  userId: string
): Promise<Array<{ guess: string; feedback: any[]; guessNumber: number; isCorrect: boolean }>> {
  const guesses = await WordleGuess.find({
    sessionId: new Types.ObjectId(sessionId),
    roundNumber,
    userId,
  }).sort({ guessNumber: 1 });

  return guesses.map((g) => ({
    guess: g.guess,
    feedback: g.feedback,
    guessNumber: g.guessNumber,
    isCorrect: g.isCorrect,
  }));
}

// ─── Submit Guess ─────────────────────────────────────────────────────────────

export interface SubmitGuessResult {
  guessResult: WordleGuessResult;
  allPlayersFinished: boolean;
}

export async function submitWordleGuess(
  sessionId: string,
  userId: string,
  userName: string,
  rawGuess: string
): Promise<SubmitGuessResult> {
  // Validate guess format + dictionary
  const validation = validateWordleGuess(rawGuess);
  if (!validation.valid) {
    throw new AppError(
      GUESS_VALIDATION_MESSAGES[validation.reason!] || 'Invalid guess',
      400
    );
  }

  const session = await WordleSession.findById(sessionId).select('+roundWords');
  if (!session) throw new AppError('Wordle session not found', 404);
  if (session.phase !== 'PLAYING') throw new AppError('No active round', 400);

  const player = session.players.find((p) => p.userId === userId);
  if (!player) throw new AppError('You are not in this session', 403);
  if (player.isSpectator) throw new AppError('Spectators cannot submit guesses', 403);

  // Load current round
  const round = await WordleRound.findOne({
    sessionId: session._id,
    roundNumber: session.currentRoundNumber,
  });
  if (!round || round.status !== 'active') throw new AppError('No active round', 400);

  // Check timer
  if (round.endsAt && new Date() > round.endsAt) {
    throw new AppError('Round time has expired', 400);
  }

  // Find player state in round
  let roundPlayer = round.players.find((p) => p.userId === userId);
  if (!roundPlayer) throw new AppError('You are not in this round', 403);
  if (roundPlayer.status !== 'playing') throw new AppError('You have already finished this round', 400);

  // Check guess count
  const existingGuesses = await WordleGuess.countDocuments({
    sessionId: session._id,
    roundNumber: round.roundNumber,
    userId,
  });

  if (existingGuesses >= session.config.maxGuesses) {
    throw new AppError('You have used all your guesses', 400);
  }

  const guessNumber = existingGuesses + 1;
  const normalizedGuess = validation.normalized;
  const targetWord = round.targetWord;

  // Evaluate guess (two-pass algorithm)
  const feedback = evaluateGuess(targetWord, normalizedGuess);
  const correct = isSolved(feedback);

  // Calculate time remaining (for scoring)
  const now = new Date();
  const timeRemainingSec = round.endsAt
    ? Math.max(0, Math.floor((round.endsAt.getTime() - now.getTime()) / 1000))
    : 0;

  let roundScore = 0;
  let guessScore = 0;
  let timeBonus = 0;

  const isLastGuess = guessNumber >= session.config.maxGuesses;
  const finished = correct || isLastGuess;

  if (finished) {
    const scoreResult = calculateRoundScore({
      solved: correct,
      guessNumber,
      timeRemainingSec,
      totalRoundDurationSec: session.config.roundDurationSec,
    });
    roundScore = scoreResult.roundScore;
    guessScore = scoreResult.guessScore;
    timeBonus = scoreResult.timeBonus;

    // Update round player state
    roundPlayer.status = correct ? 'solved' : 'failed';
    roundPlayer.guessCount = guessNumber;
    roundPlayer.roundScore = roundScore;
    roundPlayer.guessScore = guessScore;
    roundPlayer.timeBonus = timeBonus;
    roundPlayer.completedAt = now;
    if (correct) roundPlayer.solvedAt = now;

    // Update session player total score
    const sessionPlayer = session.players.find((p) => p.userId === userId);
    if (sessionPlayer) {
      sessionPlayer.totalScore += roundScore;
    }
    await session.save();
  } else {
    roundPlayer.guessCount = guessNumber;
  }

  await round.save();

  // Persist guess
  await WordleGuess.create({
    sessionId: session._id,
    roundId: round._id,
    roundNumber: round.roundNumber,
    userId,
    userName,
    guess: normalizedGuess,
    feedback,
    guessNumber,
    isCorrect: correct,
    submittedAt: now,
  });

  // Check if all active (non-spectator) players have finished
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  const roundPlayerStatuses = round.players.filter((rp) =>
    activePlayers.some((ap) => ap.userId === rp.userId)
  );
  const allPlayersFinished = roundPlayerStatuses.every((rp) => rp.status !== 'playing');

  return {
    guessResult: {
      guess: normalizedGuess,
      feedback,
      guessNumber,
      isCorrect: correct,
      guessesRemaining: session.config.maxGuesses - guessNumber,
      ...(finished ? { roundScore } : {}),
    },
    allPlayersFinished,
  };
}

// ─── End Session (host/admin force-end) ──────────────────────────────────────

export async function endWordleSession(
  sessionId: string,
  userId: string
): Promise<IWordleSession> {
  const session = await WordleSession.findById(sessionId);
  if (!session) throw new AppError('Wordle session not found', 404);
  if (session.hostUserId.toString() !== userId) {
    throw new AppError('Only the host can end the game', 403);
  }
  if (session.status === 'finished' || session.status === 'cancelled') {
    throw new AppError('Game is already over', 400);
  }

  session.status = 'finished';
  session.phase = 'GAME_OVER';
  session.finishedAt = new Date();
  await session.save();
  return session;
}

// ─── List Active Sessions ─────────────────────────────────────────────────────

export async function listWordleSessions() {
  return WordleSession.find({
    status: { $in: ['lobby', 'active'] },
  })
    .select('_id gameType status phase config players hostUserId createdAt')
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
}
