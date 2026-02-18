import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/services/api';
import authReducer from '@/features/auth/slices/authSlice';

/**
 * Redux store configuration
 * 
 * This store includes:
 * - RTK Query API reducer and middleware
 * - Auth slice for authentication state
 */

export const store = configureStore({
  reducer: {
    // Add the API reducer
    [api.reducerPath]: api.reducer,
    // Auth reducer
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
