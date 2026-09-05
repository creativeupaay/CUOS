import { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { useLogoutMutation } from '@/features/auth/authApi';
import { logout as logoutAction } from '@/features/auth/slices/authSlice';
import { api } from '@/services/api';
import { useGetProjectsQuery } from '@/features/project/projectApi';
import { useGetPartnersQuery } from '@/features/partners/partnersApi';
import { useCheckJobManagerStatusQuery } from '@/features/hiring/hiringApi';
import { hasHrmsSelfSubmoduleAccess, hasModuleAdminAccess, hasModuleViewAccess } from '@/utils/modulePermissions';
import {
    ArrowLeft, Users2, ListTodo, BarChart3,
    FileText, ChevronRight, ChevronDown, ShieldCheck,
    ScrollText, Settings, DollarSign, Receipt, TrendingUp,
    Clock, CalendarDays, Briefcase, CheckCircle, Megaphone,
    Folder, FolderOpen, Grid2X2, Building2, LogOut, Gamepad2, Trophy,
    PanelLeftClose,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';

interface NavItem {
    key?: string;
    label: string;
    path: string;
    icon: React.ReactNode;
    matchPrefix?: string;
    subItems?: { label: string; path: string }[];
    alwaysExpanded?: boolean;
}
interface ModuleConfig { title: string; items: NavItem[] }

type SidebarProject = {
    _id: string;
    name: string;
    partnerId?: any;
};

type ProjectFolderGroup = {
    id: string;
    name: string;
    path: string;
    kind: 'internal' | 'partner';
    projects: SidebarProject[];
};

function getSidebarPartnerId(project: SidebarProject): string {
    if (!project.partnerId) return '';
    return typeof project.partnerId === 'object' ? project.partnerId?._id || '' : String(project.partnerId);
}

function getSidebarPartnerName(project: SidebarProject): string {
    const partner = typeof project.partnerId === 'object' ? project.partnerId : undefined;
    return partner?.userId?.name || partner?.contactPerson || partner?.companyName || 'Partner';
}

function buildProjectFolderGroups(projects: SidebarProject[], partnerNameById?: Record<string, string>): ProjectFolderGroup[] {
    const internalProjects: SidebarProject[] = [];
    const partnerGroups = new Map<string, ProjectFolderGroup>();

    projects.forEach((project) => {
        const partnerId = getSidebarPartnerId(project);
        if (!partnerId) {
            internalProjects.push(project);
            return;
        }

        const existingGroup = partnerGroups.get(partnerId);
        if (existingGroup) {
            existingGroup.projects.push(project);
            return;
        }

        partnerGroups.set(partnerId, {
            id: partnerId,
            name: partnerNameById?.[partnerId] || getSidebarPartnerName(project),
            path: `/projects?partnerId=${encodeURIComponent(partnerId)}`,
            kind: 'partner',
            projects: [project],
        });
    });

    const sortedPartners = Array.from(partnerGroups.values()).sort((a, b) => a.name.localeCompare(b.name));
    const sortProjects = (items: SidebarProject[]) => items.sort((a, b) => a.name.localeCompare(b.name));

    return [
        {
            id: 'internal',
            name: 'Projects',
            path: '/projects?scope=internal',
            kind: 'internal',
            projects: sortProjects(internalProjects),
        },
        ...sortedPartners.map((group) => ({
            ...group,
            projects: sortProjects(group.projects),
        })),
    ];
}

function getModuleConfig(
    pathname: string,
    user: any,
    projects?: { _id: string; name: string }[],
    isJobManager?: boolean
): ModuleConfig | null {
    const mp = user?.modulePermissions;
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isPartner = roleName === 'partner';
    const isPartnerEmployee = !!user?.isPartnerEmployee;

    // ── Tasks hub — must be checked BEFORE the generic /projects block ──
    if (pathname.startsWith('/tasks') || pathname.startsWith('/reports')) {
        const hasAccess = hasModuleViewAccess(user, 'projectManagement') || (isPartner && mp?.projectManagement?.enabled);
        if (!hasAccess) return null;
        return {
            title: 'Tasks',
            items: [
                { label: 'My Tasks', path: '/tasks', icon: <ListTodo size={18} />, matchPrefix: '/tasks' },
                { label: 'Reports', path: '/reports', icon: <BarChart3 size={18} />, matchPrefix: '/reports' },
            ],
        };
    }

    if (pathname.startsWith('/projects')) {
        const hasAccess = hasModuleViewAccess(user, 'projectManagement') || (isPartner && mp?.projectManagement?.enabled);
        if (!hasAccess) return null;
        const projectSubItems = projects?.map(p => ({ label: p.name, path: `/projects/${p._id}` })) || [];
        return {
            title: 'Project Management',
            items: [
                { label: 'Dashboard', path: '/projects', icon: <Grid2X2 size={18} />, matchPrefix: '/projects', subItems: projectSubItems, alwaysExpanded: true },
            ],
        };
    }
    if (pathname.startsWith('/finance')) {
        if (isPartner) return null;
        if (!hasModuleViewAccess(user, 'finance')) return null;
        const finSubs = mp?.finance?.subModules;
        const allItems = [
            { key: 'dashboard', label: 'Dashboard', path: '/finance', icon: <DollarSign size={18} />, matchPrefix: '/finance' },
            { key: 'cashInBank', label: 'Cash In Bank', path: '/finance/cash-in-bank', icon: <Building2 size={18} />, matchPrefix: '/finance/cash-in-bank' },
            { key: 'revenue', label: 'Revenue', path: '/finance/revenue', icon: <TrendingUp size={18} />, matchPrefix: '/finance/revenue' },
            { key: 'expenses', label: 'Expenses', path: '/finance/expenses', icon: <Receipt size={18} />, matchPrefix: '/finance/expenses' },
            { key: 'salariesPayrolls', label: 'Salaries & Payrolls', path: '/finance/salaries-payrolls', icon: <Briefcase size={18} />, matchPrefix: '/finance/salaries-payrolls' },
        ];
        return {
            title: 'Finance',
            items: hasModuleAdminAccess(user, 'finance') || !finSubs
                ? allItems
                : allItems.filter((item) => {
                    if ((finSubs as any)[item.key] === true) return true;
                    return false;
                }),
        };
    }
    if (pathname.startsWith('/crm')) {
        if (!hasModuleViewAccess(user, 'crm')) {
            return null;
        }
        const crmSubs = mp?.crm?.subModules;
        const allItems = [
            { key: 'pipeline', label: 'Pipeline', path: '/crm/pipeline', icon: <BarChart3 size={18} />, matchPrefix: '/crm/pipeline' },
            { key: 'leads', label: 'Leads', path: '/crm/leads', icon: <Users2 size={18} />, matchPrefix: '/crm/leads' },
            { key: 'proposals', label: 'Proposals', path: '/crm/proposals', icon: <FileText size={18} />, matchPrefix: '/crm/proposals' },
            { key: 'clients', label: 'Clients', path: '/crm/clients', icon: <Users2 size={18} />, matchPrefix: '/crm/clients' },
        ];
        if (isPartner) {
            // Always expose the partner CRM trio even if legacy sub-module config still has clients-only.
            return {
                title: 'CRM',
                items: allItems.filter(i => i.key === 'pipeline' || i.key === 'leads' || i.key === 'clients')
            };
        }
        return { title: 'CRM', items: hasModuleAdminAccess(user, 'crm') || !crmSubs ? allItems : allItems.filter(i => (crmSubs as any)[i.key] === true) };
    }
    if (pathname.startsWith('/hrms') && !pathname.startsWith('/my-hrms')) {
        if (!hasModuleAdminAccess(user, 'hrms')) {
            // Regular employees shouldn't access /hrms - they'll be redirected by HrmsRedirect
            // Return null to hide sidebar during redirect
            return null;
        }
        const hrmsSubs = mp?.hrms?.subModules;
        const allItems = [
            { key: 'dashboard', label: 'Dashboard', path: '/hrms', icon: <BarChart3 size={18} />, matchPrefix: '/hrms' },
            { key: 'employees', label: 'Employees', path: '/hrms/employees', icon: <Users2 size={18} />, matchPrefix: '/hrms/employees' },
            { key: 'attendance', label: 'Attendance', path: '/hrms/attendance', icon: <Clock size={18} />, matchPrefix: '/hrms/attendance' },
            { key: 'leaves', label: 'Leaves', path: '/hrms/leaves', icon: <ListTodo size={18} />, matchPrefix: '/hrms/leaves' },
            { key: 'holidays', label: 'Holidays', path: '/hrms/holidays', icon: <CalendarDays size={18} />, matchPrefix: '/hrms/holidays' },
            { key: 'payroll', label: 'Payroll', path: '/hrms/payroll', icon: <FileText size={18} />, matchPrefix: '/hrms/payroll' },
            { key: 'reimbursements', label: 'Reimbursements', path: '/hrms/reimbursements', icon: <Receipt size={18} />, matchPrefix: '/hrms/reimbursements' },
            { key: 'announcements', label: 'Company Announcements', path: '/hrms/announcements', icon: <Megaphone size={18} />, matchPrefix: '/hrms/announcements' },
        ];
        return {
            title: 'HRMS',
            items: hasModuleAdminAccess(user, 'hrms') || !hrmsSubs
                ? allItems
                : allItems.filter(i => i.key === 'announcements' || (hrmsSubs as any)[i.key] === true),
        };
    }
    if (pathname.startsWith('/my-hrms')) {
        const isHrmsAdmin = hasModuleAdminAccess(user, 'hrms');

        // Check if accessing settings pages (profile or change-password)
        const isSettingsPath = pathname === '/my-hrms/profile' || pathname === '/my-hrms/change-password';

        // Check if accessing HRMS data pages (attendance, leaves, holidays, payroll)
        const isHrmsDataPath = pathname.startsWith('/my-hrms/attendance') ||
            pathname.startsWith('/my-hrms/leaves') ||
            pathname.startsWith('/my-hrms/holidays') ||
            pathname.startsWith('/my-hrms/payroll') ||
            pathname.startsWith('/my-hrms/announcements') ||
            pathname.startsWith('/my-hrms/reimbursements');

        const settingsItems = [
            { key: 'profile', label: 'Personal Details', path: '/my-hrms/profile', icon: <Users2 size={18} />, matchPrefix: '/my-hrms/profile' },
            { key: 'changePassword', label: 'Change Password', path: '/my-hrms/change-password', icon: <Settings size={18} />, matchPrefix: '/my-hrms/change-password' },
        ];
        const employeeHrmsItems = [
            { key: 'attendance', label: 'Attendance', path: '/my-hrms/attendance', icon: <Clock size={18} />, matchPrefix: '/my-hrms/attendance' },
            { key: 'leaves', label: 'Leaves', path: '/my-hrms/leaves', icon: <ListTodo size={18} />, matchPrefix: '/my-hrms/leaves' },
            { key: 'holidays', label: 'Holidays', path: '/my-hrms/holidays', icon: <CalendarDays size={18} />, matchPrefix: '/my-hrms/holidays' },
            { key: 'payroll', label: 'Payroll', path: '/my-hrms/payroll', icon: <FileText size={18} />, matchPrefix: '/my-hrms/payroll' },
            { key: 'reimbursements', label: 'Expenses & Reimbursements', path: '/my-hrms/reimbursements', icon: <Receipt size={18} />, matchPrefix: '/my-hrms/reimbursements' },
            { key: 'announcements', label: 'Announcements', path: '/my-hrms/announcements', icon: <Megaphone size={18} />, matchPrefix: '/my-hrms/announcements' },
        ];
        const visibleEmployeeHrmsItems = isHrmsAdmin
            ? employeeHrmsItems
            : employeeHrmsItems.filter((item) => hasHrmsSelfSubmoduleAccess(user, item.key as any));

        // For regular employees
        if (!isHrmsAdmin) {
            // If on settings pages, show only settings options
            if (isSettingsPath) {
                return {
                    title: 'Settings',
                    items: settingsItems,
                };
            }

            // If on HRMS data pages, show only HRMS options
            if (isHrmsDataPath) {
                return {
                    title: 'My HRMS',
                    items: visibleEmployeeHrmsItems,
                };
            }
        }

        // HRMS admins keep their own employee tabs under profile/settings.
        return {
            title: 'My HRMS',
            items: [...settingsItems, ...visibleEmployeeHrmsItems],
        };
    }
    if (pathname.startsWith('/admin/partners')) {
        if (isPartner || !hasModuleViewAccess(user, 'partners')) return null;
        return {
            title: 'Partners',
            items: [
                { label: 'Dashboard', path: '/admin/partners/dashboard', icon: <BarChart3 size={18} />, matchPrefix: '/admin/partners/dashboard' },
                { label: 'Manage Partners', path: '/admin/partners/manage', icon: <Users2 size={18} />, matchPrefix: '/admin/partners/manage' },
            ],
        };
    }
    if (pathname.startsWith('/admin')) {
        if (isPartner || !hasModuleViewAccess(user, 'overallAdmin')) return null;
        const adminSubs = mp?.overallAdmin?.subModules;
        const allItems = [
            { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: <BarChart3 size={18} />, matchPrefix: '/admin' },
            { key: 'users', label: 'Users', path: '/admin/users', icon: <Users2 size={18} />, matchPrefix: '/admin/users' },
            { key: 'permissions', label: 'Permissions', path: '/admin/permissions', icon: <ShieldCheck size={18} />, matchPrefix: '/admin/permissions' },
            { key: 'settings', label: 'Settings', path: '/admin/settings', icon: <Settings size={18} />, matchPrefix: '/admin/settings' },
            { key: 'auditLogs', label: 'Audit Logs', path: '/admin/audit-logs', icon: <ScrollText size={18} />, matchPrefix: '/admin/audit-logs' },
        ];
        const filteredItems = hasModuleAdminAccess(user, 'overallAdmin') || !adminSubs
            ? allItems
            : allItems.filter(i => i.key === 'dashboard' || (adminSubs as any)[i.key] === true);
        return { title: 'Admin Panel', items: filteredItems };
    }
    if (pathname.startsWith('/hiring')) {
        const hasAccess = hasModuleViewAccess(user, 'hiring', { isJobManager });
        if (!hasAccess) return null;

        const allItems = [
            { key: 'jobs', label: 'Job Postings', path: '/hiring/jobs', icon: <Briefcase size={18} />, matchPrefix: '/hiring/jobs' },
            { key: 'applications', label: 'Applications', path: '/hiring/applications', icon: <FileText size={18} />, matchPrefix: '/hiring/applications' },
            { key: 'assignments', label: 'Assignment', path: '/hiring/assignments', icon: <CheckCircle size={18} />, matchPrefix: '/hiring/assignments' },
            { key: 'interviews', label: 'Interviews', path: '/hiring/interviews', icon: <CalendarDays size={18} />, matchPrefix: '/hiring/interviews' },
        ];
        return { title: 'Hiring', items: allItems };
    }
    // Partner Admin Module (for partners to manage their team)
    if (pathname.startsWith('/partner-admin')) {
        if (!isPartner) return null; // Only partners can access this module
        if (isPartnerEmployee && user?.modulePermissions?.teamManagement?.enabled !== true) return null;
        return {
            title: 'Team Management',
            items: [
                { label: 'Team Members', path: '/partner-admin/team', icon: <Users2 size={18} />, matchPrefix: '/partner-admin/team' },
            ],
        };
    }
    // Game Zone — available to all authenticated CUOS users
    if (pathname.startsWith('/games') || pathname.startsWith('/leaderboard')) {
        return {
            title: 'Game Zone',
            items: [
                { label: 'Games', path: '/games', icon: <Gamepad2 size={18} />, matchPrefix: '/games' },
                { label: 'Leaderboard', path: '/leaderboard', icon: <Trophy size={18} />, matchPrefix: '/leaderboard' },
            ],
        };
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
const NavItemComponent = memo(({
    item,
    active,
    pathname,
    onNavigate,
}: {
    item: NavItem;
    active: boolean;
    pathname: string;
    onNavigate?: () => void;
}) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isSubItemActive = hasSubItems && item.subItems!.some(sub => pathname === sub.path || pathname.startsWith(sub.path + '/'));
    const [isExpanded, setIsExpanded] = useState(item.alwaysExpanded || active || isSubItemActive);

    useEffect(() => {
        if (item.alwaysExpanded || active || isSubItemActive) setIsExpanded(true);
    }, [pathname, active, isSubItemActive, item.alwaysExpanded]);

    const isItemHighlighted = active && !isSubItemActive;

    return (
        <div>
            <NavLink
                to={item.path}
                state={{ newTab: true }}
                end={item.path === '/projects'}
                onClick={(e) => {
                    if (hasSubItems) {
                        e.preventDefault();
                        setIsExpanded(!isExpanded);
                    }
                    if (!hasSubItems || item.alwaysExpanded) {
                        onNavigate?.();
                    }
                }}
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

                {hasSubItems && !item.alwaysExpanded && (
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
                                state={{ newTab: true }}
                                onClick={() => onNavigate?.()}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                                style={
                                    isSubActive
                                        ? { color: 'var(--color-primary-dark)', fontWeight: 600, backgroundColor: 'var(--color-primary-soft)' }
                                        : { color: 'var(--color-text-secondary)', fontWeight: 500 }
                                }
                                onMouseEnter={(e) => {
                                    if (!isSubActive) {
                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                        e.currentTarget.style.color = 'var(--color-text-primary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSubActive) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                                    }
                                }}
                            >
                                <div
                                    className="w-1.5 h-1.5 rounded-full shrink-0 transition-opacity"
                                    style={{ backgroundColor: isSubActive ? 'var(--color-primary)' : 'var(--color-text-muted)', opacity: isSubActive ? 1 : 0.6 }}
                                />
                                <span className="truncate">{sub.label}</span>
                            </NavLink>
                        );
                    })}
                </div>
            )}
        </div>
    );
});

