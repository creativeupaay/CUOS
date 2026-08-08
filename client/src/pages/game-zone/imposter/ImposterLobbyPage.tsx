import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, CheckCircle2, Circle, Crown, Wifi, WifiOff, Play, LogOut } from 'lucide-react';
import { useGetGameSessionQuery, useSetPlayerReadyMutation, useStartGameSessionMutation, useLeaveGameSessionMutation } from '../../../features/game-zone/api/gameZoneApi';
import { useAppSelector, useAppDispatch } from '../../../app/hooks';
import { useGameSocket } from '../../../features/game-zone/hooks/useGameSocket';
import { setCurrentSession } from '../../../features/game-zone/games/imposter/store/imposterSlice';
import GameStatusBadge from '../../../features/game-zone/components/GameStatusBadge';
import type { PublicPlayerState } from '../../../features/game-zone/types/gameZone.types';

function PlayerRow({ player, isMe, accentColor }: { player: PublicPlayerState; isMe: boolean; accentColor: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{
        background: isMe ? `${accentColor}10` : 'var(--color-bg-subtle)',
        border: isMe ? `1px solid ${accentColor}25` : '1px solid transparent',
      }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)` }}
      >
        {player.userName.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {player.userName}
          </span>
          {player.isHost && <Crown size={13} style={{ color: '#F59E0B', flexShrink: 0 }} />}
          {isMe && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${accentColor}18`, color: accentColor }}>You</span>}
          {player.status === 'spectator' && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}>Spectator</span>
          )}
        </div>
      </div>

      {/* Ready state */}
      {player.status !== 'spectator' && (
        player.isReady
          ? <CheckCircle2 size={18} style={{ color: '#10B981', flexShrink: 0 }} />
          : <Circle size={18} style={{ color: 'var(--color-border-default)', flexShrink: 0 }} />
      )}
    </div>
  );
}

export default function ImposterLobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const imposterState = useAppSelector((s) => s.imposter);

  const { data } = useGetGameSessionQuery(gameId!, {
    pollingInterval: 5000,
    skip: !gameId,
  });
  const [setReady] = useSetPlayerReadyMutation();
  const [startGame, { isLoading: isStarting }] = useStartGameSessionMutation();
  const [leaveSession] = useLeaveGameSessionMutation();

  const { socketRef } = useGameSocket(gameId || null);
  const [isReady, setIsReady] = useState(false);

  const gameState = data?.data;
  const myPlayer = gameState?.players.find((p: any) => p.userId === user?._id);
  const isHost = myPlayer?.isHost || false;
  const activePlayers = gameState?.players.filter((p) => p.status !== 'spectator') || [];
  const readyCount = activePlayers.filter((p) => p.isReady).length;
  const canStart = isHost && activePlayers.length >= (gameState?.config.minPlayers || 4);

  // Initialise imposter store on first load
  useEffect(() => {
    if (gameState && gameId) {
      dispatch(setCurrentSession({ sessionId: gameId, gameState }));
    }
  }, [gameState, gameId, dispatch]);

  // Navigate to play screen when game starts
  useEffect(() => {
    if (gameState && gameState.phase !== 'LOBBY') {
      navigate(`/games/imposter/${gameId}/play`, { replace: true });
    }
  }, [gameState?.phase, gameId, navigate]);

  // Listen for socket phase changes (immediate transition)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = (data: any) => {
      if (data.phase !== 'LOBBY') {
        navigate(`/games/imposter/${gameId}/play`, { replace: true });
      }
    };
    socket.on('game:started', handler);
    socket.on('game:phase_updated', handler);
    return () => {
      socket.off('game:started', handler);
      socket.off('game:phase_updated', handler);
    };
  }, [socketRef.current, gameId, navigate]);

  const handleToggleReady = async () => {
    if (!gameId) return;
    const newReady = !isReady;
    setIsReady(newReady);
    try {
      await setReady({ sessionId: gameId, isReady: newReady }).unwrap();
      socketRef.current?.emit('game:ready', { sessionId: gameId, isReady: newReady });
    } catch {
      setIsReady(!newReady);
    }
  };

  const handleStart = async () => {
    if (!gameId) return;
    try {
      await startGame(gameId).unwrap();
      navigate(`/games/imposter/${gameId}/play`, { replace: true });
    } catch (e: any) {
      alert(e?.data?.message || 'Failed to start game');
    }
  };

  const handleLeave = async () => {
    if (!gameId) return;
    socketRef.current?.emit('game:leave_room', { sessionId: gameId });
    await leaveSession(gameId).unwrap().catch(() => {});
    navigate('/games/imposter');
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full animate-pulse" style={{ background: 'rgba(124,58,237,0.15)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Loading lobby...</p>
        </div>
      </div>
    );
  }

  const ACCENT = '#7C3AED';

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div
        className="flex items-center justify-between p-5 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(124,58,237,0.03))',
          border: '1px solid rgba(124,58,237,0.15)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎭</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>
                Imposter Lobby
              </h2>
              <GameStatusBadge status={gameState.status} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {gameState.sessionType === 'official' ? '🏆 Official' : '🎲 Casual'} session
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {imposterState.socketConnected
            ? <Wifi size={16} style={{ color: '#10B981' }} />
            : <WifiOff size={16} style={{ color: 'var(--color-text-muted)' }} />
          }
        </div>
      </div>

      {/* Game info */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Players', value: `${activePlayers.length} / ${gameState.config.maxPlayers}` },
          { label: 'Word Pack', value: gameState.config.wordPack, className: 'capitalize' },
          { label: 'Imposters', value: `${gameState.config.numImposters} 🎭` },
        ].map((item) => (
          <div
            key={item.label}
            className="text-center p-3 rounded-xl"
            style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
          >
            <div className={`text-lg font-bold ${item.className || ''}`} style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
              {item.value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Player list */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <Users size={14} style={{ color: 'var(--color-text-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Players</span>
          </div>
          <span className="text-xs font-semibold" style={{ color: '#10B981' }}>
            {readyCount}/{activePlayers.length} ready
          </span>
        </div>

        <div className="p-3 space-y-2">
          {gameState.players.map((player) => (
            <PlayerRow
              key={player.userId}
              player={player}
              isMe={player.userId === user?._id}
              accentColor={ACCENT}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {!isHost && (
          <button
            onClick={handleToggleReady}
            className="flex-1 py-3.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: isReady ? '#10B981' : ACCENT,
              color: '#fff',
            }}
          >
            {isReady ? '✓ Ready!' : 'Ready Up'}
          </button>
        )}

        {isHost && (
          <button
            onClick={handleStart}
            disabled={!canStart || isStarting}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: canStart ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : 'var(--color-bg-subtle)' }}
          >
            <Play size={16} />
            {isStarting ? 'Starting...' : canStart ? 'Start Game' : `Need ${gameState.config.minPlayers} players`}
          </button>
        )}

        <button
          onClick={handleLeave}
          className="px-4 py-3.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#DC2626',
            border: '1px solid rgba(239,68,68,0.15)',
          }}
        >
          <LogOut size={15} />
        </button>
      </div>

      {!canStart && isHost && (
        <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Waiting for at least {gameState.config.minPlayers} players to join
        </p>
      )}
    </div>
  );
}

