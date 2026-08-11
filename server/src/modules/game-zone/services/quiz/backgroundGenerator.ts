/**
 * Background Question Generator
 *
 * Fires after quiz session creation to prepare questions asynchronously.
 * Does NOT block the session creation response.
 *
 * Emits real-time Socket.IO events to update the lobby:
 * - quiz:preparation_updated  — progress update
 * - quiz:ready                — all questions prepared
 */

import { Server as SocketIOServer } from 'socket.io';
import { QuizSession } from '../../models/QuizSession.model';
import { prepareQuestionPool } from './questionPoolService';
import { logger } from '../../../../utils/logger';

/**
 * Starts the background question generation for a newly created quiz session.
 * This function is intentionally fire-and-forget — call without await.
 */
export async function startBackgroundGeneration(
  sessionId: string,
  io: SocketIOServer
): Promise<void> {
  const room = `quiz:${sessionId}`;

  try {
    const session = await QuizSession.findById(sessionId);
    if (!session) {
      logger.warn(`[QuizBG] Session ${sessionId} not found — aborting background generation`);
      return;
    }

    const { topic, totalQuestions, difficulty } = session.config;

    // Update session to PREPARING phase
    await QuizSession.findByIdAndUpdate(sessionId, {
      phase: 'PREPARING',
      'preparationStatus.totalRequired': totalQuestions,
      'preparationStatus.generating': totalQuestions,
    });

    // Emit initial preparation status
    io.to(room).emit('quiz:preparation_updated', {
      totalRequired: totalQuestions,
      totalReady: 0,
      aiGenerated: 0,
      fallbackUsed: 0,
      generating: totalQuestions,
      isComplete: false,
    });

    // Run the pool preparation
    const result = await prepareQuestionPool(sessionId, topic, totalQuestions, difficulty);

    // Update session with results
    const finalStatus = {
      totalRequired: totalQuestions,
      totalReady: result.totalReady,
      aiGenerated: result.aiGenerated,
      fallbackUsed: result.fallbackUsed,
      generating: 0,
      isComplete: result.totalReady >= Math.min(totalQuestions, 1), // at least 1 question required
    };

    await QuizSession.findByIdAndUpdate(sessionId, {
      phase: finalStatus.isComplete ? 'READY' : 'PREPARING',
      questionIds: result.questionIds,
      preparationStatus: finalStatus,
    });

    // Emit final preparation status
    io.to(room).emit('quiz:preparation_updated', finalStatus);

    if (finalStatus.isComplete) {
      io.to(room).emit('quiz:ready', {
        totalQuestions: result.totalReady,
        aiGenerated: result.aiGenerated,
        fallbackUsed: result.fallbackUsed,
      });
      logger.info(`[QuizBG] Session ${sessionId} ready: ${result.totalReady} questions (AI: ${result.aiGenerated}, Fallback: ${result.fallbackUsed})`);
    } else {
      logger.warn(`[QuizBG] Session ${sessionId} preparation incomplete: only ${result.totalReady}/${totalQuestions} questions ready`);
    }
  } catch (err) {
    logger.error({ err }, `[QuizBG] Background generation failed for session ${sessionId}`);

    // Emit error — session may need to be restarted
    io.to(room).emit('quiz:preparation_updated', {
      totalRequired: 0,
      totalReady: 0,
      aiGenerated: 0,
      fallbackUsed: 0,
      generating: 0,
      isComplete: false,
    });

    // Try to mark session as having failed preparation
    await QuizSession.findByIdAndUpdate(sessionId, {
      phase: 'LOBBY', // revert to lobby
      'preparationStatus.generating': 0,
      'preparationStatus.isComplete': false,
    }).catch(() => {});
  }
}
