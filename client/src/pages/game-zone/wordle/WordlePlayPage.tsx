import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { useGetWordleSessionQuery, useGetMyWordleGuessesQuery } from '@/features/game-zone/api/wordleApi';
import { useWordleSocket } from '@/features/game-zone/games/wordle/hooks/useWordleSocket';
import { useWordleKeyboard } from '@/features/game-zone/games/wordle/hooks/useWordleKeyboard';
import { useKeyboardStatus } from '@/features/game-zone/games/wordle/hooks/useWordleGame';
import {
  initWordleSession,
  restoreMyGuesses,
  setError,
  setToast,
  clearShake,
} from '@/features/game-zone/games/wordle/store/wordleSlice';
import WordleBoard from '@/features/game-zone/games/wordle/components/WordleBoard';
import WordleKeyboard from '@/features/game-zone/games/wordle/components/WordleKeyboard';
import WordleRoundHeader from '@/features/game-zone/games/wordle/components/WordleRoundHeader';
import WordlePlayerProgress from '@/features/game-zone/games/wordle/components/WordlePlayerProgress';
import WordleCountdown from '@/features/game-zone/games/wordle/components/WordleCountdown';
import WordleRoundResult from '@/features/game-zone/games/wordle/components/WordleRoundResult';
import WordleFinalResult from '@/features/game-zone/games/wordle/components/WordleFinalResult';
import { LogOut } from 'lucide-react';

const ACCENT = '#059669';

