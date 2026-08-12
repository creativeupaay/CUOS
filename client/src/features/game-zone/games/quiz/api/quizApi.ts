import { api } from '@/services/api';
import type {
  QuizPublicState,
  QuizPreparationStatus,
} from '../types/quiz.types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface CreateQuizInput {
  gameName?: string;
  topic: string;
  totalQuestions?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  timePerQuestion?: number;
  maxPlayers?: number;
  minPlayers?: number;
}

/**
 * Quiz RTK Query API
 *
 * Injected into the shared `api` instance.
 * All endpoints prefixed /quiz/
 */
export const quizApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Sessions ─────────────────────────────────────────────────────────
    listQuizSessions: builder.query<ApiResponse<any[]>, void>({
      query: () => '/quiz/sessions',
      providesTags: ['GameSessions'],
    }),

    createQuizSession: builder.mutation<ApiResponse<{ sessionId: string }>, CreateQuizInput>({
      query: (body) => ({
        url: '/quiz/sessions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['GameSessions'],
    }),

    getQuizSession: builder.query<ApiResponse<QuizPublicState>, string>({
      query: (sessionId) => `/quiz/sessions/${sessionId}`,
      providesTags: (_res, _err, sessionId) => [{ type: 'GameSessions', id: sessionId }],
    }),

    getQuizPreparation: builder.query<ApiResponse<QuizPreparationStatus>, string>({
      query: (sessionId) => `/quiz/sessions/${sessionId}/preparation`,
    }),

    joinQuizSession: builder.mutation<ApiResponse<{ sessionId: string; isSpectator: boolean }>, string>({
      query: (sessionId) => ({
        url: `/quiz/sessions/${sessionId}/join`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, sessionId) => [{ type: 'GameSessions', id: sessionId }],
    }),

    leaveQuizSession: builder.mutation<ApiResponse<null>, string>({
      query: (sessionId) => ({
        url: `/quiz/sessions/${sessionId}/leave`,
        method: 'POST',
      }),
      invalidatesTags: ['GameSessions'],
    }),

    setQuizPlayerReady: builder.mutation<ApiResponse<null>, { sessionId: string; isReady: boolean }>({
      query: ({ sessionId, isReady }) => ({
        url: `/quiz/sessions/${sessionId}/ready`,
        method: 'POST',
        body: { isReady },
      }),
    }),

    startQuizSession: builder.mutation<ApiResponse<{ message: string }>, string>({
      query: (sessionId) => ({
        url: `/quiz/sessions/${sessionId}/start`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, sessionId) => [{ type: 'GameSessions', id: sessionId }],
    }),

    endQuizSession: builder.mutation<ApiResponse<null>, string>({
      query: (sessionId) => ({
        url: `/quiz/sessions/${sessionId}/end`,
        method: 'POST',
      }),
      invalidatesTags: ['GameSessions'],
    }),
  }),
});

export const {
  useListQuizSessionsQuery,
  useCreateQuizSessionMutation,
  useGetQuizSessionQuery,
  useGetQuizPreparationQuery,
  useJoinQuizSessionMutation,
  useLeaveQuizSessionMutation,
  useSetQuizPlayerReadyMutation,
  useStartQuizSessionMutation,
  useEndQuizSessionMutation,
} = quizApi;
