import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { addTab, setActiveTab, updateTabUrl, removeTab, closeAllTabs, sanitizeTabs } from '@/features/workspace/workspaceSlice';
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
    
    if (pathname === '/announcements' || pathname === '/hrms/announcements' || pathname === '/my-hrms/announcements') {
        return 'Announcements';
    }

    if (segments[0] === 'hrms' && segments[1]) {
        if (segments[1] === 'employees') return 'Employees';
        if (segments[1] === 'attendance') return 'Attendance';
        if (segments[1] === 'leaves') return 'Leaves';
        if (segments[1] === 'holidays') return 'Holidays';
        if (segments[1] === 'payroll') return 'Payroll';
        if (segments[1] === 'announcements') return 'Announcements';
        if (segments[1] === 'reimbursements') {
            if (segments[2] === 'employees' && segments[3]) return 'Employee Reimbursement';
            return 'Reimbursements';
        }
    }

    if (segments[0] === 'my-hrms' && segments[1]) {
        if (segments[1] === 'change-password') return 'Change Password';
        if (segments[1] === 'announcements') return 'Announcements';
        return 'My ' + (segments[1].charAt(0).toUpperCase() + segments[1].slice(1));
    }
    
    // Fallback to capitalizing the last segment
    const last = segments[segments.length - 1];
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

/**
 * Resolves a stable "group key" for dynamic detail paths.
 * Detail pages in the same group share a single tab slot.
 */
export function resolveTabGroup(pathname: string): string | undefined {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return undefined;

    // /projects/:id (but not /projects or /projects/new)
    if (segments[0] === 'projects' && segments[1] && segments[1] !== 'new') {
        return 'projects-detail-' + segments[1];
    }

    // /crm/leads/:id
    if (segments[0] === 'crm' && segments[1] === 'leads' && segments[2]) {
        return 'crm-lead-detail-' + segments[2];
    }

    // /crm/clients/:id
    if (segments[0] === 'crm' && segments[1] === 'clients' && segments[2]) {
        return 'crm-client-detail-' + segments[2];
    }

    // /hrms/employees/:id
    if (segments[0] === 'hrms' && segments[1] === 'employees' && segments[2]) {
        return 'hrms-employee-detail-' + segments[2];
    }

    // /hrms/reimbursements/employees/:id
    if (segments[0] === 'hrms' && segments[1] === 'reimbursements' && segments[2] === 'employees' && segments[3]) {
        return 'hrms-reimbursement-employee-' + segments[3];
    }

    // /hiring/applications/:id
    if (segments[0] === 'hiring' && segments[1] === 'applications' && segments[2]) {
        return 'hiring-application-detail-' + segments[2];
    }

    if (pathname === '/announcements' || pathname === '/hrms/announcements' || pathname === '/my-hrms/announcements') {
        return 'hrms-announcements';
    }

    return undefined;
}

