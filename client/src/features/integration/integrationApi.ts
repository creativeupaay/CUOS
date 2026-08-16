/**
 * integrationApi.ts
 *
 * RTK Query endpoints for Google OAuth integration management.
 * Used by the Settings page to show connection status and disconnect.
 *
 * NOTE: The "Connect" flow is a server-redirect (not a fetch), so it is
 * handled by navigating to the backend URL directly, not via RTK Query.
 */

import { api } from '@/services/api';

export interface GoogleIntegrationStatus {
    connected: boolean;
    googleEmail?: string;
    status?: 'active' | 'requires_reauth';
    connectedSince?: string; // ISO date string
    lastSyncedAt?: string;   // ISO date string
}

interface ApiResponse<T> {
    status: 'success' | 'error';
    data?: T;
    message?: string;
}

export const integrationApi = api.injectEndpoints({
    endpoints: (builder) => ({
        /**
         * GET /api/v1/integrations/google/status
         * Returns the current user's Google integration status.
         * Never returns tokens.
         */
        getGoogleIntegrationStatus: builder.query<ApiResponse<GoogleIntegrationStatus>, void>({
            query: () => '/integrations/google/status',
            providesTags: ['GoogleIntegrations'],
        }),

        /**
         * DELETE /api/v1/integrations/google/disconnect
         * Revokes Google tokens and removes the integration.
         */
        disconnectGoogle: builder.mutation<ApiResponse<void>, void>({
            query: () => ({
                url: '/integrations/google/disconnect',
                method: 'DELETE',
            }),
            invalidatesTags: ['GoogleIntegrations'],
        }),
        /**
         * POST /api/v1/integrations/google/meet/sync
         * Manually sync Google Meet conferences.
         */
        syncMeetNow: builder.mutation<ApiResponse<void>, void>({
            query: () => ({
                url: '/integrations/google/meet/sync',
                method: 'POST',
            }),
            invalidatesTags: ['GlobalMeetings'],
        }),

        /**
         * GET /api/v1/integrations/google/calendar/upcoming
         * Fetch upcoming calendar events with Meet links.
         */
        getUpcomingCalendarMeetings: builder.query<ApiResponse<any[]>, void>({
            query: () => '/integrations/google/calendar/upcoming',
        }),
    }),
    overrideExisting: false,
});

export const {
    useGetGoogleIntegrationStatusQuery,
    useDisconnectGoogleMutation,
    useSyncMeetNowMutation,
    useGetUpcomingCalendarMeetingsQuery,
} = integrationApi;
