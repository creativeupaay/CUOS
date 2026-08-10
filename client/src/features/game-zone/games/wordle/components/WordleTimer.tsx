import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface WordleTimerProps {
  endsAt: string | null;
  onExpire?: () => void;
  className?: string;
}

/**
 * Wordle round countdown timer.
 * Drives from server-provided endsAt timestamp — no local timer drift.
 * Turns red and pulses in the last 30 seconds.
 */
export default function WordleTimer({ endsAt, onExpire, className = '' }: WordleTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) { setRemaining(0); return; }
    const target = new Date(endsAt).getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setRemaining(diff);
      if (diff === 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  if (!endsAt) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;
  const isUrgent = remaining <= 30 && remaining > 0;
  const isCritical = remaining <= 10 && remaining > 0;

  return (
    <div
      className={`flex items-center gap-1.5 font-mono font-bold tabular-nums ${className}`}
      style={{
        color: isCritical ? '#EF4444' : isUrgent ? '#F59E0B' : '#10B981',
        transition: 'color 0.5s',
        fontSize: '1.1rem',
      }}
    >
      <Clock size={15} className={isCritical ? 'animate-pulse' : ''} />
      <span>{display}</span>
    </div>
  );
}
