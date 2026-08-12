/**
 * Imposter Selection — Server-side only
 *
 * SECURITY: This module runs exclusively on the server.
 * The frontend NEVER decides who the imposter is.
 * Results are stored in GamePlayer records and returned individually.
 */

import { PlayerRole } from '../types/game.types';

export interface RoleAssignment {
  userId: string;
  role: PlayerRole;
}

/**
 * Randomly select imposters from a list of eligible player IDs.
 * Uses cryptographically sufficient Math.random via Fisher-Yates shuffle.
 *
 * @param playerIds - Array of active player userIds
 * @param numImposters - How many imposters to assign
 * @returns Array of { userId, role } for ALL players
 * @throws Error if numImposters >= playerIds.length (impossible configuration)
 */
export function selectImposters(
  playerIds: string[],
  numImposters: number
): RoleAssignment[] {
  if (playerIds.length === 0) {
    throw new Error('Cannot select roles: no players');
  }

  if (numImposters <= 0) {
    throw new Error('Number of imposters must be at least 1');
  }

  if (numImposters >= playerIds.length) {
    throw new Error(
      `Cannot assign ${numImposters} imposters with only ${playerIds.length} players. ` +
      'There must always be at least one non-imposter.'
    );
  }

  // Fisher-Yates shuffle on a copy of the player IDs
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // First `numImposters` in shuffled array become imposters
  const imposterSet = new Set(shuffled.slice(0, numImposters));

  return playerIds.map((userId) => ({
    userId,
    role: imposterSet.has(userId) ? 'imposter' : 'normal',
  }));
}

/**
 * Validate imposter count against player count.
 * Returns { valid: true } or { valid: false, reason: string }
 */
export function validateImposterCount(
  playerCount: number,
  numImposters: number
): { valid: boolean; reason?: string } {
  if (numImposters <= 0) {
    return { valid: false, reason: 'Must have at least 1 imposter.' };
  }
  if (numImposters >= playerCount) {
    return {
      valid: false,
      reason: `Cannot have ${numImposters} imposter(s) with ${playerCount} player(s). At least one player must be non-imposter.`,
    };
  }
  return { valid: true };
}

/**
 * Check win condition after each voting cycle.
 *
 * TEAM WINS: All imposters eliminated.
 * IMPOSTERS WIN: Imposters reach parity with or outnumber non-imposters.
 */
export function checkWinCondition(
  totalActivePlayers: number,
  remainingImposters: number
): { gameOver: boolean; winningSide?: 'team' | 'imposters' } {
  if (remainingImposters <= 0) {
    return { gameOver: true, winningSide: 'team' };
  }
  const remainingNonImposters = totalActivePlayers - remainingImposters;
  if (remainingImposters >= remainingNonImposters) {
    return { gameOver: true, winningSide: 'imposters' };
  }
  return { gameOver: false };
}

/**
 * Determine the player with the most votes in a cycle.
 * Returns null if there is a tie (no elimination).
 *
 * NOTE: In case of a strict tie we eliminate no one — game continues.
 * This can be changed to a runoff or random selection if desired.
 */
export function determineElimination(
  voteCounts: Record<string, number>
): string | null {
  const entries = Object.entries(voteCounts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const [topId, topVotes] = entries[0];
  const [, secondVotes] = entries[1] || [null, 0];

  if (topVotes === secondVotes) {
    // Strict tie — no elimination
    return null;
  }

  return topId;
}

/**
 * Generate a randomised turn order from active player IDs.
 */
export function generateTurnOrder(activePlayerIds: string[]): string[] {
  const shuffled = [...activePlayerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
