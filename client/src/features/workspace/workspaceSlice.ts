import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Tab {
    id: string;
    url: string;
    search: string;
    title: string;
    isPinned: boolean;
}

export interface WorkspaceState {
    tabs: Tab[];
    activeTabId: string | null;
}

const initialState: WorkspaceState = {
    tabs: [],
    activeTabId: null,
};

export const workspaceSlice = createSlice({
    name: 'workspace',
    initialState,
    reducers: {
        addTab: (state, action: PayloadAction<Tab>) => {
            state.tabs.push(action.payload);
            state.activeTabId = action.payload.id;
        },
        removeTab: (state, action: PayloadAction<string>) => {
            const index = state.tabs.findIndex(t => t.id === action.payload);
            if (index !== -1) {
                state.tabs.splice(index, 1);
                // If we removed the active tab, switch to another tab
                if (state.activeTabId === action.payload) {
                    if (state.tabs.length > 0) {
                        // Switch to the tab to the right, or left if none on right
                        state.activeTabId = state.tabs[Math.min(index, state.tabs.length - 1)].id;
                    } else {
                        state.activeTabId = null;
                    }
                }
            }
        },
        setActiveTab: (state, action: PayloadAction<string | null>) => {
            if (action.payload === null) {
                state.activeTabId = null;
            } else if (state.tabs.some(t => t.id === action.payload)) {
                state.activeTabId = action.payload;
            }
        },
        updateTabUrl: (state, action: PayloadAction<{ id: string, url: string, search: string, title?: string }>) => {
            const tab = state.tabs.find(t => t.id === action.payload.id);
            if (tab) {
                tab.url = action.payload.url;
                tab.search = action.payload.search;
                if (action.payload.title) {
                    tab.title = action.payload.title;
                }
            }
        },
        reorderTabs: (state, action: PayloadAction<{ sourceIndex: number, destinationIndex: number }>) => {
            const result = Array.from(state.tabs);
            const [removed] = result.splice(action.payload.sourceIndex, 1);
            result.splice(action.payload.destinationIndex, 0, removed);
            state.tabs = result;
        },
        pinTab: (state, action: PayloadAction<string>) => {
            const tab = state.tabs.find(t => t.id === action.payload);
            if (tab) {
                tab.isPinned = !tab.isPinned;
                // Move pinned tabs to the left
                state.tabs.sort((a, b) => {
                    if (a.isPinned && !b.isPinned) return -1;
                    if (!a.isPinned && b.isPinned) return 1;
                    return 0;
                });
            }
        },
        clearAllTabs: (state) => {
            state.tabs = [];
            state.activeTabId = null;
        },
        closeOtherTabs: (state, action: PayloadAction<string>) => {
            state.tabs = state.tabs.filter(t => t.id === action.payload || t.isPinned);
            if (!state.tabs.some(t => t.id === state.activeTabId)) {
                state.activeTabId = action.payload;
            }
        },
        closeAllTabs: (state) => {
            state.tabs = state.tabs.filter(t => t.isPinned);
            if (state.tabs.length > 0) {
                state.activeTabId = state.tabs[0].id;
            } else {
                state.activeTabId = null;
            }
        }
    },
});

export const { 
    addTab, 
    removeTab, 
    setActiveTab, 
    updateTabUrl, 
    reorderTabs,
    pinTab,
    clearAllTabs,
    closeOtherTabs,
    closeAllTabs
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
