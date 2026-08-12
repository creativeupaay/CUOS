import type { WordlePlayerProgress } from '../types/wordle.types';
import { CheckCircle2, XCircle } from 'lucide-react';

const ACCENT = '#059669';

interface WordlePlayerProgressProps {
  players: WordlePlayerProgress[];
  myUserId: string;
  maxGuesses?: number;
}

const statusIcon = (status: WordlePlayerProgress['status'], guessCount: number) => {
  switch (status) {
    case 'solved':
      return <CheckCircle2 size={14} style={{ color: '#10B981', flexShrink: 0 }} />;
    case 'failed':
    case 'timed_out':
      return <XCircle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />;
    default:
      return (
        <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {guessCount}/6
        </span>
      );
  }
};

export default function WordlePlayerProgress({ players, myUserId, maxGuesses = 6 }: WordlePlayerProgressProps) {
  const sorted = [...players].sort((a, b) => {
    if (a.status === 'solved' && b.status !== 'solved') return -1;
    if (b.status === 'solved' && a.status !== 'solved') return 1;
    if (a.status === 'solved' && b.status === 'solved') return a.guessCount - b.guessCount;
    return 0;
  });

  return (
    <div
      style={{
        borderRadius: 12,
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-default)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border-default)',
          background: 'var(--color-bg-subtle)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          fontFamily: 'Outfit, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Player Progress
      </div>
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sorted.map((player) => {
          const isMe = player.userId === myUserId;
          return (
            <div
              key={player.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                borderRadius: 8,
                background: isMe ? `${ACCENT}12` : 'transparent',
                border: isMe ? `1px solid ${ACCENT}25` : '1px solid transparent',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}99)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {player.userName.charAt(0).toUpperCase()}
              </div>

              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'Outfit, sans-serif',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {player.userName}
                {isMe && (
                  <span style={{ marginLeft: 4, fontSize: 10, color: ACCENT, fontWeight: 500 }}>You</span>
                )}
              </span>

              {/* Mini guess dots */}
              <div style={{ display: 'flex', gap: 2 }}>
                {Array.from({ length: maxGuesses }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: i < player.guessCount
                        ? player.status === 'solved' ? ACCENT : player.status === 'failed' || player.status === 'timed_out' ? '#EF4444' : ACCENT
                        : 'rgba(255,255,255,0.12)',
                    }}
                  />
                ))}
              </div>

              {statusIcon(player.status, player.guessCount)}
            </div>
          );
        })}
        {players.length === 0 && (
          <p style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
            No players yet
          </p>
        )}
      </div>
    </div>
  );
}
