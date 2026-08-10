import { Server as SocketIOServer } from 'socket.io';
import { Types } from 'mongoose';
import { WordleSession } from '../../models/WordleSession.model';
import { WordleRound } from '../../models/WordleRound.model';
import { WordleGuess } from '../../models/WordleGuess.model';
import { GameScore } from '../../models/GameScore.model';
import { calculateRoundScore, determineGameWinner } from './wordleScore.service';
import { logger } from '../../../../utils/logger';

/**
 * Wordle Game State Machine — server-authoritative round/game transitions.
 *
 * Manages the lifecycle:
 *   LOBBY → ROUND_START → PLAYING → ROUND_RESULT → (next ROUND_START | GAME_OVER)
 *
 * All timers are managed server-side.
 * Clients calculate visual countdown from roundStartedAt / roundEndsAt.
 */

// In-memory timer map: sessionId → NodeJS.Timeout
const wordleTimers = new Map<string, NodeJS.Timeout>();

function clearWordleTimer(sessionId: string) {
  const t = wordleTimers.get(sessionId);
  if (t) { clearTimeout(t); wordleTimers.delete(sessionId); }
}

function setWordleTimer(sessionId: string, delayMs: number, fn: () => void) {
  clearWordleTimer(sessionId);
  const t = setTimeout(fn, delayMs);
  wordleTimers.set(sessionId, t);
}

// ─── Start Game (LOBBY → ROUND_START → PLAYING) ───────────────────────────────

export async function startWordleGame(
  sessionId: string,
  requestingUserId: string,
  io: SocketIOServer
): Promise<void> {
  const session = await WordleSession.findById(sessionId).select('+roundWords');
  if (!session) throw new Error('Session not found');
  if (session.hostUserId.toString() !== requestingUserId) throw new Error('Only the host can start the game');
  if (session.phase !== 'LOBBY') throw new Error('Game has already started');

  const activePlayers = session.players.filter((p) => !p.isSpectator);
  if (activePlayers.length < session.config.minPlayers) {
    throw new Error(`Need at least ${session.config.minPlayers} players to start`);
  }

  session.status = 'active';
  session.phase = 'ROUND_START';
  session.currentRoundNumber = 1;
  await session.save();

  io.to(`wordle:${sessionId}`).emit('wordle:game_started', {
    sessionId,
    totalRounds: session.config.totalRounds,
    roundDurationSec: session.config.roundDurationSec,
    players: activePlayers.map((p) => ({ userId: p.userId, userName: p.userName })),
  });

  // Short ROUND_START delay (3 seconds) before PLAYING begins
  setWordleTimer(sessionId, 3000, () => {
    beginRound(sessionId, 1, io).catch((err) =>
      logger.error({ err }, `[WordleSM] Failed to begin round 1 for ${sessionId}`)
    );
  });
}

// ─── Begin Round ──────────────────────────────────────────────────────────────

async function beginRound(sessionId: string, roundNumber: number, io: SocketIOServer): Promise<void> {
  const session = await WordleSession.findById(sessionId).select('+roundWords');
  if (!session || session.status !== 'active') return;

  const targetWord = session.roundWords[roundNumber - 1];
  if (!targetWord) {
    logger.error(`[WordleSM] No word for round ${roundNumber} in session ${sessionId}`);
    return;
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + session.config.roundDurationSec * 1000);

  // Build player states for this round
  const activePlayers = session.players.filter((p) => !p.isSpectator);
  const roundPlayers = activePlayers.map((p) => ({
    userId: p.userId,
    userName: p.userName,
    status: 'playing' as const,
    guessCount: 0,
    roundScore: 0,
    guessScore: 0,
    timeBonus: 0,
  }));

  // Create round document
  const round = await WordleRound.create({
    sessionId: session._id,
    roundNumber,
    targetWord,
    status: 'active',
    startedAt: now,
    endsAt,
    finishedAt: null,
    players: roundPlayers,
  });

  session.phase = 'PLAYING';
  session.currentRoundNumber = roundNumber;
  await session.save();

  // Broadcast round start — targetWord NOT included
  io.to(`wordle:${sessionId}`).emit('wordle:round_started', {
    roundNumber,
    totalRounds: session.config.totalRounds,
    roundId: (round._id as any).toString(),
    startedAt: now.toISOString(),
    endsAt: endsAt.toISOString(),
    players: roundPlayers.map((p) => ({ userId: p.userId, userName: p.userName })),
  });

  // Schedule auto-end when timer expires
  setWordleTimer(sessionId, session.config.roundDurationSec * 1000, () => {
    endRound(sessionId, roundNumber, 'timer', io).catch((err) =>
      logger.error({ err }, `[WordleSM] Timer-triggered endRound failed for ${sessionId}`)
    );
  });
}

