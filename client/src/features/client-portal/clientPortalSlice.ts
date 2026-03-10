import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface PortalClientInfo {
    clientId: string;
    email: string;
    name: string;
    companyName?: string;
}

interface ClientPortalState {
    client: PortalClientInfo | null;
}

const initialState: ClientPortalState = {
    client: null,
};

const clientPortalSlice = createSlice({
    name: 'clientPortal',
    initialState,
    reducers: {
        setPortalClientInfo(state, action: PayloadAction<PortalClientInfo>) {
            state.client = action.payload;
        },
        clearPortalAuth(state) {
            state.client = null;
        },
    },
});

export const { setPortalClientInfo, clearPortalAuth } = clientPortalSlice.actions;
export default clientPortalSlice.reducer;
