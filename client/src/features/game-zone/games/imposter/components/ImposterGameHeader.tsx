import { GAME_PHASE_LABELS, PHASE_DESCRIPTIONS } from '../constants/imposterConstants';
import GameTimer from '../../../components/GameTimer';
import type { GamePhase } from '../../../types/gameZone.types';
import { useEndGameSessionMutation } from '../../../api/gameZoneApi';
import { Power } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImposterGameHeaderProps {
  phase: GamePhase;
  roundNumber: number;
  cycleNumber: number;
  phaseEndsAt: string | null;
  isEliminated: boolean;
  isSpectator: boolean;
  isHost: boolean;
  gameId: string;
}

export default function ImposterGameHeader({
  phase,
  roundNumber,
  cycleNumber,
  phaseEndsAt,
  isHost,
  gameId
}: ImposterGameHeaderProps) {
  const [endGame] = useEndGameSessionMutation();

  const handleEndGame = async () => {
    if (window.confirm('Are you sure you want to end this game early?')) {
      try {
        await endGame(gameId).unwrap();
        toast.success('Game ended successfully');
      } catch (e: any) {
        toast.error(e?.data?.message || 'Failed to end game');
      }
    }
  };

  // We only show the timer in the header if it's not DISCUSSION or VOTING
  // since those phases have huge prominent timers in their own components.
  const showHeaderTimer = phase !== 'DISCUSSION' && phase !== 'VOTING' && phaseEndsAt;

  return (
    <div
      className="p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
    >
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: 'rgba(124,58,237,0.1)' }}
        >
          🎭
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
              {GAME_PHASE_LABELS[phase] || phase}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#7C3AED', color: '#fff' }}>
              Round {roundNumber}
            </span>
            {phase !== 'ROLE_REVEAL' && phase !== 'RESULT' && phase !== 'GAME_OVER' && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                Cycle {cycleNumber}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {PHASE_DESCRIPTIONS[phase]}
          </p>
        </div>
      </div>

      {showHeaderTimer && (
        <div
          className="shrink-0 px-3 py-1.5 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
        >
          <GameTimer endsAt={phaseEndsAt} />
        </div>
      )}

      {isHost && phase !== 'GAME_OVER' && phase !== 'RESULT' && (
        <button
          onClick={handleEndGame}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
          style={{ background: 'var(--color-status-error-bg)', color: 'var(--color-status-error)', border: '1px solid var(--color-status-error-border)' }}
          title="End Round / Game"
        >
          <Power size={13} />
          End Game
        </button>
      )}
    </div>
  );
}
