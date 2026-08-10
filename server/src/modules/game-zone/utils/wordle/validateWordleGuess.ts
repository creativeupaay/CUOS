import { normalizeWord, isValidWordFormat } from './normalizeWord';
import { isValidGuessWord } from './wordleDictionary';

export interface GuessValidationResult {
  valid: boolean;
  normalized: string;
  reason?: 'wrong_length' | 'invalid_characters' | 'not_in_word_list';
}

/**
 * Validates a player's guess before it is evaluated.
 *
 * Rules:
 * 1. Must be exactly 5 letters
 * 2. Must contain only alphabetic characters
 * 3. Must be in the valid guess word list
 *
 * Returns a normalized version of the word on success.
 */
export function validateWordleGuess(rawGuess: string): GuessValidationResult {
  const normalized = normalizeWord(rawGuess);

  if (!isValidWordFormat(normalized)) {
    const reason = normalized.length !== 5 ? 'wrong_length' : 'invalid_characters';
    return { valid: false, normalized, reason };
  }

  if (!isValidGuessWord(normalized)) {
    return { valid: false, normalized, reason: 'not_in_word_list' };
  }

  return { valid: true, normalized };
}

export const GUESS_VALIDATION_MESSAGES: Record<NonNullable<GuessValidationResult['reason']>, string> = {
  wrong_length: 'Guess must be exactly 5 letters',
  invalid_characters: 'Guess must contain only letters',
  not_in_word_list: 'Not in word list',
};
