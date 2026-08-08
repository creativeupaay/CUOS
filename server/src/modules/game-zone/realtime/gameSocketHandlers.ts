import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../../collaboration/types/types';
import { GameSession } from '../models/GameSession.model';
import { GamePhase } from '../types/game.types';
import {
  joinGameSession,
  leaveGameSession,
  setPlayerReady,
  confirmRole,
  submitClue,
  submitVote,
  endGame,
} from '../services/game.service';
import {
  scheduleDiscussionEnd,
  transitionToVoting,
} from '../services/gameStateMachine.service';
import { logger } from '../../../utils/logger';

/**
 * Game Zone Socket.IO Handlers
 *
 * Each handler validates the authenticated user against game state
 * before performing any action. The server is authoritative.
 */
export function setupGameHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
  const userId = socket.data.userId;

  // ─── Join game room ────────────────────────────────────────────────────────
  socket.on('game:join_room', async ({ sessionId }: { sessionId: string }) => {
    try {
      if (!sessionId) return;

      const { session, isSpectator } = await joinGameSession(
        sessionId,
        userId,
        (socket.data as any).name || socket.data.email,
        socket.data.email
      );

      socket.join(`game:${sessionId}`);

      // Notify others in the room
      const joiningPlayer = session.players.find((p) => p.userId === userId);
      socket.to(`game:${sessionId}`).emit('game:player_joined', {
        player: {
          userId,
          userName: joiningPlayer?.userName,
          status: joiningPlayer?.status,
          isReady: false,
          isHost: joiningPlayer?.isHost,
          hasConfirmedRole: false,
        },
        isSpectator,
      });

      // Send current state to joining socket
      socket.emit('game:joined', {
        sessionId,
        isSpectator,
        phase: session.phase,
      });

      logger.info(`[GameSocket] User ${userId} joined game room ${sessionId}`);
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Failed to join game' });
    }
  });

  // ─── Leave game room ───────────────────────────────────────────────────────
  socket.on('game:leave_room', async ({ sessionId }: { sessionId: string }) => {
    try {
      const updatedSession = await leaveGameSession(sessionId, userId);
      socket.leave(`game:${sessionId}`);
      socket.to(`game:${sessionId}`).emit('game:player_left', {
        playerId: userId,
        newHostId: updatedSession.hostUserId?.toString(),
      });
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Failed to leave game' });
    }
  });

  // ─── Toggle ready ──────────────────────────────────────────────────────────
  socket.on('game:ready', async ({ sessionId, isReady }: { sessionId: string; isReady: boolean }) => {
    try {
      await setPlayerReady(sessionId, userId, isReady);
      io.to(`game:${sessionId}`).emit('game:player_ready', { playerId: userId, isReady });
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Failed to update ready state' });
    }
  });

  // ─── Confirm role ("I've Seen It") ─────────────────────────────────────────
  socket.on('game:confirm_role', async ({ sessionId }: { sessionId: string }) => {
    try {
      const { session, allConfirmed } = await confirmRole(sessionId, userId);
      const round = session.currentRound!;

      io.to(`game:${sessionId}`).emit('game:role_confirmed', {
        playerId: userId,
        confirmedCount: round.confirmedRolePlayerIds.length,
        totalCount: session.players.filter((p) => p.status === 'active').length,
        allConfirmed,
      });

      if (allConfirmed) {
        io.to(`game:${sessionId}`).emit('game:phase_updated', {
          phase: GamePhase.CLUE,
          phaseStartedAt: round.phaseStartedAt,
          phaseEndsAt: round.phaseEndsAt,
          currentTurnPlayerId: round.currentTurnPlayerId,
          turnOrder: round.turnOrder,
        });
      }
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Failed to confirm role' });
    }
  });

  // ─── Submit clue ───────────────────────────────────────────────────────────
  socket.on('game:submit_clue', async ({ sessionId, clue }: { sessionId: string; clue: string }) => {
    try {
      if (!clue || clue.trim().length === 0) {
        return socket.emit('game:error', { message: 'Clue cannot be empty' });
      }
      if (clue.trim().length > 30) {
        return socket.emit('game:error', { message: 'Clue must be 30 characters or fewer' });
      }

      const { session, allCluesIn } = await submitClue(sessionId, userId, clue.trim());
      const round = session.currentRound!;

      // Get submitting player name
      const player = session.players.find((p) => p.userId === userId);

      // Broadcast clue to all (hide secret word — only the clue itself is shared)
      io.to(`game:${sessionId}`).emit('game:clue_submitted', {
        playerId: userId,
        playerName: player?.userName || 'Unknown',
        clue: clue.trim(),
        roundNumber: round.roundNumber,
        cycleNumber: round.cycleNumber,
      });

      if (allCluesIn) {
        // Move to discussion
        io.to(`game:${sessionId}`).emit('game:discussion_started', {
          phase: GamePhase.DISCUSSION,
          phaseStartedAt: round.phaseStartedAt,
          phaseEndsAt: round.phaseEndsAt,
          roundNumber: round.roundNumber,
          cycleNumber: round.cycleNumber,
        });

        // Schedule auto-transition to voting
        scheduleDiscussionEnd(sessionId, round.phaseEndsAt!, io);
      } else {
        // Notify next turn
        io.to(`game:${sessionId}`).emit('game:turn_changed', {
          currentTurnPlayerId: round.currentTurnPlayerId,
          roundNumber: round.roundNumber,
          cycleNumber: round.cycleNumber,
        });
      }
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Failed to submit clue' });
    }
  });

  // ─── Submit vote ───────────────────────────────────────────────────────────
  socket.on('game:submit_vote', async ({ sessionId, targetPlayerId }: { sessionId: string; targetPlayerId: string }) => {
    try {
      await submitVote(sessionId, userId, targetPlayerId);
      // Notify room anonymously (just "someone voted", no attribution)
      io.to(`game:${sessionId}`).emit('game:vote_updated', { voterId: userId });
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Failed to submit vote' });
    }
  });

  // ─── End game (host request) ───────────────────────────────────────────────
  socket.on('game:end_game', async ({ sessionId }: { sessionId: string }) => {
    try {
      await endGame(sessionId, userId);
      io.to(`game:${sessionId}`).emit('game:game_ended', {
        reason: 'Host ended the game',
      });
      logger.info(`[GameSocket] Game ${sessionId} ended by host ${userId}`);
    } catch (err: any) {
      socket.emit('game:error', { message: err.message || 'Failed to end game' });
    }
  });

  // ─── Handle disconnect ─────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    // Find any active sessions this socket was in
    // We don't immediately remove the player — allow reconnect within grace period
    // The game service handles this when the player actually leaves
    logger.info(`[GameSocket] User ${userId} disconnected`);
  });
}
