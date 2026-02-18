import { useState } from 'react';
import {
    ScrollText,
    Filter,
    X,
    Activity,
} from 'lucide-react';
import { useGetAuditLogsQuery, useGetAdminUsersQuery } from '@/features/overall-admin/api/adminApi';

const ACTION_OPTIONS = [
    'user_created',
    'user_updated',
    'user_deactivated',
    'user_activated',
    'password_reset',
    'role_created',
    'role_updated',
    'role_deleted',
    'role_cloned',
    'permission_created',
    'permission_deleted',
    'permission_changed',
    'settings_updated',
    'login',
    'logout',
];

export default function AdminAuditLogsPage() {
    const [filters, setFilters] = useState({
        userId: '',
        action: '',
        startDate: '',
        endDate: '',
        page: 1,
    });
    const [showFilters, setShowFilters] = useState(false);

    const { data, isLoading } = useGetAuditLogsQuery({
        ...filters,
        limit: 20,
    });

    const { data: usersData } = useGetAdminUsersQuery({ limit: 100 });

    const logs = data?.data?.logs || [];
    const pagination = data?.data?.pagination;
    const users = usersData?.data?.users || [];

    const formatAction = (action: string) =>
        action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getActionColor = (action: string) => {
        if (action.includes('created') || action === 'login') return { bg: '#ECFDF5', text: '#059669' };
        if (action.includes('deleted') || action === 'user_deactivated') return { bg: '#FEF2F2', text: '#DC2626' };
        if (action.includes('updated') || action.includes('changed') || action.includes('cloned')) return { bg: '#EFF6FF', text: '#2563EB' };
        if (action === 'password_reset') return { bg: '#FEF3C7', text: '#D97706' };
        return { bg: '#F3F4F6', text: '#6B7280' };
    };

    const clearFilters = () => {
        setFilters({ userId: '', action: '', startDate: '', endDate: '', page: 1 });
    };

    const hasActiveFilters = filters.userId || filters.action || filters.startDate || filters.endDate;

    return (
        <div className="p-8 mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                    >
                        <ScrollText size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            Audit Logs
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {pagination?.total || 0} total log entries
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium"
                    style={{
                        borderColor: showFilters ? 'var(--color-primary)' : 'var(--color-border-default)',
                        color: showFilters ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                >
                    <Filter size={16} />
                    Filters
                    {hasActiveFilters && (
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div
                    className="mb-6 p-4 rounded-xl border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Filter Logs
                        </span>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-xs font-medium flex items-center gap-1"
                                style={{ color: '#EF4444' }}
                            >
                                <X size={12} /> Clear All
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select
                            value={filters.userId}
                            onChange={(e) => setFilters({ ...filters, userId: e.target.value, page: 1 })}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            <option value="">All Users</option>
                            {users.map((u: any) => (
                                <option key={u._id} value={u._id}>{u.name}</option>
                            ))}
                        </select>
                        <select
                            value={filters.action}
                            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            <option value="">All Actions</option>
                            {ACTION_OPTIONS.map((a) => (
                                <option key={a} value={a}>{formatAction(a)}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                            placeholder="From Date"
                        />
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
                            className="px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                            placeholder="To Date"
                        />
                    </div>
                </div>
            )}

            {/* Logs List */}
            <div
                className="rounded-xl border overflow-hidden"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                {isLoading ? (
                    <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
                        Loading audit logs...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center">
                        <ScrollText size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            No audit logs found
                        </p>
                    </div>
                ) : (
                    <div>
                        {logs.map((log: any) => {
                            const actionColor = getActionColor(log.action);
                            return (
                                <div
                                    key={log._id}
                                    className="flex items-start gap-4 px-5 py-4 border-b last:border-b-0"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                        style={{ backgroundColor: actionColor.bg, color: actionColor.text }}
                                    >
                                        <Activity size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: actionColor.bg, color: actionColor.text }}
                                            >
                                                {formatAction(log.action)}
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                on <span className="font-medium capitalize">{log.resource}</span>
                                                {log.resourceId && (
                                                    <span className="ml-1 font-mono text-[10px] opacity-70">
                                                        #{log.resourceId.slice(-6)}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {log.userId?.name || 'System'}
                                            </span>
                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                {log.userId?.email}
                                            </span>
                                        </div>
                                        {log.details && Object.keys(log.details).length > 0 && (
                                            <div className="mt-2 p-2 rounded text-xs font-mono" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                                                {JSON.stringify(log.details, null, 0).slice(0, 200)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                        <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                                            {formatDate(log.createdAt)}
                                        </div>
                                        {log.ipAddress && (
                                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
                                                {log.ipAddress}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div
                        className="flex items-center justify-between px-5 py-3 border-t"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                                disabled={filters.page === 1}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                                disabled={filters.page >= pagination.pages}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
