import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/services/api';
import authReducer from '@/features/auth/slices/authSlice';
import { clientPortalApi } from '@/features/client-portal/clientPortalApi';
import clientPortalReducer from '@/features/client-portal/clientPortalSlice';

/**
 * Redux store configuration
 *
 * This store includes:
 * - RTK Query API reducer and middleware (main admin app)
 * - Auth slice for admin authentication state
 * - Client Portal API reducer and middleware (separate JWT-based auth)
 * - Client Portal slice for portal auth state
 */

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    [clientPortalApi.reducerPath]: clientPortalApi.reducer,
    clientPortal: clientPortalReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(api.middleware)
      .concat(clientPortalApi.middleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
