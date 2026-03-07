import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import { useLogoutMutation } from '@/features/auth/authApi';
import { api } from '@/services/api';
import { useGetProjectsQuery } from '@/features/project/projectApi';
import {
    ArrowLeft, FolderKanban, Users2, ListTodo, BarChart3,
    FileText, LogOut, ChevronRight, ChevronDown, ShieldCheck,
    ScrollText, Settings, DollarSign, Receipt, CreditCard,
    TrendingUp, Clock, CalendarDays,
} from 'lucide-react';

interface NavItem {
    key?: string;
    label: string;
    path: string;
    icon: React.ReactNode;
    matchPrefix?: string;
    subItems?: { label: string; path: string }[];
}
interface ModuleConfig { title: string; items: NavItem[] }

function getModuleConfig(
    pathname: string,
    user: any,
    isAdmin: boolean,
    projects?: { _id: string; name: string }[],
    isHrAdmin?: boolean
): ModuleConfig | null {
    const mp = user?.modulePermissions;

    if (pathname.startsWith('/projects')) {
        const pmPerms = mp?.projectManagement;
        const hasAccess = isAdmin || (pmPerms?.enabled && Array.isArray(pmPerms?.projectPermissions) && pmPerms.projectPermissions.length > 0);
        if (!hasAccess) return null;
        const projectSubItems = projects?.map(p => ({ label: p.name, path: `/projects/${p._id}` })) || [];
        return {
            title: 'Project Management',
            items: [{ label: 'Projects', path: '/projects', icon: <FolderKanban size={18} />, matchPrefix: '/projects', subItems: projectSubItems }],
        };
    }
    if (pathname.startsWith('/finance')) {
        const finSubs = mp?.finance?.subModules;
        const allItems = [
            { key: 'dashboard', label: 'Dashboard', path: '/finance', icon: <DollarSign size={18} />, matchPrefix: '/finance' },
            { key: 'expenses', label: 'Expenses', path: '/finance/expenses', icon: <Receipt size={18} />, matchPrefix: '/finance/expenses' },
            { key: 'invoices', label: 'Invoices', path: '/finance/invoices', icon: <CreditCard size={18} />, matchPrefix: '/finance/invoices' },
            { key: 'reports', label: 'Reports', path: '/finance/reports', icon: <TrendingUp size={18} />, matchPrefix: '/finance/reports' },
        ];
        return { title: 'Finance', items: isAdmin || !finSubs ? allItems : allItems.filter(i => (finSubs as any)[i.key] === true) };
    }
    if (pathname.startsWith('/crm')) {
        const crmSubs = mp?.crm?.subModules;
        const allItems = [
            { key: 'pipeline', label: 'Pipeline', path: '/crm/pipeline', icon: <BarChart3 size={18} />, matchPrefix: '/crm/pipeline' },
            { key: 'leads', label: 'Leads', path: '/crm/leads', icon: <Users2 size={18} />, matchPrefix: '/crm/leads' },
            { key: 'proposals', label: 'Proposals', path: '/crm/proposals', icon: <FileText size={18} />, matchPrefix: '/crm/proposals' },
            { key: 'clients', label: 'Clients', path: '/crm/clients', icon: <Users2 size={18} />, matchPrefix: '/crm/clients' },
        ];
        return { title: 'CRM', items: isAdmin || !crmSubs ? allItems : allItems.filter(i => (crmSubs as any)[i.key] === true) };
    }
    if (pathname.startsWith('/hrms') && !pathname.startsWith('/my-hrms')) {
        if (!isAdmin && !isHrAdmin) {
            return {
                title: 'My HRMS',
                items: [
                    { key: 'attendance', label: 'Attendance', path: '/my-hrms/attendance', icon: <Clock size={18} />, matchPrefix: '/my-hrms/attendance' },
                    { key: 'leaves', label: 'Leaves', path: '/my-hrms/leaves', icon: <ListTodo size={18} />, matchPrefix: '/my-hrms/leaves' },
                    { key: 'holidays', label: 'Holidays', path: '/my-hrms/holidays', icon: <CalendarDays size={18} />, matchPrefix: '/my-hrms/holidays' },
                    { key: 'payroll', label: 'Payroll', path: '/my-hrms/payroll', icon: <FileText size={18} />, matchPrefix: '/my-hrms/payroll' },
                ],
            };
        }
        const hrmsSubs = mp?.hrms?.subModules;
        const allItems = [
            { key: 'dashboard', label: 'Dashboard', path: '/hrms', icon: <BarChart3 size={18} />, matchPrefix: '/hrms' },
            { key: 'employees', label: 'Employees', path: '/hrms/employees', icon: <Users2 size={18} />, matchPrefix: '/hrms/employees' },
            { key: 'attendance', label: 'Attendance', path: '/hrms/attendance', icon: <Clock size={18} />, matchPrefix: '/hrms/attendance' },
            { key: 'leaves', label: 'Leaves', path: '/hrms/leaves', icon: <ListTodo size={18} />, matchPrefix: '/hrms/leaves' },
            { key: 'holidays', label: 'Holidays', path: '/hrms/holidays', icon: <CalendarDays size={18} />, matchPrefix: '/hrms/holidays' },
            { key: 'payroll', label: 'Payroll', path: '/hrms/payroll', icon: <FileText size={18} />, matchPrefix: '/hrms/payroll' },
        ];
        return { title: 'HRMS', items: isAdmin || !hrmsSubs ? allItems : allItems.filter(i => (hrmsSubs as any)[i.key] === true) };
    }
    if (pathname.startsWith('/my-hrms')) {
        return {
            title: 'My HRMS',
            items: [
                { key: 'attendance', label: 'Attendance', path: '/my-hrms/attendance', icon: <Clock size={18} />, matchPrefix: '/my-hrms/attendance' },
                { key: 'leaves', label: 'Leaves', path: '/my-hrms/leaves', icon: <ListTodo size={18} />, matchPrefix: '/my-hrms/leaves' },
                { key: 'holidays', label: 'Holidays', path: '/my-hrms/holidays', icon: <CalendarDays size={18} />, matchPrefix: '/my-hrms/holidays' },
                { key: 'payroll', label: 'Payroll', path: '/my-hrms/payroll', icon: <FileText size={18} />, matchPrefix: '/my-hrms/payroll' },
            ],
        };
    }
    if (pathname.startsWith('/admin')) {
        const adminSubs = mp?.overallAdmin?.subModules;
        const allItems = [
            { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: <BarChart3 size={18} />, matchPrefix: '/admin' },
            { key: 'users', label: 'Users', path: '/admin/users', icon: <Users2 size={18} />, matchPrefix: '/admin/users' },
            { key: 'permissions', label: 'Permissions', path: '/admin/permissions', icon: <ShieldCheck size={18} />, matchPrefix: '/admin/permissions' },
            { key: 'settings', label: 'Settings', path: '/admin/settings', icon: <Settings size={18} />, matchPrefix: '/admin/settings' },
            { key: 'auditLogs', label: 'Audit Logs', path: '/admin/audit-logs', icon: <ScrollText size={18} />, matchPrefix: '/admin/audit-logs' },
        ];
        const filteredItems = isAdmin || !adminSubs
            ? allItems
            : allItems.filter(i => i.key === 'dashboard' || (adminSubs as any)[i.key] === true);
        return { title: 'Admin Panel', items: filteredItems };
    }
    return null;
}

