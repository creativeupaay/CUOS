import { Link } from 'react-router-dom';
import { Users, Clock, Zap, ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import { useListGameSessionsQuery, useJoinGameSessionMutation } from '../../../features/game-zone/api/gameZoneApi';
import GameStatusBadge from '../../../features/game-zone/components/GameStatusBadge';
import { useNavigate } from 'react-router-dom';

export default function ImposterDetailPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useListGameSessionsQuery(undefined, { pollingInterval: 8000 });
  const [joinSession] = useJoinGameSessionMutation();
  const sessions = (data?.data || []).filter((s: any) => s.gameType === 'imposter');

  async function handleJoin(sessionId: string) {
    try {
      await joinSession(sessionId).unwrap();
      navigate(`/games/imposter/${sessionId}/lobby`);
    } catch (e: any) {
      alert(e?.data?.message || 'Failed to join session');
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/games" className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <ArrowLeft size={14} /> Back to Game Zone
      </Link>

      {/* Hero */}
      <div
        className="relative rounded-2xl overflow-hidden p-8 flex flex-col sm:flex-row items-center gap-6"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(124,58,237,0.04) 100%)',
          border: '1px solid rgba(124,58,237,0.2)',
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: 'radial-gradient(circle at 80% 20%, rgba(124,58,237,0.2), transparent 70%)' }}
        />
        <span className="text-7xl select-none relative z-10">🎭</span>
        <div className="relative z-10 flex-1 min-w-0">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>
            Imposter
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-text-secondary)', maxWidth: '60ch' }}>
            A social deduction game where most players share a secret word, but imposters must blend in without knowing it.
            Give one-word clues, discuss who seems suspicious, and vote to eliminate them.
          </p>
          <div className="flex flex-wrap gap-4 mb-5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1.5"><Users size={14} /> 4–20 players</span>
            <span className="flex items-center gap-1.5"><Clock size={14} /> 15–30 minutes</span>
            <span className="flex items-center gap-1.5"><Zap size={14} /> Multiple rounds</span>
          </div>
          <Link
            to="/games/imposter/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: '#7C3AED' }}
          >
            <Plus size={16} /> Create New Game
          </Link>
        </div>
      </div>

      {/* Sessions */}
      <div>
        <h3 className="text-base font-bold mb-4" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
          Active Sessions
        </h3>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-subtle)' }} />)}
          </div>
        ) : sessions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-2xl"
            style={{ background: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border-default)' }}
          >
            <span className="text-4xl mb-3">🎭</span>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No active sessions. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: any) => {
              const host = session.players?.find((p: any) => p.isHost);
              const activeCount = session.players?.filter((p: any) => p.status !== 'spectator').length || 0;
              return (
                <div
                  key={session._id}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border-default)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {host?.userName || 'Unknown'}'s Game
                      </span>
                      <GameStatusBadge status={session.status} />
                      <span className="text-xs capitalize px-1.5 py-0.5 rounded-md" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        {session.sessionType}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                      <Users size={11} /> {activeCount} / {session.config?.maxPlayers || 10}
                    </div>
                  </div>
                  {session.status === 'lobby' ? (
                    <button
                      onClick={() => handleJoin(session._id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: '#7C3AED' }}
                    >
                      Join <ChevronRight size={14} />
                    </button>
                  ) : (
                    <span className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                      In Progress
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
