import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGetQuizSessionQuery, useJoinQuizSessionMutation } from '../api/quizApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setMyUserId, resetQuiz } from '../store/quizSlice';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/atoms/Button';

import QuizLobbyPage from './QuizLobbyPage';
import QuizPlayPage from './QuizPlayPage';

export default function QuizDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const quizState = useAppSelector((state) => state.quiz);

  // Fetch initial HTTP state to check existence and allow quick join
  const { data: sessionResponse, isLoading, error } = useGetQuizSessionQuery(sessionId!, {
    skip: !sessionId,
  });

  const [joinSession, { isLoading: isJoining }] = useJoinQuizSessionMutation();

  // Reset slice and set current user on mount
  useEffect(() => {
    dispatch(resetQuiz());
    if (user?._id) {
      dispatch(setMyUserId(user._id));
    }
    
    return () => {
      dispatch(resetQuiz());
    };
  }, [dispatch, user?._id, sessionId]);

  // Auto-join logic if not already in the session slice
  useEffect(() => {
    if (
      !sessionId || 
      !user?._id || 
      !sessionResponse?.data || 
      quizState.sessionId === sessionId ||
      sessionResponse.data.status === 'cancelled' ||
      sessionResponse.data.status === 'finished'
    ) return;

    const autoJoin = async () => {
      try {
        await joinSession(sessionId).unwrap();
        // Redux slice will be hydrated by socket events
      } catch (err: any) {
        console.error('Failed to join quiz session:', err);
      }
    };

    autoJoin();
  }, [sessionId, user?._id, sessionResponse, quizState.sessionId, joinSession]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
        <p className="text-[var(--color-text-secondary)] font-medium">Loading quiz session...</p>
      </div>
    );
  }

  if (error || !sessionResponse?.success || sessionResponse.data.status === 'cancelled' || sessionResponse.data.status === 'finished') {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-red-50 border border-red-200 rounded-xl flex flex-col items-center text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-700 mb-2">Quiz Not Found</h2>
        <p className="text-red-600 mb-6">
          This quiz session doesn't exist or has already been completed.
        </p>
        <Button onClick={() => navigate('/games')} variant="danger">
          Back to Game Zone
        </Button>
      </div>
    );
  }

  const phase = quizState.phase || sessionResponse.data.phase;
  
  if (isJoining && !quizState.sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
        <p className="text-[var(--color-text-secondary)] font-medium">Joining game...</p>
      </div>
    );
  }

  // Route to the appropriate view based on game phase
  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {(phase === 'LOBBY' || phase === 'PREPARING' || phase === 'READY') ? (
        <QuizLobbyPage sessionId={sessionId!} initialState={sessionResponse.data} />
      ) : (
        <QuizPlayPage sessionId={sessionId!} initialState={sessionResponse.data} />
      )}
    </div>
  );
}
