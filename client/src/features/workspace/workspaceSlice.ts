import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Tab {
    id: string;
    url: string;
    search: string;
    title: string;
    customTitle?: string;
    isPinned: boolean;
    /** Optional group key for deduplication — e.g. "projects-detail" for all /projects/:id pages */
    group?: string;
}

export interface WorkspaceState {
    tabs: Tab[];
    activeTabId: string | null;
}

const initialState: WorkspaceState = {
    tabs: [],
    activeTabId: null,
};

const normalizeUrlPath = (u: string) => {
    const norm = (u || '').toLowerCase().replace(/\/+$/, '').split('?')[0].split('#')[0];
    if (norm === '/announcements' || norm === '/hrms/announcements' || norm === '/my-hrms/announcements') {
        return 'canonical-announcements';
    }
    return norm;
};

export const workspaceSlice = createSlice({
    name: 'workspace',
    initialState,
    reducers: {
        addTab: (state, action: PayloadAction<Tab>) => {
            const incomingNorm = normalizeUrlPath(action.payload.url);
            const existing = state.tabs.find(t => {
                const existingNorm = normalizeUrlPath(t.url);
                return existingNorm === incomingNorm || (action.payload.group && t.group === action.payload.group);
            });
            if (existing) {
                state.activeTabId = existing.id;
                existing.url = action.payload.url;
                existing.search = action.payload.search;
                if (action.payload.title && !existing.customTitle) {
                    existing.title = action.payload.title;
                }
                return;
            }
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
            const targetNorm = normalizeUrlPath(action.payload.url);

            // Check if another tab already has this URL (e.g. redirected to an existing tab)
            const duplicateTab = state.tabs.find(t => t.id !== action.payload.id && normalizeUrlPath(t.url) === targetNorm);
            if (duplicateTab) {
                // Remove the redundant tab and activate the existing one
                const redundantIndex = state.tabs.findIndex(t => t.id === action.payload.id);
                if (redundantIndex !== -1) {
                    state.tabs.splice(redundantIndex, 1);
                }
                state.activeTabId = duplicateTab.id;
                duplicateTab.url = action.payload.url;
                duplicateTab.search = action.payload.search;
                if (action.payload.title && !duplicateTab.customTitle) {
                    duplicateTab.title = action.payload.title;
                }
                return;
            }

            const tab = state.tabs.find(t => t.id === action.payload.id);
            if (tab) {
                tab.url = action.payload.url;
                tab.search = action.payload.search;
                if (action.payload.title && !tab.customTitle) {
                    tab.title = action.payload.title;
                }
            }
        },
        sanitizeTabs: (state) => {
            const seen = new Set<string>();
            state.tabs = state.tabs.filter(t => {
                const key = normalizeUrlPath(t.url);
                if (seen.has(key) && !t.isPinned) {
                    return false;
                }
                seen.add(key);
                return true;
            });
            // Normalize any legacy /announcements URLs so they do not trigger background redirects
            state.tabs.forEach(t => {
                const raw = (t.url || '').toLowerCase().replace(/\/+$/, '').split('?')[0].split('#')[0];
                if (raw === '/announcements' || raw === '/hrms/announcements') {
                    t.url = '/my-hrms/announcements';
                    t.title = 'Announcements';
                }
            });
            if (state.activeTabId && !state.tabs.some(t => t.id === state.activeTabId)) {
                state.activeTabId = state.tabs[0]?.id || null;
            }
        },
        setTabCustomTitle: (state, action: PayloadAction<{ id: string, title: string }>) => {
            const tab = state.tabs.find(t => t.id === action.payload.id);
            if (tab) {
                tab.customTitle = action.payload.title;
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
    setTabCustomTitle,
    reorderTabs,
    pinTab,
    clearAllTabs,
    closeOtherTabs,
    closeAllTabs,
    sanitizeTabs
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
