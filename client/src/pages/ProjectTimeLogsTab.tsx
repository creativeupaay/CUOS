import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetProjectTimeLogsQuery,
    useGetTasksQuery,
} from '@/features/project';
import { Loader2, Clock, ShieldOff, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const SUPER_ADMIN_ROLES = ['super-admin', 'super_admin'];

export default function ProjectTimeLogsTab() {
    const { id: projectId } = useParams<{ id: string }>();
    const currentUser = useSelector((s: RootState) => s.auth.user);

    // Resolve role name (role can be a Role object or a string)
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as any).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';

    const isSuperAdmin = SUPER_ADMIN_ROLES.includes(roleName);

    // Check project-specific sub-permission for timeLogs
    const pmPerms = currentUser?.modulePermissions?.projectManagement;
    const projectEntry = pmPerms?.projectPermissions?.find(p => p.projectId === projectId);
    const hasTimeLogsAccess = isSuperAdmin || (projectEntry?.subModules?.timeLogs === true);

    const { data: logsData, isLoading } = useGetProjectTimeLogsQuery(
        { projectId: projectId! },
        { skip: !hasTimeLogsAccess }
    );
    const timeLogs = logsData?.data || [];

    const { data: tasksData } = useGetTasksQuery(
        { projectId: projectId! },
        { skip: !hasTimeLogsAccess }
    );
    const tasks = tasksData?.data || [];

    // ── Access Restricted screen ──────────────────────────────────────────────
    if (!hasTimeLogsAccess) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-danger-soft, rgba(239,68,68,0.1))' }}>
                    <ShieldOff size={28} style={{ color: 'var(--color-danger)' }} />
                </div>
                <div className="text-center">
                    <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        Access Restricted
                    </h3>
                    <p className="text-sm max-w-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Time logs are visible to project managers and admins only.
                        Your work hours are tracked automatically from your task activity.
                    </p>
                </div>
            </div>
        );
    }

    // ── Summary calculations ──────────────────────────────────────────────────
    const actualMins = timeLogs.reduce((sum, log) => sum + log.duration, 0);
    const expectedMins = tasks.reduce((sum, t) => sum + ((t.estimatedHours ?? 0) * 60), 0);
    const varianceMins = actualMins - expectedMins;
    const overEstimate = varianceMins > 0;

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Time Logs
                    </h2>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                        {timeLogs.length} entries
                    </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Auto-logged from employee task activity
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Actual Hours</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                        {(actualMins / 60).toFixed(1)}h
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Total time logged across all tasks</p>
                </div>
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Expected Hours</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>
                        {(expectedMins / 60).toFixed(1)}h
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Sum of estimated task hours</p>
                </div>
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Variance</p>
                    {expectedMins > 0 ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                {overEstimate
                                    ? <TrendingUp size={18} style={{ color: 'var(--color-danger)' }} />
                                    : <TrendingDown size={18} style={{ color: 'var(--color-success)' }} />}
                                <p className="text-2xl font-bold tabular-nums"
                                    style={{ color: overEstimate ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                    {overEstimate ? '+' : ''}{(varianceMins / 60).toFixed(1)}h
                                </p>
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {overEstimate ? 'Over estimate' : 'Within estimate'}
                            </p>
                        </>
                    ) : (
                        <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>No estimates set on tasks</p>
                    )}
                </div>
            </div>

            {/* Log Table */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                {/* Column headers */}
                <div className="grid grid-cols-[120px_1fr_1fr_80px_1fr] gap-3 px-4 py-2.5 border-b text-[11px] font-semibold uppercase tracking-wider"
                    style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
                    <span>Date</span>
                    <span>Member</span>
                    <span>Task</span>
                    <span>Duration</span>
                    <span>Description</span>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                ) : timeLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 gap-2">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}>
                            <Clock size={22} />
                        </div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No time logged yet</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Time is tracked automatically when employees start and pause/complete tasks
                        </p>
                    </div>
                ) : (
                    timeLogs.map(log => {
                        const user = typeof log.userId === 'object' ? (log.userId as any) : null;
                        const task = typeof log.taskId === 'object' ? (log.taskId as any) : null;
                        return (
                            <div key={log._id}
                                className="grid grid-cols-[120px_1fr_1fr_80px_1fr] gap-3 px-4 py-3 items-center border-b"
                                style={{ backgroundColor: 'var(--color-bg-body)', borderColor: 'var(--color-border-default)' }}>
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {fmtDate(log.date)}
                                </span>
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {user?.name || '—'}
                                </span>
                                <span className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                                    {task?.title || '—'}
                                </span>
                                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                                    {fmt(log.duration)}
                                </span>
                                <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                    {log.description || '—'}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            {timeLogs.length > 0 && (
                <div className="flex items-center gap-2 text-xs px-1" style={{ color: 'var(--color-text-muted)' }}>
                    <CheckCircle2 size={12} />
                    Time logs are auto-generated from employee task activity and will link to finance reporting.
                </div>
            )}
        </div>
    );
}
