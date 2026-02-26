import { useParams, Link, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
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
    const navigate = useNavigate();
    const { data, isLoading, error } = useGetProjectByIdQuery(id!);
    const project = data?.data;

    const currentUser = useSelector((s: RootState) => s.auth.user);
    const roleName = currentUser?.role
        ? typeof currentUser.role === 'object'
            ? (currentUser.role as any).name?.toLowerCase()
            : String(currentUser.role).toLowerCase()
        : '';
    const isSuperAdmin = ['super-admin', 'super_admin'].includes(roleName);

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

    const pmPerms = currentUser?.modulePermissions?.projectManagement;
    // Find THIS project's specific permission entry
    const projectEntry = pmPerms?.projectPermissions?.find(p => p.projectId === id);
    const pmSubs = projectEntry?.subModules;

    const allTabs = [
        { name: 'Overview', path: `/projects/${id}`, icon: <LayoutDashboard size={15} />, exact: true, permKey: 'overview' },
        { name: 'Tasks', path: `/projects/${id}/tasks`, icon: <ListTodo size={15} />, exact: false, permKey: 'tasks' },
        { name: 'Time Logs', path: `/projects/${id}/timelogs`, icon: <Clock size={15} />, exact: false, permKey: 'timeLogs' },
        { name: 'Meetings', path: `/projects/${id}/meetings`, icon: <Video size={15} />, exact: false, permKey: 'meetings' },
        { name: 'Credentials', path: `/projects/${id}/credentials`, icon: <KeyRound size={15} />, exact: false, permKey: 'credentials' },
        { name: 'Documents', path: `/projects/${id}/documents`, icon: <FileText size={15} />, exact: false, permKey: 'documents' },
    ];
    const tabs = isSuperAdmin
        ? allTabs
        : allTabs.filter(t => pmSubs ? (pmSubs as Record<string, boolean>)[t.permKey] === true : false);

    // Redirect to first allowed tab if no overview access
    const isOnBasePath = location.pathname === `/projects/${id}`;
    if (!isSuperAdmin && isOnBasePath && pmSubs && !pmSubs.overview && tabs.length > 0) {
        return <Navigate to={tabs[0].path} replace />;
    }

    // No tabs at all or project not assigned = access denied
    if (!isSuperAdmin && tabs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF2F2' }}>
                    <AlertCircle size={28} style={{ color: '#EF4444' }} />
                </div>
                <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>No Access</p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>You don't have permission to view any section of this project.</p>
                <button onClick={() => navigate('/dashboard')} className="mt-4 px-4 py-2 text-sm rounded-lg text-white" style={{ backgroundColor: 'var(--color-primary)' }}>Back to Dashboard</button>
            </div>
        );
    }

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
                        const isActive = tab.exact
                            ? location.pathname === tab.path
                            : location.pathname.startsWith(tab.path);
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
