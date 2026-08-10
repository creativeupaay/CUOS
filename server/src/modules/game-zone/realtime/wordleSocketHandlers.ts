import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../../collaboration/types/types';
import {
  joinWordleSession,
  leaveWordleSession,
  setWordlePlayerReady,
  submitWordleGuess,
  getWordlePublicState,
  endWordleSession,
} from '../services/wordle/wordleGame.service';
import { startWordleGame, endRound } from '../services/wordle/wordleStateMachine.service';
import { logger } from '../../../utils/logger';

/**
 * Wordle Socket.IO Handlers
 *
 * All events are prefixed `wordle:` to clearly separate from Imposter `game:` events.
 * The server is the sole authority on game state.
 *
 * guess_result is emitted ONLY to the submitting player's socket.
 * player_progress is safe to broadcast to the whole room.
 * targetWord is NEVER sent during an active round.
 */
export function setupWordleHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
  const userId = socket.data.userId;
  const userName = (socket.data as any).name || socket.data.email;
  const userEmail = socket.data.email;

  // ─── Join Wordle Room ────────────────────────────────────────────────────

  socket.on('wordle:join_room', async ({ sessionId }: { sessionId: string }) => {
    try {
      if (!sessionId) return;

      const { session, isSpectator } = await joinWordleSession(sessionId, userId, userName, userEmail);
      socket.join(`wordle:${sessionId}`);

      const joiningPlayer = session.players.find((p) => p.userId === userId);
      socket.to(`wordle:${sessionId}`).emit('wordle:player_joined', {
        player: {
          userId,
          userName: joiningPlayer?.userName,
          isSpectator,
          isReady: false,
          isHost: joiningPlayer?.isHost,
          totalScore: 0,
        },
        isSpectator,
      });

      socket.emit('wordle:joined', {
        sessionId,
        isSpectator,
        phase: session.phase,
      });

      logger.info(`[WordleSocket] User ${userId} joined wordle room ${sessionId}`);
    } catch (err: any) {
      socket.emit('wordle:error', { message: err.message || 'Failed to join session' });
    }
  });

  // ─── Leave Wordle Room ───────────────────────────────────────────────────

  socket.on('wordle:leave_room', async ({ sessionId }: { sessionId: string }) => {
    try {
      const updatedSession = await leaveWordleSession(sessionId, userId);
      socket.leave(`wordle:${sessionId}`);
      socket.to(`wordle:${sessionId}`).emit('wordle:player_left', {
        playerId: userId,
        newHostId: updatedSession.hostUserId?.toString(),
      });
    } catch (err: any) {
      socket.emit('wordle:error', { message: err.message || 'Failed to leave session' });
    }
  });

  // ─── Toggle Ready ────────────────────────────────────────────────────────

  socket.on('wordle:ready', async ({ sessionId, isReady }: { sessionId: string; isReady: boolean }) => {
    try {
      await setWordlePlayerReady(sessionId, userId, isReady);
      io.to(`wordle:${sessionId}`).emit('wordle:player_ready', { playerId: userId, isReady });
    } catch (err: any) {
      socket.emit('wordle:error', { message: err.message || 'Failed to update ready state' });
    }
  });

  // ─── Start Game (host only) ──────────────────────────────────────────────

  socket.on('wordle:start_game', async ({ sessionId }: { sessionId: string }) => {
    try {
      await startWordleGame(sessionId, userId, io);
    } catch (err: any) {
      socket.emit('wordle:error', { message: err.message || 'Failed to start game' });
    }
  });

  // ─── Submit Guess ────────────────────────────────────────────────────────

  socket.on('wordle:submit_guess', async ({ sessionId, guess }: { sessionId: string; guess: string }) => {
    try {
      if (!guess || typeof guess !== 'string') {
        return socket.emit('wordle:error', { message: 'Invalid guess' });
      }

      const { guessResult, allPlayersFinished } = await submitWordleGuess(
        sessionId,
        userId,
        userName,
        guess.trim()
      );

      // Emit guess result ONLY to this player's socket (private)
      socket.emit('wordle:guess_result', {
        sessionId,
        ...guessResult,
      });

      // Broadcast safe progress update to the whole room
      const state = await getWordlePublicState(sessionId);
      const round = state.currentRound;
      if (round) {
        io.to(`wordle:${sessionId}`).emit('wordle:player_progress', {
          sessionId,
          roundNumber: round.roundNumber,
          playerProgress: round.playerProgress,
        });
      }

      // If all players finished, end the round early
      if (allPlayersFinished && round) {
        await endRound(sessionId, round.roundNumber, 'all_finished', io);
      }

    } catch (err: any) {
      socket.emit('wordle:error', { message: err.message || 'Failed to submit guess' });
    }
  });

  // ─── End Game (host request) ─────────────────────────────────────────────

  socket.on('wordle:end_game', async ({ sessionId }: { sessionId: string }) => {
    try {
      await endWordleSession(sessionId, userId);
      io.to(`wordle:${sessionId}`).emit('wordle:game_ended', { reason: 'Host ended the game' });
      logger.info(`[WordleSocket] Game ${sessionId} ended by host ${userId}`);
    } catch (err: any) {
      socket.emit('wordle:error', { message: err.message || 'Failed to end game' });
    }
  });

  // ─── Disconnect ──────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    // Player's server state persists — they can reconnect and resume
    logger.info(`[WordleSocket] User ${userId} disconnected`);
  });
}
