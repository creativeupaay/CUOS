import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Search, LayoutList, Columns2, ChevronDown } from 'lucide-react';
import {
    useGetApplicationsQuery,
    useGetJobsQuery,
    useUpdateApplicationStatusMutation,
} from '@/features/hiring/hiringApi';
import KanbanBoard from '@/features/hiring/components/KanbanBoard';
import type { Application, ApplicationStatus } from '@/features/hiring/types/types';

const STATUS_META: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
    new: { label: 'New', color: '#1D4ED8', bg: '#DBEAFE' },
    screening: { label: 'Screening', color: '#92400E', bg: '#FEF3C7' },
    shortlisted: { label: 'Shortlisted', color: '#166534', bg: '#DCFCE7' },
    'assignment-round': { label: 'Assignment', color: '#6D28D9', bg: '#EDE9FE' },
    'assignment-submitted': { label: 'Assignment Submitted', color: '#7C3AED', bg: '#F3E8FF' },
    interview: { label: 'Interview', color: '#0F766E', bg: '#CCFBF1' },
    offered: { label: 'Offered', color: '#0369A1', bg: '#E0F2FE' },
    rejected: { label: 'Rejected', color: '#B91C1C', bg: '#FEE2E2' },
    hired: { label: 'Hired', color: '#15803D', bg: '#DCFCE7' },
};

const STATUS_FILTER_OPTIONS: ApplicationStatus[] = [
    'new',
    'screening',
    'shortlisted',
    'assignment-round',
    'assignment-submitted',
    'interview',
    'offered',
    'rejected',
    'hired',
];

function getStatusUpdateOptions(currentStatus: ApplicationStatus): ApplicationStatus[] {
    const pipelineOptions: ApplicationStatus[] = [
        'new',
        'screening',
        'shortlisted',
        'assignment-round',
        'assignment-submitted',
        'interview',
        'rejected',
    ];

    if (currentStatus === 'offered') {
        return [...pipelineOptions, 'offered', 'hired'];
    }

    if (currentStatus === 'hired') {
        return [...pipelineOptions, 'offered', 'hired'];
    }

    return pipelineOptions;
}

type ViewMode = 'table' | 'kanban';

