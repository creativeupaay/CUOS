import mongoose, { Document, Schema, Types } from 'mongoose';
import { PlayerRole, PlayerSessionStatus } from '../types/game.types';

/**
 * GamePlayer — persistent per-session per-player record.
 * This model stores hidden role information server-side.
 * The `role` field is NEVER returned in bulk to the frontend.
 * Only the owning player can request their own role via a protected endpoint.
 */
export interface IGamePlayer extends Document {
  sessionId: Types.ObjectId;
  userId: string;
  userName: string;
  userEmail: string;
  role: PlayerRole; // NEVER exposed in bulk
  status: PlayerSessionStatus;
  isHost: boolean;
  hasConfirmedRole: boolean;
  correctVotes: number; // Number of correct imposter votes cast
  survivalCycles: number; // Number of voting rounds survived
  points: number; // Points accumulated in this session
  createdAt: Date;
  updatedAt: Date;
}

const GamePlayerSchema = new Schema<IGamePlayer>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['normal', 'imposter'],
      // select: false — intentionally NOT using select:false because we need to read it in service logic
      // We manually strip it from responses
    },
    status: { type: String, enum: ['active', 'eliminated', 'spectator'], default: 'active' },
    isHost: { type: Boolean, default: false },
    hasConfirmedRole: { type: Boolean, default: false },
    correctVotes: { type: Number, default: 0 },
    survivalCycles: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Unique constraint: one player record per session
GamePlayerSchema.index({ sessionId: 1, userId: 1 }, { unique: true });
GamePlayerSchema.index({ userId: 1 });

export const GamePlayer = mongoose.model<IGamePlayer>('GamePlayer', GamePlayerSchema);
