import { api } from '@/services/api';
import type {
  PublicGameState,
  GameSessionListItem,
  LeaderboardResponse,
  CreateSessionInput,
} from '../types/gameZone.types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const gameZoneApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ─── Sessions ───────────────────────────────────────────────────────────
    listGameSessions: builder.query<ApiResponse<GameSessionListItem[]>, void>({
      query: () => '/game-zone/sessions',
      providesTags: ['GameSessions'],
    }),

    getGameSession: builder.query<ApiResponse<PublicGameState>, string>({
      query: (sessionId) => `/game-zone/sessions/${sessionId}`,
      providesTags: (_res, _err, sessionId) => [{ type: 'GameSessions', id: sessionId }],
    }),

    createGameSession: builder.mutation<ApiResponse<{ sessionId: string }>, CreateSessionInput>({
      query: (body) => ({
        url: '/game-zone/sessions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['GameSessions'],
    }),

    joinGameSession: builder.mutation<ApiResponse<{ sessionId: string; isSpectator: boolean }>, string>({
      query: (sessionId) => ({
        url: `/game-zone/sessions/${sessionId}/join`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, sessionId) => [{ type: 'GameSessions', id: sessionId }],
    }),

    leaveGameSession: builder.mutation<ApiResponse<null>, string>({
      query: (sessionId) => ({
        url: `/game-zone/sessions/${sessionId}/leave`,
        method: 'POST',
      }),
      invalidatesTags: ['GameSessions'],
    }),

    setPlayerReady: builder.mutation<ApiResponse<null>, { sessionId: string; isReady: boolean }>({
      query: ({ sessionId, isReady }) => ({
        url: `/game-zone/sessions/${sessionId}/ready`,
        method: 'POST',
        body: { isReady },
      }),
    }),

    updateSessionConfig: builder.mutation<ApiResponse<any>, { sessionId: string; config: Partial<CreateSessionInput> }>({
      query: ({ sessionId, config }) => ({
        url: `/game-zone/sessions/${sessionId}/config`,
        method: 'PATCH',
        body: config,
      }),
    }),

    startGameSession: builder.mutation<ApiResponse<{ sessionId: string; phase: string }>, string>({
      query: (sessionId) => ({
        url: `/game-zone/sessions/${sessionId}/start`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, sessionId) => [{ type: 'GameSessions', id: sessionId }],
    }),

    endGameSession: builder.mutation<ApiResponse<null>, string>({
      query: (sessionId) => ({
        url: `/game-zone/sessions/${sessionId}/end`,
        method: 'POST',
      }),
      invalidatesTags: ['GameSessions'],
    }),

    // ─── Role (private — per-player only) ───────────────────────────────────
    getMyRole: builder.query<ApiResponse<{ role: string; secretWord: string | null }>, string>({
      query: (sessionId) => `/game-zone/sessions/${sessionId}/my-role`,
    }),

    confirmRole: builder.mutation<ApiResponse<{ allConfirmed: boolean }>, string>({
      query: (sessionId) => ({
        url: `/game-zone/sessions/${sessionId}/confirm-role`,
        method: 'POST',
      }),
    }),

    // ─── Gameplay ────────────────────────────────────────────────────────────
    submitClue: builder.mutation<ApiResponse<{ allCluesIn: boolean }>, { sessionId: string; clue: string }>({
      query: ({ sessionId, clue }) => ({
        url: `/game-zone/sessions/${sessionId}/clue`,
        method: 'POST',
        body: { clue },
      }),
    }),

    submitVote: builder.mutation<ApiResponse<null>, { sessionId: string; targetPlayerId: string }>({
      query: ({ sessionId, targetPlayerId }) => ({
        url: `/game-zone/sessions/${sessionId}/vote`,
        method: 'POST',
        body: { targetPlayerId },
      }),
    }),

    getClues: builder.query<ApiResponse<Array<{ playerId: string; playerName: string; clue: string }>>, {
      sessionId: string;
      roundNumber: number;
      cycleNumber: number;
    }>({
      query: ({ sessionId, roundNumber, cycleNumber }) =>
        `/game-zone/sessions/${sessionId}/clues?roundNumber=${roundNumber}&cycleNumber=${cycleNumber}`,
    }),

    // ─── Leaderboard ─────────────────────────────────────────────────────────
    getLeaderboard: builder.query<ApiResponse<LeaderboardResponse>, {
      gameType?: string;
      period?: string;
      view?: string;
      page?: number;
      limit?: number;
    }>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params.gameType) qs.set('gameType', params.gameType);
        if (params.period) qs.set('period', params.period);
        if (params.view) qs.set('view', params.view);
        if (params.page) qs.set('page', String(params.page));
        if (params.limit) qs.set('limit', String(params.limit));
        return `/game-zone/leaderboard?${qs.toString()}`;
      },
      providesTags: ['GameLeaderboard'],
    }),

    getMyStats: builder.query<ApiResponse<any>, void>({
      query: () => '/game-zone/leaderboard/me',
    }),
  }),
});

export const {
  useListGameSessionsQuery,
  useGetGameSessionQuery,
  useCreateGameSessionMutation,
  useJoinGameSessionMutation,
  useLeaveGameSessionMutation,
  useSetPlayerReadyMutation,
  useUpdateSessionConfigMutation,
  useStartGameSessionMutation,
  useEndGameSessionMutation,
  useGetMyRoleQuery,
  useConfirmRoleMutation,
  useSubmitClueMutation,
  useSubmitVoteMutation,
  useGetCluesQuery,
  useGetLeaderboardQuery,
  useGetMyStatsQuery,
} = gameZoneApi;
