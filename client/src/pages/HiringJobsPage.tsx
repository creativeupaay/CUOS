import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    MoreVertical,
    Pencil,
    Trash2,
    Loader2,
    AlertCircle,
    Briefcase,
    MapPin,
    Clock,
    ToggleLeft,
    ToggleRight,
    Link,
} from 'lucide-react';
import {
    useGetJobsQuery,
    useDeleteJobMutation,
    useToggleJobMutation,
} from '@/features/hiring/hiringApi';
import { useGetOrgSettingsQuery } from '@/features/overall-admin/api/adminApi';
import { useAppSelector } from '@/app/hooks';
import type { Job, EmploymentType } from '@/features/hiring/types/types';
import { dedupeDepartments, DEFAULT_DEPARTMENTS } from '@/utils/department';

type JobLocationType = 'Remote' | 'In-Office';

// ── Config maps ───────────────────────────────────────────
const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
    'full-time': 'Full-time',
    'part-time': 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
};

const EMPLOYMENT_TYPE_COLORS: Record<EmploymentType, { bg: string; text: string }> = {
    'full-time': { bg: 'var(--color-primary-soft)', text: 'var(--color-primary-dark)' },
    'part-time': { bg: '#DBEAFE', text: '#1D4ED8' },
    contract: { bg: '#FEF3C7', text: '#92400E' },
    internship: { bg: '#F3E8FF', text: '#7E22CE' },
};

// ── Helpers ───────────────────────────────────────────────
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function getJobLocationLabel(job: Pick<Job, 'locationType' | 'location'>) {
    if (job.locationType === 'Remote') {
        return 'Remote';
    }

    if (job.location?.trim()) {
        return job.location.trim();
    }

    return 'Location not specified';
}

