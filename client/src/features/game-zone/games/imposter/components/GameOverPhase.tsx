import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface GameOverPhaseProps {
  sessionId: string;
  gameId: string;
}

export default function GameOverPhase({ gameId }: GameOverPhaseProps) {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(`/games/imposter/${gameId}/result`, { replace: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [gameId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-5xl mb-4 animate-bounce">🏁</span>
      <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
        Game Over!
      </h2>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Calculating final scores...
      </p>
    </div>
  );
}
