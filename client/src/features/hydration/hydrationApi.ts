import { api } from '@/services/api';

interface HydrationMessageRequest {
    userName?: string;
    workMinutes: number;
    timeOfDay: string;
}

interface HydrationMessageResponse {
    success: boolean;
    data: {
        message: string;
        source: 'gemini' | 'fallback';
    };
}

/**
 * Injects the wellness hydration-message endpoint into the existing RTK Query api.
 *
 * This mutation is called ONCE per hydration cycle (at the 90-minute trigger),
 * never from a timer loop.
 */
export const hydrationApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getHydrationMessage: builder.mutation<HydrationMessageResponse, HydrationMessageRequest>({
            query: (body) => ({
                url: '/wellness/hydration-message',
                method: 'POST',
                body,
            }),
        }),
    }),
    overrideExisting: false,
});

export const { useGetHydrationMessageMutation } = hydrationApi;
