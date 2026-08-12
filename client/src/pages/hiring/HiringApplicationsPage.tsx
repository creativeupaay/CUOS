import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Search, LayoutList, Columns2, ChevronDown, MapPin, FileText, Globe, Linkedin, Github, Briefcase, ExternalLink, Paperclip } from 'lucide-react';
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
    'interview-scheduled': { label: 'Interview Scheduled', color: '#0E7490', bg: '#CFFAFE' },
    'interview-rescheduled': { label: 'Interview Rescheduled', color: '#7C3AED', bg: '#F3E8FF' },
    'interview-cancelled': { label: 'Interview Cancelled', color: '#DC2626', bg: '#FEE2E2' },
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
    'interview-scheduled',
    'interview-rescheduled',
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
        'interview-scheduled',
        'interview-rescheduled',
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

function getJobIdValue(jobId: Application['jobId']): string {
    return typeof jobId === 'object' ? jobId?._id || '' : '';
}

type ViewMode = 'list' | 'kanban';

export default function HiringApplicationsPage() {
    const navigate = useNavigate();
    const [view, setView] = useState<ViewMode>('list');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ApplicationStatus | ''>('');
    const [jobId, setJobId] = useState('');
    const [tags, setTags] = useState('');
    const [location, setLocation] = useState('');
    const [minExperience, setMinExperience] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [debouncedTags, setDebouncedTags] = useState('');
    const [debouncedLocation, setDebouncedLocation] = useState('');
    const [debouncedMinExperience, setDebouncedMinExperience] = useState('');
    const [optimisticApplications, setOptimisticApplications] = useState<Application[]>([]);
    const [updatingIds, setUpdatingIds] = useState<string[]>([]);
    const [statusUpdateError, setStatusUpdateError] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setDebouncedTags(tags.trim());
            setDebouncedLocation(location.trim());
            setDebouncedMinExperience(minExperience.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [search, tags, location, minExperience]);

    const { data: jobsData } = useGetJobsQuery({ limit: 200 });
    const jobs = jobsData?.data.jobs || [];

    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (status) params.status = status;
    if (jobId) params.jobId = jobId;
    if (debouncedTags) params.tags = debouncedTags;
    if (debouncedLocation) params.location = debouncedLocation;
    if (debouncedMinExperience && !isNaN(Number(debouncedMinExperience))) {
        params.minExperience = debouncedMinExperience; // let the query serialize it as string
    }

    const { data, isLoading, error } = useGetApplicationsQuery(
        params as any
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
        setStatusUpdateError('');

        setOptimisticApplications((prev) =>
            prev.map((app) => (app._id === id ? { ...app, status: newStatus } : app))
        );
        setUpdatingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

        try {
            await updateStatus({ id, data: { status: newStatus } }).unwrap();
        } catch (error: any) {
            setOptimisticApplications((prev) =>
                prev.map((app) => (app._id === id ? { ...app, status: previousStatus } : app))
            );
            setStatusUpdateError(
                error?.data?.message ||
                    'Could not update status right now. Please check interview scheduling setup and retry.'
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
                            onClick={() => setView('list')}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm"
                            style={{
                                backgroundColor: view === 'list' ? 'var(--color-bg-subtle)' : 'var(--color-bg-surface)',
                                color: view === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                fontWeight: view === 'list' ? 500 : 400,
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
                className="p-4 rounded-xl border mb-5"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
                    <div className="relative col-span-2 xl:col-span-2">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--color-text-muted)' }}
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Name, email, phone"
                            className="w-full pl-9 pr-3 h-10 text-sm rounded-lg border outline-none font-medium transition-colors"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <select
                        value={jobId}
                        onChange={(e) => setJobId(e.target.value)}
                        className="h-10 px-3 text-sm rounded-lg border outline-none font-medium transition-colors"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                    >
                        <option value="">All Jobs</option>
                        {jobs.map((job: any) => (
                            <option key={job._id} value={job._id}>{job.title}</option>
                        ))}
                    </select>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ApplicationStatus | '')}
                        className="h-10 px-3 text-sm rounded-lg border outline-none font-medium transition-colors"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
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
                        placeholder="Tags (comma sep)"
                        className="h-10 px-3 text-sm rounded-lg border outline-none font-medium transition-colors"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                    />
                    <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Location"
                        className="h-10 px-3 text-sm rounded-lg border outline-none font-medium transition-colors"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                    />
                    <select
                        value={minExperience}
                        onChange={(e) => setMinExperience(e.target.value)}
                        className="h-10 px-3 text-sm rounded-lg border outline-none font-medium transition-colors"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                    >
                        <option value="">Any Experience</option>
                        <option value="0">Fresher (0 Years)</option>
                        <option value="1">1+ Years</option>
                        <option value="2">2+ Years</option>
                        <option value="3">3+ Years</option>
                        <option value="4">4+ Years</option>
                        <option value="5">5+ Years</option>
                        <option value="7">7+ Years</option>
                        <option value="10">10+ Years</option>
                    </select>
                </div>
                {(search.trim() !== debouncedSearch || tags.trim() !== debouncedTags || location.trim() !== debouncedLocation || minExperience.trim() !== debouncedMinExperience) && (
                    <p className="text-[11px] font-medium mt-2.5 ml-1" style={{ color: 'var(--color-text-muted)' }}>
                        Updating filters...
                    </p>
                )}
                {statusUpdateError && (
                    <p className="text-[11px] font-medium mt-2.5 ml-1" style={{ color: 'var(--color-danger)' }}>
                        {statusUpdateError}
                    </p>
                )}
            </div>

            {/* List view */}
            {view === 'list' && (
                <div className="flex flex-col gap-3">
                    {displayedApplications.length > 0 && (
                        <div
                            className="hidden lg:grid lg:grid-cols-[32%_1fr_220px] items-center px-4 py-3 rounded-lg border"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: '#F4F6F8',
                            }}
                        >
                            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                                Candidate
                            </p>
                            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                                Links & Details
                            </p>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-right" style={{ color: 'var(--color-text-muted)' }}>
                                Stage
                            </p>
                        </div>
                    )}
                    {displayedApplications.length === 0 && (
                        <div className="col-span-full py-16 text-center border rounded-xl" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No applications found.</p>
                        </div>
                    )}
                    {displayedApplications.map((app: any) => {
                        const meta = STATUS_META[app.status as ApplicationStatus] || STATUS_META.new;
                        const isRowUpdating = updatingIds.includes(app._id);
                        const selectedJobId = getJobIdValue(app.jobId);
                        const canReviewAssignment = app.status === 'assignment-submitted' && Boolean(selectedJobId);
                        const canViewInterview =
                            (
                                app.status === 'interview' ||
                                app.status === 'interview-scheduled' ||
                                app.status === 'interview-rescheduled'
                            ) && Boolean(app._id);

                        return (
                            <div
                                key={app._id}
                                className="group relative rounded-xl border p-3 md:p-4 min-h-[100px] flex flex-col justify-center transition-all hover:shadow-md hover:-translate-y-[1px] cursor-pointer overflow-hidden"
                                style={{ borderColor: meta.bg, backgroundColor: 'var(--color-bg-surface)' }}
                                onClick={() => navigate(`/hiring/applications/${app._id}`)}
                            >
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-1.5"
                                    style={{ backgroundColor: meta.color }}
                                />
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between w-full">
                                    <div className="w-full lg:w-[32%] pl-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-semibold text-lg leading-snug group-hover:opacity-90" style={{ color: 'var(--color-text-primary)' }}>
                                                    {app.name}
                                                </h3>
                                                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {app.jobId?.title || 'Job role not available'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                                <MapPin size={13} />
                                                {app.location || 'Location not shared'}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                                <Briefcase size={13} />
                                                {typeof app.yearsOfExperience === 'number'
                                                    ? `${app.yearsOfExperience} YOE`
                                                    : 'YOE not shared'}
                                            </span>
                                        </div>

                                        {Array.isArray(app.tags) && app.tags.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {app.tags.map((tag: string) => (
                                                    <span
                                                        key={`${app._id}-${tag}`}
                                                        className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide border"
                                                        style={{
                                                            borderColor: meta.bg,
                                                            backgroundColor: '#FFFFFF',
                                                            color: meta.color,
                                                        }}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="w-full lg:flex-1 lg:px-4 lg:border-x" onClick={(e) => e.stopPropagation()} style={{ borderColor: 'var(--color-border-subtle)' }}>
                                        <p className="text-[11px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                            Candidate Links
                                        </p>
                                        <div className="flex flex-wrap gap-2.5">
                                            {(() => {
                                                // Build dynamic list of all links and attachments
                                                const allLinks: Array<{
                                                    label: string;
                                                    url: string;
                                                    isResume?: boolean;
                                                    isAttachment?: boolean;
                                                    icon?: any;
                                                    style?: any;
                                                }> = [];

                                                // Resume is always first (mandatory)
                                                if (app.resumeUrl) {
                                                    allLinks.push({
                                                        label: 'Resume',
                                                        url: app.resumeUrl,
                                                        isResume: true,
                                                        icon: FileText,
                                                        style: { backgroundColor: '#EEF7FF', color: '#0B4F88', borderColor: '#BFDBFE' },
                                                    });
                                                }

                                                // Standard URL fields
                                                const standardFields: Array<{
                                                    key: keyof typeof app;
                                                    label: string;
                                                    icon: any;
                                                    style: any;
                                                }> = [
                                                    { key: 'portfolio', label: 'Portfolio', icon: Globe, style: { backgroundColor: '#F0FDF4', color: '#166534', borderColor: '#BBF7D0' } },
                                                    { key: 'github', label: 'GitHub', icon: Github, style: { backgroundColor: '#F3F4F6', color: '#111827', borderColor: '#D1D5DB' } },
                                                    { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, style: { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' } },
                                                    { key: 'figmaUrl', label: 'Figma', icon: ExternalLink, style: { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' } },
                                                ];

                                                standardFields.forEach(({ key, label, icon, style }) => {
                                                    const value = app[key];
                                                    if (value && typeof value === 'string' && value.trim()) {
                                                        allLinks.push({ label, url: value.trim(), icon, style });
                                                    }
                                                });

                                                // Custom field responses (URLs and attachments)
                                                if (app.customFieldResponses && Array.isArray(app.customFieldResponses)) {
                                                    app.customFieldResponses.forEach((response: any) => {
                                                        if (response.type === 'url' && response.value && response.value.trim()) {
                                                            allLinks.push({
                                                                label: response.label || 'Custom Link',
                                                                url: response.value.trim(),
                                                                icon: ExternalLink,
                                                                style: { backgroundColor: '#F3F4F6', color: '#374151', borderColor: '#D1D5DB' },
                                                            });
                                                        } else if (response.type === 'attachment' && response.fileUrl && response.fileUrl.trim()) {
                                                            allLinks.push({
                                                                label: response.label || response.fileName || 'Attachment',
                                                                url: response.fileUrl.trim(),
                                                                isAttachment: true,
                                                                icon: Paperclip,
                                                                style: { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' },
                                                            });
                                                        }
                                                    });
                                                }

                                                return (
                                                    <>
                                                        {allLinks.map((link, index) => {
                                                            const Icon = link.icon || ExternalLink;
                                                            return (
                                                                <a
                                                                    key={index}
                                                                    href={link.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all hover:-translate-y-[1px]"
                                                                    style={link.style}
                                                                >
                                                                    <Icon size={13} /> {link.label}
                                                                </a>
                                                            );
                                                        })}
                                                        {allLinks.length === 0 && (
                                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                No links shared by candidate.
                                                            </span>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    <div
                                        className="w-full lg:w-[220px] flex flex-col lg:items-end gap-2"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ opacity: isRowUpdating ? 0.65 : 1 }}
                                    >
                                        {(canReviewAssignment || canViewInterview) && (
                                            <div className="hidden lg:block h-[32px] w-full shrink-0" />
                                        )}

                                        <div className="relative inline-flex items-center w-full lg:justify-end shrink-0">
                                            <select
                                                value={app.status}
                                                onChange={(e) => handleStatusChange(app._id, e.target.value as ApplicationStatus)}
                                                disabled={isRowUpdating}
                                                className="h-9 w-full lg:w-[180px] appearance-none pl-3.5 pr-9 text-[11px] rounded-lg border outline-none"
                                                style={{
                                                    borderColor: isRowUpdating ? 'var(--color-border-default)' : meta.color,
                                                    backgroundColor: '#FFFFFF',
                                                    color: meta.color,
                                                    fontWeight: 600,
                                                    cursor: isRowUpdating ? 'not-allowed' : 'pointer',
                                                }}
                                            >
                                                {getStatusUpdateOptions(app.status as ApplicationStatus).map((statusValue) => (
                                                    <option key={statusValue} value={statusValue}>
                                                        {STATUS_META[statusValue].label}
                                                    </option>
                                                ))}
                                            </select>
                                            <span className="pointer-events-none absolute right-3" style={{ color: 'var(--color-text-muted)' }}>
                                                <ChevronDown size={14} strokeWidth={2.5} />
                                            </span>
                                        </div>
                                        {(canReviewAssignment || canViewInterview) && (
                                            <div className="flex w-full flex-wrap gap-2 lg:justify-end shrink-0">
                                                {canReviewAssignment && (
                                                    <button
                                                        onClick={() =>
                                                            navigate(
                                                                `/hiring/assignments?tab=assignment-review&jobId=${selectedJobId}&applicationId=${app._id}`
                                                            )
                                                        }
                                                        className="h-8 rounded-lg border px-3 text-[11px] font-semibold"
                                                        style={{
                                                            borderColor: '#C4B5FD',
                                                            backgroundColor: '#FAF5FF',
                                                            color: '#6D28D9',
                                                        }}
                                                    >
                                                        Review Assignment
                                                    </button>
                                                )}
                                                {canViewInterview && (
                                                    <button
                                                        onClick={() =>
                                                            navigate(
                                                                `/hiring/interviews?applicationId=${app._id}&open=1`
                                                            )
                                                        }
                                                        className="h-8 rounded-lg border px-3 text-[11px] font-semibold"
                                                        style={{
                                                            borderColor: '#99F6E4',
                                                            backgroundColor: '#F0FDFA',
                                                            color: '#0F766E',
                                                        }}
                                                    >
                                                        View Interview
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