// ── Component ─────────────────────────────────────────────
export default function HiringJobsPage() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);

    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const canManage = ['super-admin', 'admin', 'hr', 'hr-admin', 'hr-manager'].includes(roleName);

    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterLocationType, setFilterLocationType] = useState<JobLocationType | ''>('');
    const [filterType, setFilterType] = useState<EmploymentType | ''>('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
    const [deleteError, setDeleteError] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const { data: orgSettingsData } = useGetOrgSettingsQuery();

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                openMenuId &&
                menuRefs.current[openMenuId] &&
                !menuRefs.current[openMenuId]!.contains(e.target as Node)
            ) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openMenuId]);

    const queryParams: any = {};
    if (search) queryParams.search = search;
    if (filterDept) queryParams.department = filterDept;
    if (filterLocationType) queryParams.locationType = filterLocationType;
    if (filterType) queryParams.employmentType = filterType;

    const { data, isLoading, error } = useGetJobsQuery(queryParams);
    const [deleteJob, { isLoading: isDeleting }] = useDeleteJobMutation();
    const [toggleJob] = useToggleJobMutation();

    const jobs: Job[] = data?.data.jobs || [];

    // Unique departments for filter
    const departments = orgSettingsData?.data?.departments?.length
        ? dedupeDepartments(orgSettingsData.data.departments)
        : dedupeDepartments([...DEFAULT_DEPARTMENTS, ...jobs.map((j) => j.department)]).sort();

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        try {
            setDeleteError('');
            await deleteJob(deleteConfirm.id).unwrap();
            setDeleteConfirm(null);
        } catch (error: any) {
            setDeleteError(error?.data?.message || 'Could not delete this job right now.');
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await toggleJob(id).unwrap();
        } catch {
            // error handled by server
        }
    };

    // ── Loading ───────────────────────────────────────────
    if (isLoading) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    <Loader2 size={18} className="animate-spin" />
                    Loading jobs…
                </div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────
    if (error) {
        return (
            <div
                className="flex items-center justify-center h-[calc(100vh-64px)]"
                style={{ backgroundColor: 'var(--color-bg-app)' }}
            >
                <div
                    className="flex items-center gap-2 text-sm"
                    style={{ color: 'var(--color-danger)' }}
                >
                    <AlertCircle size={18} />
                    Error loading jobs
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                className="px-8 py-6 max-w-[1280px] mx-auto"
                style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
            >
                {/* ── Header ───────────────────────────────── */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1
                            className="text-2xl font-bold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Job Postings
                        </h1>
                        <p
                            className="text-sm mt-1"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Manage open positions and hiring availability
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/hiring/reports')}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'var(--color-bg-surface)',
                            }}
                        >
                            Reports
                        </button>
                        <button
                            onClick={() => navigate('/hiring/applications')}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'var(--color-bg-surface)',
                            }}
                        >
                            View Applications
                        </button>
                        {canManage && (
                            <button
                                onClick={() => navigate('/hiring/jobs/new')}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--color-primary-dark)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor =
                                        'var(--color-primary)';
                                }}
                            >
                                <Plus size={16} />
                                Create Job
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Filters ──────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    {/* Search */}
                    <div
                        className="relative flex-1 min-w-[220px] max-w-xs"
                    >
                        <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-text-muted)' }}
                        />
                        <input
                            type="text"
                            placeholder="Search jobs…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-primary)',
                                outline: 'none',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor =
                                    'var(--color-border-default)';
                            }}
                        />
                    </div>

                    {/* Department filter */}
                    <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                            color: filterDept
                                ? 'var(--color-text-primary)'
                                : 'var(--color-text-muted)',
                        }}
                    >
                        <option value="">All Departments</option>
                        {departments.map((d) => (
                            <option key={d} value={d}>
                                {d}
                            </option>
                        ))}
                    </select>

                    <select
                        value={filterLocationType}
                        onChange={(e) => setFilterLocationType(e.target.value as JobLocationType | '')}
                        className="px-3 py-2 text-sm rounded-lg border"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                            color: filterLocationType
                                ? 'var(--color-text-primary)'
                                : 'var(--color-text-muted)',
                        }}
                    >
                        <option value="">All Locations</option>
                        <option value="Remote">Remote</option>
                        <option value="In-Office">In Office</option>
                    </select>

                    {/* Employment type filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as EmploymentType | '')}
                        className="px-3 py-2 text-sm rounded-lg border"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                            color: filterType
                                ? 'var(--color-text-primary)'
                                : 'var(--color-text-muted)',
                        }}
                    >
                        <option value="">All Types</option>
                        {(
                            ['full-time', 'part-time', 'contract', 'internship'] as EmploymentType[]
                        ).map((t) => (
                            <option key={t} value={t}>
                                {EMPLOYMENT_TYPE_LABELS[t]}
                            </option>
                        ))}
                    </select>

                    {/* Clear filters */}
                    {(search || filterDept || filterType) && (
                        <button
                            onClick={() => {
                                setSearch('');
                                setFilterDept('');
                                setFilterType('');
                            }}
                            className="px-3 py-2 text-sm rounded-lg border"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* ── Summary bar ──────────────────────────── */}
                <div
                    className="flex items-center gap-6 px-4 py-3 rounded-lg mb-4"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                    }}
                >
                    <span
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        <span
                            className="font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            {jobs.length}
                        </span>{' '}
                        total
                    </span>
                    <span
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        <span
                            className="font-semibold"
                            style={{ color: 'var(--color-success)' }}
                        >
                            {jobs.filter((j) => j.isHiring).length}
                        </span>{' '}
                        actively hiring
                    </span>
                    <span
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                    >
                        <span
                            className="font-semibold"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            {jobs.filter((j) => !j.isHiring).length}
                        </span>{' '}
                        closed
                    </span>
                </div>

                {/* ── Table ────────────────────────────────── */}
                <div
                    className="rounded-xl"
                    style={{
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        overflow: 'visible',
                    }}
                >
                    {jobs.length === 0 ? (
                        <div
                            className="flex flex-col items-center justify-center py-20 gap-3"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            <Briefcase size={36} strokeWidth={1.2} />
                            <p className="text-sm">No job postings found</p>
                            {canManage && (
                                <button
                                    onClick={() => navigate('/hiring/jobs/new')}
                                    className="text-sm px-4 py-2 rounded-lg mt-1"
                                    style={{
                                        backgroundColor: 'var(--color-primary-soft)',
                                        color: 'var(--color-primary-dark)',
                                    }}
                                >
                                    Create your first job
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                                <tr
                                    style={{
                                        backgroundColor: 'var(--color-bg-subtle)',
                                        borderBottom: '1px solid var(--color-border-default)',
                                    }}
                                >
                                    <th
                                        className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)', borderRadius: '12px 0 0 0' }}
                                    >
                                        Job Title
                                    </th>
                                    <th
                                        className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        Department
                                    </th>
                                    <th
                                        className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        Type
                                    </th>
                                    <th
                                        className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        Hiring Status
                                    </th>
                                    <th
                                        className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        Interview Schedule
                                    </th>
                                    <th
                                        className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        Created
                                    </th>
                                    {canManage && (
                                        <th
                                            className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-right"
                                            style={{ color: 'var(--color-text-secondary)', borderRadius: '0 12px 0 0' }}
                                        >
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map((job, idx) => {
                                    const typeColor = EMPLOYMENT_TYPE_COLORS[job.employmentType];
                                    const isLast = idx === jobs.length - 1;
                                    return (
                                        <tr
                                            key={job._id}
                                            style={{
                                                borderBottom: isLast
                                                    ? 'none'
                                                    : '1px solid var(--color-border-default)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor =
                                                    'var(--color-bg-subtle)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor =
                                                    'transparent';
                                            }}
                                        >
                                            {/* Job Title */}
                                            <td className="px-5 py-4">
                                                <div
                                                    className="font-medium"
                                                    style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                    {job.title}
                                                </div>
                                                <div
                                                    className="text-xs mt-0.5 flex items-center gap-1"
                                                    style={{ color: 'var(--color-text-muted)' }}
                                                >
                                                    <MapPin size={11} />
                                                    {getJobLocationLabel(job)}
                                                </div>
                                            </td>

                                            {/* Department */}
                                            <td className="px-4 py-4">
                                                <span
                                                    style={{
                                                        color: 'var(--color-text-secondary)',
                                                    }}
                                                >
                                                    {job.department}
                                                </span>
                                            </td>

                                            {/* Employment type */}
                                            <td className="px-4 py-4">
                                                <span
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                                                    style={{
                                                        backgroundColor: typeColor.bg,
                                                        color: typeColor.text,
                                                    }}
                                                >
                                                    <Clock size={11} />
                                                    {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
                                                </span>
                                            </td>

                                            {/* Hiring toggle */}
                                            <td className="px-4 py-4">
                                                {canManage ? (
                                                    <button
                                                        onClick={() => handleToggle(job._id)}
                                                        className="flex items-center gap-2 text-xs font-medium transition-colors"
                                                        title={
                                                            job.isHiring
                                                                ? 'Turn off hiring'
                                                                : 'Turn on hiring'
                                                        }
                                                        style={{
                                                            color: job.isHiring
                                                                ? 'var(--color-success)'
                                                                : 'var(--color-text-muted)',
                                                        }}
                                                    >
                                                        {job.isHiring ? (
                                                            <ToggleRight size={22} />
                                                        ) : (
                                                            <ToggleLeft size={22} />
                                                        )}
                                                        {job.isHiring ? 'Hiring' : 'Closed'}
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1.5 text-xs font-medium"
                                                        style={{
                                                            color: job.isHiring
                                                                ? 'var(--color-success)'
                                                                : 'var(--color-text-muted)',
                                                        }}
                                                    >
                                                        <span
                                                            className="w-1.5 h-1.5 rounded-full"
                                                            style={{
                                                                backgroundColor: job.isHiring
                                                                    ? 'var(--color-success)'
                                                                    : 'var(--color-text-muted)',
                                                            }}
                                                        />
                                                        {job.isHiring ? 'Hiring' : 'Closed'}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-4 py-4">
                                                {!job.interviewScheduling?.enabled ? (
                                                    <span
                                                        className="text-xs"
                                                        style={{ color: 'var(--color-text-muted)' }}
                                                    >
                                                        Disabled
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-col gap-1">
                                                        <span
                                                            className="text-xs font-medium"
                                                            style={{
                                                                color:
                                                                    job.interviewScheduling.syncStatus === 'synced'
                                                                        ? 'var(--color-success)'
                                                                        : job.interviewScheduling.syncStatus ===
                                                                          'failed'
                                                                        ? 'var(--color-danger)'
                                                                        : 'var(--color-text-secondary)',
                                                            }}
                                                        >
                                                            {job.interviewScheduling.syncStatus}
                                                        </span>
                                                        <span
                                                            className="text-[11px]"
                                                            style={{ color: 'var(--color-text-muted)' }}
                                                        >
                                                            {job.interviewScheduling.bookingUrl ? 'URL ready' : 'URL missing'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td
                                                className="px-4 py-4 text-sm"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                {formatDate(job.createdAt)}
                                            </td>

                                            {/* Actions */}
                                            {canManage && (
                                                <td className="px-4 py-4 text-right">
                                                    <div
                                                        className="relative inline-block"
                                                        ref={(el) => {
                                                            menuRefs.current[job._id] = el;
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                setOpenMenuId(
                                                                    openMenuId === job._id
                                                                        ? null
                                                                        : job._id
                                                                )
                                                            }
                                                            className="p-1.5 rounded-md transition-colors"
                                                            style={{
                                                                color: 'var(--color-text-muted)',
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor =
                                                                    'var(--color-bg-subtle)';
                                                                e.currentTarget.style.color =
                                                                    'var(--color-text-primary)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor =
                                                                    'transparent';
                                                                e.currentTarget.style.color =
                                                                    'var(--color-text-muted)';
                                                            }}
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>

                                                        {openMenuId === job._id && (
                                                            <div
                                                                className="absolute right-0 top-8 w-44 rounded-lg shadow-lg z-20 overflow-hidden"
                                                                style={{
                                                                    backgroundColor:
                                                                        'var(--color-bg-surface)',
                                                                    border: '1px solid var(--color-border-default)',
                                                                }}
                                                            >
                                                                {job.isHiring && (
                                                                    <button
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(
                                                                                window.location.origin + '/apply/' + job._id
                                                                            );
                                                                            setOpenMenuId(null);
                                                                            setCopiedId(job._id);
                                                                            setTimeout(() => setCopiedId(null), 2000);
                                                                        }}
                                                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
                                                                        style={{
                                                                            color: 'var(--color-primary)',
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            e.currentTarget.style.backgroundColor =
                                                                                'var(--color-primary-soft)';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            e.currentTarget.style.backgroundColor =
                                                                                'transparent';
                                                                        }}
                                                                    >
                                                                        <Link size={14} />
                                                                        Copy Apply Link
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        navigate(
                                                                            `/hiring/jobs/${job._id}/edit`
                                                                        );
                                                                    }}
                                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
                                                                    style={{
                                                                        color: 'var(--color-text-primary)',
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor =
                                                                            'var(--color-bg-subtle)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor =
                                                                            'transparent';
                                                                    }}
                                                                >
                                                                    <Pencil size={14} />
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        setDeleteError('');
                                                                        setDeleteConfirm({
                                                                            id: job._id,
                                                                            title: job.title,
                                                                        });
                                                                    }}
                                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors"
                                                                    style={{
                                                                        color: 'var(--color-danger)',
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.backgroundColor =
                                                                            'var(--color-danger-soft)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.backgroundColor =
                                                                            'transparent';
                                                                    }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Delete Confirmation Modal ─────────────── */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0"
                        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                        onClick={() => setDeleteConfirm(null)}
                    />
                    {/* Modal */}
                    <div
                        className="relative z-10 w-full max-w-sm rounded-xl p-6 shadow-xl"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            border: '1px solid var(--color-border-default)',
                        }}
                    >
                        <h3
                            className="text-base font-semibold mb-2"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Delete Job Posting
                        </h3>
                        <p
                            className="text-sm mb-6"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Are you sure you want to delete{' '}
                            <span
                                className="font-medium"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                {deleteConfirm.title}
                            </span>
                            ? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm rounded-lg border"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg"
                                style={{ backgroundColor: 'var(--color-danger)' }}
                            >
                                {isDeleting && (
                                    <Loader2 size={14} className="animate-spin" />
                                )}
                                Delete
                            </button>
                        </div>
                        {deleteError && (
                            <p className="text-xs mt-3" style={{ color: 'var(--color-danger)' }}>
                                {deleteError}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Copied toast ─────────────────────────── */}
            {copiedId && (
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white z-50 pointer-events-none"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Link size={14} />
                    Application link copied!
                </div>
            )}
        </>
    );
}
