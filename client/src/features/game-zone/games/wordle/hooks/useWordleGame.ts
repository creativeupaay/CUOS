import { useMemo } from 'react';
import type { LetterResult, KeyStatus } from '../types/wordle.types';
import type { WordleGuessEntry } from '../types/wordle.types';
import { LETTER_STATUS_PRIORITY } from '../constants/wordleConstants';

/**
 * Derives keyboard letter statuses from a player's guess history.
 * Uses priority: correct > present > absent > unused.
 */
export function useKeyboardStatus(guesses: WordleGuessEntry[]): Record<string, KeyStatus> {
  return useMemo(() => {
    const statusMap: Record<string, KeyStatus> = {};
    for (const { guess, feedback } of guesses) {
      for (let i = 0; i < feedback.length; i++) {
        const letter = guess[i];
        const result = feedback[i] as LetterResult;
        const current = statusMap[letter];
        const currentPriority = current ? LETTER_STATUS_PRIORITY[current] ?? 0 : -1;
        const newPriority = LETTER_STATUS_PRIORITY[result] ?? 0;
        if (newPriority > currentPriority) {
          statusMap[letter] = result as KeyStatus;
        }
      }
    }
    return statusMap;
  }, [guesses]);
}
