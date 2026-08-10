import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Crown, CheckCircle2, Circle, Users, Play, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import {
  useGetWordleSessionQuery,
  useSetWordlePlayerReadyMutation,
  useStartWordleGameMutation,
  useLeaveWordleSessionMutation,
} from '@/features/game-zone/api/wordleApi';
import { useWordleSocket } from '@/features/game-zone/games/wordle/hooks/useWordleSocket';
import { initWordleSession } from '@/features/game-zone/games/wordle/store/wordleSlice';
import type { WordlePublicPlayer } from '@/features/game-zone/games/wordle/types/wordle.types';

const ACCENT = '#059669';

function PlayerRow({ player, isMe }: { player: WordlePublicPlayer; isMe: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 10,
        background: isMe ? `${ACCENT}10` : 'var(--color-bg-subtle)',
        border: isMe ? `1px solid ${ACCENT}25` : '1px solid transparent',
        transition: 'all 0.2s',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}99)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {player.userName.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.userName}
          </span>
          {player.isHost && <Crown size={12} style={{ color: '#F59E0B', flexShrink: 0 }} />}
          {isMe && <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT, background: `${ACCENT}18`, padding: '1px 6px', borderRadius: 20 }}>You</span>}
          {player.isSpectator && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 20 }}>Spectator</span>}
        </div>
      </div>
      {!player.isSpectator && (
        player.isReady
          ? <CheckCircle2 size={16} style={{ color: '#10B981', flexShrink: 0 }} />
          : <Circle size={16} style={{ color: 'var(--color-border-default)', flexShrink: 0 }} />
      )}
    </div>
  );
}

export default function WordleLobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const wordleState = useAppSelector((s) => s.wordle);

  const { data } = useGetWordleSessionQuery(gameId!, { pollingInterval: 4000, skip: !gameId });
  const [setReady] = useSetWordlePlayerReadyMutation();
  const [startGame, { isLoading: isStarting }] = useStartWordleGameMutation();
  const [leaveSession] = useLeaveWordleSessionMutation();

  const { socketRef } = useWordleSocket(gameId || null);
  const [isReady, setIsReady] = useState(false);

  const gameState = data?.data;
  const myPlayer = gameState?.players.find((p) => p.userId === user?._id);
  const isHost = myPlayer?.isHost || false;
  const activePlayers = gameState?.players.filter((p) => !p.isSpectator) || [];
  const readyCount = activePlayers.filter((p) => p.isReady).length;
  const canStart = isHost && activePlayers.length >= (gameState?.config.minPlayers || 2);



  // Sync state to Redux store on data load
  useEffect(() => {
    if (gameState && gameId) {
      dispatch(initWordleSession({ sessionId: gameId, gameState }));
    }
  }, [gameState, gameId, dispatch]);

  // Navigate to play when game starts
  useEffect(() => {
    if (gameState?.phase !== 'LOBBY') {
      navigate(`/games/wordle/${gameId}/play`, { replace: true });
    }
  }, [gameState?.phase, gameId, navigate]);

  // Listen for socket-driven start
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = () => navigate(`/games/wordle/${gameId}/play`, { replace: true });
    socket.on('wordle:game_started', handler);
    socket.on('wordle:round_started', handler);
    return () => { socket.off('wordle:game_started', handler); socket.off('wordle:round_started', handler); };
  }, [socketRef.current, gameId, navigate]);

  const handleToggleReady = async () => {
    if (!gameId) return;
    const newReady = !isReady;
    setIsReady(newReady);
    try {
      await setReady({ sessionId: gameId, isReady: newReady }).unwrap();
      socketRef.current?.emit('wordle:ready', { sessionId: gameId, isReady: newReady });
    } catch { setIsReady(!newReady); }
  };

  const handleStart = async () => {
    if (!gameId) return;
    try {
      await startGame(gameId).unwrap();
      navigate(`/games/wordle/${gameId}/play`, { replace: true });
    } catch (e: any) {
      alert(e?.data?.message || 'Failed to start game');
    }
  };

  const handleLeave = async () => {
    if (!gameId) return;
    socketRef.current?.emit('wordle:leave_room', { sessionId: gameId });
    await leaveSession(gameId).unwrap().catch(() => {});
    navigate('/games/wordle');
  };

  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: `${ACCENT}18`, margin: '0 auto 12px', animation: 'pulse 1.5s infinite' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Loading lobby…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(5,150,105,0.1), rgba(5,150,105,0.03))',
          border: `1px solid rgba(5,150,105,0.2)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>🔤</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
              {gameState.config.gameName}
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
              {gameState.config.totalRounds} rounds · {gameState.config.roundDurationSec}s/round · 6 guesses
            </p>
          </div>
        </div>
        {wordleState.isConnected
          ? <Wifi size={16} style={{ color: '#10B981' }} />
          : <WifiOff size={16} style={{ color: 'var(--color-text-muted)' }} />
        }
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Players', value: `${activePlayers.length}/${gameState.config.maxPlayers}` },
          { label: 'Rounds', value: `${gameState.config.totalRounds}` },
          { label: 'Time/Round', value: `${gameState.config.roundDurationSec}s` },
        ].map((item) => (
          <div key={item.label} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 12, background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>{item.value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Player list */}
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={13} style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>Players</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981' }}>{readyCount}/{activePlayers.length} ready</span>
        </div>
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {gameState.players.map((player) => (
            <PlayerRow
              key={player.userId}
              player={player}
              isMe={player.userId === user?._id}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        {!isHost && (
          <button
            onClick={handleToggleReady}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer',
              background: isReady ? '#10B981' : `linear-gradient(135deg, ${ACCENT}, #047857)`, color: '#fff',
            }}
          >
            {isReady ? '✓ Ready!' : 'Ready Up'}
          </button>
        )}
        {isHost && (
          <button
            onClick={handleStart}
            disabled={!canStart || isStarting}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 0', borderRadius: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 14, border: 'none',
              cursor: canStart ? 'pointer' : 'not-allowed', opacity: canStart ? 1 : 0.6,
              background: canStart ? `linear-gradient(135deg, ${ACCENT}, #047857)` : 'var(--color-bg-subtle)', color: canStart ? '#fff' : 'var(--color-text-primary)',
            }}
          >
            <Play size={15} />
            {isStarting ? 'Starting…' : canStart ? 'Start Game' : `Need ${gameState.config.minPlayers} players`}
          </button>
        )}
        <button
          onClick={handleLeave}
          style={{
            padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', color: '#DC2626',
            border: '1px solid rgba(239,68,68,0.15)', cursor: 'pointer',
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}
