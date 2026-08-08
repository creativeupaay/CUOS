import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAppSelector } from '../../../../../app/hooks';
import { useGetMyRoleQuery } from '../../../api/gameZoneApi';
import { useGameSocket } from '../../../hooks/useGameSocket';
import { MAX_CLUE_LENGTH } from '../constants/imposterConstants';

interface CluePhaseProps {
  sessionId: string;
}

export default function CluePhase({ sessionId }: CluePhaseProps) {
  const user = useAppSelector((s) => s.auth.user);
  const gameState = useAppSelector((s) => s.imposter.gameState);
  const currentClues = useAppSelector((s) => s.imposter.currentClues);
  const { socketRef } = useGameSocket(null);

  const { data: roleData } = useGetMyRoleQuery(sessionId);
  const [clue, setClue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const round = gameState?.currentRound;
  const isMyTurn = round?.currentTurnPlayerId === user?._id;
  const myStatus = gameState?.players.find((p: any) => p.userId === user?._id)?.status;
  const turnOrder = round?.turnOrder || [];
  const currentIndex = turnOrder.indexOf(round?.currentTurnPlayerId || '');
  const currentPlayerName = gameState?.players.find((p: any) => p.userId === round?.currentTurnPlayerId)?.userName || '...';

  const role = roleData?.data?.role;
  const secretWord = roleData?.data?.secretWord;
  const isImposter = role === 'imposter';

  const hasSubmitted = currentClues.some((c: any) => c.playerId === user?._id);

  async function handleSubmit() {
    const trimmed = clue.trim();
    if (!trimmed) { setError('Clue cannot be empty'); return; }
    if (trimmed.includes(' ')) { setError('Clue must be a single word'); return; }
    if (trimmed.length > MAX_CLUE_LENGTH) { setError(`Max ${MAX_CLUE_LENGTH} characters`); return; }

    setSubmitting(true);
    setError('');
    try {
      socketRef.current?.emit('game:submit_clue', { sessionId, clue: trimmed });
      setClue('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Secret word reminder */}
      {!isImposter && secretWord && (
        <div
          className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#059669' }}>Secret Word</p>
            <p className="text-xl font-black" style={{ color: '#059669', fontFamily: 'Outfit, sans-serif' }}>{secretWord}</p>
          </div>
          <span className="text-2xl">🔍</span>
        </div>
      )}

      {isImposter && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.15)' }}
        >
          <span className="text-xl">🎭</span>
          <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>
            You are the Imposter. Blend in with a convincing clue!
          </p>
        </div>
      )}

      {/* Turn indicator */}
      <div
        className="p-4 rounded-xl text-center"
        style={{
          background: isMyTurn ? 'rgba(124,58,237,0.1)' : 'var(--color-bg-subtle)',
          border: isMyTurn ? '1px solid rgba(124,58,237,0.25)' : '1px solid var(--color-border-default)',
        }}
      >
        {isMyTurn ? (
          <p className="text-sm font-bold" style={{ color: '#7C3AED' }}>
            🎤 It's your turn to give a clue!
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Waiting for <strong style={{ color: 'var(--color-text-primary)' }}>{currentPlayerName}</strong> to give their clue...
          </p>
        )}
        <div className="flex justify-center gap-1.5 mt-2">
          {turnOrder.map((uid: string, i: number) => (
            <div
              key={uid}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: i < currentIndex
                  ? '#10B981'
                  : i === currentIndex
                    ? '#7C3AED'
                    : 'var(--color-border-default)',
                transform: i === currentIndex ? 'scale(1.4)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Clue input */}
      {isMyTurn && !hasSubmitted && myStatus === 'active' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={clue}
              onChange={(e) => {
                setClue(e.target.value.replace(/\s/g, ''));
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              maxLength={MAX_CLUE_LENGTH}
              placeholder="Type your one-word clue..."
              className="flex-1 px-4 py-3 rounded-xl text-sm font-medium outline-none"
              style={{
                background: 'var(--color-bg-card)',
                border: error ? '1.5px solid #DC2626' : '1.5px solid rgba(124,58,237,0.3)',
                color: 'var(--color-text-primary)',
              }}
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !clue.trim()}
              className="px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50 transition-all"
              style={{ background: '#7C3AED' }}
            >
              <Send size={16} />
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {clue.length}/{MAX_CLUE_LENGTH} characters. Single word only.
          </p>
        </div>
      )}

      {/* Submitted clues so far */}
      {currentClues.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Clues so far ({currentClues.length}/{turnOrder.length})
          </h4>
          <div className="space-y-2">
            {currentClues.map((c: any, i: number) => (
              <div
                key={c.playerId}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)' }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }}
                >
                  {c.playerName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.playerName}</span>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                    {c.clue}
                  </p>
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-muted)' }}>#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
