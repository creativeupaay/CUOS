import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppSelector } from '@/app/hooks';
import { useGetMyProfileQuery } from '@/features/hrms/hrmsApi';
import { Settings, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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
    '/finance': 'Finance',
    '/finance/expenses': 'Expenses',
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
    '/my-hrms/profile': 'Personal Details',
    '/my-hrms/change-password': 'Change Password',
    '/my-hrms/attendance': 'My Attendance',
    '/my-hrms/leaves': 'My Leaves',
    '/my-hrms/holidays': 'Holidays',
    '/my-hrms/payroll': 'My Payroll',
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
};

function resolveTitle(pathname: string): string {
    // Exact match first
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
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

    // Fallback: capitalise last segment
    const last = pathname.split('/').filter(Boolean).pop() || '';
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

export default function DashboardLayout() {
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);
    const pageTitle = resolveTitle(location.pathname);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const initials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U';

    const { data: profileData } = useGetMyProfileQuery();
    const profilePhotoUrl = (profileData?.data?.employee as any)?.profilePhoto?.url;

    // Check if user is a partner
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isPartner = roleName === 'partner';

    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [location.pathname]);

    return (
        <div
            className="min-h-screen"
            style={{
                background: isPartner
                    ? 'linear-gradient(to bottom right, #EEF2FF, #FEFEFE, #F3E8FF)'
                    : 'var(--color-bg-app)'
            }}
        >
            <div className="hidden lg:block">
                <Sidebar />
            </div>

            {mobileSidebarOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                        onClick={() => setMobileSidebarOpen(false)}
                    />
                    <aside
                        className="fixed inset-y-0 left-0 z-50 lg:hidden"
                        style={{ width: 'min(88vw, var(--sidebar-width))' }}
                    >
                        <div className="relative h-full">
                            <button
                                onClick={() => setMobileSidebarOpen(false)}
                                className="absolute top-4 right-4 z-10 p-2 rounded-lg"
                                style={{
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'rgba(255,255,255,0.92)',
                                    border: '1px solid var(--color-border-default)',
                                }}
                            >
                                <X size={18} />
                            </button>
                            <Sidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
                        </div>
                    </aside>
                </>
            )}

            {/* ── Content area ───────────────────────────────────────── */}
            <div className="lg:ml-[var(--sidebar-width)]">

                {/* ── Sticky top bar ─────────────────────────────────── */}
                <header
                    className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-5 lg:px-7"
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
                    <div className="flex items-center gap-3 min-w-0">
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

                    {/* Right: name + avatar + settings */}
                    <div className="flex items-center gap-2.5">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                                {user?.name || 'User'}
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                {user?.email || ''}
                            </div>
                        </div>

                        {/* Avatar — display only, not clickable */}
                        <div className="shrink-0">
                            {profilePhotoUrl ? (
                                <img
                                    src={profilePhotoUrl}
                                    alt={user?.name || 'Profile'}
                                    className="w-8 h-8 rounded-full object-cover"
                                    style={{ boxShadow: 'var(--shadow-brand)' }}
                                />
                            ) : (
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{
                                        background: isPartner
                                            ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                                            : 'linear-gradient(135deg, #059669, #0EA5E9)',
                                        boxShadow: 'var(--shadow-brand)'
                                    }}
                                >
                                    {initials}
                                </div>
                            )}
                        </div>

                        {/* Settings button — opens My Profile */}
                        <Link
                            to="/my-hrms/profile"
                            title="My Profile &amp; Settings"
                            className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors hover:bg-gray-100"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            <Settings size={15} />
                        </Link>
                    </div>
                </header>

                {/* ── Page content ───────────────────────────────────── */}
                <main
                    className="page-enter"
                    style={{ minHeight: 'calc(100vh - var(--topbar-height))' }}
                >
                    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
