import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, Save, ChevronDown, X } from 'lucide-react';
import {
    useGetInterviewDetailsQuery,
    useGetInterviewsQuery,
    useSaveInterviewNoteMutation,
    useUpdateInterviewStatusMutation,
} from '@/features/hiring/hiringApi';
import HiringInterviewTabs from '@/features/hiring/components/HiringInterviewTabs';
import type { InterviewStatus } from '@/features/hiring/types/types';

const STATUS_OPTIONS: InterviewStatus[] = [
    'scheduled',
    'completed',
    'cancelled',
    'rescheduled',
    'no-show',
];

const STATUS_LABEL: Record<InterviewStatus, string> = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rescheduled: 'Rescheduled',
    'no-show': 'No Show',
};

const STATUS_META: Record<InterviewStatus, { color: string; bg: string }> = {
    scheduled: { color: '#0F766E', bg: '#CCFBF1' },
    completed: { color: '#15803D', bg: '#DCFCE7' },
    cancelled: { color: '#B91C1C', bg: '#FEE2E2' },
    rescheduled: { color: '#7C3AED', bg: '#F3E8FF' },
    'no-show': { color: '#92400E', bg: '#FEF3C7' },
};

function normalizeExternalUrl(url?: string | null) {
    if (!url) return '';

    const trimmedUrl = url.trim();
    if (!trimmedUrl) return '';

    if (/^https?:\/\//i.test(trimmedUrl)) {
        return trimmedUrl;
    }

    return `https://${trimmedUrl}`;
}

