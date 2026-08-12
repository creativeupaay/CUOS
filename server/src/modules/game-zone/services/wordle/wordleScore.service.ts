/**
 * Wordle Scoring Engine — Server-authoritative
 *
 * Scoring rewards BOTH guess efficiency AND speed.
 * All calculations happen server-side. The client never sends a score.
 *
 * Formula:
 *   roundScore = guessScore + timeBonus
 *
 * If player did NOT solve the word → roundScore = 0
 */

export interface WordleScoringRules {
  // Points per guess index (1–6 guesses → index 0–5)
  guessScores: [number, number, number, number, number, number];
  // Maximum time bonus (awarded for instant solve, scales linearly to 0 at timeout)
  maxTimeBonus: number;
  // Score for not solving the word
  dnfScore: number;
}

export const DEFAULT_WORDLE_SCORING_RULES: WordleScoringRules = {
  guessScores: [600, 500, 400, 300, 200, 100], // 1 guess → 600pts, 6 guesses → 100pts
  maxTimeBonus: 400,
  dnfScore: 0,
};

export interface WordleRoundScoreInput {
  solved: boolean;
  guessNumber: number;        // 1–6 (only meaningful if solved)
  timeRemainingSec: number;   // seconds remaining when solved (0 if not solved)
  totalRoundDurationSec: number;
}

export interface WordleRoundScoreResult {
  guessScore: number;
  timeBonus: number;
  roundScore: number;
}

/**
 * Calculate the score for a single round.
 *
 * This is a pure function — no DB calls, no side effects.
 * Can be tested independently.
 */
export function calculateRoundScore(
  input: WordleRoundScoreInput,
  rules: WordleScoringRules = DEFAULT_WORDLE_SCORING_RULES
): WordleRoundScoreResult {
  if (!input.solved) {
    return { guessScore: 0, timeBonus: 0, roundScore: rules.dnfScore };
  }

  // guessNumber is 1-based; array index is 0-based
  const guessIndex = Math.max(0, Math.min(5, input.guessNumber - 1));
  const guessScore = rules.guessScores[guessIndex];

  // Time bonus scales linearly: full bonus for instant solve, 0 at timeout
  const timeFraction = Math.max(0, Math.min(1, input.timeRemainingSec / input.totalRoundDurationSec));
  const timeBonus = Math.floor(rules.maxTimeBonus * timeFraction);

  return {
    guessScore,
    timeBonus,
    roundScore: guessScore + timeBonus,
  };
}

/**
 * Calculate the cumulative game score from all round scores.
 */
export function calculateGameScore(roundScores: number[]): number {
  return roundScores.reduce((sum, s) => sum + s, 0);
}

/**
 * Determine the game winner from a map of userId → totalScore.
 * Returns the userId with the highest score.
 * Ties are broken by userId string (deterministic).
 */
export function determineGameWinner(scores: Map<string, number>): string | null {
  if (scores.size === 0) return null;
  let bestUserId: string | null = null;
  let bestScore = -1;
  let isTie = false;

  for (const [userId, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestUserId = userId;
      isTie = false;
    } else if (score === bestScore) {
      isTie = true;
    }
  }

  // If there's a tie for the top score, it's a draw
  if (isTie) return null;
  
  return bestUserId;
}
