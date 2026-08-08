import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '@/app/hooks';
import {
  addPlayer,
  removePlayer,
  updatePlayer,
  addClue,
  setVoteResults,
  setEliminatedPlayer,
  setGameOver,
  setSocketConnected,
  setError,
  startNextCycle,
  updateGamePhase,
} from '../games/imposter/store/imposterSlice';
import type { GamePhase } from '../types/gameZone.types';

// Import the existing socket.io-client from the project
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8000';

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
 * useGameSocket — manages the Socket.IO connection for the Game Zone.
 *
 * Uses a single shared socket instance (avoids duplicate connections).
 * Automatically joins the game room and sets up all game event listeners.
 * Cleans up on unmount.
 */
export function useGameSocket(sessionId: string | null) {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const joinRoom = useCallback((sid: string) => {
    const socket = socketRef.current;
    if (!socket || !sid) return;
    socket.emit('game:join_room', { sessionId: sid });
  }, []);

  const leaveRoom = useCallback((sid: string) => {
    const socket = socketRef.current;
    if (!socket || !sid) return;
    socket.emit('game:leave_room', { sessionId: sid });
  }, []);

  useEffect(() => {
    const socket = getOrCreateSocket();
    socketRef.current = socket;
    socketRefCount++;

    dispatch(setSocketConnected(socket.connected));

    const onConnect = () => {
      dispatch(setSocketConnected(true));
      if (sessionIdRef.current) {
        socket.emit('game:join_room', { sessionId: sessionIdRef.current });
      }
    };

    const onDisconnect = () => dispatch(setSocketConnected(false));

    // ─── Game Events ──────────────────────────────────────────────────────────
    const onPlayerJoined = (payload: any) => dispatch(addPlayer(payload.player));
    const onPlayerLeft = (payload: any) => dispatch(removePlayer(payload.playerId));
    const onPlayerReady = (payload: any) =>
      dispatch(updatePlayer({ playerId: payload.playerId, updates: { isReady: payload.isReady } }));
    const onRoleConfirmed = (payload: any) =>
      dispatch(updatePlayer({ playerId: payload.playerId, updates: { hasConfirmedRole: true } }));
    const onPhaseUpdated = (payload: any) =>
      dispatch(updateGamePhase({
        phase: payload.phase as GamePhase,
        phaseStartedAt: payload.phaseStartedAt,
        phaseEndsAt: payload.phaseEndsAt,
        currentTurnPlayerId: payload.currentTurnPlayerId,
        turnOrder: payload.turnOrder,
      }));
    const onClueSubmitted = (payload: any) =>
      dispatch(addClue({ playerId: payload.playerId, playerName: payload.playerName, clue: payload.clue }));
    const onTurnChanged = (payload: any) =>
      dispatch(updateGamePhase({ phase: 'CLUE', currentTurnPlayerId: payload.currentTurnPlayerId }));
    const onDiscussionStarted = (payload: any) =>
      dispatch(updateGamePhase({
        phase: 'DISCUSSION',
        phaseStartedAt: payload.phaseStartedAt,
        phaseEndsAt: payload.phaseEndsAt,
      }));
    const onVotingStarted = (payload: any) =>
      dispatch(updateGamePhase({
        phase: 'VOTING',
        phaseStartedAt: payload.phaseStartedAt,
        phaseEndsAt: payload.phaseEndsAt,
      }));
    const onVotingEnded = (payload: any) => {
      dispatch(setVoteResults(payload.voteResults));
      dispatch(updateGamePhase({ phase: 'RESULT' }));
    };
    const onPlayerEliminated = (payload: any) =>
      dispatch(setEliminatedPlayer({ playerId: payload.playerId, wasImposter: payload.wasImposter }));
    const onNextCycle = (payload: any) =>
      dispatch(startNextCycle({
        roundNumber: payload.roundNumber,
        cycleNumber: payload.cycleNumber,
        turnOrder: payload.turnOrder,
        currentTurnPlayerId: payload.currentTurnPlayerId,
      }));
    const onGameWon = (payload: any) =>
      dispatch(setGameOver({
        winningSide: payload.winningSide,
        imposterIds: payload.imposterIds,
        imposterNames: payload.imposterNames,
        secretWord: payload.secretWord,
        scores: payload.scores,
      }));
    const onGameEnded = () => dispatch(updateGamePhase({ phase: 'GAME_OVER' }));
    const onError = (payload: any) => dispatch(setError(payload.message || 'A game error occurred'));

    // Attach listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game:player_joined', onPlayerJoined);
    socket.on('game:player_left', onPlayerLeft);
    socket.on('game:player_ready', onPlayerReady);
    socket.on('game:role_confirmed', onRoleConfirmed);
    socket.on('game:phase_updated', onPhaseUpdated);
    socket.on('game:clue_submitted', onClueSubmitted);
    socket.on('game:turn_changed', onTurnChanged);
    socket.on('game:discussion_started', onDiscussionStarted);
    socket.on('game:voting_started', onVotingStarted);
    socket.on('game:voting_ended', onVotingEnded);
    socket.on('game:player_eliminated', onPlayerEliminated);
    socket.on('game:next_cycle', onNextCycle);
    socket.on('game:game_won', onGameWon);
    socket.on('game:game_ended', onGameEnded);
    socket.on('game:error', onError);

    // Connect if not already
    if (!socket.connected) {
      socket.connect();
    } else {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game:player_joined', onPlayerJoined);
      socket.off('game:player_left', onPlayerLeft);
      socket.off('game:player_ready', onPlayerReady);
      socket.off('game:role_confirmed', onRoleConfirmed);
      socket.off('game:phase_updated', onPhaseUpdated);
      socket.off('game:clue_submitted', onClueSubmitted);
      socket.off('game:turn_changed', onTurnChanged);
      socket.off('game:discussion_started', onDiscussionStarted);
      socket.off('game:voting_started', onVotingStarted);
      socket.off('game:voting_ended', onVotingEnded);
      socket.off('game:player_eliminated', onPlayerEliminated);
      socket.off('game:next_cycle', onNextCycle);
      socket.off('game:game_won', onGameWon);
      socket.off('game:game_ended', onGameEnded);
      socket.off('game:error', onError);

      socketRefCount--;
      // Don't disconnect — the notification system also uses this socket
    };
  }, []); // Only setup once

  return { socketRef, joinRoom, leaveRoom };
}
