import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { logout } from '@/features/auth/slices/authSlice';
import {
    FolderKanban,
    DollarSign,
    Users,
    Building2,
    Shield,
    ArrowRight,
    Clock,
    CheckCircle2,
    LogOut,
} from 'lucide-react';

interface DepartmentCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    path: string;
    isActive: boolean;
}

function DepartmentCard({ title, description, icon, path, isActive }: DepartmentCardProps) {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => isActive && navigate(path)}
            className="relative rounded-lg border p-6 transition-all group"
            style={{
                backgroundColor: 'var(--color-bg-surface)',
                borderColor: isActive ? 'var(--color-border-default)' : 'var(--color-border-default)',
                cursor: isActive ? 'pointer' : 'not-allowed',
                opacity: isActive ? 1 : 0.6,
            }}
            onMouseEnter={(e) => {
                if (isActive) {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0,0,0,0.05)';
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-default)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Icon */}
            <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                style={{
                    backgroundColor: isActive ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)',
                    color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                }}
            >
                {icon}
            </div>

            {/* Content */}
            <h3
                className="text-base font-semibold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
            >
                {title}
            </h3>
            <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
            >
                {description}
            </p>

            {/* Status */}
            <div className="absolute top-5 right-5">
                {isActive ? (
                    <span
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-success-soft)',
                            color: 'var(--color-success)',
                        }}
                    >
                        <CheckCircle2 size={12} />
                        Active
                    </span>
                ) : (
                    <span
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-warning-soft)',
                            color: '#92400E',
                        }}
                    >
                        <Clock size={12} />
                        Coming Soon
                    </span>
                )}
            </div>

            {/* Arrow indicator for active cards */}
            {isActive && (
                <div
                    className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--color-primary)' }}
                >
                    <ArrowRight size={18} />
                </div>
            )}
        </div>
    );
}

export default function SuperAdminDashboard() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
    };

    // Determine if current user bypasses permission checks (admin / super-admin)
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isAdminUser = ['super-admin', 'admin', 'super_admin'].includes(roleName);

    const mp = user?.modulePermissions;

    const allDepartments = [
        {
            key: 'projectManagement',
            title: 'Project Management',
            description: 'Manage projects, tasks, time logs and team collaboration',
            icon: <FolderKanban size={24} />,
            path: '/projects',
        },
        {
            key: 'finance',
            title: 'Finance',
            description: 'Track expenses, invoices, and financial reports',
            icon: <DollarSign size={24} />,
            path: '/finance',
        },
        {
            key: 'crm',
            title: 'CRM',
            description: 'Customer relationship management and sales tracking',
            icon: <Users size={24} />,
            path: '/crm',
        },
        {
            key: 'hrms',
            title: 'HRMS',
            description: 'Human resource management and employee records',
            icon: <Building2 size={24} />,
            path: '/hrms',
        },
        {
            key: 'overallAdmin',
            title: 'Overall Admin',
            description: 'System administration, user permissions and settings',
            icon: <Shield size={24} />,
            path: '/admin',
        },
    ];

    // Admins see all; others see only permitted modules
    const departments = isAdminUser
        ? allDepartments.map(d => ({ ...d, isActive: true }))
        : allDepartments.filter(d => {
            const perm = mp?.[d.key as keyof typeof mp] as any;
            if (!perm?.enabled) return false;

            // For Project Management, also require at least one assigned project
            if (d.key === 'projectManagement') {
                return Array.isArray(perm.projectPermissions) && perm.projectPermissions.length > 0;
            }
            return true;
        }).map(d => ({ ...d, isActive: true }));

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ backgroundColor: 'var(--color-bg-app)' }}
        >
            {/* Header with user info and logout */}
            <header
                className="border-b"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="px-8 py-4 flex justify-between items-center" style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    {/* Brand */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            CU
                        </div>
                        <div>
                            <div className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                CUOS
                            </div>
                            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Creative Upaay
                            </div>
                        </div>
                    </div>

                    {/* User section */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div
                                    className="text-sm font-medium"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    {user?.name || 'User'}
                                </div>
                                <div
                                    className="text-xs"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    {user?.email || ''}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 text-sm font-medium rounded-lg border transition-colors"
                            style={{
                                height: '36px',
                                color: 'var(--color-text-primary)',
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)';
                            }}
                        >
                            <LogOut size={16} />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 px-8 py-8">
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    {/* Welcome Section */}
                    <div className="mb-8">
                        <h1
                            className="text-2xl font-semibold mb-2"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Welcome back, {user?.name || 'User'}
                        </h1>
                        <p
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Select a department to get started
                        </p>
                    </div>

                    {/* Department Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {departments.map(({ key: _key, ...dept }) => (
                            <DepartmentCard key={dept.title} {...dept} />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
