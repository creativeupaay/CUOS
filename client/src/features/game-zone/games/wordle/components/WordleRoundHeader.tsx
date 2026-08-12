import WordleTimer from './WordleTimer';
import { Wifi, WifiOff } from 'lucide-react';

const ACCENT = '#059669';

interface WordleRoundHeaderProps {
  roundNumber: number;
  totalRounds: number;
  endsAt: string | null;
  isConnected: boolean;
  phase: string;
}

export default function WordleRoundHeader({
  roundNumber,
  totalRounds,
  endsAt,
  isConnected,
  phase,
}: WordleRoundHeaderProps) {
  const dots = Array.from({ length: totalRounds }, (_, i) => (
    <div
      key={i}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: i + 1 === roundNumber
          ? ACCENT
          : i + 1 < roundNumber
          ? `${ACCENT}55`
          : 'var(--color-border-default)',
        transition: 'background 0.3s',
      }}
    />
  ));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderRadius: 14,
        background: 'linear-gradient(135deg, rgba(5,150,105,0.1), rgba(5,150,105,0.03))',
        border: `1px solid rgba(5,150,105,0.2)`,
        marginBottom: 4,
      }}
    >
      {/* Left: round info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: 'Outfit, sans-serif' }}>
            Round {roundNumber}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>of {totalRounds}</span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {dots}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
          Guess the 5-letter word!
        </div>
      </div>

      {/* Right: timer + connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {phase === 'PLAYING' && <WordleTimer endsAt={endsAt} />}
        {isConnected
          ? <Wifi size={14} style={{ color: '#10B981' }} />
          : <WifiOff size={14} style={{ color: 'var(--color-text-muted)' }} />
        }
      </div>
    </div>
  );
}
