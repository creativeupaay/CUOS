import { Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import type { QuizPreparationStatus } from '../types/quiz.types';

interface QuizPreparationStatusProps {
  status: QuizPreparationStatus;
  isHost: boolean;
}

export default function QuizPreparationStatusPanel({ status, isHost }: QuizPreparationStatusProps) {
  const { totalRequired, totalReady, aiGenerated, fallbackUsed, isComplete } = status;

  // Calculate percentage — show at least 3% width when generating
  const percentage = totalRequired > 0 ? Math.round((totalReady / totalRequired) * 100) : 0;
  const barWidth = isComplete ? 100 : totalRequired > 0 ? Math.max(percentage, totalReady > 0 ? percentage : 4) : 4;

  return (
    <div className="game-glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl border border-white/10">
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-neon-purple/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-3.5">
        {/* Header & Status Pill */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <div className="w-9 h-9 rounded-xl bg-neon-green/20 border border-neon-green/40 flex items-center justify-center shadow-[0_0_12px_rgba(34,197,94,0.3)] shrink-0">
                <CheckCircle2 className="text-neon-green" size={20} />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)] animate-pulse shrink-0">
                <Loader2 className="animate-spin text-neon-cyan" size={20} />
              </div>
            )}
            <div>
              <h3 className="font-black text-white text-base sm:text-lg tracking-wide flex items-center gap-2">
                {isComplete ? 'Questions Ready' : 'Preparing AI Questions...'}
              </h3>
              <p className="text-xs text-game-text-secondary font-medium">
                {isComplete 
                  ? 'All questions crafted and ready for battle' 
                  : 'AI is generating unique trivia for this topic'}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
            <Sparkles size={14} className={isComplete ? "text-neon-green" : "text-neon-cyan animate-pulse"} />
            <span className="text-xs font-black tracking-wider text-white">
              <span className={isComplete ? "text-neon-green" : "text-neon-cyan"}>{totalReady}</span> / {totalRequired}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-white/10 p-0.5 shadow-inner">
            <div
              className={`h-full transition-all duration-700 ease-out rounded-full ${
                isComplete 
                  ? 'bg-gradient-to-r from-neon-green to-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.6)]' 
                  : 'bg-gradient-to-r from-neon-cyan to-neon-purple shadow-[0_0_12px_rgba(6,182,212,0.6)] animate-pulse'
              }`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Meta Stats Badges (Compact) */}
        <div className="flex items-center gap-3 pt-1 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-game-text-secondary font-bold">
            <span className="w-2 h-2 rounded-full bg-neon-cyan shadow-[0_0_6px_#06b6d4]" />
            <span>AI Generated:</span>
            <span className="text-white font-black">{aiGenerated}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-game-text-secondary font-bold">
            <span className="w-2 h-2 rounded-full bg-neon-pink shadow-[0_0_6px_#ec4899]" />
            <span>Fallback Used:</span>
            <span className="text-white font-black">{fallbackUsed}</span>
          </div>
        </div>

        {/* Messages */}
        {isComplete && isHost && (
          <div className="p-3 bg-neon-green/10 border border-neon-green/30 rounded-xl text-neon-green text-xs flex items-center gap-2.5 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <CheckCircle2 size={16} className="shrink-0 text-neon-green" />
            <span className="font-bold tracking-wide">All set! You can start the game as soon as players are ready.</span>
          </div>
        )}

        {isComplete && totalReady < totalRequired && totalRequired > 0 && (
          <div className="p-3 bg-neon-yellow/10 border border-neon-yellow/30 rounded-xl text-neon-yellow text-xs flex items-center gap-2.5 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
            <AlertCircle size={16} className="shrink-0 text-neon-yellow" />
            <span className="font-bold tracking-wide">
              Generated {totalReady} of {totalRequired} questions. Game is ready to play!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
