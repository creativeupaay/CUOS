import { useGetProjectsQuery } from '@/features/project';
import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Plus, Loader2, AlertCircle, FolderOpen, Users, Calendar, Flame } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';

/* ── Status map ──────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: 'var(--color-success-soft)', text: 'var(--color-success-dark)', dot: '#10B981' },
    completed: { bg: 'var(--color-info-soft)', text: 'var(--color-info)', dot: '#3B82F6' },
    'on-hold': { bg: 'var(--color-warning-soft)', text: '#92400E', dot: '#F59E0B' },
    planning: { bg: 'var(--color-bg-subtle)', text: 'var(--color-text-secondary)', dot: '#9CA3AF' },
    cancelled: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)', dot: '#EF4444' },
};

/* ── Priority config ─────────────────────────────────────── */
const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
    critical: { color: '#EF4444', label: 'Critical' },
    high: { color: '#EA580C', label: 'High' },
    medium: { color: '#F59E0B', label: 'Medium' },
    low: { color: '#10B981', label: 'Low' },
};

/* ── Priority border accent ──────────────────────────────── */
const PRIORITY_BORDER: Record<string, string> = {
    critical: '#EF4444',
    high: '#EA580C',
    medium: '#F59E0B',
    low: '#10B981',
};

/* ── Filter chips ─────────────────────────────────────────── */
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
            style={
                active
                    ? { backgroundColor: 'var(--color-primary)', color: 'white', boxShadow: 'var(--shadow-brand)' }
                    : { backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }
            }
        >
            {label}
        </button>
    );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function ProjectsPage() {
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const user = useAppSelector((state) => state.auth.user);

    const { data, isLoading, error } = useGetProjectsQuery({ status: statusFilter, priority: priorityFilter });
    const projects = data?.data || [];

    const roleName = user?.role ? (typeof user.role === 'object' ? (user.role as any).name : user.role) : '';
    const isAdmin = ['super-admin', 'admin', 'super_admin'].includes((roleName as string).toLowerCase());
    const mp = user?.modulePermissions?.projectManagement;
    const hasProjectAccess = isAdmin || (mp?.enabled && Array.isArray(mp?.projectPermissions) && mp.projectPermissions.length > 0);

    if (!hasProjectAccess && !isLoading) return <Navigate to="/dashboard" replace />;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    Loading projects…
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Error loading projects
                </div>
            </div>
        );
    }

    const statusOptions = ['', 'planning', 'active', 'on-hold', 'completed', 'cancelled'];
    const priorityOptions = ['', 'low', 'medium', 'high', 'critical'];

    return (
        <div className="px-6 py-6 page-enter" style={{ maxWidth: '1280px' }}>
            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        Projects
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {projects.length} project{projects.length !== 1 ? 's' : ''} {statusFilter ? `· ${statusFilter}` : ''}
                    </p>
                </div>
                {isAdmin && (
                    <Link
                        to="/projects/new"
                        className="btn btn-primary"
                        style={{ gap: '7px' }}
                    >
                        <Plus size={15} />
                        New Project
                    </Link>
                )}
            </div>

            {/* ── Filters ───────────────────────────────────────────── */}
            <div className="mb-6 space-y-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Status</p>
                    <div className="flex flex-wrap gap-2">
                        {statusOptions.map(s => (
                            <FilterChip
                                key={s || '__all'}
                                label={s ? s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ') : 'All'}
                                active={statusFilter === s}
                                onClick={() => setStatusFilter(s)}
                            />
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>Priority</p>
                    <div className="flex flex-wrap gap-2">
                        {priorityOptions.map(p => (
                            <FilterChip
                                key={p || '__all'}
                                label={p ? p.charAt(0).toUpperCase() + p.slice(1) : 'All'}
                                active={priorityFilter === p}
                                onClick={() => setPriorityFilter(p)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Grid ──────────────────────────────────────────────── */}
            {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {projects.map((project) => {
                        const sc = STATUS_CONFIG[project.status] || STATUS_CONFIG.planning;
                        const pc = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.low;
                        const borderAccent = PRIORITY_BORDER[project.priority] || '#10B981';
                        const isOverdue = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'completed';

                        return (
                            <Link
                                key={project._id}
                                to={`/projects/${project._id}`}
                                className="block rounded-2xl border overflow-hidden transition-all duration-200 group"
                                style={{
                                    backgroundColor: 'var(--color-bg-surface)',
                                    borderColor: 'var(--color-border-default)',
                                    boxShadow: 'var(--shadow-xs)',
                                    borderLeft: `3px solid ${borderAccent}`,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    e.currentTarget.style.borderColor = borderAccent + '60';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                                    e.currentTarget.style.borderColor = 'var(--color-border-default)';
                                }}
                            >
                                <div className="p-5">
                                    {/* Top row: name + status */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3
                                            className="text-sm font-bold leading-tight flex-1"
                                            style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                                        >
                                            {project.name}
                                        </h3>
                                        <span
                                            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0"
                                            style={{ backgroundColor: sc.bg, color: sc.text }}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                                            {project.status?.replace('-', ' ')}
                                        </span>
                                    </div>

                                    {/* Description */}
                                    {project.description && (
                                        <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                                            {project.description}
                                        </p>
                                    )}

                                    {/* Meta row */}
                                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {/* Priority */}
                                        <span className="flex items-center gap-1 font-medium" style={{ color: pc.color }}>
                                            <Flame size={11} />
                                            {pc.label}
                                        </span>

                                        {/* Assignees */}
                                        <span className="flex items-center gap-1">
                                            <Users size={11} />
                                            {project.assignees.length}
                                        </span>

                                        {/* Deadline */}
                                        {project.deadline && (
                                            <span
                                                className="flex items-center gap-1 ml-auto font-medium"
                                                style={{ color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
                                            >
                                                <Calendar size={11} />
                                                {new Date(project.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                {isOverdue && ' · Overdue'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="flex flex-col items-center justify-center py-20 rounded-2xl border"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', borderStyle: 'dashed' }}
                >
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                    >
                        <FolderOpen size={28} />
                    </div>
                    <p className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                        No projects found
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {isAdmin ? 'Create your first project to get started' : 'No projects have been assigned to you yet'}
                    </p>
                    {isAdmin && (
                        <Link to="/projects/new" className="btn btn-primary mt-5" style={{ gap: '6px' }}>
                            <Plus size={15} /> Create Project
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
