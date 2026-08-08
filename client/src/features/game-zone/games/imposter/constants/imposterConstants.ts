/**
 * Imposter Game Constants — Frontend
 * These are frontend-only constants. Critical game logic (word selection, role assignment) stays on the server.
 */

export const WORD_PACKS_NAMES = ['general', 'food', 'office', 'nature'];

export const IMPOSTER_COLORS = [
  '#7C3AED', '#059669', '#DC2626', '#D97706',
  '#0891B2', '#DB2777', '#65A30D', '#7C3AED',
];

export const GAME_PHASE_LABELS: Record<string, string> = {
  LOBBY: 'Lobby',
  ROLE_REVEAL: 'Role Reveal',
  CLUE: 'Giving Clues',
  DISCUSSION: 'Discussion',
  VOTING: 'Voting',
  RESULT: 'Result',
  GAME_OVER: 'Game Over',
};

export const PHASE_DESCRIPTIONS: Record<string, string> = {
  LOBBY: 'Waiting for players to join and ready up.',
  ROLE_REVEAL: 'Check your role. Normal players see the secret word; imposters do not.',
  CLUE: 'Each player gives one word related to the secret word.',
  DISCUSSION: 'Discuss who seems like an imposter. Anyone acting suspicious?',
  VOTING: 'Vote for who you think the imposter is.',
  RESULT: 'See the results of the vote.',
  GAME_OVER: 'The game is over!',
};

export const MIN_PLAYERS_TO_START = 4;
export const MAX_CLUE_LENGTH = 30;
export const ROLE_REVEAL_TIMEOUT_SEC = 120;
