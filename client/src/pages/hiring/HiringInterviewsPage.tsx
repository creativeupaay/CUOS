import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ExternalLink, Loader2, Save, ChevronDown, X } from 'lucide-react';
import {
    useGetInterviewDetailsQuery,
    useGetInterviewsQuery,
    useRequestInterviewRescheduleMutation,
    useSaveInterviewNoteMutation,
    useUpdateApplicationStatusMutation,
    useUpdateInterviewStatusMutation,
} from '@/features/hiring/hiringApi';
import HiringInterviewTabs from '@/features/hiring/components/HiringInterviewTabs';
import type { ApplicationStatus, InterviewStatus } from '@/features/hiring/types/types';

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

function getInterviewRowPriority(applicationStatus?: ApplicationStatus) {
    if (applicationStatus === 'rejected') {
        return 2;
    }

    if (applicationStatus === 'hired') {
        return 1;
    }

    return 0;
}

function normalizeExternalUrl(url?: string | null) {
    if (!url) return '';

    const trimmedUrl = String(url).trim();
    if (!trimmedUrl) return '';

    const explicitUrlMatch = trimmedUrl.match(/https?:\/\/[^\s"'<>]+/i);
    if (explicitUrlMatch) {
        return explicitUrlMatch[0];
    }

    const domainLikeMatch = trimmedUrl.match(
        /(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|cal\.com|[a-z0-9-]+\.[a-z]{2,})(?:\/[^\s"'<>]*)?/i
    );
    if (domainLikeMatch) {
        const extracted = domainLikeMatch[0].replace(/[),.;]+$/, '');
        return /^https?:\/\//i.test(extracted) ? extracted : `https://${extracted}`;
    }

    if (/^https?:\/\//i.test(trimmedUrl)) {
        return trimmedUrl;
    }

    return '';
}

function normalizeMeetingUrl(url?: string | null) {
    if (!url) return '';

    const trimmedUrl = String(url).trim();
    if (!trimmedUrl || trimmedUrl.startsWith('/')) {
        return '';
    }

    const explicitMeetingUrlMatch = trimmedUrl.match(
        /https?:\/\/(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|meet\.jit\.si|whereby\.com)\/[^\s"'<>]+/i
    );
    if (explicitMeetingUrlMatch) {
        return explicitMeetingUrlMatch[0].replace(/[),.;]+$/, '');
    }

    const providerOnlyMatch = trimmedUrl.match(
        /(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|meet\.jit\.si|whereby\.com)\/[^\s"'<>]+/i
    );
    if (providerOnlyMatch) {
        const extracted = providerOnlyMatch[0].replace(/[),.;]+$/, '');
        return `https://${extracted}`;
    }

    return '';
}

export default function HiringInterviewsPage() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<InterviewStatus | ''>('');
    const [search, setSearch] = useState('');
    const [selectedInterviewId, setSelectedInterviewId] = useState<string>('');
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [noteSaved, setNoteSaved] = useState(false);
    const [preferredRescheduleTime, setPreferredRescheduleTime] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionModal, setActionModal] = useState<{
        interviewId: string;
        applicationId: string;
        candidateName: string;
        jobTitle: string;
        action: 'rejected' | 'hired' | 'reschedule';
    } | null>(null);
    const [actionToast, setActionToast] = useState<{
        type: 'rejected' | 'hired' | 'reschedule';
        candidateName: string;
    } | null>(
        null
    );
    const focusedApplicationId = searchParams.get('applicationId') || '';
    const shouldAutoOpen = searchParams.get('open') === '1';

    const { data, isLoading, error } = useGetInterviewsQuery(
        {
            applicationId: focusedApplicationId || undefined,
            status: status || undefined,
            search: search || undefined,
            limit: 100,
        }
    );

    const [updateInterviewStatus, { isLoading: updating }] = useUpdateInterviewStatusMutation();
    const [updateApplicationStatus, { isLoading: updatingApplicationStatus }] = useUpdateApplicationStatusMutation();
    const [requestInterviewReschedule, { isLoading: reschedulingInterview }] = useRequestInterviewRescheduleMutation();
    const [saveInterviewNote, { isLoading: savingNote }] = useSaveInterviewNoteMutation();

    const interviews = useMemo(() => {
        const interviewList = data?.data.interviews || [];

        return [...interviewList].sort((left: any, right: any) => {
            const leftApplication =
                typeof left.applicationId === 'object' ? left.applicationId : undefined;
            const rightApplication =
                typeof right.applicationId === 'object' ? right.applicationId : undefined;

            const leftPriority = getInterviewRowPriority(leftApplication?.status as ApplicationStatus | undefined);
            const rightPriority = getInterviewRowPriority(rightApplication?.status as ApplicationStatus | undefined);

            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority;
            }

            return new Date(left.scheduledTime).getTime() - new Date(right.scheduledTime).getTime();
        });
    }, [data?.data.interviews]);

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

    useEffect(() => {
        if (!shouldAutoOpen || !focusedApplicationId || interviews.length === 0) {
            return;
        }

        const firstInterview = interviews[0];
        if (!firstInterview?._id) {
            return;
        }

        setSelectedInterviewId(firstInterview._id);
        setIsDetailsOpen(true);
    }, [focusedApplicationId, interviews, shouldAutoOpen]);

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

    // Prevent body scroll when sidebar or action modal is open
    useEffect(() => {
        if (isDetailsOpen || actionModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isDetailsOpen, actionModal]);

    useEffect(() => {
        if (!actionToast) {
            return undefined;
        }

        const timer = window.setTimeout(() => setActionToast(null), 2200);
        return () => window.clearTimeout(timer);
    }, [actionToast]);

    useEffect(() => {
        setActionError('');
        if (actionModal?.action !== 'reschedule') {
            setPreferredRescheduleTime('');
        }
    }, [actionModal]);

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

    async function onConfirmApplicationAction() {
        if (!actionModal) {
            return;
        }

        if (actionModal.action === 'reschedule') {
            if (!preferredRescheduleTime) {
                setActionError('Preferred time is required for rescheduling.');
                return;
            }

            await requestInterviewReschedule({
                id: actionModal.interviewId,
                data: {
                    preferredTime: new Date(preferredRescheduleTime).toISOString(),
                },
            }).unwrap();
        } else {
            await updateApplicationStatus({
                id: actionModal.applicationId,
                data: { status: actionModal.action as ApplicationStatus },
            }).unwrap();
        }

        setActionToast({
            type: actionModal.action,
            candidateName: actionModal.candidateName,
        });
        setPreferredRescheduleTime('');
        setActionError('');
        setActionModal(null);
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
                            {['Candidate', 'Job', 'Time', 'Status', 'Action'].map((head) => (
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
                                <td colSpan={5} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
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
                            const applicationStatus = application?.status as ApplicationStatus | undefined;
                            const applicationId = application?._id || '';
                            const candidateName = application?.name || 'Candidate';
                            const jobTitle = job?.title || 'the role';
                            const displayInterviewStatus =
                                Boolean(interview.awaitingReschedule) && interviewStatus === 'scheduled'
                                    ? 'rescheduled'
                                    : interviewStatus;
                            const isAwaitingReschedule =
                                Boolean(interview.awaitingReschedule) &&
                                displayInterviewStatus !== 'scheduled' &&
                                displayInterviewStatus !== 'rescheduled';

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
                                                value={displayInterviewStatus}
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    onUpdateStatus(interview._id, e.target.value as InterviewStatus);
                                                }}
                                                disabled={updating}
                                                className="h-9 appearance-none pl-3 pr-9 text-xs rounded-full border outline-none shadow-sm"
                                                style={{
                                                    borderColor: STATUS_META[displayInterviewStatus].bg,
                                                    backgroundColor: '#FFFFFF',
                                                    color: STATUS_META[displayInterviewStatus].color,
                                                    fontWeight: 600,
                                                    boxShadow: `inset 0 0 0 1px ${STATUS_META[displayInterviewStatus].bg}`,
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
                                                style={{ color: STATUS_META[displayInterviewStatus].color }}
                                            >
                                                <ChevronDown size={14} />
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        {applicationStatus === 'rejected' ? (
                                            <span
                                                className="inline-flex h-9 w-[152px] items-center justify-center rounded-full border px-3 text-xs font-semibold"
                                                style={{
                                                    borderColor: '#FECACA',
                                                    backgroundColor: '#FFF1F2',
                                                    color: '#B91C1C',
                                                }}
                                            >
                                                Rejected
                                            </span>
                                        ) : applicationStatus === 'hired' ? (
                                            <span
                                                className="inline-flex h-9 w-[152px] items-center justify-center rounded-full border px-3 text-xs font-semibold"
                                                style={{
                                                    borderColor: '#BBF7D0',
                                                    backgroundColor: '#ECFDF3',
                                                    color: '#15803D',
                                                }}
                                            >
                                                Hired
                                            </span>
                                        ) : isAwaitingReschedule ? (
                                            <span
                                                className="inline-flex h-9 w-[152px] items-center justify-center rounded-full border px-3 text-xs font-semibold"
                                                style={{
                                                    borderColor: '#BFDBFE',
                                                    backgroundColor: '#EFF6FF',
                                                    color: '#1D4ED8',
                                                }}
                                            >
                                                Reschedule Sent
                                            </span>
                                        ) : (
                                            <div
                                                className="flex w-[152px] flex-col items-stretch gap-2"
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!applicationId) return;
                                                            setActionModal({
                                                                interviewId: interview._id,
                                                                applicationId,
                                                                candidateName,
                                                                jobTitle,
                                                                action: 'rejected',
                                                            });
                                                        }}
                                                        disabled={!applicationId || updatingApplicationStatus || reschedulingInterview}
                                                        className="h-9 flex-1 px-3 rounded-full text-xs font-semibold border transition-colors"
                                                        style={{
                                                            borderColor: '#FECACA',
                                                            backgroundColor: '#FFF1F2',
                                                            color: '#B91C1C',
                                                            opacity:
                                                                !applicationId || updatingApplicationStatus || reschedulingInterview ? 0.55 : 1,
                                                        }}
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!applicationId) return;
                                                            setActionModal({
                                                                interviewId: interview._id,
                                                                applicationId,
                                                                candidateName,
                                                                jobTitle,
                                                                action: 'hired',
                                                            });
                                                        }}
                                                        disabled={!applicationId || updatingApplicationStatus || reschedulingInterview}
                                                        className="h-9 flex-1 px-3 rounded-full text-xs font-semibold border transition-colors"
                                                        style={{
                                                            borderColor: '#BBF7D0',
                                                            backgroundColor: '#ECFDF3',
                                                            color: '#15803D',
                                                            opacity:
                                                                !applicationId || updatingApplicationStatus || reschedulingInterview ? 0.55 : 1,
                                                        }}
                                                    >
                                                        Hire
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!applicationId) return;
                                                        setActionModal({
                                                            interviewId: interview._id,
                                                            applicationId,
                                                            candidateName,
                                                            jobTitle,
                                                            action: 'reschedule',
                                                        });
                                                    }}
                                                    disabled={!applicationId || updatingApplicationStatus || reschedulingInterview}
                                                    className="h-9 w-full px-3 rounded-full text-xs font-semibold border transition-colors"
                                                    style={{
                                                        borderColor: '#BFDBFE',
                                                        backgroundColor: '#EFF6FF',
                                                        color: '#1D4ED8',
                                                        opacity:
                                                            !applicationId || updatingApplicationStatus || reschedulingInterview ? 0.55 : 1,
                                                    }}
                                                >
                                                    Reschedule
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {actionToast && (
                <div className="fixed right-6 top-6 z-[70]">
                    <div
                        className="rounded-2xl border px-4 py-3 shadow-lg"
                        style={{
                            borderColor:
                                actionToast.type === 'hired'
                                    ? '#BBF7D0'
                                    : actionToast.type === 'reschedule'
                                        ? '#BFDBFE'
                                        : '#FECACA',
                            backgroundColor: '#FFFFFF',
                        }}
                    >
                        <p
                            className="text-sm font-semibold"
                            style={{
                                color:
                                    actionToast.type === 'hired'
                                        ? '#15803D'
                                        : actionToast.type === 'reschedule'
                                            ? '#1D4ED8'
                                            : '#B91C1C',
                            }}
                        >
                            {actionToast.type === 'hired'
                                ? 'Hired'
                                : actionToast.type === 'reschedule'
                                    ? 'Reschedule Sent'
                                    : 'Rejected'}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            {actionToast.type === 'reschedule'
                                ? `A fresh Cal.com scheduling link has been sent to ${actionToast.candidateName}.`
                                : `${actionToast.candidateName} has been marked as ${actionToast.type === 'hired' ? 'hired' : 'rejected'
                                }.`}
                        </p>
                    </div>
                </div>
            )}

            {actionModal && (
                <>
                    <div
                        className="fixed inset-0 z-[60]"
                        style={{ backgroundColor: 'rgba(15, 23, 42, 0.34)', backdropFilter: 'blur(3px)' }}
                        onClick={() => setActionModal(null)}
                    />
                    <div className="fixed inset-0 z-[61] flex items-center justify-center px-4">
                        <div
                            className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
                            style={{
                                borderColor: 'rgba(15, 28, 20, 0.08)',
                                background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FBF9 100%)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p
                                        className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        Interview Action
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {actionModal.action === 'hired'
                                            ? 'Mark Candidate as Hired'
                                            : actionModal.action === 'reschedule'
                                                ? 'Reschedule Interview'
                                                : 'Reject Candidate'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActionModal(null)}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border"
                                    style={{
                                        borderColor: 'rgba(15, 28, 20, 0.08)',
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    }}
                                >
                                    <X size={16} style={{ color: 'var(--color-text-secondary)' }} />
                                </button>
                            </div>

                            <p className="mt-4 text-sm leading-6" style={{ color: 'var(--color-text-secondary)' }}>
                                {actionModal.action === 'hired'
                                    ? `This will mark ${actionModal.candidateName} as hired for ${actionModal.jobTitle} and send a qualification email to the candidate.`
                                    : actionModal.action === 'reschedule'
                                        ? `This will cancel the currently scheduled interview, send a new Cal.com link to ${actionModal.candidateName}, and wait for the candidate to book another slot.`
                                        : `This will mark ${actionModal.candidateName} as rejected for ${actionModal.jobTitle} and send the rejection email immediately.`}
                            </p>

                            {actionModal.action === 'reschedule' && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                        Preferred time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={preferredRescheduleTime}
                                        onChange={(e) => {
                                            setPreferredRescheduleTime(e.target.value);
                                            if (actionError) {
                                                setActionError('');
                                            }
                                        }}
                                        className="w-full h-11 rounded-xl border px-3 text-sm outline-none"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: '#FFFFFF',
                                            color: 'var(--color-text-primary)',
                                        }}
                                    />
                                    <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        This preferred slot will be shown in the email along with the Cal.com link.
                                    </p>
                                </div>
                            )}

                            <div
                                className="mt-4 rounded-2xl border px-4 py-3"
                                style={{
                                    borderColor:
                                        actionModal.action === 'hired'
                                            ? '#BBF7D0'
                                            : actionModal.action === 'reschedule'
                                                ? '#BFDBFE'
                                                : '#FECACA',
                                    backgroundColor:
                                        actionModal.action === 'hired'
                                            ? '#F0FDF4'
                                            : actionModal.action === 'reschedule'
                                                ? '#EFF6FF'
                                                : '#FFF7F7',
                                }}
                            >
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                    {actionModal.candidateName}
                                </p>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                    {actionModal.jobTitle}
                                </p>
                            </div>

                            {actionError && (
                                <p className="mt-3 text-sm" style={{ color: 'var(--color-danger)' }}>
                                    {actionError}
                                </p>
                            )}

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActionModal(null);
                                        setPreferredRescheduleTime('');
                                        setActionError('');
                                    }}
                                    className="h-11 px-4 rounded-full border text-sm font-medium"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        color: 'var(--color-text-secondary)',
                                        backgroundColor: '#FFFFFF',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirmApplicationAction}
                                    disabled={updatingApplicationStatus || reschedulingInterview}
                                    className="h-11 px-5 rounded-full text-sm font-semibold inline-flex items-center gap-2"
                                    style={{
                                        backgroundColor:
                                            actionModal.action === 'hired'
                                                ? '#10B981'
                                                : actionModal.action === 'reschedule'
                                                    ? '#2563EB'
                                                    : '#EF4444',
                                        color: '#FFFFFF',
                                        opacity: updatingApplicationStatus || reschedulingInterview ? 0.7 : 1,
                                    }}
                                >
                                    {(updatingApplicationStatus || reschedulingInterview) && (
                                        <Loader2 size={15} className="animate-spin" />
                                    )}
                                    {actionModal.action === 'hired'
                                        ? 'Mark as Hired'
                                        : actionModal.action === 'reschedule'
                                            ? 'Send Reschedule Link'
                                            : 'Reject Candidate'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Portaled overlay and sidebar */}
            {createPortal(
                <>
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
                        className="fixed top-0 inset-y-0 right-0 z-50 w-full max-w-[640px] flex flex-col border-l shadow-2xl transition-transform duration-300 ease-in-out"
                        style={{
                            background: 'linear-gradient(180deg, #FFFFFF 0%, #F7FBF8 100%)',
                            borderColor: 'rgba(15, 28, 20, 0.08)',
                            transform: isDetailsOpen ? 'translateX(0)' : 'translateX(100%)',
                        }}
                    >
                        {selectedInterviewId && (
                            <div key={selectedInterviewId} className="flex flex-col h-full overflow-hidden">
                                {/* Sidebar header */}
                                <div
                                    className="shrink-0 z-10 border-b px-5 py-4 sm:px-6"
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
                                <div className="flex-1 overflow-y-auto p-5 sm:p-6 pb-20">
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
                                        <div className="space-y-4 mt-4 mb-32">
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
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {selectedApplication?.resumeUrl && (
                                                        <a
                                                            href={selectedApplication.resumeUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shadow-sm hover:opacity-80"
                                                            style={{
                                                                backgroundColor: '#FFFFFF',
                                                                borderColor: 'var(--color-border-default)',
                                                                color: 'var(--color-text-primary)'
                                                            }}
                                                        >
                                                            Resume <ExternalLink size={12} style={{ color: 'var(--color-text-secondary)' }} />
                                                        </a>
                                                    )}
                                                    {selectedApplication?.github && (
                                                        <a
                                                            href={normalizeExternalUrl(selectedApplication.github)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shadow-sm hover:opacity-80"
                                                            style={{
                                                                backgroundColor: '#FFFFFF',
                                                                borderColor: 'var(--color-border-default)',
                                                                color: 'var(--color-text-primary)'
                                                            }}
                                                        >
                                                            GitHub <ExternalLink size={12} style={{ color: 'var(--color-text-secondary)' }} />
                                                        </a>
                                                    )}
                                                    {selectedApplication?.portfolio && (
                                                        <a
                                                            href={normalizeExternalUrl(selectedApplication.portfolio)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shadow-sm hover:opacity-80"
                                                            style={{
                                                                backgroundColor: '#FFFFFF',
                                                                borderColor: 'var(--color-border-default)',
                                                                color: 'var(--color-text-primary)'
                                                            }}
                                                        >
                                                            Portfolio <ExternalLink size={12} style={{ color: 'var(--color-text-secondary)' }} />
                                                        </a>
                                                    )}
                                                    {selectedApplication?.linkedin && (
                                                        <a
                                                            href={normalizeExternalUrl(selectedApplication.linkedin)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shadow-sm hover:opacity-80"
                                                            style={{
                                                                backgroundColor: '#FFFFFF',
                                                                borderColor: 'var(--color-border-default)',
                                                                color: 'var(--color-text-primary)'
                                                            }}
                                                        >
                                                            LinkedIn <ExternalLink size={12} style={{ color: 'var(--color-text-secondary)' }} />
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
                                                    {(() => {
                                                        const meetingHref = normalizeMeetingUrl(
                                                            details?.interview?.meetLink
                                                        );

                                                        if (!meetingHref) {
                                                            return (
                                                                <p
                                                                    className="text-xs mt-1"
                                                                    style={{ color: 'var(--color-text-muted)' }}
                                                                >
                                                                    Meeting link unavailable
                                                                </p>
                                                            );
                                                        }

                                                        return (
                                                            <a
                                                                href={meetingHref}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                                                                style={{ color: 'var(--color-primary)' }}
                                                            >
                                                                Join Meeting <ExternalLink size={11} />
                                                            </a>
                                                        );
                                                    })()}
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
                                                            {details.assignmentSubmission.figmaLink && (
                                                                <a href={normalizeExternalUrl(details.assignmentSubmission.figmaLink)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                                                                    Figma <ExternalLink size={11} />
                                                                </a>
                                                            )}
                                                            {details.assignmentSubmission.attachments?.map((attachment, index) => (
                                                                <a key={`${details.assignmentSubmission?._id || 'submission'}-attachment-${index}`} href={attachment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--color-primary)' }}>
                                                                    {attachment.name} <ExternalLink size={11} />
                                                                </a>
                                                            ))}
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
                </>,
                document.body
            )}
        </div>
    );
}
