import { useAppSelector } from '@/app/hooks';
import QuizLobby from '../components/QuizLobby';
import { useQuizSocket } from '../hooks/useQuizSocket';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { QuizPublicState } from '../types/quiz.types';
import GameFullscreenWrapper from '../../../components/GameFullscreenWrapper';

interface QuizLobbyPageProps {
  sessionId: string;
  initialState: QuizPublicState;
}

export default function QuizLobbyPage({ sessionId, initialState }: QuizLobbyPageProps) {
  const navigate = useNavigate();
  const { setReady, startGame, leaveRoom } = useQuizSocket(sessionId);
  const quizState = useAppSelector((state) => state.quiz);

  if (!quizState.isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-12 h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
        <p className="text-[var(--color-text-secondary)] font-medium">Connecting to Quiz Server...</p>
      </div>
    );
  }

  // Generate a mock state from the redux slice state to match QuizLobby's expected props
  // Key fix: use quizState.preparationStatus only if it has been updated by socket (totalRequired > 0)
  // Otherwise fall back to the HTTP-fetched initialState values
  const hasSocketPreparationData = quizState.preparationStatus.totalRequired > 0;
  const preparationStatus = hasSocketPreparationData
    ? quizState.preparationStatus
    : initialState.preparationStatus;

  const publicState = {
    sessionId: quizState.sessionId || initialState.sessionId,
    gameType: 'quiz' as const,
    hostUserId: quizState.players.find((p) => p.isHost)?.userId || initialState.hostUserId || '',
    status: 'lobby' as any,
    phase: quizState.phase || initialState.phase,
    config: quizState.config || initialState.config,
    players: quizState.players.length > 0 ? quizState.players : initialState.players,
    preparationStatus,
    currentQuestion: quizState.currentQuestion || initialState.currentQuestion,
    answeredUserIds: quizState.answeredPlayerIds || initialState.answeredUserIds,
    liveLeaderboard: quizState.liveLeaderboard.length > 0 ? quizState.liveLeaderboard : initialState.liveLeaderboard,
    createdAt: new Date().toISOString(),
  };

  const handleLeave = () => {
    leaveRoom(sessionId);
    navigate('/games');
  };

  return (
    <GameFullscreenWrapper 
      className="theme-game theme-game-bg min-h-[calc(100vh-var(--topbar-height))] w-full"
      contentClassName="flex flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="w-full h-full my-auto">
        <QuizLobby
          state={publicState}
          myUserId={quizState.myUserId}
          onSetReady={(isReady) => setReady(sessionId, isReady)}
          onStartGame={() => startGame(sessionId)}
          onLeave={handleLeave}
        />
      </div>
    </GameFullscreenWrapper>
  );
}
