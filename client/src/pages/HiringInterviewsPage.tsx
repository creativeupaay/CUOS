import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, Save, ChevronDown } from 'lucide-react';
import {
    useGetInterviewDetailsQuery,
    useGetInterviewsQuery,
    useSaveInterviewNoteMutation,
    useUpdateInterviewStatusMutation,
} from '@/features/hiring/hiringApi';
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

export default function HiringInterviewsPage() {
    const [status, setStatus] = useState<InterviewStatus | ''>('');
    const [search, setSearch] = useState('');
    const [selectedInterviewId, setSelectedInterviewId] = useState<string>('');
    const [rating, setRating] = useState<number>(7);
    const [technicalScore, setTechnicalScore] = useState<number>(7);
    const [communicationScore, setCommunicationScore] = useState<number>(7);
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
            return;
        }

        const hasSelectedInterview = interviews.some((item: any) => item._id === selectedInterviewId);
        if (!selectedInterviewId || !hasSelectedInterview) {
            setSelectedInterviewId(interviews[0]._id);
        }
    }, [selectedInterviewId, interviews]);

    const { data: detailsData, isFetching: detailsLoading } = useGetInterviewDetailsQuery(
        selectedInterviewId,
        { skip: !selectedInterviewId }
    );

    const details = detailsData?.data;

    useEffect(() => {
        if (!details) {
            return;
        }

        if (!details.note) {
            setRating(7);
            setTechnicalScore(7);
            setCommunicationScore(7);
            setNoteText('');
            return;
        }
        setRating(details.note.rating);
        setTechnicalScore(details.note.technicalScore);
        setCommunicationScore(details.note.communicationScore);
        setNoteText(details.note.notes);
    }, [details]);

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
                rating,
                technicalScore,
                communicationScore,
                notes: noteText.trim(),
            },
        }).unwrap();

        setNoteSaved(true);
        window.setTimeout(() => setNoteSaved(false), 1800);
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
            <div className="mb-6">
                <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Interviews
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Track interviews and capture structured interviewer evaluation notes.
                </p>
            </div>

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

            <div className="grid grid-cols-12 gap-4">
                <div className="col-span-5 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Candidate', 'Job', 'Time', 'Status'].map((head) => (
                                    <th
                                        key={head}
                                        className="px-3 py-3 text-left text-xs font-semibold uppercase"
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
                                    <td colSpan={4} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                        No interviews found.
                                    </td>
                                </tr>
                            )}
                            {interviews.map((interview: any, idx: number) => {
                                const application =
                                    typeof interview.applicationId === 'object' ? interview.applicationId : undefined;
                                const job = application && typeof application.jobId === 'object' ? application.jobId : undefined;
                                const isSelected = selectedInterviewId === interview._id;
                                const interviewStatus = interview.status as InterviewStatus;

                                return (
                                    <tr
                                        key={interview._id}
                                        onClick={() => setSelectedInterviewId(interview._id)}
                                        style={{
                                            cursor: 'pointer',
                                            backgroundColor: isSelected ? 'var(--color-bg-subtle)' : 'transparent',
                                            borderBottom: idx === interviews.length - 1 ? 'none' : '1px solid var(--color-border-default)',
                                        }}
                                    >
                                        <td className="px-3 py-3">
                                            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{application?.name || '—'}</p>
                                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{application?.email || '—'}</p>
                                        </td>
                                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {job?.title || '—'}
                                        </td>
                                        <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            {new Date(interview.scheduledTime).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div
                                                className="relative inline-flex items-center"
                                                style={{ opacity: updating ? 0.6 : 1 }}
                                            >
                                                <select
                                                    value={interview.status}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateStatus(interview._id, e.target.value as InterviewStatus);
                                                    }}
                                                    disabled={updating}
                                                    className="h-9 min-w-[136px] appearance-none pl-3 pr-9 text-xs rounded-full border outline-none shadow-sm"
                                                    style={{
                                                        borderColor: STATUS_META[interviewStatus].bg,
                                                        backgroundColor: '#FFFFFF',
                                                        color: STATUS_META[interviewStatus].color,
                                                        fontWeight: 600,
                                                        boxShadow: `inset 0 0 0 1px ${STATUS_META[interviewStatus].bg}`,
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

                <div className="col-span-7 rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    {!selectedInterviewId ? (
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Select an interview to view details.</p>
                    ) : detailsLoading ? (
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            Loading interview details...
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                                    Candidate Details
                                </h2>
                                <p className="text-base font-semibold mt-2" style={{ color: 'var(--color-text-primary)' }}>
                                    {selectedApplication?.name || '—'}
                                </p>
                                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
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
                                        className="inline-flex items-center gap-1 text-xs mt-2"
                                        style={{ color: 'var(--color-primary)' }}
                                    >
                                        Open Resume <ExternalLink size={11} />
                                    </a>
                                )}
                            </div>

                            <div className="border-t pt-4" style={{ borderColor: 'var(--color-border-default)' }}>
                                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                                    Assignment Submission
                                </h3>
                                {!details?.assignmentSubmission ? (
                                    <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                        No assignment submission found.
                                    </p>
                                ) : (
                                    <div className="mt-2 space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        <p>
                                            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Assignment:</span>{' '}
                                            {typeof details.assignmentSubmission.assignmentId === 'object'
                                                ? details.assignmentSubmission.assignmentId.title
                                                : '—'}
                                        </p>
                                        <div className="flex flex-wrap gap-3">
                                            {details.assignmentSubmission.githubLink && (
                                                <a href={details.assignmentSubmission.githubLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-primary)' }}>
                                                    GitHub <ExternalLink size={11} />
                                                </a>
                                            )}
                                            {details.assignmentSubmission.demoLink && (
                                                <a href={details.assignmentSubmission.demoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-primary)' }}>
                                                    Demo <ExternalLink size={11} />
                                                </a>
                                            )}
                                            {details.assignmentSubmission.videoLink && (
                                                <a href={details.assignmentSubmission.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--color-primary)' }}>
                                                    Video <ExternalLink size={11} />
                                                </a>
                                            )}
                                        </div>
                                        {details.assignmentSubmission.notes && (
                                            <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
                                                {details.assignmentSubmission.notes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="border-t pt-4" style={{ borderColor: 'var(--color-border-default)' }}>
                                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                                    Interview Notes
                                </h3>
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={rating}
                                        onChange={(e) => setRating(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                                        className="h-9 px-2 text-xs rounded-md border outline-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                        placeholder="Rating (1-10)"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={technicalScore}
                                        onChange={(e) => setTechnicalScore(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                                        className="h-9 px-2 text-xs rounded-md border outline-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                        placeholder="Technical (1-10)"
                                    />
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={communicationScore}
                                        onChange={(e) => setCommunicationScore(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                                        className="h-9 px-2 text-xs rounded-md border outline-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                        placeholder="Communication (1-10)"
                                    />
                                </div>

                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    rows={6}
                                    placeholder="Write evaluation notes: technical depth, communication, strengths, concerns, recommendation..."
                                    className="w-full mt-3 px-3 py-2 text-sm rounded-lg border outline-none resize-y"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                />

                                <div className="flex items-center justify-between mt-3">
                                    <div className="text-xs" style={{ color: noteSaved ? '#166534' : 'var(--color-text-muted)' }}>
                                        {noteSaved
                                            ? 'Interview notes saved successfully.'
                                            : details?.note?.updatedAt
                                              ? `Last saved: ${new Date(details.note.updatedAt).toLocaleString('en-IN')}`
                                              : 'No notes saved yet.'}
                                    </div>
                                    <button
                                        onClick={onSaveNotes}
                                        disabled={!noteText.trim() || savingNote}
                                        className="h-9 px-4 rounded-md text-xs inline-flex items-center gap-1"
                                        style={{
                                            backgroundColor: 'var(--color-primary)',
                                            color: '#fff',
                                            opacity: !noteText.trim() || savingNote ? 0.6 : 1,
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
        </div>
    );
}
