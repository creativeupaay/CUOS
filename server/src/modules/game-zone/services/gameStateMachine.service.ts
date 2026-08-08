import { Server as SocketIOServer } from 'socket.io';
import { GameSession } from '../models/GameSession.model';
import { GamePlayer } from '../models/GamePlayer.model';
import { GameVote } from '../models/GameVote.model';
import { GameScore } from '../models/GameScore.model';
import { GamePhase, WinningSide } from '../types/game.types';
import { checkWinCondition, determineElimination, generateTurnOrder } from '../utils/imposterSelection';
import { getRandomWord } from '../utils/wordPacks';
import {
  calculateCyclePoints,
  calculateGameEndPoints,
  buildFinalScoreBreakdown,
  DEFAULT_SCORING_RULES,
} from './scoring.service';
import { logger } from '../../../utils/logger';

/**
 * Server-side Game State Machine
 *
 * All game phase transitions are initiated from here.
 * Socket.IO `io` is used to broadcast state changes to all players.
 *
 * The server is the SOLE authority on game state.
 * Timers are managed server-side using setTimeout.
 * Timer handles are stored in-memory and cleared on transition.
 */

// In-memory map of active timers: sessionId → NodeJS.Timeout
const activeTimers = new Map<string, NodeJS.Timeout>();

function clearSessionTimer(sessionId: string) {
  const existing = activeTimers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    activeTimers.delete(sessionId);
  }
}

function setSessionTimer(sessionId: string, delayMs: number, fn: () => void) {
  clearSessionTimer(sessionId);
  const timer = setTimeout(fn, delayMs);
  activeTimers.set(sessionId, timer);
}

// ─── Transition: Discussion → Voting ─────────────────────────────────────────

export async function transitionToVoting(sessionId: string, io: SocketIOServer): Promise<void> {
  try {
    const session = await GameSession.findById(sessionId);
    if (!session || session.phase !== GamePhase.DISCUSSION) return;

    const round = session.currentRound!;
    const now = new Date();
    const phaseEndsAt = new Date(now.getTime() + session.config.votingTimeSec * 1000);

    session.phase = GamePhase.VOTING;
    round.phaseStartedAt = now;
    round.phaseEndsAt = phaseEndsAt;
    await session.save();

    io.to(`game:${sessionId}`).emit('game:voting_started', {
      phase: GamePhase.VOTING,
      phaseStartedAt: now,
      phaseEndsAt,
      roundNumber: round.roundNumber,
      cycleNumber: round.cycleNumber,
      eligibleVoters: session.players.filter((p) => p.status === 'active').map((p) => p.userId),
    });

    // Auto-end voting when timer expires
    setSessionTimer(sessionId, session.config.votingTimeSec * 1000, () => {
      resolveVoting(sessionId, io).catch((err) =>
        logger.error({ err }, `[GameStateMachine] Error resolving voting for ${sessionId}`)
      );
    });
  } catch (err) {
    logger.error({ err }, `[GameStateMachine] transitionToVoting failed for ${sessionId}`);
  }
}

// ─── Transition: Discussion timer expired → trigger voting ───────────────────

export function scheduleDiscussionEnd(sessionId: string, endsAt: Date, io: SocketIOServer) {
  const delay = Math.max(0, endsAt.getTime() - Date.now());
  setSessionTimer(sessionId, delay, () => {
    transitionToVoting(sessionId, io).catch((err) =>
      logger.error({ err }, `[GameStateMachine] Error transitioning to voting for ${sessionId}`)
    );
  });
}

// ─── Resolve Voting ───────────────────────────────────────────────────────────

