import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * QuizSubmission — one record per player per question.
 *
 * Security:
 * - unique index on (sessionId, roundId, userId) enforces one-answer-per-question
 * - submissionId provides idempotency — identical submissionId = no double scoring
 * - submittedAt is set SERVER-SIDE — never trust client timestamps
 * - isCorrect and scoreChange are set SERVER-SIDE — never from client
 */
export interface IQuizSubmission extends Document {
  sessionId: Types.ObjectId;
  roundId: Types.ObjectId;
  questionIndex: number;
  userId: string;
  userName: string;
  selectedOption: number; // 0–3
  isCorrect: boolean;
  submittedAt: Date; // server-set timestamp
  responseTimeSec: number; // time taken from question start (server-computed)
  scoreChange: number; // +500+bonus, -100, or 0
  submissionId: string; // client-generated UUID for idempotency
  createdAt: Date;
  updatedAt: Date;
}

const QuizSubmissionSchema = new Schema<IQuizSubmission>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'QuizSession', required: true, index: true },
    roundId: { type: Schema.Types.ObjectId, ref: 'QuizRound', required: true },
    questionIndex: { type: Number, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    selectedOption: { type: Number, required: true, min: 0, max: 3 },
    isCorrect: { type: Boolean, required: true },
    submittedAt: { type: Date, required: true },
    responseTimeSec: { type: Number, required: true, min: 0 },
    scoreChange: { type: Number, required: true, default: 0 },
    submissionId: { type: String, required: true },
  },
  { timestamps: true }
);

// One answer per player per question — enforced at DB level
QuizSubmissionSchema.index({ sessionId: 1, roundId: 1, userId: 1 }, { unique: true });
// Idempotency — same submissionId is ignored
QuizSubmissionSchema.index({ submissionId: 1 }, { unique: true });
QuizSubmissionSchema.index({ sessionId: 1, userId: 1 });

export const QuizSubmission = mongoose.model<IQuizSubmission>('QuizSubmission', QuizSubmissionSchema);
