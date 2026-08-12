import { Check, X } from 'lucide-react';
import React from 'react';

interface QuizOptionCardProps {
  index: number;
  text: string;
  isSelected: boolean;
  isCorrect?: boolean | null; // null if not yet revealed
  isDisabled: boolean;
  onSelect: () => void;
  showResult: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const OPTION_THEMES = [
  {
    border: 'border-cyan-500/40 hover:border-cyan-400',
    letterBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
    glow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]',
  },
  {
    border: 'border-pink-500/40 hover:border-pink-400',
    letterBg: 'bg-pink-500/20 text-pink-300 border-pink-400/40',
    glow: 'hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]',
  },
  {
    border: 'border-purple-500/40 hover:border-purple-400',
    letterBg: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    glow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]',
  },
  {
    border: 'border-amber-500/40 hover:border-amber-400',
    letterBg: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
    glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]',
  },
];

export default function QuizOptionCard({
  index,
  text,
  isSelected,
  isCorrect,
  isDisabled,
  onSelect,
  showResult,
}: QuizOptionCardProps) {
  const theme = OPTION_THEMES[index % 4];

  // Compact & sleek styles with h-full for equal grid height alignment
  let cardClass = 'relative flex items-center w-full h-full min-h-[54px] sm:min-h-[60px] p-3 px-4 rounded-xl transition-all duration-200 border-2 shadow-md ';
  let letterClass = 'flex items-center justify-center w-9 h-9 rounded-lg font-black text-sm mr-3 shrink-0 transition-all border shadow-sm ';
  let textClass = 'text-sm sm:text-base font-bold text-left break-words flex-grow tracking-wide leading-snug ';
  let icon = null;

  if (showResult) {
    // Result phase
    if (isCorrect) {
      cardClass += 'bg-gradient-to-r from-emerald-500/30 to-emerald-950/40 border-emerald-400 shadow-[0_0_25px_rgba(34,197,94,0.35)] z-10 scale-[1.01] ';
      letterClass += 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_12px_rgba(34,197,94,0.8)] ';
      textClass += 'text-white drop-shadow-md ';
      icon = <Check className="text-emerald-400 ml-2 shrink-0 drop-shadow-[0_0_6px_currentColor]" size={24} />;
    } else if (isSelected && !isCorrect) {
      cardClass += 'bg-gradient-to-r from-rose-600/30 to-rose-950/40 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.25)] ';
      letterClass += 'bg-rose-600 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)] ';
      textClass += 'text-white/80 line-through ';
      icon = <X className="text-rose-500 ml-2 shrink-0 drop-shadow-[0_0_6px_currentColor]" size={24} />;
    } else {
      cardClass += 'bg-black/30 border-white/5 opacity-40 grayscale ';
      letterClass += 'bg-black/40 text-slate-500 border-white/10 ';
      textClass += 'text-slate-500 ';
    }
  } else {
    // Active question phase
    if (isSelected) {
      cardClass += 'bg-gradient-to-r from-purple-600/90 via-purple-700/80 to-indigo-800/90 border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.5)] scale-[1.01] ';
      letterClass += 'bg-white text-purple-900 border-white shadow-[0_0_12px_rgba(255,255,255,0.8)] ';
      textClass += 'text-white drop-shadow-md ';
    } else {
      cardClass += `bg-black/40 ${theme.border} ${theme.glow} hover:bg-black/60 hover:scale-[1.005] `;
      letterClass += `${theme.letterBg} `;
      textClass += 'text-white ';
    }
  }

  if (!isDisabled) {
    cardClass += 'cursor-pointer active:scale-95 ';
  } else if (!showResult && !isSelected) {
    cardClass += 'opacity-50 cursor-not-allowed ';
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? -1 : 0}
      className={cardClass}
      onClick={() => !isDisabled && onSelect()}
      onKeyDown={handleKeyDown}
    >
      <div className={letterClass}>
        {OPTION_LETTERS[index]}
      </div>
      <div className={textClass}>
        {text}
      </div>
      {icon}
    </div>
  );
}
