import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  QuizPhase,
  QuizPublicPlayer,
  QuizPreparationStatus,
  QuizCurrentQuestion,
  QuizQuestionResult,
  QuizLiveLeaderboardEntry,
  QuizFinalPlayerResult,
  QuizPublicState,
  QuizConfig,
} from '../types/quiz.types';

/**
 * Quiz Redux Slice
 *
 * Manages transient game state for the current Quiz session.
 * HTTP-fetched state stays in RTK Query cache.
 * This slice handles socket-pushed real-time updates.
 *
 * Security:
 * - mySelectedOption is stored locally for UI feedback
 * - correctOption is only stored in questionResult (after question ends)
 * - otherPlayers' selectedOption is NEVER stored — only their IDs (answeredPlayerIds)
 */

interface QuizState {
  // Connection & session
  sessionId: string | null;
  phase: QuizPhase;
  isConnected: boolean;

  // Session config
  config: QuizConfig | null;

  // Players
  players: QuizPublicPlayer[];
  myUserId: string | null; // set from auth

  // Preparation
  preparationStatus: QuizPreparationStatus;

  // Current active question (no correctOption)
  currentQuestion: QuizCurrentQuestion | null;

  // My answer state
  mySelectedOption: number | null; // null = not answered
  myAnswerLocked: boolean;
  mySubmissionId: string | null; // UUID for idempotency

  // Who has answered (IDs only — not their choice)
  answeredPlayerIds: string[];

  // After question ends — includes correctOption
  questionResult: QuizQuestionResult | null;

  // Live leaderboard (updated after each question)
  liveLeaderboard: QuizLiveLeaderboardEntry[];

  // Final results
  finalResult: QuizFinalPlayerResult[] | null;

  // UI feedback
  error: string | null;
  toastMessage: string | null;
  nextQuestionCountdown: number | null; // seconds until next question
}

const initialState: QuizState = {
  sessionId: null,
  phase: 'LOBBY',
  isConnected: false,
  config: null,
  players: [],
  myUserId: null,
  preparationStatus: {
    totalRequired: 0,
    totalReady: 0,
    aiGenerated: 0,
    fallbackUsed: 0,
    generating: 0,
    isComplete: false,
  },
  currentQuestion: null,
  mySelectedOption: null,
  myAnswerLocked: false,
  mySubmissionId: null,
  answeredPlayerIds: [],
  questionResult: null,
  liveLeaderboard: [],
  finalResult: null,
  error: null,
  toastMessage: null,
  nextQuestionCountdown: null,
};

