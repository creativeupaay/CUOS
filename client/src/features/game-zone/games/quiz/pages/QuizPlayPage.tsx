import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useQuizSocket } from '../hooks/useQuizSocket';
import { setNextQuestionCountdown, setMyAnswer } from '../store/quizSlice';
import GameFullscreenWrapper from '../../../components/GameFullscreenWrapper';
import QuizQuestion from '../components/QuizQuestion';
import QuizQuestionResultView from '../components/QuizQuestionResult';
import QuizLiveLeaderboard from '../components/QuizLiveLeaderboard';
import QuizPlayerStatusPanel from '../components/QuizPlayerStatusPanel';
import QuizFinalResult from '../components/QuizFinalResult';
import QuizScoringInfo from '../components/QuizScoringInfo';
import { Loader2 } from 'lucide-react';
import type { QuizPublicState } from '../types/quiz.types';

interface QuizPlayPageProps {
  sessionId: string;
  initialState: QuizPublicState;
}

export default function QuizPlayPage({ sessionId, initialState }: QuizPlayPageProps) {
  const dispatch = useAppDispatch();
  const { submitAnswer } = useQuizSocket(sessionId);

  const {
    phase,
    config: stateConfig,
    currentQuestion,
    mySelectedOption,
    myAnswerLocked,
    answeredPlayerIds,
    players: statePlayers,
    questionResult,
    liveLeaderboard,
    finalResult,
    myUserId,
    nextQuestionCountdown,
  } = useAppSelector((state) => state.quiz);

  const config = stateConfig || initialState.config;
  const players = statePlayers.length > 0 ? statePlayers : initialState.players;

  // 1-Second Interval Ticker for 5s Next Question Countdown
  useEffect(() => {
    if (nextQuestionCountdown === null || nextQuestionCountdown <= 0) return;

    const timer = setInterval(() => {
      dispatch(setNextQuestionCountdown(nextQuestionCountdown - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [nextQuestionCountdown, dispatch]);

  const handleSelectOption = (optionIndex: number, submissionId: string) => {
    if (!currentQuestion || !sessionId) return;
    const roundId = currentQuestion.roundId || currentQuestion.questionId;
    dispatch(setMyAnswer({ option: optionIndex, submissionId }));
    submitAnswer(sessionId, roundId, optionIndex, submissionId);
  };

  const isGameOver = phase === 'GAME_OVER' || phase === 'FINAL_RESULT';

  // Compute final results fallback if needed
  const totalQ = config?.totalQuestions || 10;
  const finalResults = finalResult || liveLeaderboard.map((l) => {
    const correct = l.correctAnswers || 0;
    const wrong = Math.max(0, totalQ - correct);
    const acc = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    return {
      userId: l.userId,
      userName: l.userName,
      rank: l.rank,
      totalScore: l.totalScore,
      correctAnswers: correct,
      wrongAnswers: wrong,
      accuracy: acc,
      avgResponseTimeSec: 0,
    };
  });

  return (
    <GameFullscreenWrapper 
      className="theme-game theme-game-bg w-full min-h-[calc(100vh-var(--topbar-height))]"
      contentClassName="p-4 sm:p-6 max-w-7xl mx-auto w-full overflow-y-auto min-h-full flex flex-col"
    >
      {isGameOver ? (
        <div className="w-full flex-1 flex flex-col items-center justify-center py-4">
          <QuizFinalResult results={finalResults} myUserId={myUserId} />
        </div>
      ) : (
        <div className="w-full flex flex-col lg:flex-row gap-6 items-start flex-1 py-2 sm:py-4">
          
          {/* Main Area (Left) */}
          <div className="flex-1 w-full flex flex-col relative min-w-0">
            
            {/* Header Bar */}
            <div className="flex justify-between items-center mb-3 shrink-0">
              <div className="text-xs font-black text-slate-300 uppercase tracking-wider bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner flex items-center gap-2">
                <span>Topic:</span>
                <span className="text-cyan-300 font-extrabold">{config?.topic}</span>
              </div>
              <QuizScoringInfo />
            </div>

            {/* ACTIVE QUESTION PHASE */}
            {phase === 'QUESTION' && currentQuestion && (
              <div className="animate-fade-slide-up flex-1 flex flex-col justify-center">
                <QuizQuestion
                  question={currentQuestion}
                  timePerQuestion={config?.timePerQuestion || 20}
                  mySelectedOption={mySelectedOption}
                  myAnswerLocked={myAnswerLocked}
                  onSelectOption={handleSelectOption}
                />
              </div>
            )}

            {/* QUESTION RESULT / INTERMISSION PHASE */}
            {(phase === 'QUESTION_RESULT' || phase === 'INTERMISSION') && currentQuestion && questionResult && (
              <div className="animate-fade-slide-up flex-1 flex flex-col justify-center">
                <QuizQuestionResultView
                  question={currentQuestion}
                  result={questionResult}
                  mySelectedOption={mySelectedOption}
                  myUserId={myUserId}
                  nextQuestionCountdown={nextQuestionCountdown}
                />
              </div>
            )}

            {/* Loading Fallback if question state is initializing */}
            {!currentQuestion && phase === 'QUESTION' && (
              <div className="flex flex-col items-center justify-center p-12 game-glass-panel rounded-2xl text-center">
                <Loader2 className="w-10 h-10 animate-spin text-purple-400 mb-3" />
                <p className="text-slate-300 font-bold text-sm">Loading arena question...</p>
              </div>
            )}
          </div>

          {/* Right Sidebar (ALWAYS visible, fixed position) */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col gap-4 lg:pt-[44px]">
            {phase === 'QUESTION' && (
              <QuizPlayerStatusPanel
                players={players || []}
                answeredPlayerIds={answeredPlayerIds || []}
                totalPlayers={players?.filter(p => !p.isSpectator).length || 0}
              />
            )}
            
            <QuizLiveLeaderboard 
              leaderboard={liveLeaderboard || []} 
              myUserId={myUserId} 
              maxDisplay={8}
            />
          </div>

        </div>
      )}
    </GameFullscreenWrapper>
  );
}