export default function HiringApplicationsPage() {
    const navigate = useNavigate();
    const [view, setView] = useState<ViewMode>('table');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ApplicationStatus | ''>('');
    const [jobId, setJobId] = useState('');
    const [tags, setTags] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [debouncedTags, setDebouncedTags] = useState('');
    const [optimisticApplications, setOptimisticApplications] = useState<Application[]>([]);
    const [updatingIds, setUpdatingIds] = useState<string[]>([]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setDebouncedTags(tags.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, tags]);

    const { data: jobsData } = useGetJobsQuery({ limit: 200 });
    const jobs = jobsData?.data.jobs || [];

    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (jobId) params.jobId = jobId;
    if (debouncedTags) params.tags = debouncedTags;

    const { data, isLoading, error } = useGetApplicationsQuery(
        params as any,
        { refetchOnMountOrArgChange: true }
    );
    const applications = data?.data.applications || [];

    useEffect(() => {
        setOptimisticApplications(applications);
    }, [applications]);

    const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateApplicationStatusMutation();

    async function handleStatusChange(id: string, newStatus: ApplicationStatus) {
        const current = optimisticApplications.find((app) => app._id === id);
        if (!current || current.status === newStatus) {
            return;
        }

        const previousStatus = current.status;

        setOptimisticApplications((prev) =>
            prev.map((app) => (app._id === id ? { ...app, status: newStatus } : app))
        );
        setUpdatingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

        try {
            await updateStatus({ id, data: { status: newStatus } }).unwrap();
        } catch {
            setOptimisticApplications((prev) =>
                prev.map((app) => (app._id === id ? { ...app, status: previousStatus } : app))
            );
        } finally {
            setUpdatingIds((prev) => prev.filter((item) => item !== id));
        }
    }

    const displayedApplications = useMemo(
        () => optimisticApplications,
        [optimisticApplications]
    );

    const total = displayedApplications.length;
    const newCount = displayedApplications.filter((a: any) => a.status === 'new').length;
    const shortlisted = displayedApplications.filter((a: any) => a.status === 'shortlisted').length;
    const rejected = displayedApplications.filter((a: any) => a.status === 'rejected').length;

    if (isLoading) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading applications...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Unable to load applications
                </div>
            </div>
        );
    }

    return (
        <div
            className="px-8 py-6 max-w-[1280px] mx-auto"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Applications
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Review candidates and move them through the hiring pipeline
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div
                        className="flex items-center rounded-lg border overflow-hidden"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <button
                            onClick={() => setView('table')}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm"
                            style={{
                                backgroundColor: view === 'table' ? 'var(--color-bg-subtle)' : 'var(--color-bg-surface)',
                                color: view === 'table' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                fontWeight: view === 'table' ? 500 : 400,
                            }}
                        >
                            <LayoutList size={14} />
                            List
                        </button>
                        <button
                            onClick={() => setView('kanban')}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm border-l"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: view === 'kanban' ? 'var(--color-bg-subtle)' : 'var(--color-bg-surface)',
                                color: view === 'kanban' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                fontWeight: view === 'kanban' ? 500 : 400,
                            }}
                        >
                            <Columns2 size={14} />
                            Kanban
                        </button>
                    </div>
                    <button
                        onClick={() => navigate('/hiring/reports')}
                        className="px-3 py-2 rounded-lg text-sm border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        Reports
                    </button>
                    <button
                        onClick={() => navigate('/hiring/jobs')}
                        className="px-3 py-2 rounded-lg text-sm border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        Manage Jobs
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                    { label: 'Total', value: total, color: 'var(--color-text-primary)' },
                    { label: 'New', value: newCount, color: '#1D4ED8' },
                    { label: 'Shortlisted', value: shortlisted, color: '#166534' },
                    { label: 'Rejected', value: rejected, color: '#B91C1C' },
                ].map(({ label, value, color }) => (
                    <div
                        key={label}
                        className="p-4 rounded-lg border"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                        <p className="text-xl font-semibold mt-1" style={{ color }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div
                className="p-4 rounded-xl border mb-4"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="grid grid-cols-4 gap-3">
                    <div className="relative">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-text-muted)' }}
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or email"
                            className="w-full pl-9 pr-3 h-10 text-sm rounded-lg border outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />
                    </div>
                    <select
                        value={jobId}
                        onChange={(e) => setJobId(e.target.value)}
                        className="h-10 px-3 text-sm rounded-lg border outline-none"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        <option value="">All Jobs</option>
                        {jobs.map((job: any) => (
                            <option key={job._id} value={job._id}>{job.title}</option>
                        ))}
                    </select>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ApplicationStatus | '')}
                        className="h-10 px-3 text-sm rounded-lg border outline-none"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        <option value="">All Statuses</option>
                        {STATUS_FILTER_OPTIONS.map((statusValue) => (
                            <option key={statusValue} value={statusValue}>
                                {STATUS_META[statusValue].label}
                            </option>
                        ))}
                    </select>
                    <input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="Filter by tags (comma separated)"
                        className="h-10 px-3 text-sm rounded-lg border outline-none"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                        }}
                    />
                </div>
                {(search.trim() !== debouncedSearch || tags.trim() !== debouncedTags) && (
                    <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                        Updating filters...
                    </p>
                )}
            </div>

            {/* Table view */}
            {view === 'table' && (
                <div
                    className="rounded-xl overflow-hidden border"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <table className="w-full text-sm">
                        <thead>
                            <tr
                                style={{
                                    backgroundColor: 'var(--color-bg-subtle)',
                                    borderBottom: '1px solid var(--color-border-default)',
                                }}
                            >
                                {['Candidate', 'Job Role', 'Email', 'Applied', 'Status', 'Tags'].map((h) => (
                                    <th
                                        key={h}
                                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayedApplications.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-14 text-center text-sm"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        No applications found.
                                    </td>
                                </tr>
                            )}
                            {displayedApplications.map((app: any, idx: number) => {
                                const jobTitle =
                                    app.jobId && typeof app.jobId === 'object'
                                        ? app.jobId.title || '—'
                                        : '—';
                                const meta =
                                    STATUS_META[app.status as ApplicationStatus] || STATUS_META.new;
                                const isRowUpdating = updatingIds.includes(app._id);
                                return (
                                    <tr
                                        key={app._id}
                                        onClick={() => navigate(`/hiring/applications/${app._id}`)}
                                        style={{
                                            cursor: 'pointer',
                                            borderBottom:
                                                idx === displayedApplications.length - 1
                                                    ? 'none'
                                                    : '1px solid var(--color-border-default)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        <td
                                            className="px-4 py-3.5 font-medium"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            {app.name}
                                        </td>
                                        <td
                                            className="px-4 py-3.5"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {jobTitle}
                                        </td>
                                        <td
                                            className="px-4 py-3.5"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {app.email}
                                        </td>
                                        <td
                                            className="px-4 py-3.5"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {new Date(app.createdAt).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div
                                                className="relative inline-flex items-center"
                                                style={{ opacity: isRowUpdating ? 0.65 : 1 }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <select
                                                    value={app.status}
                                                    onChange={(e) =>
                                                        handleStatusChange(
                                                            app._id,
                                                            e.target.value as ApplicationStatus
                                                        )
                                                    }
                                                    disabled={isRowUpdating}
                                                    className="h-9 min-w-[148px] appearance-none pl-3 pr-9 text-xs rounded-full border outline-none shadow-sm transition-all"
                                                    style={{
                                                        borderColor: meta.bg,
                                                        backgroundColor: '#FFFFFF',
                                                        color: meta.color,
                                                        fontWeight: 600,
                                                        boxShadow: `inset 0 0 0 1px ${meta.bg}`,
                                                        cursor: isRowUpdating ? 'not-allowed' : 'pointer',
                                                    }}
                                                >
                                                    {getStatusUpdateOptions(
                                                        app.status as ApplicationStatus
                                                    ).map((statusValue) => (
                                                        <option key={statusValue} value={statusValue}>
                                                            {STATUS_META[statusValue].label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span
                                                    className="pointer-events-none absolute right-3"
                                                    style={{ color: meta.color }}
                                                >
                                                    <ChevronDown size={14} />
                                                </span>
                                            </div>
                                        </td>
                                        <td
                                            className="px-4 py-3.5 text-xs"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {app.tags?.length ? app.tags.join(', ') : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Kanban view */}
            {view === 'kanban' && (
                <KanbanBoard
                    applications={displayedApplications}
                    onStatusChange={handleStatusChange}
                    isUpdating={isUpdatingStatus}
                    updatingIds={updatingIds}
                />
            )}
        </div>
    );
}
