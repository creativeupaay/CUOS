import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAppSelector } from '@/app/hooks';
import { useGetMyProfileQuery } from '@/features/hrms/hrmsApi';
import { Settings } from 'lucide-react';

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
    '/my-hrms/profile': 'My Profile',
    '/my-hrms/attendance': 'My Attendance',
    '/my-hrms/leaves': 'My Leaves',
    '/my-hrms/holidays': 'Holidays',
    '/my-hrms/payroll': 'My Payroll',
    '/admin': 'Admin Panel',
    '/admin/users': 'Users',
    '/admin/permissions': 'Permissions',
    '/admin/settings': 'Settings',
    '/admin/audit-logs': 'Audit Logs',
};

function resolveTitle(pathname: string): string {
    // Exact match first
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
    // Project detail pages
    if (pathname.startsWith('/projects/') && pathname !== '/projects/new') return 'Project';
    if (pathname === '/projects/new') return 'New Project';
    // Fallback: capitalise last segment
    const last = pathname.split('/').filter(Boolean).pop() || '';
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

export default function DashboardLayout() {
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);
    const pageTitle = resolveTitle(location.pathname);

    const initials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U';

    const { data: profileData } = useGetMyProfileQuery();
    const profilePhotoUrl = (profileData?.data?.employee as any)?.profilePhoto?.url;

    return (
        <div
            className="min-h-screen"
            style={{ backgroundColor: 'var(--color-bg-app)' }}
        >
            <Sidebar />

            {/* ── Content area ───────────────────────────────────────── */}
            <div style={{ marginLeft: 'var(--sidebar-width)' }}>

                {/* ── Sticky top bar ─────────────────────────────────── */}
                <header
                    className="sticky top-0 z-20 flex items-center justify-between px-7"
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
                    <h1
                        className="text-base font-bold"
                        style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}
                    >
                        {pageTitle}
                    </h1>

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
                                    style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)', boxShadow: 'var(--shadow-brand)' }}
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
                    style={{ padding: '28px 32px', minHeight: 'calc(100vh - var(--topbar-height))' }}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
