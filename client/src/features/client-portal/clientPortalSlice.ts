import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { PortalClientInfo } from './clientPortalApi';



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
