import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import {
    ArrowLeft,
    FolderKanban,
    Users2,
    ListTodo,
    BarChart3,
    FileText,
    LogOut,
    ChevronRight,
    Shield,
    ScrollText,
    Settings,
    DollarSign,
    Receipt,
    CreditCard,
    TrendingUp,
} from 'lucide-react';

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    /** Match routes that start with this prefix to highlight active state */
    matchPrefix?: string;
}

interface ModuleConfig {
    title: string;
    items: NavItem[];
}

/**
 * Returns module-specific navigation items based on the current route.
 */
function getModuleConfig(pathname: string): ModuleConfig | null {
    if (pathname.startsWith('/projects')) {
        return {
            title: 'Project Management',
            items: [
                {
                    label: 'Projects',
                    path: '/projects',
                    icon: <FolderKanban size={20} />,
                    matchPrefix: '/projects',
                },
                {
                    label: 'Clients',
                    path: '/projects/clients',
                    icon: <Users2 size={20} />,
                    matchPrefix: '/projects/clients',
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
                    label: 'Leads',
                    path: '/crm/leads',
                    icon: <ListTodo size={20} />,
                    matchPrefix: '/crm/leads',
                },
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

    // Sort items by matchPrefix length descending (most specific first)
    const sorted = [...allItems]
        .filter((i) => i.matchPrefix)
        .sort((a, b) => (b.matchPrefix?.length || 0) - (a.matchPrefix?.length || 0));

    // Find the first (most specific) match
    const bestMatch = sorted.find((i) => pathname.startsWith(i.matchPrefix!));
    return bestMatch?.path === item.path;
}

export default function Sidebar() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAppSelector((state) => state.auth.user);

    const moduleConfig = getModuleConfig(location.pathname);

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
                className="px-5 border-b"
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
                        className="text-sm font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {moduleConfig.title}
                    </h2>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 overflow-y-auto">
                <div className="space-y-1">
                    {moduleConfig.items.map((item) => {
                        const active = isItemActive(item, location.pathname, moduleConfig.items);

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/projects'}
                                className="flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors h-10"
                                style={
                                    active
                                        ? {
                                            backgroundColor: 'var(--color-primary-soft)',
                                            color: 'var(--color-primary-dark)',
                                        }
                                        : {
                                            color: 'var(--color-text-secondary)',
                                        }
                                }
                                onMouseEnter={(e) => {
                                    if (!active) {
                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!active) {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                <span style={active ? { color: 'var(--color-primary-dark)' } : {}}>
                                    {item.icon}
                                </span>
                                <span>{item.label}</span>
                                {active && (
                                    <ChevronRight
                                        size={16}
                                        className="ml-auto"
                                        style={{ color: 'var(--color-primary-dark)' }}
                                    />
                                )}
                            </NavLink>
                        );
                    })}
                </div>
            </nav>

            {/* User */}
            <div
                className="px-4 py-3 border-t"
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
