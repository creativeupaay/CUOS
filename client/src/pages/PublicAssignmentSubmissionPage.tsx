import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    Loader2,
    PlayCircle,
    ShieldCheck,
} from 'lucide-react';
import {
    useGetAssignmentForApplicationQuery,
    useStartAssignmentMutation,
    useSubmitAssignmentMutation,
} from '@/features/hiring/hiringApi';

export default function PublicAssignmentSubmissionPage() {
    const { applicationId } = useParams<{ applicationId: string }>();

    const { data, isLoading, error, refetch } = useGetAssignmentForApplicationQuery(applicationId!, {
        skip: !applicationId,
    });
    const [submitAssignment, { isLoading: submitting }] = useSubmitAssignmentMutation();
    const [startAssignment, { isLoading: startingAssignment }] = useStartAssignmentMutation();

    const [githubLink, setGithubLink] = useState('');
    const [demoLink, setDemoLink] = useState('');
    const [videoLink, setVideoLink] = useState('');
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [startError, setStartError] = useState('');
    const [isStarted, setIsStarted] = useState(false);
    const [expiresAtIso, setExpiresAtIso] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    const assignment = data?.data.assignment;
    const hasSubmitted = data?.data.hasSubmitted || submitted;

    useEffect(() => {
        setIsStarted(Boolean(data?.data.hasStarted));
        setExpiresAtIso(data?.data.expiresAt || null);
    }, [data?.data.hasStarted, data?.data.expiresAt]);

    const deadlineTime = useMemo(() => {
        if (!expiresAtIso) {
            return null;
        }

        const expiresAtMs = new Date(expiresAtIso).getTime();
        if (Number.isNaN(expiresAtMs)) {
            return null;
        }
        return expiresAtMs;
    }, [expiresAtIso]);

    useEffect(() => {
        const id = window.setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => window.clearInterval(id);
    }, []);

    const remainingMs = deadlineTime ? Math.max(0, deadlineTime - now) : null;
    const isTimeExpired = Boolean(isStarted && remainingMs !== null && remainingMs <= 0);

    const remainingLabel = useMemo(() => {
        if (remainingMs === null) {
            return null;
        }
        const totalSeconds = Math.floor(remainingMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, [remainingMs]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!applicationId) return;

        setSubmitError('');

        if (!isStarted) {
            setSubmitError('Please start the assignment timer before submitting.');
            return;
        }

        if (isTimeExpired) {
            setSubmitError('Assignment submission window has expired. Please contact the hiring team.');
            return;
        }

        try {
            await submitAssignment({
                applicationId,
                data: {
                    githubLink: githubLink || undefined,
                    demoLink: demoLink || undefined,
                    videoLink: videoLink || undefined,
                    notes: notes || undefined,
                },
            }).unwrap();

            setSubmitted(true);
            await refetch();
        } catch (error: any) {
            setSubmitError(error?.data?.message || 'Failed to submit assignment. Please try again.');
        }
    }

    async function handleStartAssignment() {
        if (!applicationId) return;

        setStartError('');
        setSubmitError('');

        try {
            const response = await startAssignment(applicationId).unwrap();
            setIsStarted(true);
            setExpiresAtIso(response.data.expiresAt);
            setNow(Date.now());
            await refetch();
        } catch (error: any) {
            setStartError(
                error?.data?.message ||
                    'Could not start assignment right now. Please contact the hiring team.'
            );
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading assignment...
                </div>
            </div>
        );
    }

    if (error || !assignment) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Assignment not found for this application.
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen px-4 py-10"
            style={{
                background:
                    'radial-gradient(circle at top left, #F0F9FF 0%, #F8FAFC 45%, #F1F5F9 100%)',
            }}
        >
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">
                <section
                    className="lg:col-span-2 rounded-2xl border p-6 shadow-sm"
                    style={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                    }}
                >
                    <h1 className="text-3xl font-semibold" style={{ color: '#0F172A' }}>
                        {assignment.title}
                    </h1>
                    <p className="text-sm mt-2" style={{ color: '#475569' }}>
                        {assignment.description}
                    </p>

                    <div className="mt-5 rounded-xl border p-4" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                            Instructions
                        </p>
                        <p className="text-sm whitespace-pre-wrap mt-2" style={{ color: '#1E293B' }}>
                            {assignment.instructions}
                        </p>
                    </div>

                    <div className="mt-5 rounded-xl border p-4" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                            Submission Form
                        </p>

                        {!hasSubmitted && !isStarted && (
                            <div className="mt-3 rounded-lg border p-3" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                                <p className="text-sm" style={{ color: '#1E40AF' }}>
                                    Click Start Assignment to begin your timer. After starting, this link expires when the timer ends.
                                </p>
                                <button
                                    onClick={handleStartAssignment}
                                    disabled={startingAssignment}
                                    className="mt-3 h-10 px-4 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                                    style={{
                                        backgroundColor: '#2563EB',
                                        color: '#FFFFFF',
                                        opacity: startingAssignment ? 0.7 : 1,
                                    }}
                                >
                                    {startingAssignment ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <PlayCircle size={16} />
                                    )}
                                    Start Assignment
                                </button>
                            </div>
                        )}

                        {startError && (
                            <div
                                className="mt-3 p-3 rounded-lg flex items-center gap-2 text-sm"
                                style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}
                            >
                                <AlertCircle size={16} />
                                {startError}
                            </div>
                        )}

                        {submitError && (
                            <div
                                className="mt-3 p-3 rounded-lg flex items-center gap-2 text-sm"
                                style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}
                            >
                                <AlertCircle size={16} />
                                {submitError}
                            </div>
                        )}

                        {hasSubmitted ? (
                            <div
                                className="mt-4 p-3 rounded-lg flex items-center gap-2 text-sm"
                                style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                            >
                                <CheckCircle2 size={16} />
                                Assignment submitted successfully.
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                                {assignment.submissionFields.githubLink && (
                                    <input
                                        type="url"
                                        value={githubLink}
                                        onChange={(e) => setGithubLink(e.target.value)}
                                        placeholder="GitHub repository link"
                                        className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                        style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                    />
                                )}
                                {assignment.submissionFields.demoLink && (
                                    <input
                                        type="url"
                                        value={demoLink}
                                        onChange={(e) => setDemoLink(e.target.value)}
                                        placeholder="Live demo link"
                                        className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                        style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                    />
                                )}
                                {assignment.submissionFields.videoLink && (
                                    <input
                                        type="url"
                                        value={videoLink}
                                        onChange={(e) => setVideoLink(e.target.value)}
                                        placeholder="Video walkthrough link"
                                        className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                        style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                    />
                                )}
                                {assignment.submissionFields.notes && (
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Additional notes"
                                        rows={4}
                                        className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-y"
                                        style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                    />
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting || !isStarted || isTimeExpired}
                                    className="h-10 px-4 rounded-lg text-sm font-medium"
                                    style={{
                                        backgroundColor: '#0F766E',
                                        color: '#FFFFFF',
                                        opacity: submitting || !isStarted || isTimeExpired ? 0.6 : 1,
                                    }}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Assignment'}
                                </button>
                            </form>
                        )}
                    </div>
                </section>

                <aside
                    className="rounded-2xl border p-5 h-fit shadow-sm"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                >
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                        Assignment Status
                    </p>

                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                        <div className="flex items-center gap-2" style={{ color: '#334155' }}>
                            <Clock3 size={15} />
                            <span className="text-sm">
                                Time Limit: <strong>{assignment.timeLimitHours} hours</strong>
                            </span>
                        </div>

                        {isStarted && remainingLabel && (
                            <p
                                className="text-sm font-semibold mt-2"
                                style={{ color: isTimeExpired ? '#B91C1C' : '#0F172A' }}
                            >
                                Remaining: {remainingLabel}
                            </p>
                        )}

                        {!isStarted && !hasSubmitted && (
                            <p className="text-sm mt-2" style={{ color: '#64748B' }}>
                                Timer has not started yet.
                            </p>
                        )}

                        {isTimeExpired && !hasSubmitted && (
                            <p className="text-sm mt-2" style={{ color: '#B91C1C' }}>
                                Time expired. Submission is locked.
                            </p>
                        )}
                    </div>

                    <div className="mt-4 p-3 rounded-lg border" style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }}>
                        <div className="flex items-center gap-2" style={{ color: '#1E3A8A' }}>
                            <ShieldCheck size={15} />
                            <p className="text-xs font-medium">Need help?</p>
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#1D4ED8' }}>
                            Contact HR at hr@creativeupaay.in for clarification before the deadline.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
