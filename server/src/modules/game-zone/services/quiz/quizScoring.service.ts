/**
 * Quiz Scoring Service
 *
 * Centralized, server-authoritative scoring.
 * Never called from client code.
 *
 * Scoring formula:
 * - Correct answer: baseScore(500) + speedBonus(0-300)
 * - Wrong answer: -100
 * - No answer (timeout): 0
 *
 * Speed bonus = (timeRemaining / totalTime) * 300
 * Answered in first second = max bonus, answered in last second = ~0 bonus
 */

export interface ScoringInput {
  selectedOption: number | null; // null = no answer
  correctOption: number;
  responseTimeSec: number; // time taken from question start
  totalTimeSec: number; // total time allowed per question
}

export interface ScoringResult {
  isCorrect: boolean;
  scoreChange: number;
  speedBonus: number;
  baseScore: number;
}

const BASE_SCORE = 500;
const MAX_SPEED_BONUS = 300;
const WRONG_PENALTY = -100;

export function calculateQuizScore(input: ScoringInput): ScoringResult {
  // No answer
  if (input.selectedOption === null) {
    return {
      isCorrect: false,
      scoreChange: 0,
      speedBonus: 0,
      baseScore: 0,
    };
  }

  const isCorrect = input.selectedOption === input.correctOption;

  if (!isCorrect) {
    return {
      isCorrect: false,
      scoreChange: WRONG_PENALTY,
      speedBonus: 0,
      baseScore: 0,
    };
  }

  // Speed bonus: faster answer = more bonus
  const timeRemaining = Math.max(0, input.totalTimeSec - input.responseTimeSec);
  const speedRatio = input.totalTimeSec > 0 ? timeRemaining / input.totalTimeSec : 0;
  const speedBonus = Math.round(MAX_SPEED_BONUS * speedRatio);

  const scoreChange = BASE_SCORE + speedBonus;

  return {
    isCorrect: true,
    scoreChange,
    speedBonus,
    baseScore: BASE_SCORE,
  };
}

/**
 * Ranks players using multi-factor tie-breaking:
 * 1. Higher total score
 * 2. More correct answers
 * 3. Fewer wrong answers
 * 4. Lower total response time (cumulative, correct answers only)
 */
export interface PlayerRankInput {
  userId: string;
  userName: string;
  totalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalResponseTimeSec: number;
}

export interface PlayerRankResult extends PlayerRankInput {
  rank: number;
}

export function rankPlayers(players: PlayerRankInput[]): PlayerRankResult[] {
  const sorted = [...players].sort((a, b) => {
    // 1. Higher score wins
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // 2. More correct answers
    if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
    // 3. Fewer wrong answers
    if (a.wrongAnswers !== b.wrongAnswers) return a.wrongAnswers - b.wrongAnswers;
    // 4. Lower cumulative response time (faster)
    return a.totalResponseTimeSec - b.totalResponseTimeSec;
  });

  // Assign ranks (shared rank for ties)
  const ranked: PlayerRankResult[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (
      i > 0 &&
      sorted[i].totalScore === sorted[i - 1].totalScore &&
      sorted[i].correctAnswers === sorted[i - 1].correctAnswers &&
      sorted[i].wrongAnswers === sorted[i - 1].wrongAnswers &&
      sorted[i].totalResponseTimeSec === sorted[i - 1].totalResponseTimeSec
    ) {
      // Shared rank
      ranked.push({ ...sorted[i], rank: ranked[i - 1].rank });
    } else {
      ranked.push({ ...sorted[i], rank: currentRank });
    }
    currentRank = i + 2; // next rank = position + 1 (1-indexed)
  }

  return ranked;
}
