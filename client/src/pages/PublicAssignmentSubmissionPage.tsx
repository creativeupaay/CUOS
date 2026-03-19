import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    ExternalLink,
    Github,
    Loader2,
    PlayCircle,
    Sparkles,
    ShieldCheck,
    StickyNote,
} from 'lucide-react';
import {
    useGetAssignmentForApplicationQuery,
    useSubmitAssignmentMutation,
} from '@/features/hiring/hiringApi';

export default function PublicAssignmentSubmissionPage() {
    const { applicationId } = useParams<{ applicationId: string }>();

    const { data, isLoading, error, refetch } = useGetAssignmentForApplicationQuery(applicationId!, {
        skip: !applicationId,
    });
    const [submitAssignment, { isLoading: submitting }] = useSubmitAssignmentMutation();

    const [githubLink, setGithubLink] = useState('');
    const [demoLink, setDemoLink] = useState('');
    const [videoLink, setVideoLink] = useState('');
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [expiresAtIso, setExpiresAtIso] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());

    const assignment = data?.data.assignment;
    const hasSubmitted = data?.data.hasSubmitted || submitted;

    useEffect(() => {
        setExpiresAtIso(data?.data.expiresAt || null);
    }, [data?.data.expiresAt]);

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
    const isTimeExpired = Boolean(remainingMs !== null && remainingMs <= 0);

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

    const isSubmitDisabled = submitting || hasSubmitted;

    const statusPillStyle: React.CSSProperties = hasSubmitted
        ? {
              backgroundColor: '#DCFCE7',
              color: '#166534',
              border: '1px solid #BBF7D0',
          }
        : isTimeExpired
        ? {
              backgroundColor: '#FEF2F2',
              color: '#B91C1C',
              border: '1px solid #FECACA',
          }
        : {
              backgroundColor: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0',
          };

    return (
        <div
            className="min-h-screen relative overflow-hidden"
            style={{
                backgroundColor: 'var(--color-bg-app)',
            }}
        >
            <div className="absolute top-0 inset-x-0 h-80" style={{ background: 'linear-gradient(180deg, rgba(34,197,94,0.14) 0%, rgba(249,250,251,0) 100%)' }} />
            <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0) 70%)' }} />

            <div className="relative z-10 px-4 py-10 md:py-14">
                <div className="max-w-6xl mx-auto mb-6 md:mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-secondary)',
                        }}
                    >
                        <Sparkles size={13} />
                        Candidate Assignment Portal
                    </div>
                    <h1
                        className="text-3xl md:text-4xl font-bold mt-3"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        {assignment.title}
                    </h1>
                    <p className="text-sm md:text-base mt-2 max-w-3xl" style={{ color: 'var(--color-text-secondary)' }}>
                        Submit your work before the deadline. Your links and notes are sent directly to the hiring team for review.
                    </p>
                </div>

                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section
                    className="lg:col-span-2 rounded-2xl border p-5 md:p-7 shadow-sm"
                    style={{
                        backgroundColor: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <div className="rounded-xl border p-4 md:p-5" style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FBFF' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
                            Assignment Brief
                        </p>
                        <div className="text-sm mt-2 prose prose-sm max-w-none" style={{ color: '#1E3A8A' }}>
                            <ReactMarkdown
                                components={{
                                    a: ({ href, children }) => (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-semibold underline hover:opacity-75 transition-opacity"
                                            style={{ color: '#1D4ED8' }}
                                        >
                                            {children}
                                        </a>
                                    ),
                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                    li: ({ children }) => <li className="ml-2 mb-1">{children}</li>,
                                    code: ({ children }) => (
                                        <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">
                                            {children}
                                        </code>
                                    ),
                                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                }}
                            >
                                {assignment.description}
                            </ReactMarkdown>
                        </div>
                    </div>

                    <div className="mt-5 rounded-xl border p-4" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                            Instructions
                        </p>
                        <div className="text-sm mt-2 prose prose-sm max-w-none" style={{ color: '#1E293B' }}>
                            <ReactMarkdown
                                components={{
                                    a: ({ href, children }) => (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-semibold underline hover:opacity-75 transition-opacity"
                                            style={{ color: '#1D4ED8' }}
                                        >
                                            {children}
                                        </a>
                                    ),
                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                    li: ({ children }) => <li className="ml-2 mb-1">{children}</li>,
                                    code: ({ children }) => (
                                        <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">
                                            {children}
                                        </code>
                                    ),
                                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                                    em: ({ children }) => <em className="italic">{children}</em>,
                                }}
                            >
                                {assignment.instructions}
                            </ReactMarkdown>
                        </div>
                    </div>

                    <div className="mt-5 rounded-xl border p-4 md:p-5" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                Submission Form
                            </p>
                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={statusPillStyle}>
                                {hasSubmitted
                                    ? 'Submitted'
                                    : isTimeExpired
                                    ? 'Late window'
                                    : 'Open'}
                            </span>
                        </div>

                        {isTimeExpired && !hasSubmitted && (
                            <div
                                className="mt-3 p-3 rounded-lg flex items-center gap-2 text-sm border"
                                style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                            >
                                <AlertCircle size={16} />
                                Deadline has passed. You can still submit, but it will be marked as late.
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
                                className="mt-4 p-3 rounded-lg flex items-center gap-2 text-sm border"
                                style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                            >
                                <CheckCircle2 size={16} />
                                Assignment submitted successfully.
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                                {assignment.submissionFields.githubLink && (
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                            GitHub Repository
                                        </label>
                                        <div className="relative mt-1.5">
                                            <Github size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                                            <input
                                                type="url"
                                                value={githubLink}
                                                onChange={(e) => setGithubLink(e.target.value)}
                                                placeholder="https://github.com/username/repository"
                                                className="w-full h-11 pl-9 pr-3 text-sm rounded-xl border outline-none"
                                                style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                            />
                                        </div>
                                    </div>
                                )}
                                {assignment.submissionFields.demoLink && (
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                            Live Demo
                                        </label>
                                        <div className="relative mt-1.5">
                                            <ExternalLink size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                                            <input
                                                type="url"
                                                value={demoLink}
                                                onChange={(e) => setDemoLink(e.target.value)}
                                                placeholder="https://your-demo-url"
                                                className="w-full h-11 pl-9 pr-3 text-sm rounded-xl border outline-none"
                                                style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                            />
                                        </div>
                                    </div>
                                )}
                                {assignment.submissionFields.videoLink && (
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                            Video Walkthrough
                                        </label>
                                        <div className="relative mt-1.5">
                                            <PlayCircle size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                                            <input
                                                type="url"
                                                value={videoLink}
                                                onChange={(e) => setVideoLink(e.target.value)}
                                                placeholder="https://loom.com / youtube.com / drive link"
                                                className="w-full h-11 pl-9 pr-3 text-sm rounded-xl border outline-none"
                                                style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                            />
                                        </div>
                                    </div>
                                )}
                                {assignment.submissionFields.notes && (
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                            Additional Notes
                                        </label>
                                        <div className="relative mt-1.5">
                                            <StickyNote size={15} className="absolute left-3 top-3.5" style={{ color: '#64748B' }} />
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Mention assumptions, setup steps, credentials for reviewer, or anything important."
                                                rows={5}
                                                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border outline-none resize-y"
                                                style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitDisabled}
                                    className="h-11 px-5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all"
                                    style={{
                                        backgroundColor: '#0B7A52',
                                        color: '#FFFFFF',
                                        opacity: isSubmitDisabled ? 0.6 : 1,
                                    }}
                                >
                                    {submitting && <Loader2 size={15} className="animate-spin" />}
                                    {submitting ? 'Submitting...' : 'Submit Assignment'}
                                </button>
                            </form>
                        )}
                    </div>
                </section>

                <aside
                    className="rounded-2xl border p-5 h-fit shadow-sm sticky top-6"
                    style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                >
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                        Assignment Status
                    </p>

                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#F8FAFC' }}>
                        <div className="flex items-center gap-2" style={{ color: '#334155' }}>
                            <Clock3 size={15} />
                            <span className="text-sm">
                                Time Limit: <strong>{assignment.timeLimitDays} day{assignment.timeLimitDays > 1 ? 's' : ''}</strong>
                            </span>
                        </div>

                        {expiresAtIso && (
                            <p className="text-sm mt-2" style={{ color: '#475569' }}>
                                Expires on: <strong>{new Date(expiresAtIso).toLocaleString('en-IN')}</strong>
                            </p>
                        )}

                        {remainingLabel && !hasSubmitted && (
                            <p
                                className="text-sm font-semibold mt-2"
                                style={{ color: isTimeExpired ? '#B91C1C' : '#0F172A' }}
                            >
                                {isTimeExpired ? 'Deadline passed' : `Remaining: ${remainingLabel}`}
                            </p>
                        )}

                        {hasSubmitted && (
                            <p className="text-sm font-semibold mt-2" style={{ color: '#166534' }}>
                                Submission received
                            </p>
                        )}

                        {isTimeExpired && !hasSubmitted && (
                            <p className="text-sm mt-2" style={{ color: '#92400E' }}>
                                Late submissions are accepted and flagged for the hiring team.
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
        </div>
    );
}
