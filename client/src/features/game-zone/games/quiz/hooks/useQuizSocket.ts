import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { io, Socket } from 'socket.io-client';
import {
  setSocketConnected,
  initQuizSession,
  setPhase,
  playerJoined,
  playerLeft,
  playerReadyUpdated,
  setPreparationStatus,
  questionStarted,
  lockMyAnswer,
  playerAnswered,
  questionEnded,
  setNextQuestionCountdown,
  gameCompleted,
  setError,
} from '../store/quizSlice';
import type {
  QuizCurrentQuestion,
  QuizQuestionResult,
  QuizPreparationStatus,
  QuizPublicPlayer,
  QuizPublicState,
} from '../types/quiz.types';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8000';

// Shared socket singleton — same as other game hooks
let sharedSocket: Socket | null = null;

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
 * useQuizSocket — manages the Socket.IO connection for the Quiz game.
 *
 * - Completely isolated from Imposter (game:) and Wordle (wordle:) sockets
 * - Uses the shared socket singleton to avoid duplicate connections
 * - Handles all quiz: events and dispatches to quizSlice
 * - Auto-reconnects: re-emits quiz:join_room on reconnect
 */
export function useQuizSocket(sessionId: string | null) {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const joinRoom = useCallback((sid: string) => {
    const socket = socketRef.current;
    if (!socket || !sid) return;
    socket.emit('quiz:join_room', { sessionId: sid });
  }, []);

  const leaveRoom = useCallback((sid: string) => {
    const socket = socketRef.current;
    if (!socket || !sid) return;
    socket.emit('quiz:leave_room', { sessionId: sid });
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const socket = getOrCreateSocket();
    socketRef.current = socket;

    // ─── Connection ─────────────────────────────────────────────────────────

    const onConnect = () => {
      dispatch(setSocketConnected(true));
      // Reconnect: re-join the room to restore state
      const sid = sessionIdRef.current;
      if (sid) {
        socket.emit('quiz:join_room', { sessionId: sid });
      }
    };

    const onDisconnect = () => {
      dispatch(setSocketConnected(false));
    };

    // ─── Session Events ──────────────────────────────────────────────────────

    const onJoined = (data: {
      sessionId: string;
      isSpectator: boolean;
      phase: string;
      currentState: QuizPublicState;
    }) => {
      dispatch(initQuizSession({
        sessionId: data.sessionId,
        gameState: data.currentState,
      }));
    };

    const onPlayerJoined = (data: { player: QuizPublicPlayer; isSpectator: boolean; sessionId: string }) => {
      dispatch(playerJoined(data.player as QuizPublicPlayer & { isSpectator: boolean }));
    };

    const onPlayerLeft = (data: { playerId: string; newHostId?: string; sessionId: string }) => {
      dispatch(playerLeft({ playerId: data.playerId, newHostId: data.newHostId }));
    };

    const onPlayerReady = (data: { playerId: string; isReady: boolean; sessionId: string }) => {
      dispatch(playerReadyUpdated({ playerId: data.playerId, isReady: data.isReady }));
    };

    // ─── Preparation ─────────────────────────────────────────────────────────

    const onPreparationUpdated = (data: QuizPreparationStatus) => {
      dispatch(setPreparationStatus(data));
    };

    const onReady = (_data: any) => {
      dispatch(setPhase('READY'));
    };

    // ─── Game flow ────────────────────────────────────────────────────────────

    const onStarted = (_data: any) => {
      dispatch(setPhase('QUESTION'));
    };

    const onQuestionStarted = (data: QuizCurrentQuestion) => {
      dispatch(questionStarted(data));
    };

    const onAnswerAccepted = (_data: {
      submissionId: string;
      locked: boolean;
      isCorrect: boolean;
      scoreChange: number;
      responseTimeSec: number;
    }) => {
      dispatch(lockMyAnswer());
    };

    const onPlayerAnswered = (data: { userId: string; userName: string; sessionId: string }) => {
      dispatch(playerAnswered({ userId: data.userId }));
    };

    const onQuestionEnded = (data: QuizQuestionResult) => {
      dispatch(questionEnded(data));
    };

    const onNextQuestionCountdown = (data: { secondsUntilNext: number; sessionId: string }) => {
      dispatch(setNextQuestionCountdown(data.secondsUntilNext));
    };

    const onGameCompleted = (data: { finalRanking: any[]; sessionId: string }) => {
      dispatch(gameCompleted({ finalRanking: data.finalRanking }));
    };

    const onGameEnded = (_data: any) => {
      dispatch(setPhase('GAME_OVER'));
    };

    const onError = (data: { message: string }) => {
      dispatch(setError(data.message));
    };

    // ─── Register listeners ──────────────────────────────────────────────────

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('quiz:joined', onJoined);
    socket.on('quiz:player_joined', onPlayerJoined);
    socket.on('quiz:player_left', onPlayerLeft);
    socket.on('quiz:player_ready', onPlayerReady);
    socket.on('quiz:preparation_updated', onPreparationUpdated);
    socket.on('quiz:ready', onReady);
    socket.on('quiz:started', onStarted);
    socket.on('quiz:question_started', onQuestionStarted);
    socket.on('quiz:answer_accepted', onAnswerAccepted);
    socket.on('quiz:player_answered', onPlayerAnswered);
    socket.on('quiz:question_ended', onQuestionEnded);
    socket.on('quiz:next_question_countdown', onNextQuestionCountdown);
    socket.on('quiz:game_completed', onGameCompleted);
    socket.on('quiz:game_ended', onGameEnded);
    socket.on('quiz:error', onError);

    // Join the room
    if (socket.connected) {
      onConnect();
    } else {
      socket.connect();
    }

    return () => {
      // Remove only our listeners — don't disconnect shared socket
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('quiz:joined', onJoined);
      socket.off('quiz:player_joined', onPlayerJoined);
      socket.off('quiz:player_left', onPlayerLeft);
      socket.off('quiz:player_ready', onPlayerReady);
      socket.off('quiz:preparation_updated', onPreparationUpdated);
      socket.off('quiz:ready', onReady);
      socket.off('quiz:started', onStarted);
      socket.off('quiz:question_started', onQuestionStarted);
      socket.off('quiz:answer_accepted', onAnswerAccepted);
      socket.off('quiz:player_answered', onPlayerAnswered);
      socket.off('quiz:question_ended', onQuestionEnded);
      socket.off('quiz:next_question_countdown', onNextQuestionCountdown);
      socket.off('quiz:game_completed', onGameCompleted);
      socket.off('quiz:game_ended', onGameEnded);
      socket.off('quiz:error', onError);
    };
  }, [sessionId, dispatch, leaveRoom]);

  // Emit functions for components to use
  const submitAnswer = useCallback((
    sessionId: string,
    roundId: string,
    selectedOption: number,
    submissionId: string
  ) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('quiz:submit_answer', { sessionId, roundId, selectedOption, submissionId });
  }, []);

  const setReady = useCallback((sessionId: string, isReady: boolean) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('quiz:ready', { sessionId, isReady });
  }, []);

  const startGame = useCallback((sessionId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('quiz:start_game', { sessionId });
  }, []);

  const endGame = useCallback((sessionId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('quiz:end_game', { sessionId });
  }, []);

  const requestPreparation = useCallback((sessionId: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('quiz:request_preparation', { sessionId });
  }, []);

  return {
    joinRoom,
    leaveRoom,
    submitAnswer,
    setReady,
    startGame,
    endGame,
    requestPreparation,
    socket: socketRef.current,
  };
}
