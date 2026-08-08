import { useAppSelector } from '../../../../../app/hooks';
import { useGetCluesQuery } from '../../../api/gameZoneApi';
import GameTimer from '../../../components/GameTimer';
import { MessageCircle } from 'lucide-react';

interface DiscussionPhaseProps {
  sessionId: string;
}

export default function DiscussionPhase({ sessionId }: DiscussionPhaseProps) {
  const gameState = useAppSelector((s) => s.imposter.gameState);
  const currentClues = useAppSelector((s) => s.imposter.currentClues);

  const round = gameState?.currentRound;
  const phaseEndsAt = round?.phaseEndsAt ?? null;

  const { data: cluesData } = useGetCluesQuery(
    { sessionId, roundNumber: round?.roundNumber || 1, cycleNumber: round?.cycleNumber || 1 },
    { skip: !sessionId || !round }
  );

  const displayClues = cluesData?.data || currentClues;

  return (
    <div className="space-y-5">
      {/* Discussion banner */}
      <div
        className="p-6 rounded-2xl text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))',
          border: '1px solid rgba(245,158,11,0.2)',
        }}
      >
        <span className="text-4xl block mb-3">💬</span>
        <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>
          Discussion Time!
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          Discuss the clues. Who gave a suspicious clue? Talk with your teammates and decide who to vote for.
        </p>
        {phaseEndsAt && (
          <div className="flex justify-center">
            <GameTimer endsAt={phaseEndsAt} className="text-xl" />
          </div>
        )}
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Voting starts automatically when the timer ends.
        </p>
      </div>

      {/* All clues reference */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={14} style={{ color: 'var(--color-text-muted)' }} />
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            Clues from this round
          </h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {displayClues.map((c: any) => (
            <div
              key={c.playerId}
              className="p-3 rounded-xl text-center"
              style={{ background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)' }}
            >
              <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                {c.clue}
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                {c.playerName}
              </p>
            </div>
          ))}
          {displayClues.length === 0 && (
            <div className="col-span-3 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No clues recorded yet...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
