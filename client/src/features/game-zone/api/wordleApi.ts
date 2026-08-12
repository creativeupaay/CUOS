import { api } from '@/services/api';
import type {
  WordlePublicSessionState,
  WordleSessionListItem,
  CreateWordleSessionInput,
  WordleGuessEntry,
} from '../games/wordle/types/wordle.types';

/**
 * Wordle RTK Query API
 *
 * Completely separate from gameZoneApi.ts (Imposter).
 * Wordle MUST NOT import from Imposter API and vice versa.
 */

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const wordleApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Sessions ──────────────────────────────────────────────────────────
    listWordleSessions: builder.query<ApiResponse<WordleSessionListItem[]>, void>({
      query: () => '/wordle/sessions',
      providesTags: ['WordleSessions'],
    }),

    getWordleSession: builder.query<ApiResponse<WordlePublicSessionState>, string>({
      query: (sessionId) => `/wordle/sessions/${sessionId}`,
      providesTags: (_res, _err, sessionId) => [{ type: 'WordleSessions', id: sessionId }],
    }),

    createWordleSession: builder.mutation<ApiResponse<{ sessionId: string }>, CreateWordleSessionInput>({
      query: (body) => ({
        url: '/wordle/sessions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['WordleSessions'],
    }),

    joinWordleSession: builder.mutation<ApiResponse<{ sessionId: string; isSpectator: boolean }>, string>({
      query: (sessionId) => ({
        url: `/wordle/sessions/${sessionId}/join`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, sessionId) => [{ type: 'WordleSessions', id: sessionId }],
    }),

    leaveWordleSession: builder.mutation<ApiResponse<null>, string>({
      query: (sessionId) => ({
        url: `/wordle/sessions/${sessionId}/leave`,
        method: 'POST',
      }),
      invalidatesTags: ['WordleSessions'],
    }),

    setWordlePlayerReady: builder.mutation<ApiResponse<null>, { sessionId: string; isReady: boolean }>({
      query: ({ sessionId, isReady }) => ({
        url: `/wordle/sessions/${sessionId}/ready`,
        method: 'POST',
        body: { isReady },
      }),
    }),

    startWordleGame: builder.mutation<ApiResponse<null>, string>({
      query: (sessionId) => ({
        url: `/wordle/sessions/${sessionId}/start`,
        method: 'POST',
      }),
    }),

    endWordleGame: builder.mutation<ApiResponse<null>, string>({
      query: (sessionId) => ({
        url: `/wordle/sessions/${sessionId}/end`,
        method: 'POST',
      }),
      invalidatesTags: ['WordleSessions'],
    }),

    // ─── Gameplay ────────────────────────────────────────────────────────────
    submitWordleGuess: builder.mutation<ApiResponse<any>, { sessionId: string; guess: string }>({
      query: ({ sessionId, guess }) => ({
        url: `/wordle/sessions/${sessionId}/guess`,
        method: 'POST',
        body: { guess },
      }),
    }),

    getMyWordleGuesses: builder.query<ApiResponse<WordleGuessEntry[]>, { sessionId: string; roundNumber: number }>({
      query: ({ sessionId, roundNumber }) =>
        `/wordle/sessions/${sessionId}/my-guesses?roundNumber=${roundNumber}`,
    }),
  }),
});

export const {
  useListWordleSessionsQuery,
  useGetWordleSessionQuery,
  useCreateWordleSessionMutation,
  useJoinWordleSessionMutation,
  useLeaveWordleSessionMutation,
  useSetWordlePlayerReadyMutation,
  useStartWordleGameMutation,
  useEndWordleGameMutation,
  useSubmitWordleGuessMutation,
  useGetMyWordleGuessesQuery,
} = wordleApi;