export function useWorkspaceTabsManager() {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { tabs, activeTabId } = useAppSelector(state => state.workspace);
    const user = useAppSelector(state => state.auth.user);
    
    const isNavigatingRef = useRef(false);
    const processedLocationKeyRef = useRef<string | null>(null);

    const normalizeUrl = (u: string) => {
        const norm = (u || '').toLowerCase().replace(/\/+$/, '').split('?')[0].split('#')[0];
        if (norm === '/announcements' || norm === '/hrms/announcements' || norm === '/my-hrms/announcements') {
            return 'canonical-announcements';
        }
        return norm;
    };

    // Sanitize any existing duplicates on load
    useEffect(() => {
        dispatch(sanitizeTabs());
    }, [dispatch]);

    useEffect(() => {
        if (isNavigatingRef.current) {
            isNavigatingRef.current = false;
            return;
        }

        // Prevent double processing in StrictMode / React re-renders
        if (processedLocationKeyRef.current === location.key) {
            return;
        }
        processedLocationKeyRef.current = location.key;

        let currentUrl = location.pathname;
        if (currentUrl === '/announcements') {
            const isHrAdmin = user?.role === 'admin' || user?.role === 'super-admin' || user?.modulePermissions?.hrms?.adminAccess === true;
            currentUrl = isHrAdmin ? '/hrms/announcements' : '/my-hrms/announcements';
        }
        const activeTab = tabs.find(t => t.id === activeTabId);

        // If the current browser URL matches the active tab's URL perfectly, do nothing.
        if (activeTab && normalizeUrl(activeTab.url) === normalizeUrl(currentUrl) && activeTab.search === location.search) {
            return;
        }

        // Dashboard is outside the workspace tabs context. Deactivate all tabs.
        if (currentUrl === '/dashboard' || currentUrl.startsWith('/dashboard/')) {
            dispatch(setActiveTab(null));
            return;
        }

        // 1. Check if ANY tab already matches this exact URL/path
        const exactTab = tabs.find(t => normalizeUrl(t.url) === normalizeUrl(currentUrl));

        // 2. Check for dynamic route group match (e.g. within same project /crm/leads/:id)
        const group = resolveTabGroup(currentUrl);
        const groupTab = !exactTab && group ? tabs.find(t => t.group === group) : null;

        const targetTab = exactTab || groupTab;
        const isNewTabRequest = location.state?.newTab === true;

        if (targetTab) {
            // Tab already exists! Switch to it and update URL/title
            if (targetTab.id !== activeTabId) {
                dispatch(setActiveTab(targetTab.id));
            }
            dispatch(updateTabUrl({
                id: targetTab.id,
                url: currentUrl,
                search: location.search,
                title: resolveTabTitle(currentUrl),
            }));
            if (isNewTabRequest) {
                isNavigatingRef.current = true;
                navigate(currentUrl + location.search, { replace: true, state: {} });
            }
            return;
        }

        if (isNewTabRequest) {
            // Open a genuinely new tab
            dispatch(addTab({
                id: nanoid(),
                url: currentUrl,
                search: location.search,
                title: resolveTabTitle(currentUrl),
                isPinned: false,
                group,
            }));
            isNavigatingRef.current = true;
            navigate(currentUrl + location.search, { replace: true, state: {} });
        } else {
            // In-page navigation without newTab flag
            const getBaseModule = (u: string) => {
                const norm = (u || '').toLowerCase().replace(/\/+$/, '').split('?')[0].split('#')[0];
                if (norm === 'canonical-announcements' || norm === '/announcements' || norm.includes('/announcements')) return 'hrms';
                const base = u.split('/')[1];
                return base === 'my-hrms' ? 'hrms' : base;
            };
            const isBaseUrlChanged = activeTab && getBaseModule(normalizeUrl(activeTab.url)) !== getBaseModule(normalizeUrl(currentUrl));

            if (activeTabId && tabs.length > 0 && !isBaseUrlChanged) {
                dispatch(updateTabUrl({
                    id: activeTabId,
                    url: currentUrl,
                    search: location.search,
                    title: resolveTabTitle(currentUrl),
                }));
            } else {
                dispatch(addTab({
                    id: nanoid(),
                    url: currentUrl,
                    search: location.search,
                    title: resolveTabTitle(currentUrl),
                    isPinned: false,
                    group,
                }));
            }
        }
    }, [location, tabs, activeTabId, dispatch, navigate, user]);

    // Expose a manual switch method for the TabBar
    const switchTab = (tabId: string) => {
        const tab = tabs.find(t => t.id === tabId);
        if (tab && tab.id !== activeTabId) {
            dispatch(setActiveTab(tab.id));
            const targetUrl = tab.url + tab.search;
            if (normalizeUrl(tab.url) !== normalizeUrl(location.pathname) || tab.search !== location.search) {
                isNavigatingRef.current = true;
                navigate(targetUrl);
            }
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
