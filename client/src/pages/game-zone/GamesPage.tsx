import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Users, Clock, Zap, Star, ChevronRight, Plus } from 'lucide-react';
import { GAME_REGISTRY } from '../../features/game-zone/registry/gameRegistry';
import { useListGameSessionsQuery } from '../../features/game-zone/api/gameZoneApi';
import { useAppSelector } from '../../app/hooks';
import GameStatusBadge from '../../features/game-zone/components/GameStatusBadge';
import type { GameDefinition } from '../../features/game-zone/types/gameZone.types';

function DifficultyStars({ difficulty }: { difficulty: GameDefinition['difficulty'] }) {
  const stars = { Easy: 1, Medium: 2, Hard: 3 }[difficulty];
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((s) => (
        <Star
          key={s}
          size={11}
          fill={s <= stars ? 'currentColor' : 'none'}
          style={{ color: s <= stars ? '#F59E0B' : 'var(--color-border-default)' }}
        />
      ))}
      <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {difficulty}
      </span>
    </div>
  );
}

function GameCard({ game }: { game: GameDefinition }) {
  return (
    <div
      className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Accent header */}
      <div
        className="relative h-36 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${game.accentColor}25, ${game.accentColor}08)` }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `radial-gradient(circle at 70% 30%, ${game.accentColor}40, transparent 70%)`,
          }}
        />
        <span className="text-6xl drop-shadow-lg select-none relative z-10">{game.icon}</span>
        {!game.available && (
          <div
            className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
          >
            Coming Soon
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            {game.name}
          </h3>
          <DifficultyStars difficulty={game.difficulty} />
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {game.shortDescription}
        </p>

        {/* Meta */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <Users size={12} />
            <span>{game.minPlayers}–{game.maxPlayers} players</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <Clock size={12} />
            <span>{game.durationMin}–{game.durationMax} min</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {game.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: `${game.accentColor}15`, color: game.accentColor }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex gap-2 mt-auto pt-2">
          {game.available ? (
            <>
              <Link
                to={game.route}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: `${game.accentColor}18`,
                  color: game.accentColor,
                  border: `1px solid ${game.accentColor}30`,
                }}
              >
                <Gamepad2 size={15} />
                Browse Games
              </Link>
              <Link
                to={game.createRoute}
                className="flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
                style={{ background: game.accentColor }}
              >
                <Plus size={15} />
              </Link>
            </>
          ) : (
            <div
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium opacity-50"
              style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
            >
              Coming Soon
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveSessionRow({ session, onJoin, currentUserId }: { session: any; onJoin: (id: string, type: string) => void; currentUserId: string | undefined }) {
  const host = session.players?.find((p: any) => p.isHost);
  const isParticipant = session.players?.some((p: any) => p.userId === currentUserId);
  const canJoin = session.status === 'lobby' || (session.status === 'active' && isParticipant);
  
  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl transition-all duration-200 hover:scale-[1.005]"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl shrink-0">{session.gameType === 'wordle' ? '🔤' : '🎭'}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {host?.userName || 'Unknown'}'s Game
            </span>
            <GameStatusBadge status={session.status} />
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-medium capitalize"
              style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
            >
              {session.gameType || session.sessionType}
            </span>
          </div>
          <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: 'var(--color-text-muted)' }}>
            <span className="flex items-center gap-1">
              <Users size={11} />
              {session.players?.filter((p: any) => p.status !== 'spectator').length || 0} / {session.config?.maxPlayers || 10}
            </span>
          </div>
        </div>
      </div>
      {canJoin && (
        <button
          onClick={() => onJoin(session._id, session.gameType || session.sessionType)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#7C3AED' }}
        >
          {session.status === 'active' ? 'Rejoin' : 'Join'} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

export default function GamesPage() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { data, isLoading } = useListGameSessionsQuery(undefined, { pollingInterval: 10000 });
  const sessions = data?.data || [];

  const handleJoin = (sessionId: string, gameType: string) => {
    if (gameType === 'wordle') {
      navigate(`/games/wordle/${sessionId}/lobby`);
    } else {
      navigate(`/games/imposter/${sessionId}/lobby`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Games grid */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} style={{ color: '#7C3AED' }} />
          <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
            Available Games
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {GAME_REGISTRY.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      {/* Active sessions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
              Live Sessions
            </h3>
          </div>
          {sessions.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
              {sessions.length} active
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--color-bg-subtle)' }} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-2xl"
            style={{ background: 'var(--color-bg-subtle)', border: '1px dashed var(--color-border-default)' }}
          >
            <Gamepad2 size={36} style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No active sessions. Be the first to start a game!
            </p>
            <Link
              to="/games/imposter/create"
              className="mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#7C3AED' }}
            >
              Create Game
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: any) => (
              <ActiveSessionRow key={session._id} session={session} onJoin={handleJoin} currentUserId={user?._id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
