import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import {
    useGetProjectTimeLogsQuery,
    useGetMyTimeLogsQuery,
    useGetTasksQuery,
} from '@/features/project';
import { Loader2, Clock, ShieldOff, CheckCircle2, TrendingUp, TrendingDown, User } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
};

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const SUPER_ADMIN_ROLES = ['super-admin', 'super_admin', 'admin'];

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

    // Project-specific permissions
    const pmPerms = currentUser?.modulePermissions?.projectManagement;
    const projectEntry = pmPerms?.projectPermissions?.find((p: any) => p.projectId === projectId);

    // Super admin or user with explicit timeLogs sub-permission → sees ALL logs
    const canSeeAll = isSuperAdmin || (projectEntry?.subModules?.timeLogs === true);

    // Any project member (has a projectEntry) can see at minimum their own logs
    const isProjectMember = isSuperAdmin || Boolean(projectEntry);

    // ── Queries ───────────────────────────────────────────────────────────────
    const { data: allLogsData, isLoading: allLogsLoading } = useGetProjectTimeLogsQuery(
        { projectId: projectId! },
        { skip: !canSeeAll }
    );

    const { data: myLogsData, isLoading: myLogsLoading } = useGetMyTimeLogsQuery(
        { projectId: projectId! },
        { skip: canSeeAll || !isProjectMember }
    );

    const { data: tasksData } = useGetTasksQuery(
        { projectId: projectId! },
        { skip: !isProjectMember }
    );
    const tasks = tasksData?.data || [];

    const isLoading = canSeeAll ? allLogsLoading : myLogsLoading;
    const timeLogs = canSeeAll ? (allLogsData?.data || []) : (myLogsData?.data || []);

    // ── Access Restricted ─────────────────────────────────────────────────────
    if (!isProjectMember) {
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
                        You are not assigned to this project.
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
                    {!canSeeAll && (
                        <span
                            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
                        >
                            <User size={10} /> My logs only
                        </span>
                    )}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Auto-logged from task activity
                </p>
            </div>

            {/* Summary Cards */}
            <div className={`grid gap-4 ${canSeeAll ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'}`}>
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        {canSeeAll ? 'Total Actual Hours' : 'My Logged Hours'}
                    </p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                        {(actualMins / 60).toFixed(1)}h
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {canSeeAll ? 'Across all team members' : 'Your time across all tasks in this project'}
                    </p>
                </div>
                {canSeeAll && (
                    <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Expected Hours</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-success)' }}>
                            {(expectedMins / 60).toFixed(1)}h
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Sum of estimated task hours</p>
                    </div>
                )}
                {canSeeAll && (
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
                )}
            </div>

            {/* Log Table */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)' }}>
                {/* Column headers — Member column only for admins/managers */}
                <div
                    className={`grid gap-3 px-4 py-2.5 border-b text-[11px] font-semibold uppercase tracking-wider ${
                        canSeeAll ? 'grid-cols-[120px_1fr_1fr_80px_1fr]' : 'grid-cols-[120px_1fr_80px_1fr]'
                    }`}
                    style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                >
                    <span>Date</span>
                    {canSeeAll && <span>Member</span>}
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
                            Time is tracked automatically when you start and pause/complete tasks
                        </p>
                    </div>
                ) : (
                    timeLogs.map(log => {
                        const user = typeof log.userId === 'object' ? (log.userId as any) : null;
                        const task = typeof log.taskId === 'object' ? (log.taskId as any) : null;
                        return (
                            <div
                                key={log._id}
                                className={`grid gap-3 px-4 py-3 items-center border-b last:border-0 ${
                                    canSeeAll ? 'grid-cols-[120px_1fr_1fr_80px_1fr]' : 'grid-cols-[120px_1fr_80px_1fr]'
                                }`}
                                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                            >
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    {fmtDate(log.date)}
                                </span>
                                {canSeeAll && (
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                            style={{ backgroundColor: '#6366F1' }}
                                        >
                                            {user?.name?.charAt(0) || '?'}
                                        </div>
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {user?.name || '—'}
                                        </span>
                                    </div>
                                )}
                                <span className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }} title={task?.title}>
                                    {task?.title || '—'}
                                </span>
                                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-primary)' }}>
                                    {fmt(log.duration)}
                                </span>
                                <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }} title={log.description}>
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
                    {canSeeAll
                        ? 'Time logs are auto-generated from employee task activity and link to finance reporting.'
                        : 'Showing your logged time only. Total project view is available to project managers.'}
                </div>
            )}
        </div>
    );
}

