/**
 * Scoring Rules for Game Zone — Imposter
 *
 * Centralised, configurable scoring.
 * Do NOT put point calculations in React components or socket handlers.
 */

export interface ScoringRules {
  participation: number;
  survivalPerCycle: number;         // Points per voting cycle survived
  correctImposterVote: number;      // Normal player voted correctly
  deceptionSurvivedCycle: number;   // Imposter survived a voting cycle
  teamWinBonus: number;             // Normal player on winning team
  imposterWinBonus: number;         // Imposter on winning team
}

/** Default scoring rules — balanced for a 15–30 min game */
export const DEFAULT_SCORING_RULES: ScoringRules = {
  participation: 10,
  survivalPerCycle: 10,
  correctImposterVote: 25,
  deceptionSurvivedCycle: 25,
  teamWinBonus: 50,
  imposterWinBonus: 100,
};

export interface PlayerCycleStats {
  survived: boolean;
  votedForEliminated: boolean;
  wasEliminated: boolean;
  role: 'normal' | 'imposter';
}

export interface CyclePointsResult {
  survival: number;
  correctVote: number;
  deception: number;
  total: number;
}

/**
 * Calculate points earned by a player in a single voting cycle.
 */
export function calculateCyclePoints(
  stats: PlayerCycleStats,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): CyclePointsResult {
  const result: CyclePointsResult = { survival: 0, correctVote: 0, deception: 0, total: 0 };

  if (stats.survived && !stats.wasEliminated) {
    result.survival = rules.survivalPerCycle;
  }

  if (stats.role === 'normal' && stats.votedForEliminated) {
    result.correctVote = rules.correctImposterVote;
  }

  if (stats.role === 'imposter' && stats.survived && !stats.wasEliminated) {
    result.deception = rules.deceptionSurvivedCycle;
  }

  result.total = result.survival + result.correctVote + result.deception;
  return result;
}

export interface GameEndStats {
  role: 'normal' | 'imposter';
  survived: boolean;
  winningSide: 'team' | 'imposters';
}

export interface GameEndPointsResult {
  winBonus: number;
  total: number;
}

/**
 * Calculate bonus points at game end.
 */
export function calculateGameEndPoints(
  stats: GameEndStats,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): GameEndPointsResult {
  let winBonus = 0;

  const playerWon =
    (stats.role === 'normal' && stats.winningSide === 'team') ||
    (stats.role === 'imposter' && stats.winningSide === 'imposters');

  if (playerWon) {
    winBonus = stats.role === 'imposter' ? rules.imposterWinBonus : rules.teamWinBonus;
  }

  return { winBonus, total: winBonus };
}

/**
 * Full session score breakdown.
 */
export interface FinalScoreBreakdown {
  participation: number;
  survival: number;
  correctVotes: number;
  deception: number;
  winBonus: number;
  total: number;
}

export function buildFinalScoreBreakdown(
  accumulated: { survival: number; correctVotes: number; deception: number },
  winBonus: number,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): FinalScoreBreakdown {
  const participation = rules.participation;
  const total = participation + accumulated.survival + accumulated.correctVotes + accumulated.deception + winBonus;
  return {
    participation,
    survival: accumulated.survival,
    correctVotes: accumulated.correctVotes,
    deception: accumulated.deception,
    winBonus,
    total,
  };
}
