import { useState } from 'react';
import { Trophy, Medal, Crown, BarChart2 } from 'lucide-react';
import { useGetLeaderboardQuery, useGetMyStatsQuery } from '../../features/game-zone/api/gameZoneApi';

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={18} fill="#F59E0B" style={{ color: '#F59E0B' }} />;
  if (rank === 2) return <Medal size={18} style={{ color: '#94A3B8' }} />;
  if (rank === 3) return <Medal size={18} style={{ color: '#B45309' }} />;
  return <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-muted)' }}>#{rank}</span>;
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState('all');

  const { data: lbData, isLoading } = useGetLeaderboardQuery({ gameType: 'all', period });
  const { data: myStatsData } = useGetMyStatsQuery({ gameType: 'all', period });

  const entries = lbData?.data?.entries || [];
  const myStats = myStatsData?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={22} style={{ color: '#F59E0B' }} />
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>
              Leaderboard
            </h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Top performers across all Game Zone games.
          </p>
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                background: period === opt.value ? 'var(--color-bg-card)' : 'transparent',
                color: period === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: period === opt.value ? 'var(--shadow-xs)' : 'none',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* My Stats */}
      {myStats && myStats.gamesPlayed > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.02))',
            border: '1px solid rgba(124,58,237,0.15)',
          }}
        >
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#7C3AED', fontFamily: 'Outfit, sans-serif' }}>
              {myStats.totalPoints || 0}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Total Points</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
              {myStats.gamesPlayed || 0}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Games Played</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#10B981', fontFamily: 'Outfit, sans-serif' }}>
              {myStats.wins || 0}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Wins</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#F59E0B', fontFamily: 'Outfit, sans-serif' }}>
              {myStats.gamesPlayed > 0 ? Math.round((myStats.wins / myStats.gamesPlayed) * 100) : 0}%
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Win Rate</div>
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)' }}
      >
        {/* Table header */}
        <div
          className="grid grid-cols-[48px_1fr_80px_80px_100px] gap-4 px-5 py-3 text-xs font-semibold"
          style={{
            color: 'var(--color-text-muted)',
            background: 'var(--color-bg-subtle)',
            borderBottom: '1px solid var(--color-border-default)',
          }}
        >
          <span>Rank</span>
          <span>Player</span>
          <span className="text-center">Games</span>
          <span className="text-center">Wins</span>
          <span className="text-right">Points</span>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="space-y-px">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 animate-pulse" style={{ background: 'var(--color-bg-subtle)', margin: '1px 0' }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <BarChart2 size={40} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>No data for this period yet.</p>
          </div>
        ) : (
          entries.map((entry: any, idx: number) => (
            <div
              key={entry.userId}
              className="grid grid-cols-[48px_1fr_80px_80px_100px] gap-4 items-center px-5 py-3.5 transition-colors"
              style={{
                borderBottom: idx < entries.length - 1 ? '1px solid var(--color-border-default)' : 'none',
                background: entry.rank <= 3 ? `rgba(245,158,11,${(4 - entry.rank) * 0.04})` : 'transparent',
              }}
            >
              <div className="flex items-center justify-center w-7 h-7">
                <RankIcon rank={entry.rank} />
              </div>

              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
                >
                  {entry.userName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {entry.userName}
                  </div>
                  {entry.roleStats && entry.roleStats.timesImposter > 0 && (
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {entry.roleStats.timesImposter}× 🎭 imposter
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {entry.gamesPlayed}
              </div>

              <div className="text-center text-sm font-semibold" style={{ color: '#10B981' }}>
                {entry.wins}
              </div>

              <div className="text-right">
                <span
                  className="text-base font-bold"
                  style={{ color: entry.rank <= 3 ? '#F59E0B' : 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                >
                  {entry.totalPoints.toLocaleString()}
                </span>
                <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>pts</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
