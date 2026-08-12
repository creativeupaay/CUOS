import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * GameVote — stores the latest vote per voter per cycle.
 * A voter can change their vote until the voting timer expires.
 * The unique index on (sessionId, roundNumber, cycleNumber, voterId) enforces one vote per voter per cycle.
 */
export interface IGameVote extends Document {
  sessionId: Types.ObjectId;
  roundNumber: number;
  cycleNumber: number;
  voterId: string;
  targetPlayerId: string;
  createdAt: Date;
  updatedAt: Date;
}

const GameVoteSchema = new Schema<IGameVote>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true },
    roundNumber: { type: Number, required: true },
    cycleNumber: { type: Number, required: true },
    voterId: { type: String, required: true },
    targetPlayerId: { type: String, required: true },
  },
  { timestamps: true }
);

// Unique: one vote entry per voter per cycle (upsert replaces old vote)
GameVoteSchema.index(
  { sessionId: 1, roundNumber: 1, cycleNumber: 1, voterId: 1 },
  { unique: true }
);
GameVoteSchema.index({ sessionId: 1 });

export const GameVote = mongoose.model<IGameVote>('GameVote', GameVoteSchema);