export default function WordlePlayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const wordle = useAppSelector((s) => s.wordle);

  const [nextRoundStartsAt, setNextRoundStartsAt] = useState<string | null>(null);

  const { data } = useGetWordleSessionQuery(gameId!, { pollingInterval: 10000, skip: !gameId });
  const { socketRef } = useWordleSocket(gameId || null);

  // Fetch my guesses on reconnect (when round is already in progress)
  const { data: myGuessesData } = useGetMyWordleGuessesQuery(
    { sessionId: gameId!, roundNumber: wordle.currentRound },
    { skip: !gameId || wordle.currentRound === 0 }
  );

  const gameState = data?.data;
  const myPlayer = gameState?.players.find((p) => p.userId === user?._id);
  const isSpectator = myPlayer?.isSpectator || false;

  // Determine if I can still guess
  const myProgress = wordle.playerProgress.find((p) => p.userId === user?._id);
  const iFinished = myProgress?.status !== 'playing' && myProgress?.status !== undefined;
  const canGuess = wordle.phase === 'PLAYING' && !isSpectator && !iFinished;

  // Init session state
  useEffect(() => {
    if (gameState && gameId) {
      dispatch(initWordleSession({ sessionId: gameId, gameState }));
    }
  }, [gameState, gameId, dispatch]);

  // Restore guesses on reconnect
  useEffect(() => {
    if (myGuessesData?.data) {
      dispatch(restoreMyGuesses(myGuessesData.data));
    }
  }, [myGuessesData]);

  // Redirect if still in lobby
  useEffect(() => {
    if (gameState?.phase === 'LOBBY') {
      navigate(`/games/wordle/${gameId}/lobby`, { replace: true });
    }
  }, [gameState?.phase]);

  // Listen for next round countdown
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = (payload: any) => setNextRoundStartsAt(payload.startsAt);
    socket.on('wordle:next_round_countdown', handler);
    return () => { socket.off('wordle:next_round_countdown', handler); };
  }, [socketRef.current]);

  // Clear countdown when next round starts
  useEffect(() => {
    if (wordle.phase === 'PLAYING') setNextRoundStartsAt(null);
  }, [wordle.phase]);

  // Toast auto-clear
  useEffect(() => {
    if (wordle.toastMessage) {
      const t = setTimeout(() => dispatch(setToast(null)), 3500);
      return () => clearTimeout(t);
    }
  }, [wordle.toastMessage, dispatch]);

  // Shake auto-clear
  useEffect(() => {
    if (wordle.shakeRow) {
      const t = setTimeout(() => dispatch(clearShake()), 600);
      return () => clearTimeout(t);
    }
  }, [wordle.shakeRow]);

  // Submit guess handler
  const handleSubmit = useCallback(async (guess: string) => {
    if (!gameId || !canGuess) return;
    try {
      // Submit via socket (immediate UX) — server responds via wordle:guess_result private event
      socketRef.current?.emit('wordle:submit_guess', { sessionId: gameId, guess });
    } catch (err: any) {
      dispatch(setError(err?.data?.message || 'Failed to submit guess'));
    }
  }, [gameId, canGuess, socketRef, dispatch]);

  const { handleKey } = useWordleKeyboard(handleSubmit, !canGuess);
  const keyStatuses = useKeyboardStatus(wordle.myGuesses);

  if (!gameState) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${ACCENT}18`, animation: 'pulse 1.5s infinite', margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <>
      {/* Global Wordle CSS animations */}
      <style>{`
        @keyframes wordleShake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-6px); }
          30%, 70% { transform: translateX(6px); }
        }
        @keyframes wordlePop {
          0% { transform: scale(1); }
          50% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes wordleBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* Countdown overlay */}
      {nextRoundStartsAt && wordle.phase !== 'ROUND_RESULT' && (
        <WordleCountdown
          startsAt={nextRoundStartsAt}
          roundNumber={(wordle.currentRound || 0) + 1}
          onComplete={() => setNextRoundStartsAt(null)}
        />
      )}

      {/* Round result overlay */}
      {wordle.phase === 'ROUND_RESULT' && wordle.lastRoundResult && (
        <WordleRoundResult
          result={wordle.lastRoundResult}
          myUserId={user?._id || ''}
          nextRoundStartsAt={nextRoundStartsAt}
        />
      )}

      {/* Final game result */}
      {wordle.phase === 'GAME_OVER' && wordle.finalResult && (
        <WordleFinalResult
          result={wordle.finalResult}
          myUserId={user?._id || ''}
        />
      )}

      {/* Main game layout */}
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Round header */}
        <WordleRoundHeader
          roundNumber={wordle.currentRound || 1}
          totalRounds={wordle.totalRounds || gameState.config.totalRounds}
          endsAt={wordle.roundEndsAt}
          isConnected={wordle.isConnected}
          phase={wordle.phase}
        />

        {/* Toast */}
        {wordle.toastMessage && (
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              background: `${ACCENT}18`,
              border: `1px solid ${ACCENT}35`,
              color: ACCENT,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
              textAlign: 'center',
              animation: 'wordlePop 0.3s ease',
            }}
          >
            {wordle.toastMessage}
          </div>
        )}

        {/* Error */}
        {wordle.error && (
          <div
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#EF4444',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Outfit, sans-serif',
              textAlign: 'center',
            }}
          >
            {wordle.error}
          </div>
        )}

        {/* Main content: Board + Sidebar */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Board + Keyboard */}
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* Status badge when finished */}
            {iFinished && myProgress?.status === 'solved' && (
              <div
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: `${ACCENT}18`,
                  border: `1px solid ${ACCENT}35`,
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                ✅ Solved! Waiting for others…
              </div>
            )}
            {iFinished && myProgress?.status !== 'solved' && (
              <div
                style={{
                  padding: '6px 16px',
                  borderRadius: 20,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#EF4444',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                ⏰ Time's up! Waiting for others…
              </div>
            )}
            {isSpectator && (
              <div style={{ padding: '6px 16px', borderRadius: 20, background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)', fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'Outfit, sans-serif' }}>
                👁 Spectating
              </div>
            )}

            <WordleBoard
              guesses={wordle.myGuesses}
              currentInput={wordle.currentInput}
              isShaking={wordle.shakeRow}
              isGameOver={iFinished || isSpectator}
            />

            {!isSpectator && (
              <WordleKeyboard
                keyStatuses={keyStatuses}
                onKey={handleKey}
                disabled={!canGuess}
              />
            )}
          </div>

          {/* Sidebar: Player progress */}
          <div style={{ flex: '0 1 220px', minWidth: 180 }}>
            <WordlePlayerProgress
              players={wordle.playerProgress}
              myUserId={user?._id || ''}
            />

            {/* Score display */}
            {myPlayer && (
              <div
                style={{
                  marginTop: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border-default)',
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>
                  My Score
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: ACCENT, fontFamily: 'Outfit, sans-serif' }}>
                  {myPlayer.totalScore}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>points</div>
              </div>
            )}

            {/* Leave button */}
            <button
              onClick={() => {
                socketRef.current?.emit('wordle:leave_room', { sessionId: gameId });
                navigate('/games/wordle');
              }}
              style={{
                marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'rgba(239,68,68,0.07)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)',
                fontSize: 12, fontWeight: 600, fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
              }}
            >
              <LogOut size={12} /> Leave
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
