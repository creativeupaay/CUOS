import { useGetProjectsQuery } from '@/features/project';
import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Plus, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';

const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
    completed: { bg: 'var(--color-info-soft)', text: 'var(--color-info)' },
    'on-hold': { bg: 'var(--color-warning-soft)', text: '#92400E' },
    planning: { bg: 'var(--color-bg-subtle)', text: 'var(--color-text-secondary)' },
    cancelled: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
};

const priorityColors: Record<string, string> = {
    critical: 'var(--color-danger)',
    high: '#EA580C',
    medium: 'var(--color-warning)',
    low: 'var(--color-success)',
};

export default function ProjectsPage() {
    const [filters, setFilters] = useState({ status: '', priority: '' });
    const user = useAppSelector((state) => state.auth.user);

    const { data, isLoading, error } = useGetProjectsQuery(filters);
    const projects = data?.data || [];

    // Check module-level access
    const roleName = user?.role ? (typeof user.role === 'object' ? (user.role as any).name : user.role) : '';
    const isAdmin = ['super-admin', 'admin', 'super_admin'].includes(roleName.toLowerCase());
    const mp = user?.modulePermissions?.projectManagement;
    const hasProjectAccess = isAdmin || (mp?.enabled && Array.isArray(mp?.projectPermissions) && mp.projectPermissions.length > 0);

    if (!hasProjectAccess && !isLoading) {
        return <Navigate to="/dashboard" replace />;
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading projects...
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

    return (
        <div className="px-8 py-6" style={{ maxWidth: '1280px' }}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1
                        className="text-xl font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Projects
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        {projects.length} project{projects.length !== 1 ? 's' : ''} total
                    </p>
                </div>
                {isAdmin && (
                    <Link
                        to="/projects/new"
                        className="flex items-center gap-2 px-4 text-sm font-medium text-white rounded-lg transition-colors"
                        style={{
                            height: '40px',
                            backgroundColor: 'var(--color-primary)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                        }}
                    >
                        <Plus size={16} />
                        New Project
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-6">
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="px-3 rounded-lg border text-sm outline-none"
                    style={{
                        height: '36px',
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                >
                    <option value="">All Status</option>
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>

                <select
                    value={filters.priority}
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                    className="px-3 rounded-lg border text-sm outline-none"
                    style={{
                        height: '36px',
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                >
                    <option value="">All Priority</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                </select>
            </div>

            {/* Project Grid */}
            {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map((project) => {
                        const sColors = statusColors[project.status] || statusColors.planning;
                        const pColor = priorityColors[project.priority] || priorityColors.low;

                        return (
                            <Link
                                key={project._id}
                                to={`/projects/${project._id}`}
                                className="block rounded-lg border p-5 transition-all"
                                style={{
                                    backgroundColor: 'var(--color-bg-surface)',
                                    borderColor: 'var(--color-border-default)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0,0,0,0.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-default)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <h3
                                        className="text-sm font-semibold"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        {project.name}
                                    </h3>
                                    <span
                                        className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ml-2"
                                        style={{
                                            backgroundColor: sColors.bg,
                                            color: sColors.text,
                                        }}
                                    >
                                        {project.status}
                                    </span>
                                </div>

                                {project.description && (
                                    <p
                                        className="text-xs mb-3 line-clamp-2"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        {project.description}
                                    </p>
                                )}

                                <div
                                    className="flex items-center justify-between text-xs"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: pColor }}
                                        />
                                        <span className="capitalize">{project.priority}</span>
                                    </span>
                                    <span>{project.assignees.length} member{project.assignees.length !== 1 ? 's' : ''}</span>
                                </div>

                                {project.deadline && (
                                    <div
                                        className="mt-2.5 pt-2.5 text-xs border-t"
                                        style={{
                                            color: 'var(--color-text-muted)',
                                            borderColor: 'var(--color-border-default)',
                                        }}
                                    >
                                        Due: {new Date(project.deadline).toLocaleDateString()}
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div
                    className="flex flex-col items-center justify-center py-16 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                        style={{
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-muted)',
                        }}
                    >
                        <FolderOpen size={24} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        No projects found
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Create your first project to get started
                    </p>
                </div>
            )}
        </div>
    );
}
