import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import { useGetProjectsQuery } from '@/features/project/projectApi';
import {
    ArrowLeft,
    FolderKanban,
    Users2,
    ListTodo,
    BarChart3,
    FileText,
    LogOut,
    ChevronRight,
    ChevronDown,
    Shield,
    ScrollText,
    Settings,
    DollarSign,
    Receipt,
    CreditCard,
    TrendingUp,
    Clock,
} from 'lucide-react';

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    /** Match routes that start with this prefix to highlight active state */
    matchPrefix?: string;
    /** Optional sub-items for nested navigation */
    subItems?: { label: string; path: string }[];
}

interface ModuleConfig {
    title: string;
    items: NavItem[];
}

/**
 * Returns module-specific navigation items based on the current route.
 */
function getModuleConfig(pathname: string, projects?: { _id: string; name: string }[]): ModuleConfig | null {
    if (pathname.startsWith('/projects')) {
        const projectSubItems = projects?.map(p => ({
            label: p.name,
            path: `/projects/${p._id}`
        })) || [];

        return {
            title: 'Project Management',
            items: [
                {
                    label: 'Projects',
                    path: '/projects',
                    icon: <FolderKanban size={20} />,
                    matchPrefix: '/projects',
                    subItems: projectSubItems,
                },
            ],
        };
    }

    if (pathname.startsWith('/finance')) {
        return {
            title: 'Finance',
            items: [
                {
                    label: 'Dashboard',
                    path: '/finance',
                    icon: <DollarSign size={20} />,
                    matchPrefix: '/finance',
                },
                {
                    label: 'Expenses',
                    path: '/finance/expenses',
                    icon: <Receipt size={20} />,
                    matchPrefix: '/finance/expenses',
                },
                {
                    label: 'Invoices',
                    path: '/finance/invoices',
                    icon: <CreditCard size={20} />,
                    matchPrefix: '/finance/invoices',
                },
                {
                    label: 'Reports',
                    path: '/finance/reports',
                    icon: <TrendingUp size={20} />,
                    matchPrefix: '/finance/reports',
                },
            ],
        };
    }

    if (pathname.startsWith('/crm')) {
        return {
            title: 'CRM',
            items: [
                {
                    label: 'Pipeline',
                    path: '/crm/pipeline',
                    icon: <BarChart3 size={20} />,
                    matchPrefix: '/crm/pipeline',
                },
                {
                    label: 'Proposals',
                    path: '/crm/proposals',
                    icon: <FileText size={20} />,
                    matchPrefix: '/crm/proposals',
                },
                {
                    label: 'Clients',
                    path: '/crm/clients',
                    icon: <Users2 size={20} />,
                    matchPrefix: '/crm/clients',
                },
            ],
        };
    }

    if (pathname.startsWith('/hrms')) {
        return {
            title: 'HRMS',
            items: [
                {
                    label: 'Dashboard',
                    path: '/hrms',
                    icon: <BarChart3 size={20} />,
                    matchPrefix: '/hrms',
                },
                {
                    label: 'Employees',
                    path: '/hrms/employees',
                    icon: <Users2 size={20} />,
                    matchPrefix: '/hrms/employees',
                },
                {
                    label: 'Attendance',
                    path: '/hrms/attendance',
                    icon: <Clock size={20} />,
                    matchPrefix: '/hrms/attendance',
                },
                {
                    label: 'Leaves',
                    path: '/hrms/leaves',
                    icon: <ListTodo size={20} />,
                    matchPrefix: '/hrms/leaves',
                },
                {
                    label: 'Payroll',
                    path: '/hrms/payroll',
                    icon: <FileText size={20} />,
                    matchPrefix: '/hrms/payroll',
                },
            ],
        };
    }

    if (pathname.startsWith('/admin')) {
        return {
            title: 'Admin Panel',
            items: [
                {
                    label: 'Dashboard',
                    path: '/admin',
                    icon: <BarChart3 size={20} />,
                    matchPrefix: '/admin',
                },
                {
                    label: 'Users',
                    path: '/admin/users',
                    icon: <Users2 size={20} />,
                    matchPrefix: '/admin/users',
                },
                {
                    label: 'Roles & Permissions',
                    path: '/admin/roles',
                    icon: <Shield size={20} />,
                    matchPrefix: '/admin/roles',
                },
                {
                    label: 'Settings',
                    path: '/admin/settings',
                    icon: <Settings size={20} />,
                    matchPrefix: '/admin/settings',
                },
                {
                    label: 'Audit Logs',
                    path: '/admin/audit-logs',
                    icon: <ScrollText size={20} />,
                    matchPrefix: '/admin/audit-logs',
                },
            ],
        };
    }

    return null;
}

/**
 * Check if a nav item should be highlighted as active.
 * Uses prefix matching — /projects/clients matches before /projects
 * so we sort by specificity (longest prefix first).
 */
