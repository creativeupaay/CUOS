import { useNavigate } from 'react-router-dom';
import {
    Users,
    Shield,
    Settings,
    ScrollText,
    ShieldCheck,
    UserX,
    Activity,
    ArrowRight,
    BarChart3,
} from 'lucide-react';
import { useGetAdminDashboardStatsQuery } from '@/features/overall-admin/api/adminApi';

export default function AdminDashboardPage() {
    const navigate = useNavigate();
    const { data } = useGetAdminDashboardStatsQuery();

    const stats = data?.data?.stats;
    const recentUsers = data?.data?.recentUsers || [];
    const recentLogs = data?.data?.recentAuditLogs || [];
    const roleDist = data?.data?.roleDistribution || [];

    const statCards = [
        {
            label: 'Total Users',
            value: stats?.totalUsers || 0,
            icon: <Users size={22} />,
            color: '#3B82F6',
            bg: '#EFF6FF',
        },
        {
            label: 'Active Users',
            value: stats?.activeUsers || 0,
            icon: <ShieldCheck size={22} />,
            color: '#10B981',
            bg: '#ECFDF5',
        },
        {
            label: 'Inactive Users',
            value: stats?.inactiveUsers || 0,
            icon: <UserX size={22} />,
            color: '#EF4444',
            bg: '#FEF2F2',
        },
        {
            label: 'Total Roles',
            value: stats?.totalRoles || 0,
            icon: <Shield size={22} />,
            color: '#8B5CF6',
            bg: '#F5F3FF',
        },
    ];

    const quickActions = [
        {
            label: 'Manage Users',
            description: 'Create, edit, and manage user accounts',
            icon: <Users size={22} />,
            path: '/admin/users',
        },
        {
            label: 'Roles & Permissions',
            description: 'Configure roles and access controls',
            icon: <Shield size={22} />,
            path: '/admin/roles',
        },
        {
            label: 'Organization Settings',
            description: 'Company info, departments, policies',
            icon: <Settings size={22} />,
            path: '/admin/settings',
        },
        {
            label: 'Audit Logs',
            description: 'View system activity and changes',
            icon: <ScrollText size={22} />,
            path: '/admin/audit-logs',
        },
    ];

    const formatAction = (action: string) =>
        action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());



    const formatTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    return (
        <div className="p-6 mx-auto page-enter" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#7C3AED20,#8B5CF620)', border: '1px solid #7C3AED30' }}
                    >
                        <Shield size={22} style={{ color: '#7C3AED' }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            Admin Panel
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            System administration &amp; access control
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {statCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-2xl border p-5 relative overflow-hidden"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                            boxShadow: 'var(--shadow-xs)',
                        }}
                    >
                        {/* Accent strip */}
                        <div className="absolute top-0 left-0 w-1 h-full rounded-l-none" style={{ backgroundColor: card.color, borderRadius: '0 0 0 12px', width: '3px' }} />
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                            style={{ background: `linear-gradient(135deg,${card.color}20,${card.color}10)`, border: `1px solid ${card.color}25` }}
                        >
                            <div style={{ color: card.color }}>{card.icon}</div>
                        </div>
                        <div className="text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            {card.value}
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                            {card.label}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions + Role Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Quick Actions */}
                <div
                    className="lg:col-span-2 rounded-2xl border p-6"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                        boxShadow: 'var(--shadow-xs)',
                    }}
                >
                    <h2
                        className="text-lg font-semibold mb-4"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {quickActions.map((action) => (
                            <button
                                key={action.label}
                                onClick={() => navigate(action.path)}
                                className="flex items-center gap-4 p-4 rounded-lg border text-left group transition-all"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-default)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-surface)';
                                }}
                            >
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        backgroundColor: 'var(--color-primary-soft)',
                                        color: 'var(--color-primary-dark)',
                                    }}
                                >
                                    {action.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div
                                        className="text-sm font-semibold"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        {action.label}
                                    </div>
                                    <div
                                        className="text-xs mt-0.5"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        {action.description}
                                    </div>
                                </div>
                                <ArrowRight
                                    size={16}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                    style={{ color: 'var(--color-primary)' }}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Role Distribution */}
                <div
                    className="rounded-2xl border p-6"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                        boxShadow: 'var(--shadow-xs)',
                    }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={18} style={{ color: 'var(--color-primary)' }} />
                        <h2
                            className="text-lg font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Role Distribution
                        </h2>
                    </div>
                    {roleDist.length > 0 ? (
                        <div className="space-y-3">
                            {roleDist.map((role) => {
                                const total = stats?.totalUsers || 1;
                                const pct = Math.round((role.count / total) * 100);
                                return (
                                    <div key={role._id}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span
                                                className="font-medium capitalize"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {role._id}
                                            </span>
                                            <span style={{ color: 'var(--color-text-muted)' }}>
                                                {role.count} ({pct}%)
                                            </span>
                                        </div>
                                        <div
                                            className="h-2 rounded-full"
                                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                                        >
                                            <div
                                                className="h-2 rounded-full transition-all"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: 'var(--color-primary)',
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p
                            className="text-sm"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            No data yet
                        </p>
                    )}
                </div>
            </div>

            {/* Recent Users + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Users */}
                <div
                    className="rounded-2xl border p-6"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                        boxShadow: 'var(--shadow-xs)',
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2
                            className="text-lg font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Recent Users
                        </h2>
                        <button
                            onClick={() => navigate('/admin/users')}
                            className="text-sm font-medium flex items-center gap-1"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            View All <ArrowRight size={14} />
                        </button>
                    </div>
                    {recentUsers.length > 0 ? (
                        <div className="space-y-3">
                            {recentUsers.map((u: any) => (
                                <div
                                    key={u._id}
                                    className="flex items-center gap-3 p-3 rounded-lg"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                    >
                                        {u.name?.charAt(0)?.toUpperCase() || 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-sm font-medium truncate"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {u.name}
                                        </div>
                                        <div
                                            className="text-xs truncate"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            {u.email}
                                        </div>
                                    </div>
                                    <span
                                        className="text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                                        style={{
                                            backgroundColor: u.isActive ? '#ECFDF5' : '#FEF2F2',
                                            color: u.isActive ? '#10B981' : '#EF4444',
                                        }}
                                    >
                                        {u.isActive ? 'active' : 'inactive'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p
                            className="text-sm"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            No users yet
                        </p>
                    )}
                </div>

                {/* Recent Activity */}
                <div
                    className="rounded-2xl border p-6"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                        boxShadow: 'var(--shadow-xs)',
                    }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2
                            className="text-lg font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Recent Activity
                        </h2>
                        <button
                            onClick={() => navigate('/admin/audit-logs')}
                            className="text-sm font-medium flex items-center gap-1"
                            style={{ color: 'var(--color-primary)' }}
                        >
                            View All <ArrowRight size={14} />
                        </button>
                    </div>
                    {recentLogs.length > 0 ? (
                        <div className="space-y-3">
                            {recentLogs.slice(0, 6).map((log: any) => (
                                <div
                                    key={log._id}
                                    className="flex items-start gap-3 p-3 rounded-lg"
                                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                        style={{
                                            backgroundColor: '#F5F3FF',
                                            color: '#7C3AED',
                                        }}
                                    >
                                        <Activity size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-sm font-medium"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {formatAction(log.action)}
                                        </div>
                                        <div
                                            className="text-xs mt-0.5"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            by {log.userId?.name || 'System'} • {formatTimeAgo(log.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p
                            className="text-sm"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            No activity yet
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
