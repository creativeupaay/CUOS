import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import WordleFinalResult from '@/features/game-zone/games/wordle/components/WordleFinalResult';

/**
 * WordleResultPage — shown after game completes.
 * Reads final result from Redux slice (set by socket event wordle:game_completed).
 * If navigated to directly without socket data, redirects to the games page.
 */
export default function WordleResultPage() {
  const navigate = useNavigate();
  const wordle = useAppSelector((s) => s.wordle);
  const user = useAppSelector((s) => s.auth.user);

  if (!wordle.finalResult) {
    navigate('/games/wordle', { replace: true });
    return null;
  }

  return (
    <WordleFinalResult
      result={wordle.finalResult}
      myUserId={user?._id || ''}
    />
  );
}
