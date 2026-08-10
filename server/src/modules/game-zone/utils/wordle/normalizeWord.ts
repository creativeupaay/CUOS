/**
 * Wordle Word Normalization
 *
 * All words entering the system (from player or config) must be normalized.
 * Consistent normalization prevents case-mismatch bugs.
 */

/**
 * Normalize a word to uppercase, trimmed, with no whitespace.
 * All Wordle comparisons use normalized form.
 */
export function normalizeWord(word: string): string {
  return word.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Returns true if the string is exactly 5 alphabetic characters.
 */
export function isValidWordFormat(word: string): boolean {
  return /^[A-Z]{5}$/.test(normalizeWord(word));
}
