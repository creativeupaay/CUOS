/**
 * Quiz Socket.IO Handlers
 *
 * All events prefixed quiz: — completely isolated from game: and wordle: namespaces.
 * The server is the sole authority on game state.
 *
 * Security principles:
 * - correctOption NEVER sent before question ends
 * - Other players' selected options NEVER broadcast
 * - Server timestamps used for all scoring
 * - Duplicate submissions silently ignored
 */

import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../../collaboration/types/types';
import {
  joinQuizSession,
  leaveQuizSession,
  setQuizPlayerReady,
  startQuizGame,
  submitQuizAnswer,
  endQuizSession,
  getPublicQuizState,
} from '../services/quiz/quizGame.service';
import {
  startAndScheduleQuestion,
  endQuestionEarly,
  cancelQuizTimers,
} from '../services/quiz/quizStateMachine.service';
import { startBackgroundGeneration } from '../services/quiz/backgroundGenerator';
import { logger } from '../../../utils/logger';

export function setupQuizHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
  const userId = socket.data.userId;
  const userName = (socket.data as any).name || socket.data.email;
  const userEmail = socket.data.email;

  // ─── Join Room ──────────────────────────────────────────────────────────

  socket.on('quiz:join_room', async ({ sessionId }: { sessionId: string }) => {
    try {
      if (!sessionId) return;

      const { session, isSpectator } = await joinQuizSession(sessionId, userId, userName, userEmail);
      socket.join(`quiz:${sessionId}`);

      const joiningPlayer = session.players.find((p) => p.userId === userId);

      // Notify other players
      socket.to(`quiz:${sessionId}`).emit('quiz:player_joined', {
        sessionId,
        player: {
          userId,
          userName: joiningPlayer?.userName,
          isSpectator,
          isReady: joiningPlayer?.isReady || false,
          isHost: joiningPlayer?.isHost || false,
          totalScore: 0,
        },
        isSpectator,
      });

      // Get current state for the joining player
      const publicState = await getPublicQuizState(sessionId);

      // Send back current state to this player only
      socket.emit('quiz:joined', {
        sessionId,
        isSpectator,
        phase: session.phase,
        currentState: publicState,
      });

      logger.info(`[QuizSocket] User ${userId} joined quiz room ${sessionId}`);
    } catch (err: any) {
      socket.emit('quiz:error', { message: err.message || 'Failed to join session' });
    }
  });

  // ─── Leave Room ─────────────────────────────────────────────────────────

  socket.on('quiz:leave_room', async ({ sessionId }: { sessionId: string }) => {
    try {
      const updatedSession = await leaveQuizSession(sessionId, userId);
      socket.leave(`quiz:${sessionId}`);
      socket.to(`quiz:${sessionId}`).emit('quiz:player_left', {
        sessionId,
        playerId: userId,
        newHostId: updatedSession.hostUserId?.toString(),
      });
    } catch (err: any) {
      socket.emit('quiz:error', { message: err.message || 'Failed to leave session' });
    }
  });

  // ─── Ready Toggle ────────────────────────────────────────────────────────

  socket.on('quiz:ready', async ({ sessionId, isReady }: { sessionId: string; isReady: boolean }) => {
    try {
      await setQuizPlayerReady(sessionId, userId, isReady);
      io.to(`quiz:${sessionId}`).emit('quiz:player_ready', {
        sessionId,
        playerId: userId,
        isReady,
      });
    } catch (err: any) {
      socket.emit('quiz:error', { message: err.message || 'Failed to update ready state' });
    }
  });

  // ─── Start Game (Host) ───────────────────────────────────────────────────

  socket.on('quiz:start_game', async ({ sessionId }: { sessionId: string }) => {
    try {
      await startQuizGame(sessionId, userId);

      // Notify all players that game is starting
      io.to(`quiz:${sessionId}`).emit('quiz:started', { sessionId });

      // Start the first question after a brief delay
      setTimeout(async () => {
        await startAndScheduleQuestion(sessionId, 0, io);
      }, 2000);

      logger.info(`[QuizSocket] Game ${sessionId} started by host ${userId}`);
    } catch (err: any) {
      socket.emit('quiz:error', { message: err.message || 'Failed to start game' });
    }
  });

  // ─── Submit Answer ───────────────────────────────────────────────────────

  socket.on('quiz:submit_answer', async ({
    sessionId,
    roundId,
    selectedOption,
    submissionId,
  }: {
    sessionId: string;
    roundId: string;
    selectedOption: number;
    submissionId: string;
  }) => {
    try {
      if (!sessionId || !roundId || selectedOption === undefined || !submissionId) {
        return socket.emit('quiz:error', { message: 'Missing required fields' });
      }

      if (typeof selectedOption !== 'number' || selectedOption < 0 || selectedOption > 3) {
        return socket.emit('quiz:error', { message: 'Invalid option' });
      }

      const result = await submitQuizAnswer({
        sessionId,
        roundId,
        userId,
        userName,
        selectedOption,
        submissionId,
      });

      // Send private confirmation to this player (not which option — just locked status)
      socket.emit('quiz:answer_accepted', {
        submissionId,
        locked: result.locked,
        isCorrect: result.isCorrect, // can reveal immediately (won't help — timer still running)
        scoreChange: result.scoreChange,
        responseTimeSec: result.responseTimeSec,
      });

      // Broadcast to room that a player answered (NOT their choice)
      io.to(`quiz:${sessionId}`).emit('quiz:player_answered', {
        sessionId,
        userId,
        userName,
      });

      // End question early if all players answered
      if (result.allPlayersAnswered) {
        logger.info(`[QuizSocket] All players answered for session ${sessionId} — ending question early`);

        // Find current question index
        const { QuizRound } = await import('../models/QuizRound.model');
        const round = await QuizRound.findById(roundId);
        if (round && round.status === 'active') {
          await endQuestionEarly(sessionId, round.questionIndex, io);
        }
      }
    } catch (err: any) {
      socket.emit('quiz:error', { message: err.message || 'Failed to submit answer' });
    }
  });

  // ─── End Game (Host) ─────────────────────────────────────────────────────

  socket.on('quiz:end_game', async ({ sessionId }: { sessionId: string }) => {
    try {
      await endQuizSession(sessionId, userId);
      cancelQuizTimers(sessionId);
      io.to(`quiz:${sessionId}`).emit('quiz:game_ended', {
        sessionId,
        reason: 'Host ended the game',
      });
      logger.info(`[QuizSocket] Game ${sessionId} ended by host ${userId}`);
    } catch (err: any) {
      socket.emit('quiz:error', { message: err.message || 'Failed to end game' });
    }
  });

  // ─── Request Preparation Start (after creating session) ─────────────────
  // Client calls this after creating a session to trigger background generation

  socket.on('quiz:request_preparation', async ({ sessionId }: { sessionId: string }) => {
    try {
      // Join the room first so they receive prep updates
      socket.join(`quiz:${sessionId}`);

      // Start background generation (fire and forget)
      startBackgroundGeneration(sessionId, io).catch((err) => {
        logger.error({ err }, `[QuizSocket] Background generation error for session ${sessionId}`);
      });

      logger.info(`[QuizSocket] Background preparation started for session ${sessionId}`);
    } catch (err: any) {
      socket.emit('quiz:error', { message: err.message || 'Failed to start preparation' });
    }
  });

  // ─── Disconnect ──────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    logger.info(`[QuizSocket] User ${userId} disconnected`);
  });
}
