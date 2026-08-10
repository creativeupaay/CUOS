import { useEffect, useState } from 'react';
import type { LetterResult } from '../types/wordle.types';
import { TILE_FLIP_DURATION_MS } from '../constants/wordleConstants';

interface WordleTileProps {
  letter: string;
  status: LetterResult;
  delay?: number;   // stagger delay in ms
  revealed?: boolean; // triggers flip animation
}

/**
 * A single Wordle tile with flip animation on reveal.
 */
export default function WordleTile({ letter, status, delay = 0, revealed = false }: WordleTileProps) {
  const [flipped, setFlipped] = useState(false);
  const [showing, setShowing] = useState(status === 'empty' || status === 'tbd' ? 'front' : 'back');

  useEffect(() => {
    if (revealed && status !== 'empty' && status !== 'tbd') {
      const t = setTimeout(() => setFlipped(true), delay);
      const t2 = setTimeout(() => setShowing('back'), delay + TILE_FLIP_DURATION_MS / 2);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [revealed, delay, status]);

  const bgColors: Record<LetterResult, string> = {
    correct:  '#059669',  // emerald green
    present:  '#D97706',  // amber
    absent:   '#4B5563',  // gray-600
    empty:    'transparent',
    tbd:      'transparent',
  };

  const borderColors: Record<LetterResult, string> = {
    correct:  '#059669',
    present:  '#D97706',
    absent:   '#4B5563',
    empty:    'var(--color-border-default)',
    tbd:      'var(--color-text-muted)',
  };

  const textColors: Record<LetterResult, string> = {
    correct:  '#fff',
    present:  '#fff',
    absent:   '#fff',
    empty:    'var(--color-text-primary)',
    tbd:      'var(--color-text-primary)',
  };

  const bg = showing === 'back' ? bgColors[status] : bgColors.empty;
  const border = showing === 'back' ? borderColors[status] : borderColors[letter ? 'tbd' : 'empty'];
  const textColor = showing === 'back' ? textColors[status] : textColors[letter ? 'tbd' : 'empty'];

  const hasLetter = letter && letter.length > 0;

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${border}`,
        borderRadius: 4,
        background: bg,
        fontFamily: 'Outfit, sans-serif',
        fontSize: 'clamp(18px, 3.5vw, 28px)',
        fontWeight: 700,
        color: textColor,
        textTransform: 'uppercase',
        letterSpacing: 1,
        cursor: 'default',
        userSelect: 'none',
        transformStyle: 'preserve-3d',
        transform: flipped ? 'rotateX(360deg)' : 'rotateX(0deg)',
        transition: flipped ? `transform ${TILE_FLIP_DURATION_MS}ms ease ${delay}ms, background ${1}ms ${delay + TILE_FLIP_DURATION_MS / 2}ms, border-color ${1}ms ${delay + TILE_FLIP_DURATION_MS / 2}ms` : 'none',
        // Pop animation on letter entry
        animation: hasLetter && status === 'tbd' ? 'wordlePop 0.1s ease' : undefined,
      }}
      aria-label={letter ? `${letter} ${status}` : 'empty'}
    >
      {letter}
    </div>
  );
}
