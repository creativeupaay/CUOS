import { useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppSelector } from '@/app/hooks';
import { useGetMyProfileQuery } from '@/features/hrms/hrmsApi';
import { Settings, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import NotificationBell from '@/features/notification/components/NotificationBell';
import NotificationPanel from '@/features/notification/components/NotificationPanel';
import GlobalTimerWidget from '@/components/organisms/project/GlobalTimerWidget';
import { useNotificationSocket } from '@/features/notification/hooks/useNotificationSocket';

import { Toaster } from 'react-hot-toast';
import TabBar from './TabBar';
import DashboardRoutes from './DashboardRoutes';
/**
 * DashboardLayout
 *
 * Wraps all authenticated pages with:
 * - Fixed left sidebar (--sidebar-width)
 * - Sticky top bar with breadcrumb / page title
 * - Scrollable main content area with page-entry animation
 */

const ROUTE_TITLES: Record<string, string> = {
    '/projects': 'Projects',
    '/tasks': 'Tasks',
    '/tasks/daily-overview': 'Daily Overview',
    '/reports': 'Reports',
    '/finance': 'Finance',
    '/finance/cash-in-bank': 'Cash in Bank',
    '/finance/expenses': 'Expenses',
    '/finance/salaries-payrolls': 'Salaries & Payrolls',
    '/finance/invoices': 'Invoices',
    '/finance/reports': 'Reports',
    '/crm/pipeline': 'Pipeline',
    '/crm/leads': 'Leads',
    '/crm/proposals': 'Proposals',
    '/crm/clients': 'Clients',
    '/hrms': 'HR Dashboard',
    '/hrms/employees': 'Employees',
    '/hrms/attendance': 'Attendance',
    '/hrms/leaves': 'Leave Management',
    '/hrms/holidays': 'Holidays',
    '/hrms/payroll': 'Payroll',
    '/hrms/announcements': 'Company Announcements',
    '/hrms/reimbursements': 'Reimbursements',
    '/my-hrms/profile': 'Personal Details',
    '/my-hrms/change-password': 'Change Password',
    '/my-hrms/attendance': 'My Attendance',
    '/my-hrms/leaves': 'My Leaves',
    '/my-hrms/holidays': 'Holidays',
    '/my-hrms/payroll': 'My Payroll',
    '/my-hrms/announcements': 'Announcements',
    '/my-hrms/reimbursements': 'Expenses & Reimbursements',
    '/admin': 'Admin Panel',
    '/admin/users': 'Users',
    '/admin/permissions': 'Permissions',
    '/admin/settings': 'Settings',
    '/admin/audit-logs': 'Audit Logs',
    '/admin/partners/dashboard': 'Partner Dashboard',
    '/admin/partners/manage': 'Manage Partners',
    '/partner-admin': 'Team Management',
    '/partner-admin/team': 'Team Members',
    '/hiring/assignments': 'Assignment',
    '/games': 'Game Zone',
    '/leaderboard': 'Leaderboard',
    '/games/imposter': 'Imposter',
    '/games/imposter/create': 'Create Game',
    '/games/quiz/create': 'Create Quiz Game',
};

function resolveTitle(pathname: string): string {
    // Exact match first
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
    
    // Quiz dynamic routes
    if (pathname.startsWith('/games/quiz/') && pathname !== '/games/quiz/create') {
        return 'Quiz Game';
    }
    // Project detail pages
    if (pathname.startsWith('/projects/') && pathname !== '/projects/new') return 'Project';
    if (pathname === '/projects/new') return 'New Project';

    // Employee detail pages
    if (pathname.startsWith('/hrms/employees/') && pathname !== '/hrms/employees/new') {
        return pathname.endsWith('/edit') ? 'Edit Employee' : 'Employee Details';
    }
    if (pathname === '/hrms/employees/new') return 'New Employee';

    // Client detail pages
    if (pathname.startsWith('/crm/clients/') && pathname !== '/crm/clients/new') {
        return pathname.endsWith('/edit') ? 'Edit Client' : 'Client Details';
    }
    if (pathname === '/crm/clients/new') return 'New Client';

    if (pathname.startsWith('/admin/partners/manage/')) {
        return pathname.endsWith('/edit') ? 'Edit Partner' : 'Partner Details';
    }

    // Lead detail pages
    if (pathname.startsWith('/crm/leads/') && pathname !== '/crm/leads/new') {
        return 'Lead Details';
    }

    // Hiring detail pages
    if (pathname.startsWith('/hiring/applications/')) {
        return 'Application Details';
    }
    if (pathname === '/hiring/applications') return 'Applications';
    if (pathname.startsWith('/hiring/jobs/') && pathname.endsWith('/edit')) return 'Edit Job Posting';
    if (pathname === '/hiring/jobs/new') return 'Create Job Posting';
    if (pathname === '/hiring/jobs') return 'Job Postings';
    if (pathname === '/hiring/interviews') return 'Interviews';
    if (pathname === '/hiring/reports') return 'Reports';

    // Reimbursement detail pages
    if (pathname.startsWith('/hrms/reimbursements/employees/')) {
        return 'Employee Reimbursement History';
    }

    // Fallback: capitalise last segment
    const last = pathname.split('/').filter(Boolean).pop() || '';
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

export default function DashboardLayout() {
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);
    const backgroundLocation = (location.state as { backgroundLocation?: { pathname: string } } | null)?.backgroundLocation;
    const effectivePathname = backgroundLocation?.pathname || location.pathname;
    const pageTitle = resolveTitle(effectivePathname);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const initials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U';

    // Check if user is a partner
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isPartner = roleName === 'partner';
    // DashboardLayout owns the notification socket setup and page title.
    // Avatar/profile photo is handled by Sidebar which already has its own
    // useGetMyProfileQuery subscription — no need to duplicate it here.
    // We re-use the same cache via a second subscription only for the topbar avatar.
    const { data: profileData } = useGetMyProfileQuery(undefined, { skip: isPartner });
    const profilePhotoUrl = (profileData?.data?.employee as any)?.profilePhoto?.url;

    // Initialize notification socket listeners
    useNotificationSocket();

    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [effectivePathname]);

    const { tabs, activeTabId } = useAppSelector(state => state.workspace);

    return (
        <div
            className="min-h-screen"
            style={{
                background: isPartner
                    ? 'linear-gradient(to bottom right, #EEF2FF, #FEFEFE, #F3E8FF)'
                    : 'var(--color-bg-app)'
            }}
        >


            {/* Global toast notifications for mutations (success / error) */}
            <Toaster
                position="bottom-right"
                gutter={10}
                toastOptions={{
                    duration: 3500,
                    style: {
                        fontFamily: 'Outfit, system-ui, sans-serif',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '10px',
                        padding: '10px 14px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                        maxWidth: '380px',
                    },
                    success: {
                        iconTheme: { primary: '#16A34A', secondary: '#fff' },
                        style: { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' },
                    },
                    error: {
                        iconTheme: { primary: '#DC2626', secondary: '#fff' },
                        style: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
                    },
                }}
            />
            {/* ── Desktop Sidebar ─────────────────────────────────── */}
            <div className="hidden lg:block print:hidden">
                <Sidebar />
            </div>

            {/* ── Mobile Sidebar — always mounted, shown via CSS transform ────────
                 Using CSS instead of conditional rendering prevents Sidebar from
                 remounting (and re-firing its API queries) on every menu toggle. */}
            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}
            <aside
                className="fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-in-out"
                style={{
                    width: 'min(88vw, var(--sidebar-width))',
                    transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                }}
                aria-hidden={!mobileSidebarOpen}
            >
                <Sidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
            </aside>

            {/* ── Content area ───────────────────────────────────────── */}
            <div className="lg:ml-[var(--sidebar-width)] print:ml-0">

                {/* ── Sticky top bar ─────────────────────────────────── */}
                <header
                    className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-5 lg:px-7 print:hidden"
                    style={{
                        height: 'var(--topbar-height)',
                        background: 'rgba(255,255,255,0.88)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        borderBottom: '1px solid var(--color-border-default)',
                        boxShadow: 'var(--shadow-xs)',
                    }}
                >
                    {/* Page title */}
                    <div className="flex items-center gap-2 flex-1">
                        {/* Mobile menu toggle */}
                        <button
                            onClick={() => setMobileSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-2 rounded-lg"
                            style={{ color: 'var(--color-text-secondary)' }}
                            aria-label="Open navigation"
                        >
                            <Menu size={20} />
                        </button>
                        <h1
                            className="text-base font-bold truncate"
                            style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
                        >
                            {pageTitle}
                        </h1>
                    </div>

                    {/* Right: timer + profile + notifications */}
                    <div className="flex items-center justify-end gap-4 flex-1">
                        {/* Timer */}
                        <div className="shrink-0">
                            <GlobalTimerWidget />
                        </div>

                        {/* Avatar — clickable to open settings */}
                        <Link to="/my-hrms/profile" title="My Profile & Settings" className="shrink-0 transition-transform hover:scale-105 active:scale-95">
                            {profilePhotoUrl ? (
                                <img
                                    src={profilePhotoUrl}
                                    alt={user?.name || 'Profile'}
                                    className="w-8 h-8 rounded-full object-cover"
                                />
                            ) : (
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{
                                        background: isPartner
                                            ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                                            : 'linear-gradient(135deg, #059669, #0EA5E9)'
                                    }}
                                >
                                    {initials}
                                </div>
                            )}
                        </Link>

                        {/* Notification Bell (far right) */}
                        <NotificationBell />
                    </div>
                </header>

                {/* ── Workspace Tab Bar ──────────────────────────────── */}
                <div className="sticky z-10 print:hidden" style={{ top: 'var(--topbar-height)' }}>
                    <TabBar />
                </div>

                {/* ── Page content ───────────────────────────────────── */}
                {(() => {
                    const isGameRoute = effectivePathname.startsWith('/games') || effectivePathname === '/leaderboard';
                    return (
                        <main
                            className="page-enter relative"
                            style={{ minHeight: 'calc(100vh - var(--topbar-height) - 40px)' }}
                        >
                            <div className={isGameRoute ? 'p-0 h-[calc(100vh-var(--topbar-height)-40px)]' : 'px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7'}>
                                {tabs.length === 0 || !activeTabId ? (
                                    <DashboardRoutes />
                                ) : null}
        
                                {tabs.map(tab => (
                                        <div key={tab.id} style={{ display: tab.id === activeTabId ? 'block' : 'none', height: '100%' }}>
                                            <DashboardRoutes location={tab.url + tab.search} />
                                        </div>
                                ))}
                            </div>
                        </main>
                    );
                })()}
            </div>

            {/* Notification Panel */}
            <NotificationPanel />
        </div>
    );
}
