import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent, FormEvent, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    AlertCircle,
    CheckCircle2,
    Clock3,
    ChevronLeft,
    ExternalLink,
    Figma,
    Github,
    Loader2,
    Paperclip,
    PlayCircle,
    Sparkles,
    ShieldCheck,
    StickyNote,
    Upload,
    X,
} from 'lucide-react';
import {
    useGetAssignmentForApplicationQuery,
    useSubmitAssignmentMutation,
} from '@/features/hiring/hiringApi';

const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

function normalizeOptionalUrl(value: string): string | undefined {
    const trimmedValue = value.trim();
    if (!trimmedValue) return undefined;
    return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

const INLINE_MARKDOWN_COMPONENTS = {
    p: ({ children }: { children?: ReactNode }) => <>{children}</>,
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity break-words"
            style={{ color: 'inherit' }}
        >
            {children}
        </a>
    ),
    strong: ({ children }: { children?: ReactNode }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
    code: ({ children }: { children?: ReactNode }) => (
        <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
    ),
};

const ASSIGNMENT_MARKDOWN_COMPONENTS = {
    p: ({ children }: { children?: ReactNode }) => <p className="mb-3 last:mb-0 whitespace-pre-wrap leading-7">{children}</p>,
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity break-words"
            style={{ color: '#1D4ED8' }}
        >
            {children}
        </a>
    ),
    strong: ({ children }: { children?: ReactNode }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
    h1: ({ children }: { children?: ReactNode }) => <h1 className="mb-4 mt-6 text-2xl font-bold leading-tight">{children}</h1>,
    h2: ({ children }: { children?: ReactNode }) => <h2 className="mb-3 mt-5 text-xl font-bold leading-tight">{children}</h2>,
    h3: ({ children }: { children?: ReactNode }) => <h3 className="mb-2 mt-4 text-lg font-semibold leading-tight">{children}</h3>,
    h4: ({ children }: { children?: ReactNode }) => <h4 className="mb-2 mt-3 text-base font-semibold leading-tight">{children}</h4>,
    ul: ({ children }: { children?: ReactNode }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }: { children?: ReactNode }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
    li: ({ children }: { children?: ReactNode }) => <li className="whitespace-pre-wrap pl-1">{children}</li>,
    blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote className="my-4 whitespace-pre-wrap border-l-4 border-sky-200 bg-sky-50/80 px-4 py-3 italic text-slate-700">
            {children}
        </blockquote>
    ),
    hr: () => <hr className="my-5 border-slate-200" />,
    pre: ({ children }: { children?: ReactNode }) => (
        <pre className="my-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-sm text-slate-50 shadow-inner">
            {children}
        </pre>
    ),
    code: ({ inline, children }: { inline?: boolean; children?: ReactNode }) =>
        inline ? (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900">{children}</code>
        ) : (
            <code className="font-mono text-slate-50">{children}</code>
        ),
    table: ({ children }: { children?: ReactNode }) => (
        <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">{children}</table>
        </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => <thead className="bg-slate-50">{children}</thead>,
    tbody: ({ children }: { children?: ReactNode }) => <tbody className="divide-y divide-slate-200">{children}</tbody>,
    tr: ({ children }: { children?: ReactNode }) => <tr>{children}</tr>,
    th: ({ children }: { children?: ReactNode }) => (
        <th className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">{children}</th>
    ),
    td: ({ children }: { children?: ReactNode }) => <td className="whitespace-pre-wrap px-3 py-2 align-top text-slate-700">{children}</td>,
    img: ({ alt, src }: { alt?: string; src?: string }) => (
        <img alt={alt || ''} src={src} className="my-4 max-w-full rounded-xl border border-slate-200" />
    ),
};

function InlineMarkdown({ content }: { content: string }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={INLINE_MARKDOWN_COMPONENTS}>
            {content}
        </ReactMarkdown>
    );
}