// ─── End Round (timer or all-finished) ───────────────────────────────────────

export async function endRound(
  sessionId: string,
  roundNumber: number,
  reason: 'timer' | 'all_finished',
  io: SocketIOServer
): Promise<void> {
  clearWordleTimer(sessionId);

  const session = await WordleSession.findById(sessionId).select('+roundWords');
  if (!session || session.status !== 'active') return;

  const round = await WordleRound.findOne({ sessionId: session._id, roundNumber });
  if (!round || round.status === 'finished') return;

  const now = new Date();

  // Mark any still-playing players as timed_out (timer case) or failed (all-finished case)
  for (const rp of round.players) {
    if (rp.status === 'playing') {
      rp.status = reason === 'timer' ? 'timed_out' : 'failed';
      rp.completedAt = now;
      rp.roundScore = 0;
    }
  }

  round.status = 'finished';
  round.finishedAt = now;
  await round.save();

  // Update session player total scores (already updated per-guess for solved; here for completeness)
  session.phase = 'ROUND_RESULT';
  await session.save();

  // Build round results (NOW we can reveal targetWord)
  const playerResults = round.players.map((rp) => ({
    userId: rp.userId,
    userName: rp.userName,
    status: rp.status,
    guessCount: rp.guessCount,
    solvedAt: rp.solvedAt?.toISOString() || null,
    roundScore: rp.roundScore,
  }));

  const isLastRound = roundNumber >= session.config.totalRounds;

  io.to(`wordle:${sessionId}`).emit('wordle:round_ended', {
    roundNumber,
    totalRounds: session.config.totalRounds,
    targetWord: round.targetWord,  // Safe to reveal now
    playerResults,
    isLastRound,
  });

  if (isLastRound) {
    // Brief delay for results display, then finalise game
    setWordleTimer(sessionId, 8000, () => {
      finaliseWordleGame(sessionId, io).catch((err) =>
        logger.error({ err }, `[WordleSM] Failed to finalise game ${sessionId}`)
      );
    });
  } else {
    // Countdown to next round (8 seconds)
    const nextRoundStartsAt = new Date(now.getTime() + 8000);
    io.to(`wordle:${sessionId}`).emit('wordle:next_round_countdown', {
      nextRoundNumber: roundNumber + 1,
      startsAt: nextRoundStartsAt.toISOString(),
    });

    setWordleTimer(sessionId, 8000, () => {
      beginRound(sessionId, roundNumber + 1, io).catch((err) =>
        logger.error({ err }, `[WordleSM] Failed to begin round ${roundNumber + 1} for ${sessionId}`)
      );
    });
  }
}

// ─── Finalise Game ────────────────────────────────────────────────────────────

