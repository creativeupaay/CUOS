import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  WordlePublicSessionState,
  WordlePlayerProgress,
  WordleGuessEntry,
  WordleRoundResultPayload,
  WordleFinalResultPayload,
  WordlePhase,
} from '../types/wordle.types';

/**
 * Wordle Redux Slice
 *
 * Manages transient game state for the current Wordle session.
 * HTTP-fetched state stays in RTK Query cache.
 * This slice handles socket-pushed real-time updates.
 *
 * Completely isolated from imposterSlice.
 */

interface WordleState {
  sessionId: string | null;
  phase: WordlePhase;
  isConnected: boolean;

  // Current round
  currentRound: number;
  totalRounds: number;
  roundStartedAt: string | null;
  roundEndsAt: string | null;

  // My guesses this round (private — only my own)
  myGuesses: WordleGuessEntry[];
  currentInput: string;
  isSubmitting: boolean;

  // Players progress (public — guess counts, solved status)
  playerProgress: WordlePlayerProgress[];

  // Round results (revealed after round ends)
  lastRoundResult: WordleRoundResultPayload | null;

  // Final game result
  finalResult: WordleFinalResultPayload | null;

  // Toast / error messages
  error: string | null;
  toastMessage: string | null;

  // Shake animation trigger (invalid guess)
  shakeRow: boolean;
}

const initialState: WordleState = {
  sessionId: null,
  phase: 'LOBBY',
  isConnected: false,
  currentRound: 0,
  totalRounds: 0,
  roundStartedAt: null,
  roundEndsAt: null,
  myGuesses: [],
  currentInput: '',
  isSubmitting: false,
  playerProgress: [],
  lastRoundResult: null,
  finalResult: null,
  error: null,
  toastMessage: null,
  shakeRow: false,
};

const wordleSlice = createSlice({
  name: 'wordle',
  initialState,
  reducers: {
    // ─── Connection ────────────────────────────────────────────────────────
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.isConnected = action.payload;
    },

    // ─── Session Initialization ────────────────────────────────────────────
    initWordleSession(state, action: PayloadAction<{
      sessionId: string;
      gameState: WordlePublicSessionState;
    }>) {
      const { sessionId, gameState } = action.payload;
      state.sessionId = sessionId;
      state.phase = gameState.phase;
      state.totalRounds = gameState.config.totalRounds;
      state.currentRound = gameState.currentRound?.roundNumber || 0;
      if (gameState.currentRound) {
        state.roundStartedAt = gameState.currentRound.startedAt;
        state.roundEndsAt = gameState.currentRound.endsAt;
        state.playerProgress = gameState.currentRound.playerProgress;
      }
    },

    // ─── Phase Transitions ─────────────────────────────────────────────────
    setPhase(state, action: PayloadAction<WordlePhase>) {
      state.phase = action.payload;
    },

    // ─── Round Started ─────────────────────────────────────────────────────
    roundStarted(state, action: PayloadAction<{
      roundNumber: number;
      totalRounds: number;
      startedAt: string;
      endsAt: string;
      players: Array<{ userId: string; userName: string }>;
    }>) {
      const { roundNumber, totalRounds, startedAt, endsAt, players } = action.payload;
      state.phase = 'PLAYING';
      state.currentRound = roundNumber;
      state.totalRounds = totalRounds;
      state.roundStartedAt = startedAt;
      state.roundEndsAt = endsAt;
      state.myGuesses = [];
      state.currentInput = '';
      state.lastRoundResult = null;
      state.error = null;
      state.playerProgress = players.map((p) => ({
        userId: p.userId,
        userName: p.userName,
        status: 'playing',
        guessCount: 0,
        roundScore: 0,
      }));
    },

    // ─── Guess Added (my own guess — from socket or REST response) ─────────
    addMyGuess(state, action: PayloadAction<WordleGuessEntry>) {
      state.myGuesses.push(action.payload);
      state.currentInput = '';
      state.isSubmitting = false;
    },

    // ─── Input ─────────────────────────────────────────────────────────────
    appendLetter(state, action: PayloadAction<string>) {
      if (state.currentInput.length < 5) {
        state.currentInput += action.payload.toUpperCase();
      }
    },

    removeLetter(state) {
      if (state.currentInput.length > 0) {
        state.currentInput = state.currentInput.slice(0, -1);
      }
    },

    clearInput(state) {
      state.currentInput = '';
    },

    setSubmitting(state, action: PayloadAction<boolean>) {
      state.isSubmitting = action.payload;
    },

    triggerShake(state) {
      state.shakeRow = true;
    },

    clearShake(state) {
      state.shakeRow = false;
    },

    // ─── Player Progress Update (broadcast from server) ───────────────────
    updatePlayerProgress(state, action: PayloadAction<WordlePlayerProgress[]>) {
      state.playerProgress = action.payload;
    },

    // ─── Round Ended ────────────────────────────────────────────────────────
    roundEnded(state, action: PayloadAction<WordleRoundResultPayload>) {
      state.phase = 'ROUND_RESULT';
      state.lastRoundResult = action.payload;
      state.roundEndsAt = null;
    },

    // ─── Game Completed ─────────────────────────────────────────────────────
    gameCompleted(state, action: PayloadAction<WordleFinalResultPayload>) {
      state.phase = 'GAME_OVER';
      state.finalResult = action.payload;
      state.roundEndsAt = null;
    },

    // ─── Error ─────────────────────────────────────────────────────────────
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },

    setToast(state, action: PayloadAction<string | null>) {
      state.toastMessage = action.payload;
    },

    // ─── Reset ─────────────────────────────────────────────────────────────
    resetWordle() {
      return initialState;
    },

    // ─── Restore guesses on reconnect ──────────────────────────────────────
    restoreMyGuesses(state, action: PayloadAction<WordleGuessEntry[]>) {
      state.myGuesses = action.payload;
    },
  },
});

export const {
  setSocketConnected,
  initWordleSession,
  setPhase,
  roundStarted,
  addMyGuess,
  appendLetter,
  removeLetter,
  clearInput,
  setSubmitting,
  triggerShake,
  clearShake,
  updatePlayerProgress,
  roundEnded,
  gameCompleted,
  setError,
  setToast,
  resetWordle,
  restoreMyGuesses,
} = wordleSlice.actions;

export default wordleSlice.reducer;