export default function HiringInterviewsPage() {
    const [status, setStatus] = useState<InterviewStatus | ''>('');
    const [search, setSearch] = useState('');
    const [selectedInterviewId, setSelectedInterviewId] = useState<string>('');
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [noteSaved, setNoteSaved] = useState(false);

    const { data, isLoading, error } = useGetInterviewsQuery(
        {
            status: status || undefined,
            search: search || undefined,
            limit: 100,
        },
        { refetchOnMountOrArgChange: true }
    );

    const [updateInterviewStatus, { isLoading: updating }] = useUpdateInterviewStatusMutation();
    const [saveInterviewNote, { isLoading: savingNote }] = useSaveInterviewNoteMutation();

    const interviews = data?.data.interviews || [];

    useEffect(() => {
        if (interviews.length === 0) {
            setSelectedInterviewId('');
            setIsDetailsOpen(false);
            return;
        }

        const hasSelectedInterview = interviews.some((item: any) => item._id === selectedInterviewId);
        if (selectedInterviewId && !hasSelectedInterview) {
            setSelectedInterviewId('');
            setIsDetailsOpen(false);
        }
    }, [selectedInterviewId, interviews]);

    const { data: detailsData, isFetching: detailsLoading } = useGetInterviewDetailsQuery(
        selectedInterviewId,
        { skip: !selectedInterviewId }
    );

    const details = detailsData?.data;

    // Reset note state when interview changes
    useEffect(() => {
        setNoteText('');
        setNoteSaved(false);
    }, [selectedInterviewId]);

    useEffect(() => {
        if (!details) {
            return;
        }

        if (!details.note) {
            setNoteText('');
            return;
        }
        setNoteText(details.note.notes);
    }, [details]);

    // Close sidebar with ESC key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDetailsOpen) {
                setIsDetailsOpen(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isDetailsOpen]);

    // Prevent body scroll when sidebar is open
    useEffect(() => {
        if (isDetailsOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isDetailsOpen]);

    const selectedApplication: any = useMemo(() => {
        const app = details?.interview?.applicationId;
        return typeof app === 'object' ? app : undefined;
    }, [details]);

    const selectedJob: any = useMemo(() => {
        const job = selectedApplication?.jobId;
        return typeof job === 'object' ? job : undefined;
    }, [selectedApplication]);

    async function onUpdateStatus(id: string, nextStatus: InterviewStatus) {
        await updateInterviewStatus({ id, status: nextStatus }).unwrap();
    }

    async function onSaveNotes() {
        if (!selectedInterviewId || !noteText.trim()) return;

        await saveInterviewNote({
            id: selectedInterviewId,
            data: {
                rating: 7,
                technicalScore: 7,
                communicationScore: 7,
                notes: noteText.trim(),
            },
        }).unwrap();

        setNoteSaved(true);
        window.setTimeout(() => setNoteSaved(false), 1800);
    }

    function openInterviewDetails(id: string) {
        setSelectedInterviewId(id);
        setIsDetailsOpen(true);
    }

    function closeInterviewDetails() {
        setIsDetailsOpen(false);
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading interviews...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Unable to load interviews.
                </div>
            </div>
        );
    }

    return (
        <div className="px-8 py-6 max-w-[1380px] mx-auto" style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}>
            <HiringInterviewTabs
                title="Interviews"
                description="Track interviews and capture structured interviewer evaluation notes."
            />

            <div className="grid grid-cols-5 gap-4 mb-4">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search candidate, email, or job"
                    className="h-10 px-3 text-sm rounded-lg border outline-none col-span-3"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                />
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as InterviewStatus | '')}
                    className="h-10 px-3 text-sm rounded-lg border outline-none col-span-2"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                            {STATUS_LABEL[item]}
                        </option>
                    ))}
                </select>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                            {['Candidate', 'Job', 'Time', 'Status'].map((head) => (
                                <th
                                    key={head}
                                    className="px-4 py-3 text-left text-xs font-semibold uppercase"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    {head}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {interviews.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    No interviews found.
                                </td>
                            </tr>
                        )}
                        {interviews.map((interview: any, idx: number) => {
                            const application =
                                typeof interview.applicationId === 'object' ? interview.applicationId : undefined;
                            const job = application && typeof application.jobId === 'object' ? application.jobId : undefined;
                            const isSelected = isDetailsOpen && selectedInterviewId === interview._id;
                            const interviewStatus = interview.status as InterviewStatus;

                            return (
                                <tr
                                    key={interview._id}
                                    onClick={() => openInterviewDetails(interview._id)}
                                    style={{
                                        cursor: 'pointer',
                                        background: isSelected
                                            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.12) 0%, rgba(14, 165, 233, 0.08) 100%)'
                                            : 'transparent',
                                        borderBottom: idx === interviews.length - 1 ? 'none' : '1px solid var(--color-border-default)',
                                    }}
                                    className="transition-colors duration-200 hover:bg-[var(--color-bg-subtle)]"
                                >
                                    <td className="px-4 py-4">
                                        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{application?.name || '—'}</p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{application?.email || '—'}</p>
                                    </td>
                                    <td className="px-4 py-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        {job?.title || '—'}
                                    </td>
                                    <td className="px-4 py-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        {new Date(interview.scheduledTime).toLocaleString('en-IN', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </td>
                                    <td className="px-4 py-4">
                                        <div
                                            className="relative inline-flex items-center"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            style={{ opacity: updating ? 0.6 : 1 }}
                                        >
                                            <select
                                                value={interview.status}
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    onUpdateStatus(interview._id, e.target.value as InterviewStatus);
                                                }}
                                                disabled={updating}
                                                className="h-9 appearance-none pl-3 pr-9 text-xs rounded-full border outline-none shadow-sm"
                                                style={{
                                                    borderColor: STATUS_META[interviewStatus].bg,
                                                    backgroundColor: '#FFFFFF',
                                                    color: STATUS_META[interviewStatus].color,
                                                    fontWeight: 600,
                                                    boxShadow: `inset 0 0 0 1px ${STATUS_META[interviewStatus].bg}`,
                                                    minWidth: '140px',
                                                }}
                                            >
                                                {STATUS_OPTIONS.map((item) => (
                                                    <option key={item} value={item}>
                                                        {STATUS_LABEL[item]}
                                                    </option>
                                                ))}
                                            </select>
                                            <span
                                                className="pointer-events-none absolute right-3"
                                                style={{ color: STATUS_META[interviewStatus].color }}
                                            >
                                                <ChevronDown size={14} />
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Backdrop overlay */}
            {isDetailsOpen && (
                <div
                    className="fixed inset-0 z-40 transition-opacity duration-300"
                    style={{
                        background: 'linear-gradient(180deg, rgba(15, 28, 20, 0.22) 0%, rgba(15, 28, 20, 0.38) 100%)',
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={closeInterviewDetails}
                />
            )}

            {/* Sliding sidebar */}
            <div
                className="fixed top-0 right-0 z-50 h-full w-full max-w-[640px] overflow-y-auto border-l shadow-2xl transition-transform duration-300 ease-in-out"
                style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FBF8 100%)',
                    borderColor: 'rgba(15, 28, 20, 0.08)',
                    transform: isDetailsOpen ? 'translateX(0)' : 'translateX(100%)',
                }}
            >
                {selectedInterviewId && (
                    <div key={selectedInterviewId} className="h-full flex flex-col">
                        {/* Sidebar header */}
                        <div
                            className="sticky top-0 z-10 border-b px-5 py-4 sm:px-6"
                            style={{
                                borderColor: 'rgba(15, 28, 20, 0.08)',
                                background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.85) 0%, rgba(219, 234, 254, 0.85) 100%)',
                                backdropFilter: 'blur(18px)',
                            }}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-secondary)' }}>
                                        Hiring Workspace
                                    </p>
                                    <h2 className="mt-1 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        Interview Details
                                    </h2>
                                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        Review candidate context, schedule, submissions, and interview notes in one place.
                                    </p>
                                </div>
                                <button
                                    onClick={closeInterviewDetails}
                                    className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-white"
                                    style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.76)',
                                        borderColor: 'rgba(15, 28, 20, 0.08)',
                                    }}
                                    aria-label="Close sidebar"
                                >
                                    <X size={18} style={{ color: 'var(--color-text-secondary)' }} />
                                </button>
                            </div>
                        </div>

                        {/* Sidebar content */}
                        <div className="flex-1 p-5 sm:p-6">
                            {detailsLoading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        <Loader2 size={16} className="animate-spin" />
                                        Loading interview details...
                                    </div>
                                </div>
                            ) : !details ? (
                                <div className="flex items-center justify-center h-64">
                                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                        No interview details found.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div
                                        className="rounded-2xl border p-5 shadow-sm"
                                        style={{
                                            borderColor: 'rgba(15, 28, 20, 0.08)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.88)',
                                        }}
                                    >
                                        <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                            Candidate Details
                                        </h3>
                                        <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                            {selectedApplication?.name || '—'}
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                            {selectedApplication?.email || '—'}
                                            {selectedApplication?.phone ? ` • ${selectedApplication.phone}` : ''}
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                            {selectedJob?.title || '—'}{selectedJob?.department ? ` • ${selectedJob.department}` : ''}
                                        </p>
                                        {selectedApplication?.resumeUrl && (
                                            <a
                                                href={selectedApplication.resumeUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
                                                style={{ color: 'var(--color-primary)' }}
                                            >
                                                Open Resume <ExternalLink size={11} />
                                            </a>
                                        )}
                                    </div>

                                    <div
                                        className="rounded-2xl border p-5 shadow-sm"
                                        style={{
                                            borderColor: 'rgba(15, 28, 20, 0.08)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.88)',
                                        }}
                                    >
                                        <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                            Interview Schedule
                                        </h3>
                                        <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            <p>
                                                <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Time:</span>{' '}
                                                {details?.interview?.scheduledTime
                                                    ? new Date(details.interview.scheduledTime).toLocaleString('en-IN', {
                                                          weekday: 'long',
                                                          day: 'numeric',
                                                          month: 'long',
                                                          year: 'numeric',
                                                          hour: '2-digit',
                                                          minute: '2-digit',
                                                      })
                                                    : '—'}
                                            </p>
                                            <p>
                                                <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Interviewer:</span>{' '}
                                                {details?.interview?.interviewer || '—'}
                                            </p>
                                            {details?.interview?.meetLink && (
                                                <a
                                                    href={normalizeExternalUrl(details.interview.meetLink)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                                                    style={{ color: 'var(--color-primary)' }}
                                                >
                                                    Join Meeting <ExternalLink size={11} />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div
                                        className="rounded-2xl border p-5 shadow-sm"
                                        style={{
                                            borderColor: 'rgba(15, 28, 20, 0.08)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.88)',
                                        }}
                                    >
                                        <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                            Assignment Submission
                                        </h3>
                                        {!details?.assignmentSubmission ? (
                                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                No assignment submission found.
                                            </p>
                                        ) : (
                                            <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                <p>
                                                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Assignment:</span>{' '}
                                                    {typeof details.assignmentSubmission.assignmentId === 'object'
                                                        ? details.assignmentSubmission.assignmentId.title
                                                        : '—'}
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    {details.assignmentSubmission.githubLink && (
                                                        <a href={details.assignmentSubmission.githubLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                                                            GitHub <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                    {details.assignmentSubmission.demoLink && (
                                                        <a href={details.assignmentSubmission.demoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                                                            Demo <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                    {details.assignmentSubmission.videoLink && (
                                                        <a href={details.assignmentSubmission.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                                                            Video <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                </div>
                                                {details.assignmentSubmission.notes && (
                                                    <p className="text-xs whitespace-pre-wrap mt-2 p-3 rounded-lg" style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                                        {details.assignmentSubmission.notes}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        className="rounded-2xl border p-5 shadow-sm"
                                        style={{
                                            borderColor: 'rgba(15, 28, 20, 0.08)',
                                            backgroundColor: 'rgba(255, 255, 255, 0.92)',
                                        }}
                                    >
                                        <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                                            Interview Notes
                                        </h3>

                                        <textarea
                                            value={noteText}
                                            onChange={(e) => setNoteText(e.target.value)}
                                            rows={10}
                                            placeholder="Write evaluation notes: technical depth, communication skills, strengths, concerns, recommendation..."
                                            className="w-full min-h-[240px] resize-y rounded-xl border px-3 py-3 text-sm outline-none"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: '#FCFDFC',
                                                color: 'var(--color-text-primary)',
                                            }}
                                        />

                                        <div className="flex items-center justify-between mt-3">
                                            <div className="text-xs" style={{ color: noteSaved ? '#166534' : 'var(--color-text-muted)' }}>
                                                {noteSaved
                                                    ? '✓ Interview notes saved successfully.'
                                                    : details?.note?.updatedAt
                                                      ? `Last saved: ${new Date(details.note.updatedAt).toLocaleString('en-IN')}`
                                                      : 'No notes saved yet.'}
                                            </div>
                                            <button
                                                onClick={onSaveNotes}
                                                disabled={!noteText.trim() || savingNote}
                                                className="h-9 px-4 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-opacity hover:opacity-90"
                                                style={{
                                                    backgroundColor: 'var(--color-primary)',
                                                    color: '#fff',
                                                    opacity: !noteText.trim() || savingNote ? 0.5 : 1,
                                                    cursor: !noteText.trim() || savingNote ? 'not-allowed' : 'pointer',
                                                }}
                                            >
                                                {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                Save Notes
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
