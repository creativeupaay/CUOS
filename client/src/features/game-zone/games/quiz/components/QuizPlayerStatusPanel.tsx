import { Users, UserCheck, Clock } from 'lucide-react';
import type { QuizPublicPlayer } from '../types/quiz.types';

interface QuizPlayerStatusPanelProps {
  players: QuizPublicPlayer[];
  answeredPlayerIds: string[];
  totalPlayers: number;
}

function formatDisplayName(name: string): string {
  if (!name) return 'Player';
  if (name.includes('@')) {
    return name.split('@')[0];
  }
  return name;
}

export default function QuizPlayerStatusPanel({
  players,
  answeredPlayerIds,
  totalPlayers,
}: QuizPlayerStatusPanelProps) {
  // Only show active players (not spectators)
  const activePlayers = players.filter((p) => !p.isSpectator);
  const totalActive = activePlayers.length || totalPlayers;
  const answeredCount = answeredPlayerIds.length;
  const allAnswered = answeredCount >= totalActive && totalActive > 0;

  return (
    <div className="game-glass-panel rounded-2xl p-5 sm:p-6 shadow-xl border border-white/10 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-white/10 relative z-10">
        <h3 className="font-black text-white text-base flex items-center gap-2 tracking-wide">
          <div className="p-1.5 bg-gradient-to-br from-purple-500/30 to-cyan-500/30 rounded-lg border border-white/15">
            <Users size={16} className="text-cyan-400" />
          </div>
          Players Status
        </h3>
        
        <div className="text-xs font-black bg-black/40 px-3 py-1 rounded-full border border-white/10 text-slate-300 flex items-center gap-1.5">
          <span className={allAnswered ? "text-emerald-400" : "text-cyan-400"}>{answeredCount}</span>
          <span className="text-slate-500">/</span>
          <span>{totalActive} Answered</span>
        </div>
      </div>

      {/* Player Chips Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[180px] overflow-y-auto custom-scrollbar relative z-10 pt-1">
        {activePlayers.map((player) => {
          const hasAnswered = answeredPlayerIds.includes(player.userId);
          const cleanName = formatDisplayName(player.userName);

          return (
            <div
              key={player.userId}
              className={`flex items-center justify-between p-2.5 px-3 rounded-xl border transition-all ${
                hasAnswered
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  : 'bg-black/30 border-white/10 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-xs border ${
                    hasAnswered 
                      ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.4)]' 
                      : 'bg-slate-800 text-slate-400 border-white/10'
                  }`}
                >
                  {hasAnswered ? <UserCheck size={13} /> : cleanName.charAt(0).toUpperCase()}
                </div>
                
                <span className="truncate font-bold text-xs text-white flex-1">
                  {cleanName}
                </span>
              </div>

              <div className="shrink-0">
                {hasAnswered ? (
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-400/30">
                    LOCKED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Clock size={10} className="animate-spin text-slate-500" /> THINKING
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {allAnswered && (
        <div className="mt-3 text-center text-xs font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/15 py-2 rounded-xl border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)] animate-pulse">
          ✓ ALL PLAYERS HAVE LOCKED IN ANSWERS!
        </div>
      )}
    </div>
  );
}
