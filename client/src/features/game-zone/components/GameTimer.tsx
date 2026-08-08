import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface GameTimerProps {
  endsAt: string | null;
  onExpire?: () => void;
  className?: string;
  showIcon?: boolean;
  urgent?: boolean; // turns red at ≤10s
}

/**
 * GameTimer — counts down to a server-provided `phaseEndsAt` timestamp.
 * Does NOT control game transitions — that is the server's job.
 * This is purely a UI display component.
 */
export default function GameTimer({ endsAt, onExpire, className = '', showIcon = true, urgent = true }: GameTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }

    const target = new Date(endsAt).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setRemaining(diff);
      if (diff === 0) {
        onExpire?.();
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  if (!endsAt) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;
  const isUrgent = urgent && remaining <= 10 && remaining > 0;

  return (
    <div
      className={`flex items-center gap-1.5 font-mono font-bold tabular-nums ${className}`}
      style={{
        color: isUrgent ? 'var(--color-danger)' : 'var(--color-text-primary)',
        transition: 'color 0.3s',
      }}
    >
      {showIcon && <Clock size={14} className={isUrgent ? 'animate-pulse' : ''} />}
      <span>{display}</span>
    </div>
  );
}
