import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import { useGetProjectByIdQuery } from '@/features/project';
import {
    LayoutDashboard,
    ListTodo,
    Clock,
    Video,
    KeyRound,
    FileText,
    Loader2,
    AlertCircle,
    ChevronRight,
} from 'lucide-react';

const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
    completed: { bg: 'var(--color-info-soft)', text: 'var(--color-info)' },
    'on-hold': { bg: 'var(--color-warning-soft)', text: '#92400E' },
    planning: { bg: 'var(--color-bg-subtle)', text: 'var(--color-text-secondary)' },
    cancelled: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
};

const priorityColors: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
    high: { bg: '#FFF7ED', text: '#EA580C' },
    medium: { bg: 'var(--color-warning-soft)', text: '#92400E' },
    low: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
};

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const { data, isLoading, error } = useGetProjectByIdQuery(id!);
    const project = data?.data;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading project...
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Project not found
                </div>
            </div>
        );
    }

    const sColors = statusColors[project.status] || statusColors.planning;
    const pColors = priorityColors[project.priority] || priorityColors.low;

    const tabs = [
        { name: 'Overview', path: `/projects/${id}`, icon: <LayoutDashboard size={15} /> },
        { name: 'Tasks', path: `/projects/${id}/tasks`, icon: <ListTodo size={15} /> },
        { name: 'Time Logs', path: `/projects/${id}/timelogs`, icon: <Clock size={15} /> },
        { name: 'Meetings', path: `/projects/${id}/meetings`, icon: <Video size={15} /> },
        { name: 'Credentials', path: `/projects/${id}/credentials`, icon: <KeyRound size={15} /> },
        { name: 'Documents', path: `/projects/${id}/documents`, icon: <FileText size={15} /> },
    ];

    return (
        <div className="px-8 py-6" style={{ maxWidth: '1280px' }}>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                <Link
                    to="/projects"
                    className="transition-colors hover:underline"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    Projects
                </Link>
                <ChevronRight size={12} />
                <span style={{ color: 'var(--color-text-primary)' }}>{project.name}</span>
            </div>

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1
                        className="text-xl font-semibold mb-1"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {project.name}
                    </h1>
                    {project.description && (
                        <p
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            {project.description}
                        </p>
                    )}
                </div>

                <div className="flex gap-2 shrink-0">
                    <span
                        className="text-xs font-medium px-2.5 py-1 rounded-md capitalize"
                        style={{ backgroundColor: sColors.bg, color: sColors.text }}
                    >
                        {project.status}
                    </span>
                    <span
                        className="text-xs font-medium px-2.5 py-1 rounded-md capitalize"
                        style={{ backgroundColor: pColors.bg, color: pColors.text }}
                    >
                        {project.priority}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div
                className="border-b mb-6"
                style={{ borderColor: 'var(--color-border-default)' }}
            >
                <nav className="flex gap-0">
                    {tabs.map((tab) => {
                        const isActive = location.pathname === tab.path;
                        return (
                            <Link
                                key={tab.path}
                                to={tab.path}
                                className="flex items-center gap-1.5 px-4 pb-3 text-sm font-medium border-b-2 transition-colors"
                                style={
                                    isActive
                                        ? {
                                            borderColor: 'var(--color-primary)',
                                            color: 'var(--color-primary-dark)',
                                        }
                                        : {
                                            borderColor: 'transparent',
                                            color: 'var(--color-text-secondary)',
                                        }
                                }
                            >
                                {tab.icon}
                                {tab.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <Outlet context={{ project }} />
        </div>
    );
}
