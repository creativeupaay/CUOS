import { useNavigate } from 'react-router-dom';
import type { WordleFinalResultPayload } from '../types/wordle.types';

const ACCENT = '#059669';

interface WordleFinalResultProps {
  result: WordleFinalResultPayload;
  myUserId: string;
}

export default function WordleFinalResult({ result, myUserId }: WordleFinalResultProps) {
  const navigate = useNavigate();
  const iWon = result.winnerId === myUserId;
  const isDraw = !result.winnerId;

  // Deduplicate in case of DB race conditions
  const uniqueRankings = [];
  const seen = new Set();
  for (const r of result.rankings) {
    if (!seen.has(r.userId)) {
      seen.add(r.userId);
      uniqueRankings.push(r);
    }
  }

  return (
    <div className="modal-overlay-high">
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--color-bg-surface)',
          borderRadius: 24,
          border: `1px solid rgba(5,150,105,0.3)`,
          overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center', background: 'var(--color-bg-subtle)' }}>
          <div style={{ fontSize: 40, marginBottom: 8, animation: 'wordleBounce 2s infinite' }}>
            {isDraw ? '🤝' : iWon ? '🏆' : '🎮'}
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>
            {isDraw ? "It's a Draw!" : iWon ? 'You Won!' : 'Game Over'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', fontFamily: 'Outfit, sans-serif' }}>
            {isDraw 
              ? 'Well played, everybody tied! 🔤' 
              : iWon 
                ? 'Congratulations, Word Master! 🔤' 
                : `Winner: ${result.winnerName}`}
          </p>
        </div>

        {/* Rankings */}
        <div style={{ padding: 16, maxHeight: 320, overflowY: 'auto' }}>
          {uniqueRankings.map((entry) => {
            const isMe = entry.userId === myUserId;
            const rankEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
            return (
              <div
                key={entry.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  marginBottom: 6,
                  background: isMe ? `${ACCENT}15` : 'var(--color-bg-subtle)',
                  border: isMe ? `1px solid ${ACCENT}30` : '1px solid var(--color-border-default)',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{rankEmoji}</span>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}88)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {entry.userName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {entry.userName}
                    {isMe && <span style={{ fontSize: 10, color: ACCENT, fontWeight: 600 }}>You</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {entry.roundsSolved}/{entry.roundsPlayed} rounds solved
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: ACCENT, fontFamily: 'Outfit, sans-serif' }}>
                    {entry.totalScore}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>pts</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border-default)', display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate('/games/wordle')}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}, #047857)`,
              color: '#fff',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Play Again
          </button>
          <button
            onClick={() => navigate('/leaderboard')}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background: 'var(--color-bg-subtle)',
              color: 'var(--color-text-primary)',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              border: '1px solid var(--color-border-default)',
              cursor: 'pointer',
            }}
          >
            Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