export async function resolveVoting(sessionId: string, io: SocketIOServer): Promise<void> {
  clearSessionTimer(sessionId);

  const session = await GameSession.findById(sessionId);
  if (!session || session.phase !== GamePhase.VOTING) return;

  const round = session.currentRound!;

  // Tally votes
  const votes = await GameVote.find({
    sessionId: session._id,
    roundNumber: round.roundNumber,
    cycleNumber: round.cycleNumber,
  });

  const voteCounts: Record<string, number> = {};
  for (const vote of votes) {
    voteCounts[vote.targetPlayerId] = (voteCounts[vote.targetPlayerId] || 0) + 1;
  }

  // Anonymised results for frontend
  const voteResults = Object.entries(voteCounts)
    .map(([targetPlayerId, voteCount]) => {
      const player = session.players.find((p) => p.userId === targetPlayerId);
      return {
        targetPlayerId,
        targetPlayerName: player?.userName || 'Unknown',
        votes: voteCount,
      };
    })
    .sort((a, b) => b.votes - a.votes);

  // Determine who is eliminated (most votes)
  const eliminatedPlayerId = determineElimination(voteCounts);

  // Update scoring for correct votes
  if (eliminatedPlayerId) {
    const eliminatedPlayer = await GamePlayer.findOne({ sessionId: session._id, userId: eliminatedPlayerId });
    const isImposter = eliminatedPlayer?.role === 'imposter';

    if (isImposter) {
      // Update correct vote counts for voters who voted correctly
      const correctVoterIds = votes
        .filter((v) => v.targetPlayerId === eliminatedPlayerId)
        .map((v) => v.voterId);

      await GamePlayer.updateMany(
        { sessionId: session._id, userId: { $in: correctVoterIds } },
        { $inc: { correctVotes: 1 } }
      );
    }
  }

  // Update session state
  session.phase = GamePhase.RESULT;
  round.phaseStartedAt = new Date();
  round.phaseEndsAt = null;
  await session.save();

  // Broadcast vote results (anonymised — no individual vote attribution)
  io.to(`game:${sessionId}`).emit('game:voting_ended', {
    voteResults,
    eliminatedPlayerId,
  });

  // Process elimination and check win
  setTimeout(() => {
    processElimination(sessionId, eliminatedPlayerId, io).catch((err) =>
      logger.error({ err }, `[GameStateMachine] Error processing elimination for ${sessionId}`)
    );
  }, 3000); // Brief pause for result display
}

// ─── Process Elimination ──────────────────────────────────────────────────────

async function processElimination(
  sessionId: string,
  eliminatedPlayerId: string | null,
  io: SocketIOServer
): Promise<void> {
  const session = await GameSession.findById(sessionId);
  if (!session) return;

  const round = session.currentRound!;
  let wasImposter = false;

  if (eliminatedPlayerId) {
    // Update session player status
    const sessionPlayer = session.players.find((p) => p.userId === eliminatedPlayerId);
    if (sessionPlayer) {
      sessionPlayer.status = 'eliminated';
    }

    // Update GamePlayer record
    const eliminatedPlayerRecord = await GamePlayer.findOneAndUpdate(
      { sessionId: session._id, userId: eliminatedPlayerId },
      { status: 'eliminated' },
      { new: true }
    );

    wasImposter = eliminatedPlayerRecord?.role === 'imposter';

    io.to(`game:${sessionId}`).emit('game:player_eliminated', {
      playerId: eliminatedPlayerId,
      wasImposter,
    });
  }

  // Increment survival cycles for all active players
  const activePlayerIds = session.players.filter((p) => p.status === 'active').map((p) => p.userId);
  await GamePlayer.updateMany(
    { sessionId: session._id, userId: { $in: activePlayerIds } },
    { $inc: { survivalCycles: 1 } }
  );

  // Recalculate win condition with current active players
  const remainingActivePlayers = session.players.filter((p) => p.status === 'active');
  const remainingImpostors = await GamePlayer.countDocuments({
    sessionId: session._id,
    role: 'imposter',
    status: 'active',
  });

  const winCondition = checkWinCondition(remainingActivePlayers.length, remainingImpostors);

  await session.save(); // Save after elimination updates

  if (winCondition.gameOver) {
    await finaliseGame(String(session._id), winCondition.winningSide!, io);
  } else {
    // Continue — next clue cycle with remaining active players
    round.cycleNumber += 1;
    const newTurnOrder = generateTurnOrder(remainingActivePlayers.map((p) => p.userId));
    round.turnOrder = newTurnOrder;
    round.currentTurnPlayerId = newTurnOrder[0];
    round.phaseStartedAt = new Date();
    round.phaseEndsAt = null;
    session.phase = GamePhase.CLUE;
    await session.save();

    io.to(`game:${sessionId}`).emit('game:next_cycle', {
      roundNumber: round.roundNumber,
      cycleNumber: round.cycleNumber,
      phase: GamePhase.CLUE,
      turnOrder: newTurnOrder,
      currentTurnPlayerId: newTurnOrder[0],
    });
  }
}

// ─── Finalise Game ────────────────────────────────────────────────────────────

