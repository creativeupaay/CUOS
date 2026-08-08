import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../../app/hooks';
import { useGetGameSessionQuery, useGetMyRoleQuery } from '../../../features/game-zone/api/gameZoneApi';
import { useGameSocket } from '../../../features/game-zone/hooks/useGameSocket';
import { setCurrentSession } from '../../../features/game-zone/games/imposter/store/imposterSlice';
import type { GamePhase } from '../../../features/game-zone/types/gameZone.types';

// Phase components — each is completely isolated
import ImposterRoleReveal from '@/features/game-zone/games/imposter/components/ImposterRoleReveal';
import CluePhase from '@/features/game-zone/games/imposter/components/CluePhase';
import DiscussionPhase from '@/features/game-zone/games/imposter/components/DiscussionPhase';
import VotingPhase from '@/features/game-zone/games/imposter/components/VotingPhase';
import ResultPhase from '@/features/game-zone/games/imposter/components/ResultPhase';
import GameOverPhase from '@/features/game-zone/games/imposter/components/GameOverPhase';
import ImposterGameHeader from '@/features/game-zone/games/imposter/components/ImposterGameHeader';

function PhaseRenderer({ phase, sessionId, gameId }: { phase: GamePhase; sessionId: string; gameId: string }) {
  switch (phase) {
    case 'ROLE_REVEAL':
      return <ImposterRoleReveal sessionId={sessionId} />;
    case 'CLUE':
      return <CluePhase sessionId={sessionId} />;
    case 'DISCUSSION':
      return <DiscussionPhase sessionId={sessionId} />;
    case 'VOTING':
      return <VotingPhase sessionId={sessionId} />;
    case 'RESULT':
      return <ResultPhase gameId={gameId} />;
    case 'GAME_OVER':
      return <GameOverPhase sessionId={sessionId} gameId={gameId} />;
    default:
      return null;
  }
}

export default function ImposterPlayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const imposterState = useAppSelector((s) => s.imposter);

  // Polling for reconnect recovery
  const { data } = useGetGameSessionQuery(gameId!, { skip: !gameId, pollingInterval: 15000 });

  useGetMyRoleQuery(gameId!, { skip: !gameId });

  // Socket
  useGameSocket(gameId || null);

  // Sync state from HTTP on first load or reconnect
  useEffect(() => {
    if (data?.data && gameId) {
      dispatch(setCurrentSession({ sessionId: gameId, gameState: data.data }));
    }
  }, [data?.data, gameId, dispatch]);

  // Safeguard: go back to lobby if game resets
  useEffect(() => {
    if (imposterState.gameState?.phase === 'LOBBY' && data?.data?.phase === 'LOBBY') {
      navigate(`/games/imposter/${gameId}/lobby`, { replace: true });
    }
  }, [imposterState.gameState?.phase, data?.data?.phase, gameId, navigate]);

  const phase = imposterState.gameState?.phase || data?.data?.phase;
  const myPlayer = imposterState.gameState?.players.find((p: any) => p.userId === user?._id);
  const isEliminated = myPlayer?.status === 'eliminated';
  const isSpectator = myPlayer?.status === 'spectator';

  if (!phase || !gameId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full animate-pulse" style={{ background: 'rgba(124,58,237,0.15)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      {/* Game header with phase indicator */}
      <ImposterGameHeader
        phase={phase as GamePhase}
        roundNumber={imposterState.gameState?.currentRound?.roundNumber || 1}
        cycleNumber={imposterState.gameState?.currentRound?.cycleNumber || 1}
        phaseEndsAt={imposterState.gameState?.currentRound?.phaseEndsAt || null}
        isEliminated={isEliminated}
        isSpectator={isSpectator}
        isHost={myPlayer?.isHost || false}
        gameId={gameId}
      />

      {/* Phase-specific content */}
      <PhaseRenderer
        phase={phase as GamePhase}
        sessionId={gameId}
        gameId={gameId}
      />

      {/* Eliminated banner */}
      {isEliminated && phase !== 'GAME_OVER' && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#DC2626' }}
        >
          <span className="text-xl">👻</span>
          <p>You've been eliminated! You can watch the rest of the game as a spectator.</p>
        </div>
      )}

      {/* Spectator banner */}
      {isSpectator && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.15)', color: '#6B7280' }}
        >
          <span className="text-xl">👁️</span>
          <p>You joined late and are watching as a spectator.</p>
        </div>
      )}
    </div>
  );
}


