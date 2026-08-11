/**
 * Quiz State Machine — Timer Management
 *
 * Handles server-side question timers for the Quiz game.
 * When a question's time expires, the server ends the question automatically.
 *
 * Pattern mirrors wordleStateMachine.service.ts.
 */

import { Server as SocketIOServer } from 'socket.io';
import { QuizRound } from '../../models/QuizRound.model';
import { QuizSession } from '../../models/QuizSession.model';
import { endQuestion, startQuestion } from './quizGame.service';
import { logger } from '../../../../utils/logger';

// Map of active timers: sessionId:questionIndex → NodeJS.Timeout
const activeTimers = new Map<string, NodeJS.Timeout>();

const NEXT_QUESTION_DELAY_MS = 5000; // 5 seconds between questions

function getTimerKey(sessionId: string, questionIndex: number): string {
  return `${sessionId}:${questionIndex}`;
}

/**
 * Called after a question ends to emit results and schedule the next question.
 */
async function handleQuestionEnd(
  sessionId: string,
  questionIndex: number,
  io: SocketIOServer
): Promise<void> {
  const room = `quiz:${sessionId}`;

  try {
    const result = await endQuestion(sessionId, questionIndex);

    // Emit question_ended with reveal — includes correctOption
    io.to(room).emit('quiz:question_ended', {
      sessionId,
      questionIndex,
      correctOption: result.correctOption,
      explanation: result.explanation,
      results: result.results,
      liveLeaderboard: result.liveLeaderboard,
      isLastQuestion: result.isLastQuestion,
    });

    if (result.isLastQuestion) {
      // Final results — game over
      const { getQuizFinalResults } = await import('./quizGame.service');
      const finalResults = await getQuizFinalResults(sessionId);
      io.to(room).emit('quiz:game_completed', {
        sessionId,
        finalRanking: finalResults,
      });
      logger.info(`[QuizSM] Game ${sessionId} completed with ${finalResults.length} player stats`);
    } else {
      // Schedule next question after delay
      const nextIndex = questionIndex + 1;

      io.to(room).emit('quiz:next_question_countdown', {
        sessionId,
        secondsUntilNext: NEXT_QUESTION_DELAY_MS / 1000,
        nextQuestionIndex: nextIndex,
      });

      const countdownTimer = setTimeout(async () => {
        activeTimers.delete(getTimerKey(sessionId, nextIndex));
        await startAndScheduleQuestion(sessionId, nextIndex, io);
      }, NEXT_QUESTION_DELAY_MS);

      activeTimers.set(getTimerKey(sessionId, nextIndex), countdownTimer);
    }
  } catch (err) {
    logger.error({ err }, `[QuizSM] Error handling question end for session ${sessionId} Q${questionIndex}`);
  }
}

/**
 * Starts a question and schedules its end timer.
 */
export async function startAndScheduleQuestion(
  sessionId: string,
  questionIndex: number,
  io: SocketIOServer
): Promise<void> {
  const room = `quiz:${sessionId}`;

  try {
    const { round, publicQuestion } = await startQuestion(sessionId, questionIndex);

    // Emit question to all players (no correctOption)
    io.to(room).emit('quiz:question_started', {
      sessionId,
      ...publicQuestion,
    });

    // Schedule question end
    const timeUntilEndMs = round.endsAt.getTime() - Date.now();
    const timerKey = getTimerKey(sessionId, questionIndex);

    // Clear any existing timer for this slot
    const existingTimer = activeTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      activeTimers.delete(timerKey);
      await handleQuestionEnd(sessionId, questionIndex, io);
    }, Math.max(0, timeUntilEndMs));

    activeTimers.set(timerKey, timer);
    logger.info(`[QuizSM] Question ${questionIndex + 1} started for session ${sessionId}, ends in ${Math.round(timeUntilEndMs / 1000)}s`);
  } catch (err) {
    logger.error({ err }, `[QuizSM] Failed to start question ${questionIndex} for session ${sessionId}`);
    io.to(room).emit('quiz:error', { message: 'Failed to start question' });
  }
}

/**
 * Called when all players answer early — ends question before timer.
 */
export async function endQuestionEarly(
  sessionId: string,
  questionIndex: number,
  io: SocketIOServer
): Promise<void> {
  const timerKey = getTimerKey(sessionId, questionIndex);
  const timer = activeTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(timerKey);
  }

  // Update round to mark early end
  await QuizRound.findOneAndUpdate(
    { sessionId, questionIndex },
    { endedEarly: true }
  );

  await handleQuestionEnd(sessionId, questionIndex, io);
}

/**
 * Resumes any active quiz timers after server restart.
 * Called from socket.config.ts on startup.
 */
export async function resumeQuizTimers(io: SocketIOServer): Promise<void> {
  try {
    const activeRounds = await QuizRound.find({ status: 'active' })
      .populate('sessionId', 'status')
      .lean();

    logger.info(`[QuizSM] Found ${activeRounds.length} active quiz rounds to resume`);

    for (const round of activeRounds) {
      const session = round.sessionId as any;
      if (!session || session.status !== 'active') continue;

      const sessionId = session._id?.toString() || round.sessionId.toString();
      const now = Date.now();
      const timeRemaining = round.endsAt.getTime() - now;

      if (timeRemaining <= 0) {
        // Already expired — end immediately
        await handleQuestionEnd(sessionId, round.questionIndex, io);
      } else {
        // Resume timer
        const timerKey = getTimerKey(sessionId, round.questionIndex);
        const timer = setTimeout(async () => {
          activeTimers.delete(timerKey);
          await handleQuestionEnd(sessionId, round.questionIndex, io);
        }, timeRemaining);
        activeTimers.set(timerKey, timer);
        logger.info(`[QuizSM] Resumed timer for session ${sessionId} Q${round.questionIndex + 1} (${Math.round(timeRemaining / 1000)}s remaining)`);
      }
    }
  } catch (err) {
    logger.error({ err }, '[QuizSM] Failed to resume quiz timers');
  }
}

/**
 * Cancels all timers for a session (on end/cancel).
 */
export function cancelQuizTimers(sessionId: string): void {
  for (const [key, timer] of activeTimers.entries()) {
    if (key.startsWith(`${sessionId}:`)) {
      clearTimeout(timer);
      activeTimers.delete(key);
    }
  }
}
