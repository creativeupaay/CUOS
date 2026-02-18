import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import {
    FolderKanban,
    DollarSign,
    Users,
    Building2,
    Shield,
    ArrowRight,
    Clock,
    CheckCircle2,
    AlertTriangle,
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
            className="relative rounded-lg border p-5 transition-all group"
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
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                style={{
                    backgroundColor: isActive ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)',
                    color: isActive ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
                }}
            >
                {icon}
            </div>

            {/* Content */}
            <h3
                className="text-sm font-semibold mb-1"
                style={{ color: 'var(--color-text-primary)' }}
            >
                {title}
            </h3>
            <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
            >
                {description}
            </p>

            {/* Status */}
            <div className="absolute top-4 right-4">
                {isActive ? (
                    <span
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-success-soft)',
                            color: 'var(--color-success)',
                        }}
                    >
                        <CheckCircle2 size={10} />
                        Active
                    </span>
                ) : (
                    <span
                        className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-warning-soft)',
                            color: '#92400E',
                        }}
                    >
                        <Clock size={10} />
                        Coming Soon
                    </span>
                )}
            </div>

            {/* Arrow indicator for active cards */}
            {isActive && (
                <div
                    className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--color-primary)' }}
                >
                    <ArrowRight size={16} />
                </div>
            )}
        </div>
    );
}

export default function SuperAdminDashboard() {
    const user = useAppSelector((state) => state.auth.user);

    const departments = [
        {
            title: 'Project Management',
            description: 'Manage projects, tasks, time logs and team collaboration',
            icon: <FolderKanban size={20} />,
            path: '/projects',
            isActive: true,
        },
        {
            title: 'Finance',
            description: 'Track expenses, invoices, and financial reports',
            icon: <DollarSign size={20} />,
            path: '/finance',
            isActive: false,
        },
        {
            title: 'CRM',
            description: 'Customer relationship management and sales tracking',
            icon: <Users size={20} />,
            path: '/crm',
            isActive: false,
        },
        {
            title: 'HRMS',
            description: 'Human resource management and employee records',
            icon: <Building2 size={20} />,
            path: '/hrms',
            isActive: false,
        },
        {
            title: 'Overall Admin',
            description: 'System administration, roles and permissions',
            icon: <Shield size={20} />,
            path: '/admin',
            isActive: false,
        },
    ];

    return (
        <div className="px-8 py-6" style={{ maxWidth: '1280px' }}>
            {/* Welcome Section */}
            <div className="mb-8">
                <h1
                    className="text-xl font-semibold mb-1"
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

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div
                    className="rounded-lg border px-5 py-4"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{
                                backgroundColor: 'var(--color-primary-soft)',
                                color: 'var(--color-primary-dark)',
                            }}
                        >
                            <CheckCircle2 size={18} />
                        </div>
                        <div>
                            <div
                                className="text-xs font-medium"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Active Modules
                            </div>
                            <div
                                className="text-lg font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                2
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className="rounded-lg border px-5 py-4"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{
                                backgroundColor: 'var(--color-warning-soft)',
                                color: '#92400E',
                            }}
                        >
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <div
                                className="text-xs font-medium"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Coming Soon
                            </div>
                            <div
                                className="text-lg font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                3
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className="rounded-lg border px-5 py-4"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{
                                backgroundColor: 'var(--color-info-soft)',
                                color: 'var(--color-info)',
                            }}
                        >
                            <Users size={18} />
                        </div>
                        <div>
                            <div
                                className="text-xs font-medium"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Phase
                            </div>
                            <div
                                className="text-lg font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                1
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Header */}
            <div className="mb-4">
                <h2
                    className="text-sm font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    Departments
                </h2>
            </div>

            {/* Department Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {departments.map((dept) => (
                    <DepartmentCard key={dept.title} {...dept} />
                ))}
            </div>
        </div>
    );
}
