import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types/types';

const PARTNER_PORTAL_SLUG_KEY = 'partnerPortalSlug';

function persistPartnerSlug(user: User | null) {
    if (typeof window === 'undefined') return;

    const partnerSlug = (user as any)?.partnerSlug;
    if (partnerSlug) {
        window.sessionStorage.setItem(PARTNER_PORTAL_SLUG_KEY, partnerSlug);
    } else {
        window.sessionStorage.removeItem(PARTNER_PORTAL_SLUG_KEY);
    }
}

const initialState: AuthState = {
    user: null,
    isAuthenticated: false,
    isInitialized: false,
    loading: false,
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (
            state,
            action: PayloadAction<{ user: User }>
        ) => {
            state.user = action.payload.user;
            state.isAuthenticated = true;
            state.error = null;
            persistPartnerSlug(action.payload.user);
        },
        setUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
            state.isAuthenticated = true;
            persistPartnerSlug(action.payload);
        },
        logout: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.error = null;
            persistPartnerSlug(null);
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
            state.loading = false;
        },
        clearError: (state) => {
            state.error = null;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setInitialized: (state, action: PayloadAction<boolean>) => {
            state.isInitialized = action.payload;
        },
    },
});

export const { setCredentials, setUser, logout, setError, clearError, setLoading, setInitialized } =
    authSlice.actions;

export default authSlice.reducer;
