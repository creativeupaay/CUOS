/**
 * Quiz Game — Server-side TypeScript Types
 *
 * SECURITY PRINCIPLE:
 * - QuizPublicQuestion NEVER includes correctOption
 * - QuizQuestionReveal includes correctOption (sent ONLY after question ends)
 * - QuizPlayerSubmission NEVER includes the player's selectedOption to other players
 */

// ─── Game Phase ──────────────────────────────────────────────────────────────

export type QuizPhase =
  | 'LOBBY'
  | 'PREPARING'
  | 'READY'
  | 'QUESTION'
  | 'QUESTION_RESULT'
  | 'FINAL_RESULT'
  | 'GAME_OVER';

export type QuizStatus = 'lobby' | 'active' | 'finished' | 'cancelled';
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'mixed';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface QuizConfig {
  gameName: string;
  topic: string;
  totalQuestions: number;
  difficulty: QuizDifficulty;
  timePerQuestion: number;
  maxPlayers: number;
  minPlayers: number;
}

// ─── Player State (public) ───────────────────────────────────────────────────

export interface QuizPublicPlayer {
  userId: string;
  userName: string;
  isHost: boolean;
  isSpectator: boolean;
  isReady: boolean;
  totalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
}

// ─── Preparation Status ──────────────────────────────────────────────────────

export interface QuizPreparationStatus {
  totalRequired: number;
  totalReady: number;
  aiGenerated: number;
  fallbackUsed: number;
  generating: number;
  isComplete: boolean;
}

// ─── Question (PUBLIC — no correctOption) ────────────────────────────────────

/**
 * Sent to all clients when a question starts.
 * NEVER includes correctOption.
 */
export interface QuizPublicQuestion {
  questionId: string;
  roundId?: string;
  question: string;
  options: [string, string, string, string];
  category: string;
  difficulty: string;
  questionNumber: number;  // 1-based
  totalQuestions: number;
  startedAt: string;       // ISO string
  endsAt: string;          // ISO string
}

// ─── Question Reveal (sent ONLY after question ends) ────────────────────────

export interface QuizQuestionReveal {
  correctOption: number;
  explanation: string;
}

// ─── Submission Result (sent to specific player only) ───────────────────────

export interface QuizSubmissionResult {
  submissionId: string;
  isCorrect: boolean;
  scoreChange: number;
  responseTimeSec: number;
  locked: boolean;
}

// ─── Round Result Entry ──────────────────────────────────────────────────────

export interface QuizRoundPlayerResult {
  userId: string;
  userName: string;
  isCorrect: boolean | null;  // null if no answer
  scoreChange: number;
  totalScore: number;
  rank: number;
  responseTimeSec: number | null;
}

// ─── Live Leaderboard Entry ──────────────────────────────────────────────────

export interface QuizLiveLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalScore: number;
  correctAnswers: number;
}

// ─── Final Result ────────────────────────────────────────────────────────────

export interface QuizFinalPlayerResult {
  rank: number;
  userId: string;
  userName: string;
  totalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  accuracy: number;
  avgResponseTimeSec: number;
}

// ─── Public Game State ────────────────────────────────────────────────────────

/**
 * Safe to send to all players.
 * Does NOT include correctOption for active questions.
 * Does NOT include future questions.
 * Does NOT include other players' selectedOption.
 */
export interface QuizPublicState {
  sessionId: string;
  gameType: 'quiz';
  hostUserId: string;
  status: QuizStatus;
  phase: QuizPhase;
  config: QuizConfig;
  players: QuizPublicPlayer[];
  preparationStatus: QuizPreparationStatus;
  currentQuestion: QuizPublicQuestion | null;
  answeredUserIds: string[];   // who has answered (not what they chose)
  liveLeaderboard: QuizLiveLeaderboardEntry[];
  createdAt: string;
}

// ─── Validated Question (internal) ───────────────────────────────────────────

export interface ValidatedQuestion {
  question: string;
  options: [string, string, string, string];
  correctOption: number;
  explanation: string;
  topic: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: 'ai' | 'fallback';
}