const ProjectFoldersNav = memo(({
    projects,
    partnerNameById,
    pathname,
    search,
    onNavigate,
}: {
    projects: SidebarProject[];
    partnerNameById?: Record<string, string>;
    pathname: string;
    search: string;
    onNavigate?: () => void;
}) => {
    const groups = useMemo(() => buildProjectFolderGroups(projects, partnerNameById), [projects, partnerNameById]);
    const currentProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] || '';
    const currentGroup = currentProjectId
        ? groups.find((group) => group.projects.some((project) => project._id === currentProjectId))
        : undefined;
    const currentParams = new URLSearchParams(search);
    const currentScope = currentParams.get('scope');
    const currentPartnerId = currentParams.get('partnerId') || '';
    const isAllDashboard = pathname === '/projects' && !currentScope && !currentPartnerId;

    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => ({
        internal: true,
        ...(currentGroup ? { [currentGroup.id]: true } : {}),
    }));

    useEffect(() => {
        if (!currentGroup) return;
        setExpandedFolders((previous) => ({ ...previous, [currentGroup.id]: true }));
    }, [currentGroup?.id]);

    const toggleFolder = (folderId: string) => {
        setExpandedFolders((previous) => ({ ...previous, [folderId]: !previous[folderId] }));
    };

    return (
        <div className="space-y-3">
            <NavLink
                to="/projects"
                state={{ newTab: true }}
                end
                onClick={() => onNavigate?.()}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 select-none relative"
                style={
                    isAllDashboard
                        ? {
                            backgroundColor: 'var(--color-primary-soft)',
                            color: 'var(--color-primary-darker)',
                            boxShadow: 'inset 0 0 0 1px rgba(5, 150, 105, 0.13)',
                        }
                        : {
                            color: 'var(--color-text-secondary)',
                        }
                }
                onMouseEnter={(e) => {
                    if (!isAllDashboard) {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isAllDashboard) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                }}
            >
                {isAllDashboard && (
                    <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                        style={{ backgroundColor: 'var(--color-primary)', left: '-12px' }}
                    />
                )}
                <span
                    className="flex items-center justify-center w-7 h-7 rounded-lg transition-all shrink-0"
                    style={isAllDashboard ? { backgroundColor: 'var(--color-primary)', color: 'white' } : { color: 'inherit' }}
                >
                    <Grid2X2 size={17} />
                </span>
                <span className="flex-1 truncate">Dashboard</span>
            </NavLink>



            <div className="space-y-1.5">
                {groups.map((group) => {
                    const isExpanded = expandedFolders[group.id] ?? group.kind === 'internal';
                    const isFolderDashboardActive = pathname === '/projects' && (
                        (group.kind === 'internal' && currentScope === 'internal') ||
                        (group.kind === 'partner' && currentPartnerId === group.id)
                    );
                    const isCurrentProjectFolder = currentGroup?.id === group.id;
                    const isFolderActive = isFolderDashboardActive || isCurrentProjectFolder;

                    return (
                        <div key={group.id} className="relative">
                            {isFolderActive && (
                                <div
                                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                                    style={{ backgroundColor: 'var(--color-primary)', left: '-12px' }}
                                />
                            )}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => toggleFolder(group.id)}
                                    className="w-7 h-9 flex items-center justify-center rounded-lg transition-colors duration-200 shrink-0"
                                    style={{ color: isFolderActive ? 'var(--color-primary-dark)' : 'var(--color-text-muted)' }}
                                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.name}`}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <ChevronRight
                                        size={14}
                                        className="transition-transform duration-200"
                                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                    />
                                </button>

                                <NavLink
                                    to={group.path}
                                    state={{ newTab: true }}
                                    onClick={() => onNavigate?.()}
                                    className="min-w-0 flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-semibold transition-colors duration-200"
                                    style={
                                        isFolderActive
                                            ? {
                                                backgroundColor: 'var(--color-primary-soft)',
                                                color: 'var(--color-primary-darker)',
                                                boxShadow: 'inset 0 0 0 1px rgba(5, 150, 105, 0.13)',
                                            }
                                            : { color: 'var(--color-text-secondary)' }
                                    }
                                    onMouseEnter={(e) => {
                                        if (!isFolderActive) {
                                            e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                            e.currentTarget.style.color = 'var(--color-text-primary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isFolderActive) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                                        }
                                    }}
                                >
                                    <span
                                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
                                        style={
                                            isFolderActive
                                                ? { backgroundColor: 'var(--color-primary)', color: '#ffffff' }
                                                : { backgroundColor: 'var(--color-bg-subtle)', color: 'inherit' }
                                        }
                                    >
                                        {isExpanded ? (
                                            <FolderOpen size={16} />
                                        ) : group.kind === 'partner' ? (
                                            <Building2 size={16} />
                                        ) : (
                                            <Folder size={16} />
                                        )}
                                    </span>
                                    <span className="truncate">{group.name}</span>
                                    <span
                                        className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                                        style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
                                    >
                                        {group.projects.length}
                                    </span>
                                </NavLink>
                            </div>

                            <div
                                className="grid transition-all duration-200 ease-out"
                                style={{
                                    gridTemplateRows: isExpanded ? '1fr' : '0fr',
                                    opacity: isExpanded ? 1 : 0,
                                    transform: isExpanded ? 'translateY(0)' : 'translateY(-4px)',
                                }}
                            >
                                <div className="overflow-hidden">
                                    <div
                                        className="ml-8 mt-1 space-y-0.5 border-l pl-3"
                                        style={{ borderColor: isFolderActive ? 'rgba(5, 150, 105, 0.22)' : 'var(--color-border-default)' }}
                                    >
                                        {group.projects.length === 0 ? (
                                            <div className="px-3 py-2 text-xs rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
                                                No projects
                                            </div>
                                        ) : (
                                            group.projects.map((project) => {
                                                const isProjectActive = currentProjectId === project._id;
                                                return (
                                                    <NavLink
                                                        key={project._id}
                                                        to={`/projects/${project._id}`}
                                                        state={{ newTab: true }}
                                                        onClick={() => onNavigate?.()}
                                                        className="relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                                                        style={
                                                            isProjectActive
                                                                ? {
                                                                    color: 'var(--color-primary-dark)',
                                                                    fontWeight: 600,
                                                                    backgroundColor: 'var(--color-primary-soft)',
                                                                    transform: 'translateX(2px)',
                                                                }
                                                                : { color: 'var(--color-text-secondary)', fontWeight: 500 }
                                                        }
                                                        onMouseEnter={(e) => {
                                                            if (!isProjectActive) {
                                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                                                e.currentTarget.style.color = 'var(--color-text-primary)';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isProjectActive) {
                                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                                e.currentTarget.style.color = 'var(--color-text-secondary)';
                                                            }
                                                        }}
                                                    >
                                                        <div
                                                            className="absolute top-1/2 h-px w-3"
                                                            style={{
                                                                left: '-13px',
                                                                backgroundColor: isProjectActive ? 'rgba(5, 150, 105, 0.45)' : 'var(--color-border-default)',
                                                            }}
                                                        />
                                                        <div
                                                            className="w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-200"
                                                            style={{
                                                                backgroundColor: isProjectActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                                                opacity: isProjectActive ? 1 : 0.45,
                                                                transform: isProjectActive ? 'scale(1.25)' : 'scale(1)',
                                                            }}
                                                        />
                                                        <span className="truncate">{project.name}</span>
                                                    </NavLink>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

/* ── Sidebar ─────────────────────────────────────────────── */
export default function Sidebar({
    onNavigate,
    mobile = false,
    isCollapsed = false,
    onToggleCollapse,
}: {
    onNavigate?: () => void;
    mobile?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}) {

    const navigate = useNavigate();
    const location = useLocation();
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const user = useAppSelector((state) => state.auth.user);
    const backgroundLocation = (location.state as { backgroundLocation?: { pathname: string } } | null)?.backgroundLocation;
    const effectivePathname = backgroundLocation?.pathname || location.pathname;

    const dispatch = useAppDispatch();
    const [logoutApi] = useLogoutMutation();

    const handleLogout = useCallback(async () => {
        try { await logoutApi().unwrap(); } catch { /* ignore */ }

        // Determine logout redirect based on user role and partner status
        const currentRoleName = user?.role
            ? typeof user.role === 'object' ? (user.role as any).name?.toLowerCase() : String(user.role).toLowerCase()
            : '';
        const isPartnerUser = currentRoleName === 'partner';
        const partnerSlug = (user as any)?.partnerSlug || (
            typeof window !== 'undefined' ? window.sessionStorage.getItem('partnerPortalSlug') : null
        );
        const logoutPath = isPartnerUser && partnerSlug
            ? `/partner/${partnerSlug}/login`
            : isPartnerUser
                ? '/partner/login'
                : '/login';

        dispatch(logoutAction());
        dispatch(api.util.resetApiState());
        window.location.href = logoutPath;
    }, [user, logoutApi, dispatch, navigate]);

    const roleName = user?.role
        ? typeof user.role === 'object' ? (user.role as any).name?.toLowerCase() : String(user.role).toLowerCase()
        : '';
    const isPartner = roleName === 'partner';
    const canManageProjects = hasModuleAdminAccess(user, 'projectManagement') && !isPartner;

    // Partner branding
    const partnerCompanyName = (user as any)?.companyName;
    const partnerCompanyLogo = (user as any)?.companyLogo;
    const brandName = isPartner && partnerCompanyName ? partnerCompanyName : 'CUOS';
    const brandSubtitle = isPartner && partnerCompanyName ? 'Partner Portal' : 'Creative Upaay';
    // const brandInitials = isPartner && partnerCompanyName
    //     ? partnerCompanyName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    //     : 'CU';

    const isPMRoute = effectivePathname.startsWith('/projects');
    const isHiringRoute = effectivePathname.startsWith('/hiring');
    const { data: projectsResponse } = useGetProjectsQuery({}, { skip: !isPMRoute });
    const { data: partnersResponse } = useGetPartnersQuery(
        { limit: 500 },
        { skip: !(isPMRoute && canManageProjects) }
    );
    // Only fetch job manager status when on hiring routes — avoids an unnecessary
    // API call on every non-hiring page (CRM, HRMS, Finance, etc.)
    const { data: jobManagerStatus } = useCheckJobManagerStatusQuery(undefined, {
        skip: !isHiringRoute,
    });
    const isJobManager = !!jobManagerStatus?.data?.isJobManager;

    const projects = (projectsResponse?.data || []) as SidebarProject[];
    const partnerNameById = ((partnersResponse?.data?.partners || []) as any[]).reduce<Record<string, string>>((acc, partner) => {
        if (partner?._id) {
            acc[partner._id] = partner.userId?.name || partner.contactPerson || partner.companyName || 'Partner';
        }
        return acc;
    }, {});
    const moduleConfig = getModuleConfig(effectivePathname, user, projects, isJobManager);
    const useProjectFoldersNav = isPMRoute && canManageProjects;

    if (!moduleConfig) return null;

    return (
        <aside
            className={
                mobile 
                    ? 'h-full flex flex-col' 
                    : `fixed top-0 left-0 h-screen flex flex-col transition-transform duration-300 ease-in-out ${isCollapsed ? '-translate-x-full' : 'translate-x-0'}`
            }
            style={{
                width: mobile ? '100%' : 'var(--sidebar-width)',
                zIndex: 40,
                background: 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid var(--color-border-default)',
                boxShadow: 'var(--shadow-sm)',
            }}
        >
            {/* ── Brand ─────────────────────────────────────────────── */}
            <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {isPartner && partnerCompanyLogo ? (
                            <img
                                src={partnerCompanyLogo}
                                alt={partnerCompanyName || 'Company Logo'}
                                className="h-8 max-w-[120px] object-contain"
                            />
                        ) : (
                            <>
                                <img src="/company-logo2.png" alt="Company Logo" className="h-8 max-w-[120px] object-contain shrink-0" />
                                <div>
                                    <div className="font-bold text-sm truncate" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-text-primary)' }}>{brandName}</div>
                                    <div className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>{brandSubtitle}</div>
                                </div>
                            </>
                        )}
                    </div>

                    {!mobile && onToggleCollapse && (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                            title="Close sidebar (Ctrl+B)"
                            aria-label="Close sidebar"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    )}

                    {mobile && onNavigate && (
                        <button
                            type="button"
                            onClick={onNavigate}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                            title="Close navigation"
                            aria-label="Close navigation"
                        >
                            <PanelLeftClose size={18} />
                        </button>
                    )}
                </div>

                {/* Back + Module name */}
                <button
                    onClick={() => {
                        navigate('/dashboard');
                        onNavigate?.();
                    }}
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
                    {useProjectFoldersNav ? (
                        <ProjectFoldersNav
                            projects={projects}
                            partnerNameById={partnerNameById}
                            pathname={effectivePathname}
                            search={location.search}
                            onNavigate={onNavigate}
                        />
                    ) : (
                        moduleConfig.items.map((item) => {
                            const active = isItemActive(item, effectivePathname, moduleConfig.items);
                            return (
                                <NavItemComponent
                                    key={item.path}
                                    item={item}
                                    active={active}
                                    pathname={effectivePathname}
                                    onNavigate={onNavigate}
                                />
                            );
                        })
                    )}
                </div>
            </nav>

            {/* ── Logout Button ──────────────────────────────────────── */}
            <div className="p-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                <button
                    onClick={() => setShowLogoutModal(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 group"
                    style={{
                        color: 'var(--color-text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                        e.currentTarget.style.color = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                >
                    <span className="flex-1 text-left pl-1">Logout</span>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 text-inherit">
                        <LogOut size={16} />
                    </span>
                </button>
            </div>

            {/* ── Logout Modal ──────────────────────────────────────── */}
            {showLogoutModal && (
                <ModalPortal>
                    <div className="bg-white rounded-xl shadow-2xl w-[400px] max-w-[90vw] overflow-hidden animate-in fade-in zoom-in duration-200 relative border border-gray-100">
                        <div className="p-6">
                            <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border"
                                style={{ backgroundColor: 'var(--color-primary-soft)', borderColor: 'var(--color-primary-soft)' }}
                            >
                                <LogOut size={24} style={{ color: 'var(--color-primary-dark)' }} />
                            </div>
                            <h3 className="text-lg font-bold text-center text-gray-900 mb-2">Ready to Leave?</h3>
                            <p className="text-center text-gray-500 text-sm">
                                Are you sure you want to logout?
                            </p>
                        </div>
                        <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t border-gray-100">
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

        </aside>
    );
}
