import mongoose, { Document, Schema, Types } from 'mongoose';
import { PlayerRole, WinningSide } from '../types/game.types';

/**
 * GameScore — persistent leaderboard record per session per player.
 * Written once when a game session finishes.
 */
export interface IGameScore extends Document {
  sessionId: Types.ObjectId;
  userId: string;
  userName: string;
  userEmail: string;
  gameType: 'imposter';
  role: PlayerRole;
  won: boolean;
  winningSide: WinningSide | null;
  points: number;
  breakdown: {
    participation: number;
    survival: number;
    correctVotes: number;
    deception: number;
    winBonus: number;
  };
  gamesPlayed: number; // Always 1 — used for aggregation
  createdAt: Date;
  updatedAt: Date;
}

const GameScoreSchema = new Schema<IGameScore>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true },
    userId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    gameType: { type: String, required: true, enum: ['imposter'], default: 'imposter' },
    role: { type: String, required: true, enum: ['normal', 'imposter'] },
    won: { type: Boolean, required: true, default: false },
    winningSide: { type: String, enum: ['team', 'imposters', null], default: null },
    points: { type: Number, required: true, default: 0 },
    breakdown: {
      participation: { type: Number, default: 0 },
      survival: { type: Number, default: 0 },
      correctVotes: { type: Number, default: 0 },
      deception: { type: Number, default: 0 },
      winBonus: { type: Number, default: 0 },
    },
    gamesPlayed: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Unique: one score record per player per session
GameScoreSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
GameScoreSchema.index({ createdAt: -1 });
GameScoreSchema.index({ gameType: 1, userId: 1 });

export const GameScore = mongoose.model<IGameScore>('GameScore', GameScoreSchema);
