import type { KeyboardLayout } from '../types/wordle.types';

export const WORDLE_WORD_LENGTH = 5;
export const WORDLE_MAX_GUESSES = 6;
export const WORDLE_ACCENT_COLOR = '#059669'; // emerald green

export const KEYBOARD_LAYOUT: KeyboardLayout = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

export const TILE_FLIP_DURATION_MS = 300; // per-tile animation duration
export const TILE_FLIP_STAGGER_MS = 100; // delay between tiles in a row

export const LETTER_STATUS_PRIORITY: Record<string, number> = {
  correct: 3,
  present: 2,
  absent: 1,
  unused: 0,
};

export const NEXT_ROUND_COUNTDOWN_SEC = 8;
