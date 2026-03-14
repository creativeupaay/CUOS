import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ExternalLink, Loader2, Search, LayoutList, Columns2 } from 'lucide-react';
import {
    useGetApplicationsQuery,
    useGetJobsQuery,
    useUpdateApplicationStatusMutation,
} from '@/features/hiring/hiringApi';
import KanbanBoard from '@/features/hiring/components/KanbanBoard';
import type { ApplicationStatus } from '@/features/hiring/types/types';

const STATUS_META: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
    new: { label: 'New', color: '#1D4ED8', bg: '#DBEAFE' },
    screening: { label: 'Screening', color: '#92400E', bg: '#FEF3C7' },
    shortlisted: { label: 'Shortlisted', color: '#166534', bg: '#DCFCE7' },
    'assignment-round': { label: 'Assignment', color: '#6D28D9', bg: '#EDE9FE' },
    interview: { label: 'Interview', color: '#0F766E', bg: '#CCFBF1' },
    offered: { label: 'Offered', color: '#0369A1', bg: '#E0F2FE' },
    rejected: { label: 'Rejected', color: '#B91C1C', bg: '#FEE2E2' },
    hired: { label: 'Hired', color: '#15803D', bg: '#DCFCE7' },
};

type ViewMode = 'table' | 'kanban';

export default function HiringApplicationsPage() {
    const navigate = useNavigate();
    const [view, setView] = useState<ViewMode>('table');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ApplicationStatus | ''>('');
    const [jobId, setJobId] = useState('');
    const [tags, setTags] = useState('');

    const { data: jobsData } = useGetJobsQuery({ limit: 200 });
    const jobs = jobsData?.data.jobs || [];

    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (status) params.status = status;
    if (jobId) params.jobId = jobId;
    if (tags) params.tags = tags;

    const { data, isLoading, error } = useGetApplicationsQuery(
        params as any,
        { refetchOnMountOrArgChange: true }
    );
    const applications = data?.data.applications || [];

    const [updateStatus, { isLoading: isUpdatingStatus }] = useUpdateApplicationStatusMutation();

    async function handleStatusChange(id: string, newStatus: ApplicationStatus) {
        await updateStatus({ id, data: { status: newStatus } });
    }

    const total = applications.length;
    const newCount = applications.filter((a: any) => a.status === 'new').length;
    const shortlisted = applications.filter((a: any) => a.status === 'shortlisted').length;
    const rejected = applications.filter((a: any) => a.status === 'rejected').length;

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
                        {(Object.entries(STATUS_META) as [ApplicationStatus, { label: string }][]).map(
                            ([val, meta]) => (
                                <option key={val} value={val}>{meta.label}</option>
                            )
                        )}
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
                                {['Candidate', 'Job Role', 'Email', 'Applied', 'Status', 'Tags', ''].map((h) => (
                                    <th
                                        key={h}
                                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide ${
                                            h === '' ? 'text-right' : 'text-left'
                                        }`}
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {applications.length === 0 && (
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
                            {applications.map((app: any, idx: number) => {
                                const jobTitle =
                                    typeof app.jobId === 'object' ? app.jobId.title : '—';
                                const meta =
                                    STATUS_META[app.status as ApplicationStatus] || STATUS_META.new;
                                return (
                                    <tr
                                        key={app._id}
                                        style={{
                                            borderBottom:
                                                idx === applications.length - 1
                                                    ? 'none'
                                                    : '1px solid var(--color-border-default)',
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
                                            <span
                                                className="px-2 py-1 rounded-md text-xs font-medium"
                                                style={{
                                                    backgroundColor: meta.bg,
                                                    color: meta.color,
                                                }}
                                            >
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td
                                            className="px-4 py-3.5 text-xs"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {app.tags?.length ? app.tags.join(', ') : '—'}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <button
                                                onClick={() =>
                                                    navigate(`/hiring/applications/${app._id}`)
                                                }
                                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                                style={{
                                                    borderColor: 'var(--color-border-default)',
                                                    color: 'var(--color-text-secondary)',
                                                }}
                                            >
                                                View
                                                <ExternalLink size={12} />
                                            </button>
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
                    applications={applications}
                    onStatusChange={handleStatusChange}
                    isUpdating={isUpdatingStatus}
                />
            )}
        </div>
    );
}
