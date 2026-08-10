import { useState, useEffect } from 'react';

interface WordleCountdownProps {
  startsAt: string | null;
  roundNumber: number;
  onComplete?: () => void;
}

/**
 * Full-screen overlay countdown before the next round begins.
 */
export default function WordleCountdown({ startsAt, roundNumber, onComplete }: WordleCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!startsAt) return;
    const target = new Date(startsAt).getTime();

    const tick = () => {
      const diff = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setRemaining(diff);
      if (diff === 0) onComplete?.();
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [startsAt, onComplete]);

  if (!startsAt || remaining === null || remaining === 0) return null;

  return (
    <div className="modal-overlay-high" style={{ flexDirection: 'column', gap: 16 }}>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, fontFamily: 'Outfit, sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>
        Round {roundNumber} starting in
      </p>
      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          color: '#059669',
          fontFamily: 'Outfit, sans-serif',
          lineHeight: 1,
          textShadow: '0 0 40px rgba(5,150,105,0.6)',
          animation: 'wordlePop 0.3s ease',
        }}
      >
        {remaining}
      </div>
      <p style={{ color: 'var(--color-text-muted)', opacity: 0.8, fontSize: 12, fontFamily: 'Outfit, sans-serif' }}>
        Get ready!
      </p>
    </div>
  );
}
