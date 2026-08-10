import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * WordleSession — one complete Wordle game session.
 *
 * Completely isolated from the Imposter GameSession model.
 * The targetWord for each round is stored in WordleRound, NEVER here.
 */

export type WordleSessionStatus = 'lobby' | 'active' | 'finished' | 'cancelled';

export type WordlePhase =
  | 'LOBBY'
  | 'ROUND_START'
  | 'PLAYING'
  | 'ROUND_RESULT'
  | 'GAME_OVER';

export interface WordleSessionConfig {
  gameName: string;
  totalRounds: number;       // 1–10
  roundDurationSec: number;  // seconds per round (e.g. 180 = 3 min)
  maxGuesses: 6;             // fixed at 6 per Wordle rules
  wordPack: string;
  maxPlayers: number;
  minPlayers: number;
}

export interface WordleSessionPlayer {
  userId: string;
  userName: string;
  userEmail: string;
  isHost: boolean;
  isSpectator: boolean;
  isReady: boolean;
  totalScore: number;
  joinedAt: Date;
}

export interface IWordleSession extends Document {
  gameType: 'wordle';
  hostUserId: Types.ObjectId;
  status: WordleSessionStatus;
  phase: WordlePhase;
  config: WordleSessionConfig;
  players: WordleSessionPlayer[];
  currentRoundNumber: number;
  roundWords: string[];  // server-side list of words for all rounds (NEVER sent to client)
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WordleSessionConfigSchema = new Schema<WordleSessionConfig>(
  {
    gameName: { type: String, required: true, default: 'Wordle Battle', maxlength: 60 },
    totalRounds: { type: Number, required: true, default: 3, min: 1, max: 10 },
    roundDurationSec: { type: Number, required: true, default: 180, min: 30, max: 600 },
    maxGuesses: { type: Number, required: true, default: 6 },
    wordPack: { type: String, required: true, default: 'general' },
    maxPlayers: { type: Number, required: true, default: 20, min: 2, max: 50 },
    minPlayers: { type: Number, required: true, default: 2, min: 2 },
  },
  { _id: false }
);

const WordleSessionPlayerSchema = new Schema<WordleSessionPlayer>(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    isHost: { type: Boolean, default: false },
    isSpectator: { type: Boolean, default: false },
    isReady: { type: Boolean, default: false },
    totalScore: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WordleSessionSchema = new Schema<IWordleSession>(
  {
    gameType: { type: String, required: true, default: 'wordle', enum: ['wordle'] },
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
      enum: ['LOBBY', 'ROUND_START', 'PLAYING', 'ROUND_RESULT', 'GAME_OVER'],
      default: 'LOBBY',
    },
    config: { type: WordleSessionConfigSchema, required: true },
    players: [WordleSessionPlayerSchema],
    currentRoundNumber: { type: Number, default: 0 },
    roundWords: { type: [String], default: [], select: false }, // NEVER returned by default
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
WordleSessionSchema.index({ status: 1, gameType: 1 });
WordleSessionSchema.index({ 'players.userId': 1, status: 1 });
WordleSessionSchema.index({ hostUserId: 1 });
WordleSessionSchema.index({ createdAt: -1 });

export const WordleSession = mongoose.model<IWordleSession>('WordleSession', WordleSessionSchema);
