import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { io, Socket } from 'socket.io-client';
import {
  setSocketConnected,
  roundStarted,
  addMyGuess,
  updatePlayerProgress,
  roundEnded,
  gameCompleted,
  setPhase,
  setError,
  setToast,
} from '../store/wordleSlice';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8000';

// Share the same socket instance across hooks to avoid duplicate connections
let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getOrCreateSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return sharedSocket;
}

/**
 * useWordleSocket — manages Socket.IO connection for the Wordle game.
 *
 * Uses the same shared socket pattern as useGameSocket but with `wordle:` events.
 * Dispatches all server events to the Wordle Redux slice.
 * The word is NEVER included in room-broadcast events — only in private socket events.
 */
export function useWordleSocket(sessionId: string | null) {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const joinRoom = useCallback((sid: string) => {
    const socket = socketRef.current;
    if (!socket || !sid) return;
    socket.emit('wordle:join_room', { sessionId: sid });
  }, []);

  const leaveRoom = useCallback((sid: string) => {
    const socket = socketRef.current;
    if (!socket || !sid) return;
    socket.emit('wordle:leave_room', { sessionId: sid });
  }, []);

  useEffect(() => {
    const socket = getOrCreateSocket();
    socketRef.current = socket;
    socketRefCount++;

    dispatch(setSocketConnected(socket.connected));

    const onConnect = () => {
      dispatch(setSocketConnected(true));
      if (sessionIdRef.current) {
        socket.emit('wordle:join_room', { sessionId: sessionIdRef.current });
      }
    };

    const onDisconnect = () => dispatch(setSocketConnected(false));

    // ─── Wordle-specific events ────────────────────────────────────────────

    const onRoundStarted = (payload: any) => {
      dispatch(roundStarted({
        roundNumber: payload.roundNumber,
        totalRounds: payload.totalRounds,
        startedAt: payload.startedAt,
        endsAt: payload.endsAt,
        players: payload.players || [],
      }));
    };

    // This event is PRIVATE — only the submitting player receives it
    const onGuessResult = (payload: any) => {
      dispatch(addMyGuess({
        guess: payload.guess,
        feedback: payload.feedback,
        guessNumber: payload.guessNumber,
        isCorrect: payload.isCorrect,
      }));
      if (payload.isCorrect) {
        dispatch(setToast(`✅ Solved in ${payload.guessNumber} guess${payload.guessNumber > 1 ? 'es' : ''}! +${payload.roundScore ?? 0} pts`));
      }
    };

    // This event is BROADCAST — safe info only (guess count, solved status)
    const onPlayerProgress = (payload: any) => {
      dispatch(updatePlayerProgress(payload.playerProgress));
    };

    const onRoundEnded = (payload: any) => {
      dispatch(roundEnded(payload));
    };

    const onGameCompleted = (payload: any) => {
      dispatch(gameCompleted(payload));
    };

    const onGameStarted = (payload: any) => {
      dispatch(setPhase('ROUND_START'));
      dispatch(setToast(`🎮 Game starting! ${payload.totalRounds} rounds.`));
    };

    const onGameEnded = () => {
      dispatch(setPhase('GAME_OVER'));
    };

    const onError = (payload: any) => {
      dispatch(setError(payload.message || 'A game error occurred'));
    };

    // Attach listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('wordle:round_started', onRoundStarted);
    socket.on('wordle:guess_result', onGuessResult);
    socket.on('wordle:player_progress', onPlayerProgress);
    socket.on('wordle:round_ended', onRoundEnded);
    socket.on('wordle:game_completed', onGameCompleted);
    socket.on('wordle:game_started', onGameStarted);
    socket.on('wordle:game_ended', onGameEnded);
    socket.on('wordle:error', onError);

    if (!socket.connected) {
      socket.connect();
    } else {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('wordle:round_started', onRoundStarted);
      socket.off('wordle:guess_result', onGuessResult);
      socket.off('wordle:player_progress', onPlayerProgress);
      socket.off('wordle:round_ended', onRoundEnded);
      socket.off('wordle:game_completed', onGameCompleted);
      socket.off('wordle:game_started', onGameStarted);
      socket.off('wordle:game_ended', onGameEnded);
      socket.off('wordle:error', onError);

      socketRefCount--;
      // Don't disconnect — notification system shares this socket
    };
  }, []);

  return { socketRef, joinRoom, leaveRoom };
}
