import WordleTile from './WordleTile';
import type { LetterResult } from '../types/wordle.types';
import { WORDLE_WORD_LENGTH, TILE_FLIP_STAGGER_MS } from '../constants/wordleConstants';

interface WordleRowProps {
  letters: string[];       // 5 letters (may be partially filled)
  feedback?: LetterResult[]; // 5 results (only when row is submitted)
  isCurrentRow?: boolean;
  isShaking?: boolean;
  isRevealing?: boolean;
}

export default function WordleRow({ letters, feedback, isShaking = false, isRevealing = false }: WordleRowProps) {
  const tiles = Array.from({ length: WORDLE_WORD_LENGTH }, (_, i) => {
    const letter = letters[i] || '';
    const status: LetterResult = feedback
      ? feedback[i]
      : letter
      ? 'tbd'
      : 'empty';

    return (
      <WordleTile
        key={i}
        letter={letter}
        status={status}
        delay={i * TILE_FLIP_STAGGER_MS}
        revealed={isRevealing}
      />
    );
  });

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${WORDLE_WORD_LENGTH}, 1fr)`,
        gap: 6,
        animation: isShaking ? 'wordleShake 0.5s ease' : undefined,
      }}
    >
      {tiles}
    </div>
  );
}
