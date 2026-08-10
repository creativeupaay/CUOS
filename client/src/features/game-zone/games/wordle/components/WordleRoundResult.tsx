import { useState, useEffect } from 'react';
import type { WordleRoundResultPayload } from '../types/wordle.types';

const ACCENT = '#059669';

interface WordleRoundResultProps {
  result: WordleRoundResultPayload;
  myUserId: string;
  nextRoundStartsAt?: string | null;
}

export default function WordleRoundResult({ result, myUserId, nextRoundStartsAt }: WordleRoundResultProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!nextRoundStartsAt) return;
    const target = new Date(nextRoundStartsAt).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRemaining(diff);
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [nextRoundStartsAt]);

  // Deduplicate in case of DB race conditions
  const uniqueResults = [];
  const seen = new Set();
  for (const p of result.playerResults) {
    if (!seen.has(p.userId)) {
      seen.add(p.userId);
      uniqueResults.push(p);
    }
  }

  const sorted = [...uniqueResults].sort((a, b) => b.roundScore - a.roundScore);

  return (
    <div className="modal-overlay">
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--color-bg-surface)',
          borderRadius: 20,
          border: `1px solid rgba(5,150,105,0.25)`,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            background: 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(5,150,105,0.05))',
            borderBottom: '1px solid rgba(5,150,105,0.15)',
          }}
        >
          <p style={{ fontSize: 11, color: ACCENT, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: 'Outfit, sans-serif' }}>
            Round {result.roundNumber} of {result.totalRounds}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🔤</span>
            <div>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'Outfit, sans-serif' }}>The word was</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: 4, textTransform: 'uppercase', textShadow: `0 0 20px ${ACCENT}40` }}>
                {result.targetWord}
              </p>
            </div>
          </div>
        </div>

        {/* Player results */}
        <div style={{ padding: '12px 16px', maxHeight: 300, overflowY: 'auto' }}>
          {sorted.map((player, i) => {
            const isMe = player.userId === myUserId;
            const solved = player.status === 'solved';
            return (
              <div
                key={player.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  marginBottom: 4,
                  background: isMe ? `${ACCENT}12` : 'transparent',
                  border: isMe ? `1px solid ${ACCENT}25` : '1px solid transparent',
                }}
              >
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}88)`,
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
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                    {player.userName}{isMe && <span style={{ marginLeft: 4, color: ACCENT, fontSize: 10 }}>You</span>}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {solved ? `Solved in ${player.guessCount} guess${player.guessCount > 1 ? 'es' : ''}` : 'Did not solve'}
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: player.roundScore > 0 ? ACCENT : 'var(--color-text-muted)', fontFamily: 'Outfit, sans-serif' }}>
                  +{player.roundScore}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!result.isLastRound && nextRoundStartsAt && (
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--color-border-default)',
              textAlign: 'center',
              fontSize: 13,
              color: ACCENT,
              fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {remaining !== null && remaining > 0 
              ? `Next round in ${remaining}s...` 
              : 'Next round starting now...'}
          </div>
        )}
        {result.isLastRound && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border-default)', textAlign: 'center', fontSize: 13, color: ACCENT, fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            🏁 Final round complete! Calculating results…
          </div>
        )}
      </div>
    </div>
  );
}
