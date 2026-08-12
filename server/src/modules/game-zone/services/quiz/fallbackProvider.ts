/**
 * Fallback Question Provider
 *
 * Selects verified fallback questions when AI fails or produces insufficient questions.
 *
 * Selection logic:
 * 1. Try topic-specific questions (fuzzy match to category keywords)
 * 2. Try related category questions
 * 3. Fill remaining from General Knowledge
 */

import { FALLBACK_QUESTIONS, CATEGORY_KEYWORDS, FallbackQuestion } from '../../utils/quiz/fallbackQuestions';
import { deduplicateQuestions } from '../../utils/quiz/questionValidator';
import type { ValidatedQuestion } from '../../types/quiz.types';
import type { QuizDifficulty } from '../../models/QuizSession.model';

/**
 * Maps a topic to the best matching fallback category.
 */
function findBestMatchingCategories(topic: string): string[] {
  const topicLower = topic.toLowerCase();
  const scores: Array<{ category: string; score: number }> = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (topicLower.includes(keyword)) {
        // Longer keyword match = higher relevance
        score += keyword.length;
      }
    }
    if (score > 0) {
      scores.push({ category, score });
    }
  }

  // Sort by score descending — highest relevance first
  scores.sort((a, b) => b.score - a.score);

  // Return all matching categories (most relevant first), then fallback to General Knowledge
  const matched = scores.map((s) => s.category);
  if (!matched.includes('General Knowledge')) {
    matched.push('General Knowledge');
  }

  return matched;
}

/**
 * Selects fallback questions by difficulty distribution matching the requested difficulty.
 */
function filterByDifficulty(
  questions: FallbackQuestion[],
  difficulty: QuizDifficulty,
  count: number
): FallbackQuestion[] {
  if (difficulty === 'mixed') {
    // 30% easy, 50% medium, 20% hard
    const easyTarget = Math.round(count * 0.3);
    const hardTarget = Math.round(count * 0.2);
    const mediumTarget = count - easyTarget - hardTarget;

    const easy = questions.filter((q) => q.difficulty === 'easy').slice(0, easyTarget);
    const medium = questions.filter((q) => q.difficulty === 'medium').slice(0, mediumTarget);
    const hard = questions.filter((q) => q.difficulty === 'hard').slice(0, hardTarget);

    return [...easy, ...medium, ...hard];
  }

  const filtered = questions.filter((q) => q.difficulty === difficulty);
  if (filtered.length >= count) return filtered;

  // If not enough of the requested difficulty, fill from other difficulties
  const remaining = questions.filter((q) => q.difficulty !== difficulty);
  return [...filtered, ...remaining].slice(0, count);
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Get fallback questions for a given topic and difficulty.
 *
 * @param topic - The quiz topic
 * @param count - Number of questions needed
 * @param difficulty - Requested difficulty
 * @param excludeQuestions - Questions already selected (by question text) to avoid
 */
export function getFallbackQuestions(
  topic: string,
  count: number,
  difficulty: QuizDifficulty,
  excludeQuestions: Set<string> = new Set()
): ValidatedQuestion[] {
  const matchingCategories = findBestMatchingCategories(topic);

  // Collect questions by category priority
  const selected: FallbackQuestion[] = [];
  const usedKeys = new Set<string>([...excludeQuestions]);

  for (const category of matchingCategories) {
    if (selected.length >= count) break;

    const categoryQuestions = shuffle(
      FALLBACK_QUESTIONS.filter(
        (q) => q.category === category && !usedKeys.has(q.question.toLowerCase().slice(0, 80))
      )
    );

    const needed = count - selected.length;
    const difficultyFiltered = filterByDifficulty(categoryQuestions, difficulty, needed);

    for (const q of difficultyFiltered) {
      const key = q.question.toLowerCase().slice(0, 80);
      if (!usedKeys.has(key) && selected.length < count) {
        selected.push(q);
        usedKeys.add(key);
      }
    }
  }

  // Convert to ValidatedQuestion format
  const result: ValidatedQuestion[] = selected.map((q) => ({
    question: q.question,
    options: q.options,
    correctOption: q.correctOption,
    explanation: q.explanation,
    topic,
    category: q.category,
    difficulty: q.difficulty,
    source: 'fallback' as const,
  }));

  return deduplicateQuestions(result);
}

/**
 * Returns the total number of fallback questions available.
 */
export function getFallbackPoolSize(): number {
  return FALLBACK_QUESTIONS.length;
}
