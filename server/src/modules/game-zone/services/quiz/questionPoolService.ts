/**
 * Question Pool Service
 *
 * Orchestrates AI generation + fallback selection to produce the final
 * ordered list of questions for a quiz session.
 *
 * Ensures:
 * - AI failure never breaks quiz creation
 * - Questions are reserved (sessionId) to prevent reuse within the same quiz
 * - Each question's source ('ai' | 'fallback') is tracked
 */

import { Types } from 'mongoose';
import { QuizQuestion } from '../../models/QuizQuestion.model';
import { generateQuestionsWithAI } from './aiQuestionGenerator';
import { getFallbackQuestions } from './fallbackProvider';
import { logger } from '../../../../utils/logger';
import type { ValidatedQuestion } from '../../types/quiz.types';
import type { QuizDifficulty } from '../../models/QuizSession.model';

export interface QuestionPoolResult {
  questionIds: string[];
  totalReady: number;
  aiGenerated: number;
  fallbackUsed: number;
}

/**
 * Prepares the question pool for a quiz session.
 *
 * 1. Attempts AI generation
 * 2. Fills gaps with fallback questions
 * 3. Persists all questions to DB with sessionId reservation
 * 4. Returns ordered list of question IDs
 */
export async function prepareQuestionPool(
  sessionId: string,
  topic: string,
  totalQuestions: number,
  difficulty: QuizDifficulty
): Promise<QuestionPoolResult> {
  logger.info(`[QuizPool] Preparing ${totalQuestions} questions for session ${sessionId}, topic: "${topic}"`);

  // Step 1: Try AI generation
  let aiQuestions: ValidatedQuestion[] = [];
  try {
    aiQuestions = await generateQuestionsWithAI(topic, totalQuestions, difficulty);
  } catch (err) {
    logger.warn({ err }, '[QuizPool] AI generation failed — using fallback');
  }

  const aiCount = Math.min(aiQuestions.length, totalQuestions);
  const selectedAI = aiQuestions.slice(0, aiCount);

  // Step 2: Fill remaining with fallback
  const fallbackNeeded = totalQuestions - aiCount;
  const aiQuestionTexts = new Set(selectedAI.map((q) => q.question.toLowerCase().slice(0, 80)));

  let fallbackQuestions: ValidatedQuestion[] = [];
  if (fallbackNeeded > 0) {
    fallbackQuestions = getFallbackQuestions(topic, fallbackNeeded, difficulty, aiQuestionTexts);
    logger.info(`[QuizPool] Using ${fallbackQuestions.length} fallback questions (needed ${fallbackNeeded})`);
  }

  // Combine and shuffle (keep order for now — randomize question order)
  const allQuestions = [...selectedAI, ...fallbackQuestions];

  if (allQuestions.length < totalQuestions) {
    logger.warn(`[QuizPool] Only ${allQuestions.length}/${totalQuestions} questions prepared — proceeding anyway`);
  }

  // Step 3: Persist to DB with session reservation
  const sessionObjectId = new Types.ObjectId(sessionId);
  const insertedIds: string[] = [];

  for (const q of allQuestions) {
    try {
      const doc = await QuizQuestion.create({
        question: q.question,
        options: q.options,
        correctOption: q.correctOption,
        explanation: q.explanation,
        topic: q.topic,
        category: q.category,
        difficulty: q.difficulty,
        source: q.source,
        sessionId: sessionObjectId,
        usageCount: 0,
        active: true,
      });
      insertedIds.push((doc._id as Types.ObjectId).toString());
    } catch (err) {
      logger.error({ err }, `[QuizPool] Failed to persist question: "${q.question.slice(0, 50)}"`);
    }
  }

  logger.info(`[QuizPool] Pool ready: ${insertedIds.length} questions persisted (AI: ${selectedAI.length}, Fallback: ${fallbackQuestions.length})`);

  return {
    questionIds: insertedIds,
    totalReady: insertedIds.length,
    aiGenerated: selectedAI.length,
    fallbackUsed: fallbackQuestions.length,
  };
}

/**
 * Cleans up questions for a session (on cancel or error).
 */
export async function cleanupSessionQuestions(sessionId: string): Promise<void> {
  await QuizQuestion.deleteMany({ sessionId: new Types.ObjectId(sessionId) });
}
