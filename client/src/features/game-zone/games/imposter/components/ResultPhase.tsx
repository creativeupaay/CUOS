import { useAppSelector } from '../../../../../app/hooks';
import { Skull, ShieldAlert } from 'lucide-react';
import type { VoteResult } from '../../../types/gameZone.types';

interface ResultPhaseProps {
  gameId: string;
}

export default function ResultPhase({}: ResultPhaseProps) {
  const gameState = useAppSelector((s) => s.imposter.gameState);
  const voteResultsList = useAppSelector((s) => s.imposter.voteResultsList);
  const eliminatedPlayerId = useAppSelector((s) => s.imposter.eliminatedPlayerId);
  const eliminatedWasImposter = useAppSelector((s) => s.imposter.eliminatedWasImposter);

  // Find who was eliminated
  const eliminatedPlayer = gameState?.players.find((p: any) => p.userId === eliminatedPlayerId);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div
        className="p-8 rounded-2xl text-center relative overflow-hidden"
        style={{
          background: eliminatedWasImposter
            ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))'
            : eliminatedPlayerId
              ? 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))'
              : 'linear-gradient(135deg, rgba(107,114,128,0.15), rgba(107,114,128,0.05))',
          border: eliminatedWasImposter
            ? '1px solid rgba(16,185,129,0.3)'
            : eliminatedPlayerId
              ? '1px solid rgba(220,38,38,0.3)'
              : '1px solid rgba(107,114,128,0.3)',
        }}
      >
        <div className="relative z-10 space-y-3">
          {eliminatedPlayerId ? (
            <>
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center bg-white shadow-lg text-2xl mb-2">
                {eliminatedWasImposter ? '🎭' : '👻'}
              </div>
              <h2 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                {eliminatedPlayer?.userName || 'Someone'} was Eliminated
              </h2>
              
              <div
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold mt-2"
                style={{
                  background: eliminatedWasImposter ? '#10B981' : '#DC2626',
                  color: '#fff',
                }}
              >
                {eliminatedWasImposter ? (
                  <>
                    <ShieldAlert size={16} /> They were an IMPOSTER
                  </>
                ) : (
                  <>
                    <Skull size={16} /> They were NOT an imposter
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">🤔</div>
              <h2 className="text-2xl font-black" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                No One Was Eliminated
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                The vote was tied or no votes were cast.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Vote Breakdown */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          Vote Breakdown
        </h3>
        {voteResultsList.length > 0 ? (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
          >
            {voteResultsList.map((result: VoteResult, idx: number) => {
              const maxVotes = voteResultsList[0].votes;
              const percentage = Math.max(5, (result.votes / maxVotes) * 100);
              const isEliminated = result.targetPlayerId === eliminatedPlayerId;

              return (
                <div
                  key={result.targetPlayerId}
                  className="flex items-center justify-between p-3"
                  style={{ borderBottom: idx < voteResultsList.length - 1 ? '1px solid var(--color-border-default)' : 'none' }}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: isEliminated ? '#DC2626' : 'var(--color-text-primary)' }}
                      >
                        {result.targetPlayerName}
                      </span>
                      {isEliminated && <span className="text-[10px] uppercase font-bold text-red-500">Eliminated</span>}
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 dark:bg-gray-800">
                      <div
                        className="h-1.5 rounded-full transition-all duration-1000"
                        style={{
                          width: `${percentage}%`,
                          background: isEliminated ? '#DC2626' : '#7C3AED',
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{result.votes}</span>
                    <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>votes</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center rounded-xl" style={{ background: 'var(--color-bg-subtle)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No votes recorded.</span>
          </div>
        )}
      </div>
      
      <p className="text-center text-xs mt-6" style={{ color: 'var(--color-text-muted)' }}>
        Get ready for the next round...
      </p>
    </div>
  );
}