function isItemActive(item: NavItem, pathname: string, allItems: NavItem[]): boolean {
    if (!item.matchPrefix) return false;
    if (item.subItems?.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'))) return true;
    const sorted = [...allItems].filter(i => i.matchPrefix).sort((a, b) => (b.matchPrefix?.length || 0) - (a.matchPrefix?.length || 0));
    const bestMatch = sorted.find(i => pathname.startsWith(i.matchPrefix!));
    return bestMatch?.path === item.path;
}

/* ── Nav Item ──────────────────────────────────────────────── */
const NavItemComponent = ({ item, active, pathname }: { item: NavItem; active: boolean; pathname: string }) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isSubItemActive = hasSubItems && item.subItems!.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'));
    const [isExpanded, setIsExpanded] = useState(active || isSubItemActive);

    useEffect(() => {
        if (active || isSubItemActive) setIsExpanded(true);
    }, [pathname, active, isSubItemActive]);

    const toggleExpand = (e: React.MouseEvent) => {
        if (hasSubItems) { e.preventDefault(); setIsExpanded(!isExpanded); }
    };

    const isItemHighlighted = active && !isSubItemActive;

    return (
        <div>
            <NavLink
                to={item.path}
                end={item.path === '/projects'}
                onClick={toggleExpand}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 select-none relative"
                style={
                    isItemHighlighted
                        ? {
                            backgroundColor: 'var(--color-primary-soft)',
                            color: 'var(--color-primary-darker)',
                        }
                        : {
                            color: 'var(--color-text-secondary)',
                        }
                }
                onMouseEnter={(e) => {
                    if (!isItemHighlighted) {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isItemHighlighted) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                }}
            >
                {/* Active left bar */}
                {isItemHighlighted && (
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                        style={{ backgroundColor: 'var(--color-primary)', left: '-12px' }}
                    />
                )}

                {/* Icon */}
                <span
                    className="flex items-center justify-center w-7 h-7 rounded-lg transition-all shrink-0"
                    style={
                        isItemHighlighted
                            ? { backgroundColor: 'var(--color-primary)', color: 'white' }
                            : { color: 'inherit' }
                    }
                >
                    {item.icon}
                </span>

                <span className="flex-1 truncate">{item.label}</span>

                {hasSubItems && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                )}
                {!hasSubItems && isItemHighlighted && (
                    <ChevronRight size={13} style={{ color: 'var(--color-primary-dark)' }} />
                )}
            </NavLink>

            {/* Sub items */}
            {hasSubItems && isExpanded && (
                <div className="pl-10 mt-0.5 space-y-0.5">
                    {item.subItems!.map((sub) => {
                        const isSubActive = pathname === sub.path || pathname.startsWith(sub.path + '/');
                        return (
                            <NavLink
                                key={sub.path}
                                to={sub.path}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                                style={
                                    isSubActive
                                        ? { color: 'var(--color-primary-dark)', fontWeight: 600, backgroundColor: 'var(--color-primary-soft)' }
                                        : { color: 'var(--color-text-muted)' }
                                }
                                onMouseEnter={(e) => { if (!isSubActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                onMouseLeave={(e) => { if (!isSubActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                                <div
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: isSubActive ? 'var(--color-primary)' : 'var(--color-text-muted)', opacity: isSubActive ? 1 : 0.5 }}
                                />
                                <span className="truncate">{sub.label}</span>
                            </NavLink>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ── Sidebar ─────────────────────────────────────────────── */
export default function Sidebar() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);
    const [logoutApi] = useLogoutMutation();

    const handleLogout = async () => {
        try { await logoutApi().unwrap(); } catch { /* ignore */ }
        dispatch(logout());
        dispatch(api.util.resetApiState());
        navigate('/login');
    };

    const roleName = user?.role
        ? typeof user.role === 'object' ? (user.role as any).name?.toLowerCase() : String(user.role).toLowerCase()
        : '';
    const isAdmin = ['super-admin', 'admin', 'super_admin'].includes(roleName);
    const isHrAdmin = isAdmin || ['hr', 'hr-admin', 'hr_admin', 'hr-manager', 'hrmanager', 'human-resources'].includes(roleName);
    const displayRole = user?.role ? (typeof user.role === 'object' ? (user.role as any).name : String(user.role)) : 'User';

    const isPMRoute = location.pathname.startsWith('/projects');
    const { data: projectsResponse } = useGetProjectsQuery({}, { skip: !isPMRoute });
    const projects = projectsResponse?.data || [];
    const moduleConfig = getModuleConfig(location.pathname, user, isAdmin, projects, isHrAdmin);

    if (!moduleConfig) return null;

    return (
        <aside
            className="fixed top-0 left-0 h-screen flex flex-col"
            style={{
                width: 'var(--sidebar-width)',
                zIndex: 40,
                background: 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid var(--color-border-default)',
                boxShadow: 'var(--shadow-sm)',
            }}
        >
            {/* ── Brand ─────────────────────────────────────────────── */}
            <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                <div className="flex items-center gap-2.5 mb-4">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)', boxShadow: 'var(--shadow-brand)' }}
                    >
                        CU
                    </div>
                    <div>
                        <div className="font-bold text-sm" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>CUOS</div>
                        <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Creative Upaay</div>
                    </div>
                </div>

                {/* Back + Module name */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-1.5 text-xs font-medium mb-2 transition-colors duration-150"
                    style={{ color: 'var(--color-text-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary-dark)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                >
                    <ArrowLeft size={12} />
                    Back to Dashboard
                </button>
                <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                    <h2 className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {moduleConfig.title}
                    </h2>
                </div>
            </div>

            {/* ── Navigation ─────────────────────────────────────────── */}
            <nav className="flex-1 py-3 px-3 overflow-y-auto overflow-x-hidden">
                <div className="space-y-0.5 pl-3">
                    {moduleConfig.items.map((item) => {
                        const active = isItemActive(item, location.pathname, moduleConfig.items);
                        return (
                            <NavItemComponent
                                key={item.path}
                                item={item}
                                active={active}
                                pathname={location.pathname}
                            />
                        );
                    })}
                </div>
            </nav>

            {/* ── User section ───────────────────────────────────────── */}
            <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                <div
                    className="flex items-center gap-2.5 p-2.5 rounded-xl"
                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    {/* Avatar with gradient ring */}
                    <div className="relative shrink-0">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg,#059669,#0369a1)' }}
                        >
                            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div
                            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                            style={{ backgroundColor: 'var(--color-success)' }}
                        />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {user?.name || 'User'}
                        </div>
                        <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize"
                            style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-darker)', display: 'inline-block', marginTop: '1px' }}
                        >
                            {displayRole}
                        </span>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-lg transition-all duration-150 shrink-0"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Logout"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-danger-soft)';
                            e.currentTarget.style.color = 'var(--color-danger)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
