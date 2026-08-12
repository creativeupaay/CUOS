import { Trophy, Medal, Award, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { QuizFinalPlayerResult } from '../types/quiz.types';

interface QuizFinalResultProps {
  results: QuizFinalPlayerResult[];
  myUserId: string | null;
}

function formatDisplayName(name: string): string {
  if (!name) return 'Player';
  if (name.includes('@')) {
    return name.split('@')[0];
  }
  return name;
}

export default function QuizFinalResult({ results, myUserId }: QuizFinalResultProps) {
  const navigate = useNavigate();

  if (!results || results.length === 0) return null;

  const top3 = results.slice(0, 3);

  const getPodiumColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-amber-400 via-amber-500 to-amber-700 shadow-amber-500/40 border-amber-300/60';
      case 2: return 'from-slate-300 via-slate-400 to-slate-600 shadow-slate-400/30 border-slate-200/50';
      case 3: return 'from-amber-700 via-amber-800 to-amber-950 shadow-amber-800/30 border-amber-500/50';
      default: return 'from-purple-600 to-purple-900 border-purple-400/40';
    }
  };

  const getPodiumIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy size={36} className="text-slate-950 fill-slate-950 drop-shadow-md animate-pulse mb-1" />;
      case 2: return <Medal size={30} className="text-slate-950 drop-shadow-sm mb-1" />;
      case 3: return <Medal size={28} className="text-amber-200 drop-shadow-sm mb-1" />;
      default: return <Award size={24} className="text-white" />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center px-4 py-3 sm:py-5 justify-center">
      
      {/* Title Banner */}
      <div className="text-center mb-4 animate-fade-slide-up relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-400 mb-1 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] tracking-tight uppercase">
          CHAMPIONSHIP STANDINGS
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 font-extrabold tracking-widest uppercase flex items-center justify-center gap-1.5">
          <span>🏆 Quiz Battle Complete</span>
        </p>
      </div>

      {/* Perfectly Proportioned AAA Podium */}
      <div className="flex flex-row items-end justify-center gap-4 sm:gap-6 w-full h-[180px] sm:h-[210px] mb-5">
        
        {/* 2nd Place */}
        {top3[1] && (
          <div className="flex flex-col items-center w-1/3 max-w-[140px] animate-fade-slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="text-center mb-1.5 w-full">
              <div className="font-extrabold text-xs sm:text-base text-white truncate w-full px-1 drop-shadow-md">
                {formatDisplayName(top3[1].userName)}
              </div>
              <div className="text-[11px] font-black text-slate-200 bg-black/50 px-2.5 py-0.5 rounded-full border border-white/20 inline-block mt-0.5">
                {top3[1].totalScore} PTS
              </div>
            </div>
            <div className={`w-full h-20 sm:h-24 rounded-t-2xl bg-gradient-to-t ${getPodiumColor(2)} shadow-xl flex flex-col items-center justify-start pt-2 relative overflow-hidden border-2 border-b-0`}>
              <div className="absolute inset-0 bg-white/10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 30%, 0 50%)' }} />
              {getPodiumIcon(2)}
              <span className="text-2xl font-black text-slate-950 drop-shadow-md">2</span>
            </div>
          </div>
        )}

        {/* 1st Place (Gold Winner) */}
        {top3[0] && (
          <div className="flex flex-col items-center w-1/3 max-w-[165px] animate-fade-slide-up z-10" style={{ animationDelay: '0.1s' }}>
            <div className="text-center mb-1.5 w-full">
              <div className="font-black text-sm sm:text-lg text-amber-300 truncate w-full px-1 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                {formatDisplayName(top3[0].userName)}
              </div>
              <div className="text-xs sm:text-sm font-black text-amber-950 bg-amber-400 px-3 py-0.5 rounded-full border border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] inline-block mt-0.5">
                {top3[0].totalScore} PTS
              </div>
            </div>
            <div className={`w-full h-32 sm:h-36 rounded-t-2xl bg-gradient-to-t ${getPodiumColor(1)} shadow-[0_0_30px_rgba(245,158,11,0.45)] flex flex-col items-center justify-start pt-2.5 relative overflow-hidden border-2 border-b-0`}>
              <div className="absolute inset-0 bg-white/25" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 20%, 0 40%)' }} />
              {getPodiumIcon(1)}
              <span className="text-4xl font-black text-slate-950 drop-shadow-lg mt-0.5">1</span>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {top3[2] && (
          <div className="flex flex-col items-center w-1/3 max-w-[140px] animate-fade-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="text-center mb-1.5 w-full">
              <div className="font-extrabold text-xs sm:text-base text-white truncate w-full px-1 drop-shadow-md">
                {formatDisplayName(top3[2].userName)}
              </div>
              <div className="text-[11px] font-black text-amber-200 bg-black/50 px-2.5 py-0.5 rounded-full border border-amber-500/40 inline-block mt-0.5">
                {top3[2].totalScore} PTS
              </div>
            </div>
            <div className={`w-full h-16 sm:h-18 rounded-t-2xl bg-gradient-to-t ${getPodiumColor(3)} shadow-xl flex flex-col items-center justify-start pt-2 relative overflow-hidden border-2 border-b-0`}>
              <div className="absolute inset-0 bg-white/10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 40%, 0 60%)' }} />
              {getPodiumIcon(3)}
              <span className="text-xl font-black text-amber-200 drop-shadow-md">3</span>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Final Leaderboard Table */}
      <div className="w-full game-glass-panel rounded-2xl overflow-hidden shadow-2xl animate-fade-slide-up border border-white/10 mb-4" style={{ animationDelay: '0.6s' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/60 border-b border-white/10">
                <th className="px-4 py-2.5 font-black text-slate-400 uppercase tracking-widest text-center w-16 text-[11px]">Rank</th>
                <th className="px-4 py-2.5 font-black text-slate-400 uppercase tracking-widest text-[11px]">Player</th>
                <th className="px-4 py-2.5 font-black text-slate-400 uppercase tracking-widest text-right text-[11px]">Score</th>
                <th className="px-4 py-2.5 font-black text-slate-400 uppercase tracking-widest text-center text-[11px]">Correct / Wrong</th>
                <th className="px-4 py-2.5 font-black text-slate-400 uppercase tracking-widest text-center text-[11px]">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-black/20 text-xs sm:text-sm">
              {results.map((player, idx) => {
                const isMe = player.userId === myUserId;
                const cleanName = formatDisplayName(player.userName);
                const totalAnswers = (player.correctAnswers || 0) + (player.wrongAnswers || 0);
                const accuracy = totalAnswers > 0 
                  ? Math.round(((player.correctAnswers || 0) / totalAnswers) * 100)
                  : player.accuracy || 0;

                return (
                  <tr 
                    key={player.userId}
                    className={`transition-colors ${isMe ? 'bg-purple-900/30' : 'hover:bg-white/5'}`}
                  >
                    <td className="px-4 py-2.5 text-center font-black text-sm sm:text-base text-slate-300">
                      #{idx + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                        <span className="truncate max-w-[160px]">{cleanName}</span>
                        {isMe && (
                          <span className="bg-purple-600 text-white text-[9px] uppercase font-black px-1.5 py-0.5 rounded shrink-0 shadow-sm">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-black text-base sm:text-lg text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)] tabular-nums">
                        {player.totalScore}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-black">
                        <span className="text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-400/30">
                          {player.correctAnswers || 0}
                        </span>
                        <span className="text-slate-500">/</span>
                        <span className="text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                          {player.wrongAnswers || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="px-2.5 py-0.5 bg-white/10 rounded-full text-xs font-extrabold text-white border border-white/15">
                        {accuracy}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons - Compact Padding & Sleek Spacing */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm sm:max-w-md animate-fade-slide-up" style={{ animationDelay: '0.8s' }}>
        <button
          onClick={() => navigate('/games/quiz')}
          className="btn-game btn-game-primary flex-1 w-full py-2.5 px-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xl animate-pulse-glow"
        >
          <RefreshCw size={15} />
          Play Again
        </button>
        <button
          onClick={() => navigate('/games')}
          className="btn-game btn-game-outline flex-1 w-full py-2.5 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-white/20"
        >
          <ArrowLeft size={15} />
          Exit to Game Zone
        </button>
      </div>

    </div>
  );
}