function isItemActive(item: NavItem, pathname: string, allItems: NavItem[]): boolean {
    if (!item.matchPrefix) return false;

    // Check if any subItem is active specifically to avoid parent taking precedence
    if (item.subItems?.some(sub => pathname === sub.path)) {
        return true;
    }

    // Sort items by matchPrefix length descending (most specific first)
    const sorted = [...allItems]
        .filter((i) => i.matchPrefix)
        .sort((a, b) => (b.matchPrefix?.length || 0) - (a.matchPrefix?.length || 0));

    // Find the first (most specific) match
    const bestMatch = sorted.find((i) => pathname.startsWith(i.matchPrefix!));

    // For exact paths or general prefix matches where a subItem isn't explicitly active
    return bestMatch?.path === item.path;
}

// Separate component for rendering a nav item to manage its own expand/collapse state
const NavItemComponent = ({ item, active, pathname }: { item: NavItem; active: boolean; pathname: string }) => {
    // Default open if active or if we are in one of its subItems
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isSubItemActive = hasSubItems && item.subItems!.some(sub => pathname === sub.path);
    const [isExpanded, setIsExpanded] = useState(active || isSubItemActive);

    // Sync expansion state when route changes
    useEffect(() => {
        if (active || isSubItemActive) {
            setIsExpanded(true);
        }
    }, [pathname, active, isSubItemActive]);

    const toggleExpand = (e: React.MouseEvent) => {
        if (hasSubItems) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div className="space-y-1">
            <NavLink
                to={item.path}
                end={item.path === '/projects'}
                className="flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors h-10 select-none"
                style={
                    active && !isSubItemActive
                        ? {
                            backgroundColor: 'var(--color-primary-soft)',
                            color: 'var(--color-primary-dark)',
                        }
                        : {
                            color: 'var(--color-text-secondary)',
                        }
                }
                onMouseEnter={(e) => {
                    if (!(active && !isSubItemActive)) {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!(active && !isSubItemActive)) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }
                }}
            >
                <span style={active && !isSubItemActive ? { color: 'var(--color-primary-dark)' } : {}}>
                    {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {hasSubItems && (
                    <button
                        onClick={toggleExpand}
                        className="p-1 rounded hover:bg-black/5"
                        style={active && !isSubItemActive ? { color: 'var(--color-primary-dark)' } : {}}
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                )}
                {!hasSubItems && active && (
                    <ChevronRight
                        size={16}
                        className="ml-auto"
                        style={{ color: 'var(--color-primary-dark)' }}
                    />
                )}
            </NavLink>

            {hasSubItems && isExpanded && (
                <div className="pl-10 space-y-1 mt-1">
                    {item.subItems!.map((sub) => {
                        const isSubActive = pathname === sub.path;
                        return (
                            <NavLink
                                key={sub.path}
                                to={sub.path}
                                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors truncate"
                                style={
                                    isSubActive
                                        ? {
                                            color: 'var(--color-primary-dark)',
                                            fontWeight: 500,
                                            backgroundColor: 'var(--color-primary-soft)',
                                        }
                                        : {
                                            color: 'var(--color-text-secondary)',
                                        }
                                }
                                onMouseEnter={(e) => {
                                    if (!isSubActive) {
                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSubActive) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <div
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{
                                        backgroundColor: isSubActive ? 'var(--color-primary-dark)' : 'var(--border-default)',
                                        opacity: isSubActive ? 1 : 0.5
                                    }}
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

export default function Sidebar() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);

    // Only fetch projects if we are in the PM module
    const isPMRoute = location.pathname.startsWith('/projects');
    const { data: projectsResponse } = useGetProjectsQuery(
        {},
        { skip: !isPMRoute }
    );
    const projects = projectsResponse?.data || [];

    const moduleConfig = getModuleConfig(location.pathname, projects);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    // If no module config (shouldn't happen since sidebar only renders in module routes)
    if (!moduleConfig) return null;

    return (
        <aside
            className="fixed top-0 left-0 h-screen flex flex-col border-r"
            style={{
                width: 'var(--sidebar-width)',
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
            }}
        >
            {/* Brand + Module Title */}
            <div
                className="px-5 border-b shrink-0"
                style={{
                    borderColor: 'var(--color-border-default)',
                }}
            >
                {/* Brand row */}
                <div className="flex items-center gap-3 h-14">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        CU
                    </div>
                    <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                            CUOS
                        </div>
                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Creative Upaay
                        </div>
                    </div>
                </div>

                {/* Back + Module Name */}
                <div className="pb-3">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-1.5 text-xs font-medium mb-2 cursor-pointer transition-colors"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--color-primary-dark)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                    >
                        <ArrowLeft size={14} />
                        Back to Dashboard
                    </button>
                    <h2
                        className="text-sm font-semibold truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {moduleConfig.title}
                    </h2>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 overflow-y-auto overflow-x-hidden">
                <div className="space-y-1">
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

            {/* User */}
            <div
                className="px-4 py-3 border-t shrink-0"
                style={{ borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            {user?.name || 'User'}
                        </div>
                        <div
                            className="text-xs truncate"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            {user?.email || ''}
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-1.5 rounded-md transition-colors hover:bg-gray-100 shrink-0 cursor-pointer"
                        style={{ color: 'var(--color-text-muted)' }}
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
