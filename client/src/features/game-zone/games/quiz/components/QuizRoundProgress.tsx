interface QuizRoundProgressProps {
  currentRound: number;
  totalRounds: number;
}

export default function QuizRoundProgress({ currentRound, totalRounds }: QuizRoundProgressProps) {
  // Ensure valid values
  const safeCurrent = Math.max(1, Math.min(currentRound, totalRounds));
  const safeTotal = Math.max(1, totalRounds);

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-2.5">
        <div className="text-xs font-black text-slate-300 uppercase tracking-widest drop-shadow-sm flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          Progress
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl font-black leading-none text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]">
            {safeCurrent}
          </span>
          <span className="text-xs font-extrabold text-slate-400">
            / {safeTotal}
          </span>
        </div>
      </div>
      
      {/* Segmented Progress Bar */}
      <div className="flex gap-1.5 h-2.5">
        {Array.from({ length: safeTotal }).map((_, index) => {
          const isCompleted = index + 1 < safeCurrent;
          const isCurrent = index + 1 === safeCurrent;
          
          let segmentClass = 'flex-1 rounded-full transition-all duration-300 ';
          let shadow = 'none';
          
          if (isCompleted) {
            segmentClass += 'bg-emerald-400';
            shadow = '0 0 10px rgba(52,211,153,0.7)';
          } else if (isCurrent) {
            segmentClass += 'bg-cyan-400 animate-pulse scale-105';
            shadow = '0 0 14px rgba(34,211,238,0.9)';
          } else {
            segmentClass += 'bg-slate-800/90 border border-white/10';
          }
          
          return (
            <div 
              key={index} 
              className={segmentClass}
              style={{ boxShadow: shadow }}
            />
          );
        })}
      </div>
    </div>
  );
}
