import { z } from 'zod';

// ─── Create Wordle Session ────────────────────────────────────────────────────

export const CreateWordleSessionSchema = z.object({
  gameName: z.string().min(1).max(60).optional(),
  totalRounds: z.number().int().min(1).max(10),
  roundDurationSec: z.number().int().min(30).max(600),
  wordPack: z.string().optional(),
  maxPlayers: z.number().int().min(2).max(50).optional(),
  minPlayers: z.number().int().min(2).max(20).optional(),
});

export type CreateWordleSessionInput = z.infer<typeof CreateWordleSessionSchema>;

// ─── Submit Guess ─────────────────────────────────────────────────────────────

export const SubmitWordleGuessSchema = z.object({
  guess: z
    .string()
    .min(1)
    .max(10)
    .transform((v) => v.trim().toUpperCase()),
});

export type SubmitWordleGuessInput = z.infer<typeof SubmitWordleGuessSchema>;
