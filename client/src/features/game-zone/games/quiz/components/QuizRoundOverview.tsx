import { Target, Zap, Clock, BrainCircuit, Sparkles } from 'lucide-react';
import type { QuizConfig } from '../types/quiz.types';

interface QuizRoundOverviewProps {
  config: QuizConfig;
}

export default function QuizRoundOverview({ config }: QuizRoundOverviewProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/40 text-emerald-400';
      case 'medium': return 'from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-400';
      case 'hard': return 'from-rose-500/20 to-rose-500/5 border-rose-500/40 text-rose-400';
      case 'mixed': return 'from-purple-500/20 to-purple-500/5 border-purple-500/40 text-purple-300';
      default: return 'from-slate-500/20 to-slate-500/5 border-slate-500/40 text-slate-300';
    }
  };

  const difficultyTheme = getDifficultyColor(config.difficulty);

  return (
    <div className="game-glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-fade-slide-up shadow-2xl border border-white/10">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left: Icon, Title & Topic */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(217,70,239,0.4)] border border-white/20">
            <BrainCircuit className="text-white drop-shadow-md" size={30} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide leading-tight uppercase drop-shadow-sm flex items-center gap-2">
              {config.gameName}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-black uppercase tracking-widest text-slate-300">
                TOPIC
              </span>
              <span className="capitalize font-extrabold text-cyan-300 text-sm tracking-wide flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-400" />
                {config.topic}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Game Parameters Stats */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center p-2.5 px-4 rounded-xl bg-black/40 border border-white/10 shadow-inner min-w-[95px]">
            <div className="flex items-center gap-1.5 mb-1 text-cyan-400">
              <Target size={14} />
              <span className="text-[10px] uppercase font-extrabold tracking-wider">QUESTIONS</span>
            </div>
            <span className="text-xl font-black text-white">{config.totalQuestions}</span>
          </div>

          <div className="flex flex-col items-center justify-center p-2.5 px-4 rounded-xl bg-black/40 border border-white/10 shadow-inner min-w-[95px]">
            <div className="flex items-center gap-1.5 mb-1 text-pink-400">
              <Clock size={14} />
              <span className="text-[10px] uppercase font-extrabold tracking-wider">TIME / Q</span>
            </div>
            <span className="text-xl font-black text-white">{config.timePerQuestion}s</span>
          </div>

          <div className={`flex flex-col items-center justify-center p-2.5 px-4 rounded-xl bg-gradient-to-b ${difficultyTheme} border min-w-[105px] shadow-md`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Zap size={14} />
              <span className="text-[10px] uppercase font-extrabold tracking-wider opacity-90">DIFFICULTY</span>
            </div>
            <span className="text-xl font-black capitalize drop-shadow-sm">{config.difficulty}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
