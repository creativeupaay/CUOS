import WordleRow from './WordleRow';
import type { WordleGuessEntry, LetterResult } from '../types/wordle.types';
import { WORDLE_MAX_GUESSES, WORDLE_WORD_LENGTH } from '../constants/wordleConstants';

interface WordleBoardProps {
  guesses: WordleGuessEntry[];
  currentInput: string;
  maxGuesses?: number;
  isShaking?: boolean;
  isGameOver?: boolean;
}

/**
 * WordleBoard — renders all 6 rows.
 * Submitted rows show feedback. Current row shows typed letters. Empty rows show blank tiles.
 */
export default function WordleBoard({
  guesses,
  currentInput,
  maxGuesses = WORDLE_MAX_GUESSES,
  isShaking = false,
  isGameOver = false,
}: WordleBoardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        maxWidth: 340,
        margin: '0 auto',
      }}
    >
      {Array.from({ length: maxGuesses }, (_, rowIndex) => {
        const submitted = guesses[rowIndex];
        const isCurrentRow = rowIndex === guesses.length && !isGameOver;

        if (submitted) {
          return (
            <WordleRow
              key={rowIndex}
              letters={submitted.guess.split('')}
              feedback={submitted.feedback as LetterResult[]}
              isRevealing
            />
          );
        }

        if (isCurrentRow) {
          const validLetters = currentInput.split('').slice(0, WORDLE_WORD_LENGTH);
          return (
            <WordleRow
              key={rowIndex}
              letters={validLetters}
              isCurrentRow
              isShaking={isShaking}
            />
          );
        }

        return (
          <WordleRow
            key={rowIndex}
            letters={[]}
          />
        );
      })}
    </div>
  );
}