function AssignmentMarkdown({ content }: { content: string }) {
    return (
        <div className="select-text break-words leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={ASSIGNMENT_MARKDOWN_COMPONENTS}>
                {content}
            </ReactMarkdown>
        </div>
    );
}

export default function PublicAssignmentSubmissionPage() {
    const { applicationId } = useParams<{ applicationId: string }>();

    const { data, isLoading, error, refetch } = useGetAssignmentForApplicationQuery(applicationId!, {
        skip: !applicationId,
    });
    const [submitAssignment, { isLoading: submitting }] = useSubmitAssignmentMutation();

    const [githubLink, setGithubLink] = useState('');
    const [demoLink, setDemoLink] = useState('');
    const [videoLink, setVideoLink] = useState('');
    const [figmaLink, setFigmaLink] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
    const [customFieldFiles, setCustomFieldFiles] = useState<Record<string, File | null>>({});
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const expiresAtIso = data?.data.expiresAt || null;
    const [now, setNow] = useState(() => Date.now());
    const [showSubmissionStep, setShowSubmissionStep] = useState(false);
    const [prevAssignmentId, setPrevAssignmentId] = useState<string | undefined>(undefined);

    const assignment = data?.data.assignment;
    const hasSubmitted = data?.data.hasSubmitted || submitted;

    if (assignment?._id !== prevAssignmentId) {
        setPrevAssignmentId(assignment?._id);
        setGithubLink('');
        setDemoLink('');
        setVideoLink('');
        setFigmaLink('');
        setAttachments([]);
        setIsUploadModalOpen(false);
        setNotes('');
        setSubmitted(false);
        setSubmitError('');
        setShowSubmissionStep(false);

        if (!assignment?.submissionFields?.customFields) {
            setCustomFieldValues({});
            setCustomFieldFiles({});
        } else {
            const initialValues: Record<string, string> = {};
            const initialFiles: Record<string, File | null> = {};
            assignment.submissionFields.customFields.forEach((field) => {
                initialValues[field.key] = '';
                initialFiles[field.key] = null;
            });
            setCustomFieldValues(initialValues);
            setCustomFieldFiles(initialFiles);
        }
    }

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

        const filteredCustomFieldFiles = Object.entries(customFieldFiles).reduce<Record<string, File>>(
            (acc, [key, file]) => {
                if (file) {
                    acc[key] = file;
                }
                return acc;
            },
            {}
        );

        try {
            await submitAssignment({
                applicationId,
                data: {
                    githubLink: normalizeOptionalUrl(githubLink),
                    demoLink: normalizeOptionalUrl(demoLink),
                    videoLink: normalizeOptionalUrl(videoLink),
                    figmaLink: normalizeOptionalUrl(figmaLink),
                    attachments,
                    notes: notes || undefined,
                    customFieldValues,
                    customFieldFiles: filteredCustomFieldFiles,
                },
            }).unwrap();

            setSubmitted(true);
            await refetch();
        } catch (error) {
            setSubmitError((error as { data?: { message?: string } })?.data?.message || 'Failed to submit assignment. Please try again.');
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
    const attachmentSummary = attachments.map((file) => `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`);

    function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        const oversized = files.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
        if (oversized) {
            setSubmitError('Each attachment must be smaller than 25MB.');
            event.target.value = '';
            return;
        }

        setAttachments((prev) => {
            const merged = [...prev];
            files.forEach((file) => {
                if (!merged.some((existing) => existing.name === file.name && existing.size === file.size)) {
                    merged.push(file);
                }
            });
            return merged.slice(0, 8);
        });
        event.target.value = '';
    }

    function removeAttachment(index: number) {
        setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    }

    function handleCustomFieldValueChange(key: string, value: string) {
        setCustomFieldValues((prev) => ({
            ...prev,
            [key]: value,
        }));
    }

    function handleCustomAttachmentFieldChange(key: string, file: File | null) {
        if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
            setSubmitError('Each attachment must be smaller than 25MB.');
            return;
        }

        setCustomFieldFiles((prev) => ({
            ...prev,
            [key]: file,
        }));
    }

    const statusPillStyle: CSSProperties = hasSubmitted
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
                {!showSubmissionStep ? (
                    <div className="mx-auto max-w-4xl animate-fade-scale">
                        <div
                            className="rounded-[2rem] border p-6 md:p-10 shadow-sm backdrop-blur"
                            style={{
                                background:
                                    'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.92) 100%)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <div className="flex flex-wrap items-center gap-3">
                                <img src="/company-logo.png" alt="Company Logo" className="h-12 w-auto object-contain" />
                                <span
                                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-secondary)',
                                    }}
                                >
                                    <Sparkles size={13} />
                                    Candidate Assignment Portal
                                </span>
                                <span
                                    className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                                    style={{
                                        borderColor: 'var(--color-primary-soft)',
                                        backgroundColor: 'var(--color-primary-soft)',
                                        color: 'var(--color-primary-darker)',
                                    }}
                                >
                                    Step 1 of 2
                                </span>
                            </div>

                            <h1
                                className="mt-6 text-3xl font-bold leading-tight md:text-5xl select-text break-words"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                <InlineMarkdown content={assignment.title} />
                            </h1>

                            <p className="mt-4 max-w-3xl text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
                                Read the instructions carefully before continuing. The next step will show the assignment
                                description and submission fields.
                            </p>

                            <div className="mt-7 grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                        Time Limit
                                    </p>
                                    <p className="mt-2 text-sm font-semibold" style={{ color: '#0F172A' }}>
                                        {assignment.timeLimitDays} day{assignment.timeLimitDays > 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' }}>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
                                        What you&apos;ll see next
                                    </p>
                                    <p className="mt-2 text-sm font-semibold" style={{ color: '#1E3A8A' }}>
                                        Description, links, notes, and uploads
                                    </p>
                                </div>
                                <div className="rounded-2xl border px-4 py-4" style={{ borderColor: '#DCFCE7', backgroundColor: '#F0FDF4' }}>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#166534' }}>
                                        Submission status
                                    </p>
                                    <p className="mt-2 text-sm font-semibold" style={{ color: '#14532D' }}>
                                        {hasSubmitted ? 'Already submitted' : isTimeExpired ? 'Late window open' : 'Ready to submit'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-7 rounded-2xl border p-5 md:p-6" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                        Instructions
                                    </p>
                                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={statusPillStyle}>
                                        {hasSubmitted ? 'Submitted' : isTimeExpired ? 'Late window' : 'Open'}
                                    </span>
                                </div>

                                <div className="mt-3 text-sm select-text break-words md:text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
                                    <AssignmentMarkdown content={assignment.instructions} />
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="max-w-2xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    Continue when you&apos;re ready to review the assignment details and submit your work.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowSubmissionStep(true)}
                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all"
                                    style={{
                                        backgroundColor: '#0B7A52',
                                        color: '#FFFFFF',
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mx-auto mb-6 max-w-6xl md:mb-8">
                            <div className="flex flex-col gap-4 rounded-[2rem] border p-5 md:p-6 shadow-sm" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                                <div className="flex flex-wrap items-center gap-3">
                                    <img src="/company-logo.png" alt="Company Logo" className="h-10 w-auto object-contain" />
                                    <span
                                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        <Sparkles size={13} />
                                        Candidate Assignment Portal
                                    </span>
                                    <span
                                        className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold"
                                        style={{
                                            borderColor: 'var(--color-primary-soft)',
                                            backgroundColor: 'var(--color-primary-soft)',
                                            color: 'var(--color-primary-darker)',
                                        }}
                                    >
                                        Step 2 of 2
                                    </span>
                                </div>

                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                    <div className="max-w-3xl">
                                        <h1 className="text-3xl md:text-4xl font-bold select-text break-words" style={{ color: 'var(--color-text-primary)' }}>
                                            <InlineMarkdown content={assignment.title} />
                                        </h1>
                                        <p className="mt-2 text-sm md:text-base" style={{ color: 'var(--color-text-secondary)' }}>
                                            Review the assignment description and complete the submission form below.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowSubmissionStep(false)}
                                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        <ChevronLeft size={16} />
                                        Back to instructions
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <section
                                className="lg:col-span-2 rounded-[2rem] border p-5 md:p-7 shadow-sm"
                                style={{
                                    backgroundColor: 'var(--color-bg-surface)',
                                    borderColor: 'var(--color-border-default)',
                                }}
                            >
                                <div className="rounded-2xl border p-4 md:p-5" style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FBFF' }}>
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1D4ED8' }}>
                                            Assignment Description
                                        </p>
                                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={statusPillStyle}>
                                            {hasSubmitted ? 'Submitted' : isTimeExpired ? 'Late window' : 'Open'}
                                        </span>
                                    </div>
                                    <div className="mt-3 text-sm select-text break-words md:text-[15px]" style={{ color: '#1E3A8A' }}>
                                        <AssignmentMarkdown content={assignment.description} />
                                    </div>
                                </div>

                                <div className="mt-5 rounded-2xl border p-4 md:p-5" style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
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
                                                            type="text"
                                                            value={githubLink}
                                                            onChange={(e) => setGithubLink(e.target.value)}
                                                            placeholder="github.com/username/repository"
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
                                                            type="text"
                                                            value={demoLink}
                                                            onChange={(e) => setDemoLink(e.target.value)}
                                                            placeholder="your-demo-url.com"
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
                                                            type="text"
                                                            value={videoLink}
                                                            onChange={(e) => setVideoLink(e.target.value)}
                                                            placeholder="loom.com / youtube.com / drive link"
                                                            className="w-full h-11 pl-9 pr-3 text-sm rounded-xl border outline-none"
                                                            style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {assignment.submissionFields.figmaLink && (
                                                <div>
                                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                                        Figma Link
                                                    </label>
                                                    <div className="relative mt-1.5">
                                                        <Figma size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                                                        <input
                                                            type="text"
                                                            value={figmaLink}
                                                            onChange={(e) => setFigmaLink(e.target.value)}
                                                            placeholder="figma.com/file/..."
                                                            className="w-full h-11 pl-9 pr-3 text-sm rounded-xl border outline-none"
                                                            style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {assignment.submissionFields.attachments && (
                                                <div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                                            Attachments
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsUploadModalOpen(true)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
                                                            style={{ borderColor: '#CBD5E1', color: '#1E40AF', backgroundColor: '#EFF6FF' }}
                                                        >
                                                            <Upload size={13} />
                                                            Upload Files
                                                        </button>
                                                    </div>
                                                    <p className="text-xs mt-1.5" style={{ color: '#64748B' }}>
                                                        Add images, videos, PDFs, or supporting documents for your submission.
                                                    </p>
                                                    {attachmentSummary.length > 0 ? (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {attachmentSummary.map((label, index) => (
                                                                <span
                                                                    key={`${label}-${index}`}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border"
                                                                    style={{ borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                                                                >
                                                                    <Paperclip size={12} />
                                                                    {label}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeAttachment(index)}
                                                                        className="inline-flex items-center"
                                                                        style={{ color: '#1D4ED8' }}
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-3 rounded-xl border border-dashed px-4 py-4 text-sm" style={{ borderColor: '#CBD5E1', color: '#64748B', backgroundColor: '#F8FAFC' }}>
                                                            No files selected yet.
                                                        </div>
                                                    )}
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

                                            {assignment.submissionFields.customFields?.map((field) => {
                                                const value = customFieldValues[field.key] || '';
                                                const label = field.label || 'Custom Field';
                                                const placeholder = field.placeholder || `Enter ${label.toLowerCase()}`;

                                                if (field.type === 'attachment') {
                                                    const file = customFieldFiles[field.key];

                                                    return (
                                                        <div key={field.key}>
                                                            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                                                <InlineMarkdown content={label} />
                                                            </label>
                                                            <label
                                                                className="mt-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3"
                                                                style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }}
                                                            >
                                                                <span className="inline-flex items-center gap-2 text-sm" style={{ color: '#0F172A' }}>
                                                                    <Paperclip size={14} />
                                                                    {file ? file.name : placeholder}
                                                                </span>
                                                                <span className="text-xs font-semibold" style={{ color: '#1D4ED8' }}>
                                                                    {file ? 'Change' : 'Upload'}
                                                                </span>
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    onChange={(e) =>
                                                                        handleCustomAttachmentFieldChange(
                                                                            field.key,
                                                                            e.target.files?.[0] || null
                                                                        )
                                                                    }
                                                                />
                                                            </label>
                                                            <p className="mt-1 text-xs" style={{ color: '#64748B' }}>
                                                                Max file size: 25MB
                                                            </p>
                                                        </div>
                                                    );
                                                }

                                                if (field.type === 'note') {
                                                    return (
                                                        <div key={field.key}>
                                                            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                                                <InlineMarkdown content={label} />
                                                            </label>
                                                            <textarea
                                                                value={value}
                                                                onChange={(e) => handleCustomFieldValueChange(field.key, e.target.value)}
                                                                placeholder={placeholder}
                                                                rows={4}
                                                                className="mt-1.5 w-full px-3 py-2.5 text-sm rounded-xl border outline-none resize-y"
                                                                style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                const inputType =
                                                    field.type === 'url'
                                                        ? 'url'
                                                        : field.type === 'number'
                                                            ? 'number'
                                                            : field.type === 'date'
                                                                ? 'date'
                                                                : 'text';

                                                return (
                                                    <div key={field.key}>
                                                        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                                            <InlineMarkdown content={label} />
                                                        </label>
                                                        <input
                                                            type={inputType}
                                                            value={value}
                                                            onChange={(e) => handleCustomFieldValueChange(field.key, e.target.value)}
                                                            placeholder={inputType === 'date' ? undefined : placeholder}
                                                            className="mt-1.5 w-full h-11 px-3 text-sm rounded-xl border outline-none"
                                                            style={{ borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
                                                        />
                                                    </div>
                                                );
                                            })}

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
                                className="rounded-[2rem] border p-5 h-fit shadow-sm sticky top-6"
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
                    </>
                )}
            </div>

            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
                    <div className="w-full max-w-lg rounded-2xl border p-5 shadow-xl" style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                                    Upload Submission Attachments
                                </p>
                                <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                                    You can add up to 8 files. Supported formats include images, videos, PDFs, docs, sheets, and zip files (max 25MB per file).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(false)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                                style={{ color: '#64748B', backgroundColor: '#F8FAFC' }}
                            >
                                <X size={15} />
                            </button>
                        </div>

                        <label className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-10 text-center cursor-pointer" style={{ borderColor: '#93C5FD', backgroundColor: '#EFF6FF' }}>
                            <Upload size={22} style={{ color: '#1D4ED8' }} />
                            <span className="text-sm font-semibold mt-3" style={{ color: '#1E40AF' }}>
                                Choose files to upload
                            </span>
                            <span className="text-xs mt-1" style={{ color: '#64748B' }}>
                                Click here to browse from your device
                            </span>
                            <input
                                type="file"
                                multiple
                                onChange={handleAttachmentChange}
                                className="hidden"
                                accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
                            />
                        </label>

                        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                            {attachmentSummary.length > 0 ? (
                                attachmentSummary.map((label, index) => (
                                    <div key={`${label}-modal-${index}`} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                                        <span className="inline-flex items-center gap-2 text-sm" style={{ color: '#334155' }}>
                                            <Paperclip size={14} />
                                            {label}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(index)}
                                            className="inline-flex items-center gap-1 text-xs font-semibold"
                                            style={{ color: '#B91C1C' }}
                                        >
                                            <X size={12} />
                                            Remove
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-xl border px-3 py-3 text-sm" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#64748B' }}>
                                    No attachments selected yet.
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsUploadModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold"
                                style={{ backgroundColor: '#2563EB', color: '#FFFFFF' }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
