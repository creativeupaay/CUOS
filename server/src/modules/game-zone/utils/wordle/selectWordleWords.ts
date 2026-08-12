import { TARGET_WORDS_ARRAY } from './wordleDictionary';
import AppError from '../../../../utils/appError';

/**
 * Selects N distinct random target words for a Wordle session.
 *
 * Words are selected server-side using a Fisher-Yates shuffle.
 * The same word will NOT appear twice in the same session.
 *
 * @param count - Number of words needed (= number of rounds)
 * @returns Array of N distinct uppercase 5-letter words
 * @throws AppError if count > available words
 */
export function selectWordleWords(count: number): string[] {
  if (count <= 0) throw new AppError('Round count must be at least 1', 400);
  if (count > TARGET_WORDS_ARRAY.length) {
    throw new AppError(
      `Cannot create ${count} rounds: only ${TARGET_WORDS_ARRAY.length} words available`,
      400
    );
  }

  // Fisher-Yates shuffle of a copy
  const pool = [...TARGET_WORDS_ARRAY];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}
