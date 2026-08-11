import { useQuizTimer } from '../hooks/useQuizTimer';

interface QuizTimerProps {
  endsAt: string | null;
  timePerQuestion: number;
  size?: 'normal' | 'large';
}

export default function QuizTimer({ endsAt, timePerQuestion, size = 'normal' }: QuizTimerProps) {
  const { secondsRemaining, progress, isUrgent } = useQuizTimer(endsAt, timePerQuestion);

  const isLarge = size === 'large';

  const circleSize = isLarge ? 90 : 64;
  const strokeWidth = isLarge ? 7 : 5;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * progress;

  // Colors: starts cyan, turns pink, then flashing red when urgent
  const timerColor = isUrgent ? '#ef4444' : progress > 0.5 ? '#ec4899' : '#06b6d4';
  const glowColor = isUrgent ? 'rgba(239, 68, 68, 0.4)' : progress > 0.5 ? 'rgba(236, 72, 153, 0.35)' : 'rgba(6, 182, 212, 0.35)';
  const bgColor = 'rgba(255,255,255,0.08)';

  return (
    <div
      className="flex flex-col items-center gap-1"
      role="timer"
      aria-label={`${secondsRemaining} seconds remaining`}
    >
      {/* Circular progress container with perfectly circular CSS shadow (NO square SVG bounding box artifacts) */}
      <div 
        className="relative flex items-center justify-center bg-black/50 rounded-full border border-white/15 transition-all duration-300"
        style={{ 
          width: circleSize, 
          height: circleSize,
          boxShadow: `0 0 16px ${glowColor}`
        }}
      >
        <svg
          width={circleSize}
          height={circleSize}
          style={{ transform: 'rotate(-90deg)' }}
          className="relative z-10 block"
        >
          {/* Background circle */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="transparent"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle without SVG filter drop-shadow to eliminate square clipping box */}
          <circle
            cx={circleSize / 2}
            cy={circleSize / 2}
            r={radius}
            fill="none"
            stroke={timerColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 0.2s linear, stroke 0.3s ease',
            }}
          />
        </svg>

        {/* Number in center */}
        <div
          className="absolute flex flex-col items-center z-20 pointer-events-none"
          style={{
            color: timerColor,
            transition: 'color 0.3s ease',
          }}
        >
          <span
            className={`font-black tabular-nums leading-none tracking-tighter ${isLarge ? 'text-3xl' : 'text-xl'}`}
            style={{
              animation: isUrgent ? 'urgent-pulse 0.5s ease-in-out infinite' : 'none',
            }}
          >
            {secondsRemaining}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes urgent-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