async function finaliseGame(
  sessionId: string,
  winningSide: WinningSide,
  io: SocketIOServer
): Promise<void> {
  const session = await GameSession.findById(sessionId);
  if (!session) return;

  session.status = 'finished';
  session.phase = GamePhase.GAME_OVER;
  session.winningSide = winningSide;
  session.finishedAt = new Date();
  await session.save();

  // Fetch all player records for score computation
  const playerRecords = await GamePlayer.find({ sessionId: session._id });

  // Reveal imposters (safe now — game is over)
  const imposterIds = playerRecords.filter((p) => p.role === 'imposter').map((p) => p.userId);
  const imposterNames = playerRecords
    .filter((p) => p.role === 'imposter')
    .map((p) => p.userName);

  // Compute and persist scores
  const scoreEntries = [];
  for (const player of playerRecords) {
    const playerWon =
      (player.role === 'normal' && winningSide === 'team') ||
      (player.role === 'imposter' && winningSide === 'imposters');

    const cyclePoints = {
      survival: player.survivalCycles * DEFAULT_SCORING_RULES.survivalPerCycle,
      correctVotes: player.correctVotes * DEFAULT_SCORING_RULES.correctImposterVote,
      deception:
        player.role === 'imposter'
          ? player.survivalCycles * DEFAULT_SCORING_RULES.deceptionSurvivedCycle
          : 0,
    };

    const { winBonus } = calculateGameEndPoints(
      { role: player.role, survived: player.status === 'active', winningSide },
      DEFAULT_SCORING_RULES
    );

    const breakdown = buildFinalScoreBreakdown(cyclePoints, winBonus);

    scoreEntries.push({
      sessionId: session._id,
      userId: player.userId,
      userName: player.userName,
      userEmail: player.userEmail,
      gameType: 'imposter',
      role: player.role,
      won: playerWon,
      winningSide,
      points: breakdown.total,
      breakdown: {
        participation: breakdown.participation,
        survival: breakdown.survival,
        correctVotes: breakdown.correctVotes,
        deception: breakdown.deception,
        winBonus: breakdown.winBonus,
      },
      gamesPlayed: 1,
    });

    // Update GamePlayer with final points
    await GamePlayer.updateOne(
      { sessionId: session._id, userId: player.userId },
      { points: breakdown.total }
    );
  }

  // Bulk write scores
  await GameScore.insertMany(scoreEntries, { ordered: false });

  const secretWord = session.currentRound?.secretWord || '';

  // Broadcast game over
  io.to(`game:${sessionId}`).emit('game:game_won', {
    winningSide,
    imposterIds,
    imposterNames,
    secretWord,
    scores: scoreEntries.map((s) => ({
      userId: s.userId,
      userName: s.userName,
      points: s.points,
      won: s.won,
      breakdown: s.breakdown,
    })),
  });

  // Clean up in-memory resources
  clearSessionTimer(sessionId);
}

// ─── Resume Timers on Server Restart ─────────────────────────────────────────

/**
 * Re-attach timers for any sessions that were in DISCUSSION or VOTING
 * when the server last restarted. Called once at startup.
 */
export async function resumePendingTimers(io: SocketIOServer): Promise<void> {
  try {
    const activeSessions = await GameSession.find({
      status: 'active',
      phase: { $in: [GamePhase.DISCUSSION, GamePhase.VOTING] },
    });

    for (const session of activeSessions) {
      const endsAt = session.currentRound?.phaseEndsAt;
      if (!endsAt) continue;

      const remaining = endsAt.getTime() - Date.now();
      if (remaining <= 0) {
        // Already expired — resolve immediately
        if (session.phase === GamePhase.DISCUSSION) {
          await transitionToVoting(String(session._id), io);
        } else if (session.phase === GamePhase.VOTING) {
          await resolveVoting(String(session._id), io);
        }
      } else {
        if (session.phase === GamePhase.DISCUSSION) {
          scheduleDiscussionEnd(String(session._id), endsAt, io);
        } else if (session.phase === GamePhase.VOTING) {
          setSessionTimer(String(session._id), remaining, () => {
            resolveVoting(String(session._id), io).catch(() => {});
          });
        }
      }
    }
    logger.info(`[GameStateMachine] Resumed timers for ${activeSessions.length} active sessions`);
  } catch (err) {
    logger.error({ err }, '[GameStateMachine] Failed to resume pending timers');
  }
}
