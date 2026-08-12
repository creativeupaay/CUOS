import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { addTab, setActiveTab, updateTabUrl, removeTab, closeAllTabs } from '@/features/workspace/workspaceSlice';
import { nanoid } from '@reduxjs/toolkit';

// Helper to extract a friendly title from path
export function resolveTabTitle(pathname: string): string {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    
    // Quick specific matches
    if (pathname === '/projects') return 'Projects';
    if (pathname === '/tasks') return 'Tasks';
    if (pathname.includes('/daily-overview')) return 'Daily Overview';
    if (pathname === '/reports') return 'Reports';
    if (pathname.startsWith('/crm/pipeline')) return 'Pipeline';
    
    // Dynamic matching for specific modules
    if (segments[0] === 'projects' && segments[1]) {
        return segments[1] === 'new' ? 'New Project' : 'Project Details';
    }
    
    if (segments[0] === 'finance' && segments[1]) {
        if (segments[1] === 'revenue') return 'Revenue';
        if (segments[1] === 'expenses') return 'Expenses';
        if (segments[1] === 'cash-in-bank') return 'Cash In Bank';
        if (segments[1] === 'salaries-payroll') return 'Salaries & Payroll';
    }

    if (segments[0] === 'crm' && segments[1]) {
        if (segments[1] === 'leads') return 'Leads';
        if (segments[1] === 'clients') return 'Clients';
        if (segments[1] === 'proposals') return 'Proposals';
    }

    if (segments[0] === 'hiring' && segments[1]) {
        if (segments[1] === 'jobs') return 'Jobs';
        if (segments[1] === 'applications') return 'Applications';
        if (segments[1] === 'interviews') return 'Interviews';
        if (segments[1] === 'reports') return 'Hiring Reports';
    }
    
    if (segments[0] === 'hrms' && segments[1]) {
        if (segments[1] === 'employees') return 'Employees';
        if (segments[1] === 'attendance') return 'Attendance';
        if (segments[1] === 'leaves') return 'Leaves';
        if (segments[1] === 'holidays') return 'Holidays';
        if (segments[1] === 'payroll') return 'Payroll';
        if (segments[1] === 'announcements') return 'Announcements';
        if (segments[1] === 'reimbursements') return 'Reimbursements';
    }

    if (segments[0] === 'my-hrms' && segments[1]) {
        return 'My ' + (segments[1].charAt(0).toUpperCase() + segments[1].slice(1));
    }
    
    // Fallback to capitalizing the last segment
    const last = segments[segments.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

export function useWorkspaceTabsManager() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { tabs, activeTabId } = useAppSelector(state => state.workspace);
    
    const isNavigatingRef = useRef(false);
    const processedLocationKeyRef = useRef<string | null>(null);

    const normalizeUrl = (u: string) => u.replace(/\/$/, '').split('#')[0];

    useEffect(() => {
        if (isNavigatingRef.current) {
            isNavigatingRef.current = false;
            return;
        }

        // Prevent double processing in StrictMode
        if (processedLocationKeyRef.current === location.key) {
            return;
        }
        processedLocationKeyRef.current = location.key;

        const currentUrl = location.pathname;
        const activeTab = tabs.find(t => t.id === activeTabId);

        // If the current browser URL matches the active tab's URL perfectly, do nothing.
        if (activeTab && normalizeUrl(activeTab.url) === normalizeUrl(currentUrl) && activeTab.search === location.search) {
            return;
        }

        // Dashboard is outside the workspace tabs context. We should just deactivate all tabs.
        if (currentUrl === '/dashboard' || currentUrl.startsWith('/dashboard/')) {
            dispatch(setActiveTab(null));
            return;
        }

        // Did the user explicitly request a new tab? (e.g. clicked a link in the Sidebar)
        const isNewTabRequest = location.state?.newTab === true;

        if (isNewTabRequest) {
            // Check if a tab with this exact URL already exists
            const existingTab = tabs.find(t => normalizeUrl(t.url) === normalizeUrl(currentUrl));
            console.log('[DEBUG] isNewTabRequest for:', currentUrl, 'Found existing tab?', !!existingTab, 'Current tabs:', tabs.map(t => t.url));
            
            if (existingTab) {
                // Switch to the existing tab and update its search params
                console.log('[DEBUG] Switching to existing tab:', existingTab.id);
                dispatch(updateTabUrl({
                    id: existingTab.id,
                    url: currentUrl,
                    search: location.search,
                    title: resolveTabTitle(currentUrl)
                }));
                dispatch(setActiveTab(existingTab.id));
                isNavigatingRef.current = true;
                navigate(currentUrl + location.search, { replace: true, state: {} });
            } else {
                // Open a new tab
                console.log('[DEBUG] Creating new tab for:', currentUrl);
                dispatch(addTab({
                    id: nanoid(),
                    url: currentUrl,
                    search: location.search,
                    title: resolveTabTitle(currentUrl),
                    isPinned: false
                }));
                // Clear the state so refreshing doesn't keep opening new tabs
                isNavigatingRef.current = true;
                navigate(currentUrl + location.search, { replace: true, state: {} });
            }
        } else {
            // It's an in-page navigation (e.g., clicking a project card) or a direct URL visit.
            
            // Wait, is it a cross-module navigation without newTab:true?
            // If the base URL changed completely (e.g., /reports to /tasks), we should ideally treat it as a new tab request or switch to existing.
            // But if it's just in-page navigation, update the active tab.
            
            const isBaseUrlChanged = activeTab && normalizeUrl(activeTab.url) !== normalizeUrl(currentUrl);

            if (activeTabId && tabs.length > 0 && !isBaseUrlChanged) {
                // Update the active tab's URL to reflect the new navigation
                dispatch(updateTabUrl({
                    id: activeTabId,
                    url: currentUrl,
                    search: location.search,
                    title: resolveTabTitle(currentUrl)
                }));
            } else {
                // We are coming from outside (e.g., Dashboard) or initial load, OR base URL changed significantly
                // Check if a tab for this URL already exists in the background!
                const existingTab = tabs.find(t => normalizeUrl(t.url) === normalizeUrl(currentUrl));
                if (existingTab) {
                    dispatch(updateTabUrl({
                        id: existingTab.id,
                        url: currentUrl,
                        search: location.search,
                        title: resolveTabTitle(currentUrl)
                    }));
                    dispatch(setActiveTab(existingTab.id));
                } else {
                    dispatch(addTab({
                        id: nanoid(),
                        url: currentUrl,
                        search: location.search,
                        title: resolveTabTitle(currentUrl),
                        isPinned: false
                    }));
                }
            }
        }
    }, [location, tabs, activeTabId, dispatch, navigate]);

    // Expose a manual switch method for the TabBar
    const switchTab = (tabId: string) => {
        const tab = tabs.find(t => t.id === tabId);
        if (tab && tab.id !== activeTabId) {
            dispatch(setActiveTab(tab.id));
            isNavigatingRef.current = true;
            navigate(tab.url + tab.search);
        }
    };

    const closeTab = (tabId: string) => {
        const index = tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;
        
        if (activeTabId === tabId) {
            // We are closing the active tab. Find the next tab to activate.
            const remainingTabs = tabs.filter(t => t.id !== tabId);
            const nextTab = remainingTabs.length > 0 ? remainingTabs[Math.min(index, remainingTabs.length - 1)] : null;
            
            dispatch(removeTab(tabId));
            
            if (nextTab) {
                isNavigatingRef.current = true;
                navigate(nextTab.url + nextTab.search);
            } else {
                isNavigatingRef.current = true;
                navigate('/dashboard');
            }
        } else {
            // Closing a background tab. Browser URL doesn't need to change.
            dispatch(removeTab(tabId));
        }
    };

    const clearAll = () => {
        dispatch(closeAllTabs());
        // Since closeAllTabs preserves pinned tabs, we need to check if any tabs are left.
        // We'll read from the current Redux state (which might be slightly delayed) or just
        // rely on the next render. But to navigate immediately:
        const remainingTabs = tabs.filter(t => t.isPinned);
        if (remainingTabs.length > 0) {
            isNavigatingRef.current = true;
            navigate(remainingTabs[0].url + remainingTabs[0].search);
        } else {
            navigate('/dashboard');
        }
    };

    return { switchTab, closeTab, clearAll };
}
