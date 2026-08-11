import mongoose, { Document, Schema, Types } from 'mongoose';

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

export interface QuizSessionPlayer {
  userId: string;
  userName: string;
  userEmail: string;
  isHost: boolean;
  isSpectator: boolean;
  isReady: boolean;
  totalScore: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalResponseTimeSec: number; // cumulative correct-answer response times (for tie-break)
  joinedAt: Date;
}

export interface QuizPreparationStatus {
  totalRequired: number;
  totalReady: number;
  aiGenerated: number;
  fallbackUsed: number;
  generating: number;
  isComplete: boolean;
}

export interface IQuizSession extends Document {
  gameType: 'quiz';
  hostUserId: Types.ObjectId;
  status: QuizStatus;
  phase: QuizPhase;
  config: {
    gameName: string;
    topic: string;
    totalQuestions: number;
    difficulty: QuizDifficulty;
    timePerQuestion: number; // seconds
    maxPlayers: number;
    minPlayers: number;
  };
  players: QuizSessionPlayer[];
  currentQuestionIndex: number; // 0-based; -1 = not started
  questionIds: string[]; // ordered list of QuizQuestion _ids (server-side only)
  preparationStatus: QuizPreparationStatus;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSessionPlayerSchema = new Schema<QuizSessionPlayer>(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    isHost: { type: Boolean, default: false },
    isSpectator: { type: Boolean, default: false },
    isReady: { type: Boolean, default: false },
    totalScore: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    wrongAnswers: { type: Number, default: 0 },
    totalResponseTimeSec: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const QuizPreparationStatusSchema = new Schema<QuizPreparationStatus>(
  {
    totalRequired: { type: Number, default: 0 },
    totalReady: { type: Number, default: 0 },
    aiGenerated: { type: Number, default: 0 },
    fallbackUsed: { type: Number, default: 0 },
    generating: { type: Number, default: 0 },
    isComplete: { type: Boolean, default: false },
  },
  { _id: false }
);

const QuizSessionSchema = new Schema<IQuizSession>(
  {
    gameType: { type: String, required: true, default: 'quiz', enum: ['quiz'] },
    hostUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: ['lobby', 'active', 'finished', 'cancelled'],
      default: 'lobby',
    },
    phase: {
      type: String,
      required: true,
      enum: ['LOBBY', 'PREPARING', 'READY', 'QUESTION', 'QUESTION_RESULT', 'FINAL_RESULT', 'GAME_OVER'],
      default: 'LOBBY',
    },
    config: {
      gameName: { type: String, required: true, maxlength: 80 },
      topic: { type: String, required: true, maxlength: 100 },
      totalQuestions: { type: Number, required: true, min: 5, max: 20, default: 10 },
      difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'medium' },
      timePerQuestion: { type: Number, required: true, min: 10, max: 60, default: 20 },
      maxPlayers: { type: Number, required: true, default: 20, min: 2 },
      minPlayers: { type: Number, required: true, default: 2, min: 2 },
    },
    players: [QuizSessionPlayerSchema],
    currentQuestionIndex: { type: Number, default: -1 },
    questionIds: { type: [String], default: [], select: false }, // never sent to clients
    preparationStatus: { type: QuizPreparationStatusSchema, default: () => ({}) },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

QuizSessionSchema.index({ status: 1, gameType: 1 });
QuizSessionSchema.index({ 'players.userId': 1, status: 1 });
QuizSessionSchema.index({ hostUserId: 1 });
QuizSessionSchema.index({ createdAt: -1 });

export const QuizSession = mongoose.model<IQuizSession>('QuizSession', QuizSessionSchema);
