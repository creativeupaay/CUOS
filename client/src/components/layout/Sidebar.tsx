import { NavLink, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import {
    LayoutDashboard,
    FolderKanban,
    DollarSign,
    Users,
    Building2,
    Shield,
    LogOut,
    ChevronRight,
} from 'lucide-react';

interface NavItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    isActive: boolean;
}

const navItems: NavItem[] = [
    {
        label: 'Dashboard',
        path: '/dashboard',
        icon: <LayoutDashboard size={20} />,
        isActive: true,
    },
    {
        label: 'Projects',
        path: '/projects',
        icon: <FolderKanban size={20} />,
        isActive: true,
    },
    {
        label: 'Finance',
        path: '/finance',
        icon: <DollarSign size={20} />,
        isActive: false,
    },
    {
        label: 'CRM',
        path: '/crm',
        icon: <Users size={20} />,
        isActive: false,
    },
    {
        label: 'HRMS',
        path: '/hrms',
        icon: <Building2 size={20} />,
        isActive: false,
    },
    {
        label: 'Admin',
        path: '/admin',
        icon: <Shield size={20} />,
        isActive: false,
    },
];

export default function Sidebar() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    return (
        <aside
            className="fixed top-0 left-0 h-screen flex flex-col border-r"
            style={{
                width: 'var(--sidebar-width)',
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-default)',
            }}
        >
            {/* Brand */}
            <div
                className="flex items-center gap-3 px-6 border-b"
                style={{
                    height: '64px',
                    borderColor: 'var(--color-border-default)',
                }}
            >
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

            {/* Navigation */}
            <nav className="flex-1 py-4 px-3 overflow-y-auto">
                <div className="space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive: routeActive }) => {
                                const base =
                                    'flex items-center gap-3 px-3 rounded-lg text-sm font-medium transition-colors relative';
                                const height = 'h-10';
                                if (routeActive) {
                                    return `${base} ${height}`;
                                }
                                return `${base} ${height}`;
                            }}
                            style={({ isActive: routeActive }) =>
                                routeActive
                                    ? {
                                        backgroundColor: 'var(--color-primary-soft)',
                                        color: 'var(--color-primary-dark)',
                                    }
                                    : {
                                        color: 'var(--color-text-secondary)',
                                    }
                            }
                        >
                            {({ isActive: routeActive }) => (
                                <>
                                    <span style={routeActive ? { color: 'var(--color-primary-dark)' } : {}}>
                                        {item.icon}
                                    </span>
                                    <span>{item.label}</span>
                                    {!item.isActive && (
                                        <span
                                            className="ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium"
                                            style={{
                                                backgroundColor: 'var(--color-warning-soft)',
                                                color: '#92400E',
                                            }}
                                        >
                                            Soon
                                        </span>
                                    )}
                                    {item.isActive && routeActive && (
                                        <ChevronRight
                                            size={16}
                                            className="ml-auto"
                                            style={{ color: 'var(--color-primary-dark)' }}
                                        />
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
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
