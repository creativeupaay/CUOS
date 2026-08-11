import { Trophy, Medal, Crown } from 'lucide-react';
import type { QuizLiveLeaderboardEntry } from '../types/quiz.types';

interface QuizLiveLeaderboardProps {
  leaderboard: QuizLiveLeaderboardEntry[];
  myUserId: string | null;
  maxDisplay?: number;
}

// Clean up user names (e.g. if email fallback is used)
function formatDisplayName(name: string): string {
  if (!name) return 'Player';
  if (name.includes('@')) {
    return name.split('@')[0];
  }
  return name;
}

export default function QuizLiveLeaderboard({
  leaderboard,
  myUserId,
  maxDisplay = 5,
}: QuizLiveLeaderboardProps) {
  if (!leaderboard || leaderboard.length === 0) return null;

  const topPlayers = leaderboard.slice(0, maxDisplay);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.6)] border border-amber-200 shrink-0">
            <Trophy className="text-slate-950 fill-slate-950" size={16} />
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 flex items-center justify-center shadow-[0_0_12px_rgba(203,213,225,0.4)] border border-slate-100 shrink-0">
            <Medal className="text-slate-950" size={16} />
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 flex items-center justify-center shadow-[0_0_10px_rgba(180,83,9,0.4)] border border-amber-400 shrink-0">
            <Medal className="text-amber-200" size={16} />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-black/50 border border-white/10 flex items-center justify-center font-black text-slate-400 text-xs shrink-0">
            #{rank}
          </div>
        );
    }
  };

  const getRowClass = (rank: number, isMe: boolean) => {
    let baseClass = 'flex items-center justify-between p-4 px-5 rounded-2xl border-2 transition-all shadow-md ';

    switch (rank) {
      case 1:
        baseClass += 'bg-gradient-to-r from-amber-500/25 via-amber-500/10 to-black/40 border-amber-400/70 shadow-[0_0_18px_rgba(245,158,11,0.2)] ';
        break;
      case 2:
        baseClass += 'bg-gradient-to-r from-slate-400/20 via-slate-400/10 to-black/40 border-slate-300/50 shadow-[0_0_12px_rgba(203,213,225,0.15)] ';
        break;
      case 3:
        baseClass += 'bg-gradient-to-r from-amber-700/20 via-amber-700/10 to-black/40 border-amber-600/50 ';
        break;
      default:
        baseClass += 'bg-black/40 border-white/10 hover:bg-white/5 ';
    }

    if (isMe) {
      baseClass += 'ring-2 ring-purple-500/80 shadow-[0_0_20px_rgba(168,85,247,0.3)] ';
    }

    return baseClass;
  };

  return (
    <div className="game-glass-panel rounded-2xl p-5 sm:p-6 border-t-2 border-t-cyan-400/60 shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header with crisp divider */}
      <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-white/10 relative z-10">
        <h3 className="font-black text-white text-lg flex items-center gap-2.5 tracking-wide">
          <div className="p-2 bg-gradient-to-br from-fuchsia-500 to-purple-700 rounded-xl shadow-[0_0_12px_rgba(217,70,239,0.4)]">
            <Trophy size={18} className="text-white" />
          </div>
          Live Leaderboard
        </h3>
      </div>

      <div className="flex flex-col gap-4 sm:gap-5 relative z-10 pt-1">
        {topPlayers.map((player, index) => {
          const isMe = player.userId === myUserId;
          const displayRank = player.rank || (index + 1);
          const cleanName = formatDisplayName(player.userName);

          return (
            <div key={player.userId} className={getRowClass(displayRank, isMe)}>
              <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2">
                {getRankIcon(displayRank)}

                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-white text-sm tracking-wide flex items-center gap-1.5 truncate">
                    <span className="truncate">{cleanName}</span>
                    {isMe && (
                      <span className="text-[9px] uppercase font-black bg-purple-600 text-white px-1.5 py-0.5 rounded shadow-sm shrink-0">
                        YOU
                      </span>
                    )}
                    {displayRank === 1 && player.totalScore > 0 && (
                      <Crown size={12} className="text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </div>

                  <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <CheckIcon size={11} className="text-emerald-400" />
                    <span>{player.correctAnswers} correct</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-black text-xl sm:text-2xl text-cyan-300 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)] tabular-nums leading-none">
                  {player.totalScore}
                </div>
                <div className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-1">
                  PTS
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {leaderboard.length > maxDisplay && (
        <div className="text-center mt-4 text-xs font-black text-slate-400 uppercase tracking-widest bg-black/40 py-2 rounded-xl border border-white/10">
          + {leaderboard.length - maxDisplay} other players in arena
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