const quizSlice = createSlice({
  name: 'quiz',
  initialState,
  reducers: {
    // ─── Connection ──────────────────────────────────────────────────────────
    setSocketConnected(state, action: PayloadAction<boolean>) {
      state.isConnected = action.payload;
    },

    setMyUserId(state, action: PayloadAction<string>) {
      state.myUserId = action.payload;
    },

    // ─── Session Init (on join) ───────────────────────────────────────────────
    initQuizSession(state, action: PayloadAction<{
      sessionId: string;
      gameState: QuizPublicState;
    }>) {
      const { sessionId, gameState } = action.payload;
      state.sessionId = sessionId;
      state.phase = gameState.phase;
      state.config = gameState.config;
      state.players = gameState.players;
      state.preparationStatus = gameState.preparationStatus;
      state.liveLeaderboard = gameState.liveLeaderboard;
      state.answeredPlayerIds = gameState.answeredUserIds;

      if (gameState.currentQuestion) {
        state.currentQuestion = gameState.currentQuestion;
      }
    },

    // ─── Phase ───────────────────────────────────────────────────────────────
    setPhase(state, action: PayloadAction<QuizPhase>) {
      state.phase = action.payload;
    },

    // ─── Player management ────────────────────────────────────────────────────
    playerJoined(state, action: PayloadAction<QuizPublicPlayer & { isSpectator: boolean }>) {
      const existing = state.players.find((p) => p.userId === action.payload.userId);
      if (!existing) {
        state.players.push(action.payload);
      }
    },

    playerLeft(state, action: PayloadAction<{ playerId: string; newHostId?: string }>) {
      state.players = state.players.filter((p) => p.userId !== action.payload.playerId);
      if (action.payload.newHostId) {
        state.players.forEach((p) => {
          p.isHost = p.userId === action.payload.newHostId;
        });
      }
    },

    playerReadyUpdated(state, action: PayloadAction<{ playerId: string; isReady: boolean }>) {
      const player = state.players.find((p) => p.userId === action.payload.playerId);
      if (player) player.isReady = action.payload.isReady;
    },

    // ─── Preparation ──────────────────────────────────────────────────────────
    setPreparationStatus(state, action: PayloadAction<QuizPreparationStatus>) {
      state.preparationStatus = action.payload;
      if (action.payload.isComplete) {
        state.phase = 'READY';
      }
    },

    // ─── Question started ─────────────────────────────────────────────────────
    questionStarted(state, action: PayloadAction<QuizCurrentQuestion>) {
      state.phase = 'QUESTION';
      state.currentQuestion = action.payload;
      state.mySelectedOption = null;
      state.myAnswerLocked = false;
      state.mySubmissionId = null;
      state.answeredPlayerIds = [];
      state.questionResult = null;
      state.nextQuestionCountdown = null;
      state.error = null;
    },

    // ─── My answer ────────────────────────────────────────────────────────────
    setMyAnswer(state, action: PayloadAction<{ option: number; submissionId: string }>) {
      state.mySelectedOption = action.payload.option;
      state.mySubmissionId = action.payload.submissionId;
      state.myAnswerLocked = true; // Optimistic locking
      if (state.myUserId && !state.answeredPlayerIds.includes(state.myUserId)) {
        state.answeredPlayerIds.push(state.myUserId);
      }
    },

    lockMyAnswer(state) {
      state.myAnswerLocked = true;
    },

    // ─── A player has answered (not which option) ─────────────────────────────
    playerAnswered(state, action: PayloadAction<{ userId: string }>) {
      if (!state.answeredPlayerIds.includes(action.payload.userId)) {
        state.answeredPlayerIds.push(action.payload.userId);
      }
    },

    // ─── Question ended — correctOption revealed ──────────────────────────────
    questionEnded(state, action: PayloadAction<QuizQuestionResult>) {
      state.phase = 'QUESTION_RESULT';
      state.questionResult = action.payload;
      state.liveLeaderboard = action.payload.liveLeaderboard;

      // Update player scores from result
      action.payload.results.forEach((result) => {
        const player = state.players.find((p) => p.userId === result.userId);
        if (player) {
          player.totalScore = result.totalScore;
          if (result.isCorrect === true) player.correctAnswers = (player.correctAnswers || 0) + 1;
          if (result.isCorrect === false) player.wrongAnswers = (player.wrongAnswers || 0) + 1;
        }
      });
    },

    // ─── Next question countdown ──────────────────────────────────────────────
    setNextQuestionCountdown(state, action: PayloadAction<number | null>) {
      state.nextQuestionCountdown = action.payload;
    },

    // ─── Game completed ───────────────────────────────────────────────────────
    gameCompleted(state, action: PayloadAction<{
      finalRanking: QuizLiveLeaderboardEntry[];
    }>) {
      state.phase = 'GAME_OVER';
      state.liveLeaderboard = action.payload.finalRanking;
      state.nextQuestionCountdown = null;
    },

    setFinalResult(state, action: PayloadAction<QuizFinalPlayerResult[]>) {
      state.finalResult = action.payload;
    },

    // ─── Error ────────────────────────────────────────────────────────────────
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },

    setToast(state, action: PayloadAction<string | null>) {
      state.toastMessage = action.payload;
    },

    // ─── Reset ────────────────────────────────────────────────────────────────
    resetQuiz() {
      return initialState;
    },
  },
});

export const {
  setSocketConnected,
  setMyUserId,
  initQuizSession,
  setPhase,
  playerJoined,
  playerLeft,
  playerReadyUpdated,
  setPreparationStatus,
  questionStarted,
  setMyAnswer,
  lockMyAnswer,
  playerAnswered,
  questionEnded,
  setNextQuestionCountdown,
  gameCompleted,
  setFinalResult,
  setError,
  setToast,
  resetQuiz,
} = quizSlice.actions;

export default quizSlice.reducer;