async function finaliseWordleGame(sessionId: string, io: SocketIOServer): Promise<void> {
  const session = await WordleSession.findById(sessionId);
  if (!session) return;

  session.status = 'finished';
  session.phase = 'GAME_OVER';
  session.finishedAt = new Date();
  await session.save();

  // Load all rounds to compute per-player stats
  const rounds = await WordleRound.find({ sessionId: session._id });
  const activePlayers = session.players.filter((p) => !p.isSpectator);

  // Build per-player round breakdown
  const playerStats = new Map<string, {
    userName: string;
    totalScore: number;
    roundsPlayed: number;
    roundsSolved: number;
    roundScores: number[];
    totalGuesses: number;
    solvedTimes: number[];
  }>();

  for (const ap of activePlayers) {
    playerStats.set(ap.userId, {
      userName: ap.userName,
      totalScore: ap.totalScore,
      roundsPlayed: 0,
      roundsSolved: 0,
      roundScores: [],
      totalGuesses: 0,
      solvedTimes: [],
    });
  }

  for (const round of rounds) {
    for (const rp of round.players) {
      const stat = playerStats.get(rp.userId);
      if (!stat) continue;
      stat.roundsPlayed++;
      stat.roundScores.push(rp.roundScore);
      stat.totalGuesses += rp.guessCount;
      if (rp.status === 'solved') {
        stat.roundsSolved++;
        if (rp.solvedAt && round.startedAt) {
          stat.solvedTimes.push((rp.solvedAt.getTime() - round.startedAt.getTime()) / 1000);
        }
      }
    }
  }

  // Determine winner
  const scoreMap = new Map<string, number>();
  for (const [uid, stat] of playerStats) {
    scoreMap.set(uid, stat.totalScore);
  }
  const winnerId = determineGameWinner(scoreMap) || '';
  const winnerStat = playerStats.get(winnerId);

  // Build rankings (sorted by totalScore desc)
  const rankings = [...playerStats.entries()]
    .sort(([, a], [, b]) => b.totalScore - a.totalScore)
    .map(([userId, stat], i) => ({
      rank: i + 1,
      userId,
      userName: stat.userName,
      totalScore: stat.totalScore,
      roundsPlayed: stat.roundsPlayed,
      roundsSolved: stat.roundsSolved,
      roundScores: stat.roundScores,
    }));

  // Write to GameScore leaderboard (gameType: 'wordle')
  const scoreEntries = rankings.map((r) => {
    const stat = playerStats.get(r.userId)!;
    const ap = activePlayers.find((p) => p.userId === r.userId)!;
    const avgGuesses = stat.roundsPlayed > 0 ? stat.totalGuesses / stat.roundsPlayed : 0;
    const avgTime = stat.solvedTimes.length > 0
      ? stat.solvedTimes.reduce((a, b) => a + b, 0) / stat.solvedTimes.length
      : 0;

    return {
      sessionId: session._id,
      userId: r.userId,
      userName: r.userName,
      userEmail: ap?.userEmail || '',
      gameType: 'wordle' as const,
      role: 'normal' as const,
      won: r.userId === winnerId,
      winningSide: null,
      points: r.totalScore,
      breakdown: {
        participation: 0,
        survival: stat.roundsSolved,
        correctVotes: 0,
        deception: 0,
        winBonus: r.userId === winnerId ? 100 : 0,
      },
      gamesPlayed: 1,
    };
  });

  try {
    await GameScore.insertMany(scoreEntries, { ordered: false });
  } catch (err) {
    logger.error({ err }, `[WordleSM] Failed to write GameScore for ${sessionId}`);
  }

  // Broadcast final results
  io.to(`wordle:${sessionId}`).emit('wordle:game_completed', {
    sessionId,
    winnerId,
    winnerName: winnerStat?.userName || '',
    rankings,
  });

  clearWordleTimer(sessionId);
}

// ─── Resume Timers on Server Restart ─────────────────────────────────────────

export async function resumeWordleTimers(io: SocketIOServer): Promise<void> {
  try {
    const activeSessions = await WordleSession.find({
      status: 'active',
      phase: 'PLAYING',
    });

    for (const session of activeSessions) {
      const round = await WordleRound.findOne({
        sessionId: session._id,
        roundNumber: session.currentRoundNumber,
        status: 'active',
      });

      if (!round?.endsAt) continue;

      const remaining = round.endsAt.getTime() - Date.now();
      if (remaining <= 0) {
        await endRound(String(session._id), session.currentRoundNumber, 'timer', io);
      } else {
        setWordleTimer(String(session._id), remaining, () => {
          endRound(String(session._id), session.currentRoundNumber, 'timer', io).catch(() => {});
        });
      }
    }

    logger.info(`[WordleSM] Resumed timers for ${activeSessions.length} active Wordle sessions`);
  } catch (err) {
    logger.error({ err }, '[WordleSM] Failed to resume Wordle timers');
  }
}

export { beginRound };
