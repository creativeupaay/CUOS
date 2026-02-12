import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/services/api';

/**
 * Redux store configuration
 * 
 * This store includes:
 * - RTK Query API reducer and middleware
 * - Place to add feature slices as needed
 */

export const store = configureStore({
  reducer: {
    // Add the API reducer
    [api.reducerPath]: api.reducer,
    // Add other reducers here as you create slices
    // Example: auth: authSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
