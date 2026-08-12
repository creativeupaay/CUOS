/**
 * Quiz Game — Client-side TypeScript Types
 *
 * SECURITY: These types NEVER include correctOption for active questions.
 * correctOption only appears in QuizQuestionResult, received after question ends.
 */

// ─── Phase ───────────────────────────────────────────────────────────────────

export type QuizPhase =
  | 'LOBBY'
  | 'PREPARING'
  | 'READY'
  | 'QUESTION'
  | 'QUESTION_RESULT'
  | 'INTERMISSION'
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

// ─── Player ──────────────────────────────────────────────────────────────────

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

// ─── Preparation ─────────────────────────────────────────────────────────────

export interface QuizPreparationStatus {
  totalRequired: number;
  totalReady: number;
  aiGenerated: number;
  fallbackUsed: number;
  generating: number;
  isComplete: boolean;
}

// ─── Active Question (NO correctOption) ─────────────────────────────────────

export interface QuizCurrentQuestion {
  questionId: string;
  roundId?: string;
  question: string;
  options: [string, string, string, string];
  category: string;
  difficulty: string;
  questionNumber: number;
  totalQuestions: number;
  startedAt: string;
  endsAt: string;
}

// ─── After Question Ends (includes correctOption) ────────────────────────────

export interface QuizPlayerResult {
  userId: string;
  userName: string;
  isCorrect: boolean | null;
  scoreChange: number;
  totalScore: number;
  rank: number;
  responseTimeSec: number | null;
}

export interface QuizQuestionResult {
  questionIndex: number;
  correctOption: number; // revealed only after question ends
  explanation: string;
  results: QuizPlayerResult[];
  liveLeaderboard: QuizLiveLeaderboardEntry[];
  isLastQuestion: boolean;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface QuizLiveLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  totalScore: number;
  correctAnswers: number;
}

// ─── Final Result ─────────────────────────────────────────────────────────────

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

// ─── Public Session State ─────────────────────────────────────────────────────

export interface QuizPublicState {
  sessionId: string;
  gameType: 'quiz';
  hostUserId: string;
  status: QuizStatus;
  phase: QuizPhase;
  config: QuizConfig;
  players: QuizPublicPlayer[];
  preparationStatus: QuizPreparationStatus;
  currentQuestion: QuizCurrentQuestion | null;
  answeredUserIds: string[];
  liveLeaderboard: QuizLiveLeaderboardEntry[];
  createdAt: string;
}
