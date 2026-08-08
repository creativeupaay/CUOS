import { useAppSelector, useAppDispatch } from '../../../../../app/hooks';
import { setMyVote } from '../store/imposterSlice';
import { useGameSocket } from '../../../hooks/useGameSocket';
import GameTimer from '../../../components/GameTimer';
import { CheckCircle2 } from 'lucide-react';
import type { PublicPlayerState } from '../../../types/gameZone.types';

interface VotingPhaseProps {
  sessionId: string;
}

function VoteCard({
  player,
  isSelected,
  onVote,
  disabled,
  isMe,
}: {
  player: PublicPlayerState;
  isSelected: boolean;
  onVote: () => void;
  disabled: boolean;
  isMe: boolean;
}) {
  return (
    <button
      onClick={onVote}
      disabled={disabled || isMe}
      className="relative p-4 rounded-xl text-center transition-all duration-200 disabled:opacity-40 hover:scale-[1.02]"
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))'
          : 'var(--color-bg-subtle)',
        border: isSelected
          ? '1.5px solid rgba(220,38,38,0.4)'
          : '1.5px solid var(--color-border-default)',
        boxShadow: isSelected ? '0 0 0 3px rgba(220,38,38,0.1)' : 'none',
      }}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 size={14} style={{ color: '#DC2626' }} />
        </div>
      )}
      <div
        className="w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center text-white text-base font-bold"
        style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
      >
        {player.userName.charAt(0).toUpperCase()}
      </div>
      <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
        {player.userName}
      </p>
      {isMe && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>You</p>}
    </button>
  );
}

export default function VotingPhase({ sessionId }: VotingPhaseProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const gameState = useAppSelector((s) => s.imposter.gameState);
  const myVote = useAppSelector((s) => s.imposter.mySelectedVote);
  const { socketRef } = useGameSocket(null);

  const round = gameState?.currentRound;
  const activePlayers = gameState?.players.filter((p: any) => p.status === 'active') || [];
  const myPlayer = gameState?.players.find((p: any) => p.userId === user?._id);
  const canVote = myPlayer?.status === 'active';

  function handleVote(targetId: string) {
    if (!canVote || targetId === user?._id) return;
    dispatch(setMyVote(targetId));
    socketRef.current?.emit('game:submit_vote', { sessionId, targetPlayerId: targetId });
  }

  return (
    <div className="space-y-5">
      {/* Voting banner */}
      <div
        className="p-5 rounded-2xl text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.1), rgba(220,38,38,0.03))',
          border: '1px solid rgba(220,38,38,0.2)',
        }}
      >
        <span className="text-3xl block mb-2">🗳️</span>
        <h3 className="text-xl font-bold mb-1" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>
          Vote for the Imposter
        </h3>
        <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          {myVote ? 'Vote recorded — you can change it before time runs out.' : 'Tap a player to vote. You cannot vote for yourself.'}
        </p>
        {round?.phaseEndsAt && (
          <div className="flex justify-center">
            <GameTimer endsAt={round.phaseEndsAt} className="text-2xl" />
          </div>
        )}
      </div>

      {/* Player grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {activePlayers.map((player: any) => (
          <VoteCard
            key={player.userId}
            player={player}
            isSelected={myVote === player.userId}
            onVote={() => handleVote(player.userId)}
            disabled={!canVote}
            isMe={player.userId === user?._id}
          />
        ))}
      </div>

      {!canVote && (
        <div
          className="text-center text-sm p-3 rounded-xl"
          style={{ background: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
        >
          👁️ Spectating — voting not available.
        </div>
      )}
    </div>
  );
}
