import { LetterResult } from '../../models/WordleGuess.model';
import { normalizeWord } from './normalizeWord';

/**
 * Wordle Guess Evaluator — Two-Pass Algorithm
 *
 * This is the core Wordle feedback engine. It correctly handles duplicate letters.
 *
 * Two-pass approach:
 *   PASS 1: Mark exact matches (correct position). These "consume" the target letter.
 *   PASS 2: For remaining unmatched guess letters, mark 'present' if the target still
 *           has an available (unconsumed) occurrence; otherwise mark 'absent'.
 *
 * This function is pure and independently testable — no side effects, no DB calls.
 *
 * @param targetWord - The secret word (5 letters, normalized)
 * @param guess      - The player's guess (5 letters, normalized)
 * @returns Array of 5 LetterResult values
 *
 * @example
 * evaluateGuess('APPLE', 'ALLEY')
 * // → ['correct', 'absent', 'present', 'absent', 'present']
 * //    A=correct, L=absent (only one L in target used for E pos), L=present, E=absent, Y=absent
 *
 * @example
 * evaluateGuess('CRANE', 'STARE')
 * // → ['absent', 'absent', 'correct', 'correct', 'correct']
 */
export function evaluateGuess(targetWord: string, guess: string): LetterResult[] {
  const target = normalizeWord(targetWord).split('');
  const guessLetters = normalizeWord(guess).split('');

  if (target.length !== 5 || guessLetters.length !== 5) {
    throw new Error('Both target and guess must be exactly 5 letters');
  }

  const result: LetterResult[] = new Array(5).fill('absent');

  // Track which target positions have been "consumed" by a match
  const targetUsed: boolean[] = new Array(5).fill(false);
  // Track which guess positions have been resolved in pass 1
  const guessResolved: boolean[] = new Array(5).fill(false);

  // ─── PASS 1: Exact matches (correct position) ─────────────────────────────
  for (let i = 0; i < 5; i++) {
    if (guessLetters[i] === target[i]) {
      result[i] = 'correct';
      targetUsed[i] = true;
      guessResolved[i] = true;
    }
  }

  // ─── PASS 2: Present but wrong position ───────────────────────────────────
  for (let i = 0; i < 5; i++) {
    if (guessResolved[i]) continue; // already marked correct

    // Look for an available (unused) occurrence in the target
    for (let j = 0; j < 5; j++) {
      if (!targetUsed[j] && guessLetters[i] === target[j]) {
        result[i] = 'present';
        targetUsed[j] = true; // consume this target letter
        break;
      }
    }
    // If no match found, remains 'absent'
  }

  return result;
}

/**
 * Returns true if the feedback indicates a fully solved word.
 */
export function isSolved(feedback: LetterResult[]): boolean {
  return feedback.every((r) => r === 'correct');
}
