import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    CheckCircle2,
    Clock,
    ExternalLink,
    Link,
    Loader2,
    Mail,
    Phone,
    Send,
    Tag,
    Video,
    X,
} from 'lucide-react';
import {
    useGetApplicationByIdQuery,
    useGetApplicationTimelineQuery,
    useGetAssignmentsByJobQuery,
    useGetAssignmentSubmissionsQuery,
    useSendInterviewInviteMutation,
    useUpdateApplicationStatusMutation,
    useAddApplicationTagMutation,
    useRemoveApplicationTagMutation,
    useGetInterviewsQuery,
} from '@/features/hiring/hiringApi';
import type { ApplicationStatus } from '@/features/hiring/types/types';

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

const STATUS_ORDER: ApplicationStatus[] = [
    'new',
    'screening',
    'shortlisted',
    'assignment-round',
    'assignment-submitted',
    'interview',
    'interview-scheduled',
    'interview-rescheduled',
];

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

function buildCandidateBookingUrl(baseUrl: string, params: Record<string, string>) {
    const trimmed = String(baseUrl || '').trim();
    if (!trimmed) return '';

    try {
        const url = new URL(trimmed);
        [
            'date',
            'month',
            'week',
            'year',
            'slot',
            'startTime',
            'endTime',
            'rescheduleUid',
            'rescheduleToken',
        ].forEach((key) => url.searchParams.delete(key));

        Object.entries(params).forEach(([key, value]) => {
            if (String(value || '').trim()) {
                url.searchParams.set(key, value);
            }
        });

        return url.toString();
    } catch {
        return '';
    }
}

export default function HiringApplicationDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [tagInput, setTagInput] = useState('');
    const [assignmentLinkCopied, setAssignmentLinkCopied] = useState(false);
    const [inviteSent, setInviteSent] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [bookingUrlFromInvite, setBookingUrlFromInvite] = useState('');
    const [bookingLinkCopied, setBookingLinkCopied] = useState(false);
    const [pipelineError, setPipelineError] = useState('');

    const { data, isLoading, error } = useGetApplicationByIdQuery(id!, { skip: !id });
    const application = data?.data.application;
    const { data: timelineData } = useGetApplicationTimelineQuery(id!, { skip: !id });
    const jobId =
        application?.jobId && typeof application.jobId === 'object'
            ? application.jobId._id
            : (application?.jobId as string | undefined);
    const { data: assignmentData } = useGetAssignmentsByJobQuery(jobId || '', {
        skip: !jobId,
    });
    const assignmentId = assignmentData?.data.assignments?.[0]?._id;
    const { data: submissionData } = useGetAssignmentSubmissionsQuery(assignmentId || '', {
        skip: !assignmentId,
    });
    const { data: interviewsData } = useGetInterviewsQuery(
        { applicationId: id },
        { skip: !id }
    );
    const scheduledInterview = useMemo(() => {
        const interviews = interviewsData?.data.interviews || [];
        return interviews.length > 0 ? interviews[0] : null;
    }, [interviewsData?.data.interviews]);
    const submissionForApplication = useMemo(() => {
        const list = submissionData?.data.submissions || [];
        if (!id) return null;
        return (
            list.find((submission) => {
                if (typeof submission.applicationId === 'object') {
                    return submission.applicationId._id === id;
                }
                return submission.applicationId === id;
            }) || null
        );
    }, [submissionData?.data.submissions, id]);
    const activities = timelineData?.data.activities || [];
    const majorActivities = useMemo(
        () =>
            activities.filter((activity: any) =>
                [
                    'application.received',
                    'assignment.started',
                    'assignment.submitted',
                    'application.rejected',
                    'application.offer_sent',
                    'interview.invite_sent',
                    'interview.webhook_updated',
                ].includes(activity.type)
            ),
        [activities]
    );
    const latestInviteActivity = useMemo(
        () =>
            [...activities]
                .filter((activity: any) => activity.type === 'interview.invite_sent')
                .sort(
                    (a: any, b: any) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )[0] || null,
        [activities]
    );
    const bookingUrlFromTimeline =
        latestInviteActivity && latestInviteActivity.metadata
            ? String((latestInviteActivity.metadata as any).bookingUrl || '').trim()
            : '';
    const jobSchedulingBookingUrl =
        application?.jobId && typeof application.jobId === 'object'
            ? String(application.jobId.interviewScheduling?.bookingUrl || '').trim()
            : '';
    const candidateBookingUrl =
        buildCandidateBookingUrl(jobSchedulingBookingUrl, {
            applicationId: id || '',
            jobId: jobId || '',
            name: application?.name || '',
            email: application?.email || '',
            candidateEmail: application?.email || '',
        }) ||
        bookingUrlFromInvite ||
        bookingUrlFromTimeline;
    const hasInterviewInviteBeenSent = Boolean(latestInviteActivity) || inviteSent;

    // Build dynamic list of all URLs and attachments
    const allLinksAndAttachments = useMemo(() => {
        if (!application) return [];

        const items: Array<{
            label: string;
            url: string;
            isResume?: boolean;
            isAttachment?: boolean;
        }> = [];

        // Resume is always first (mandatory)
        if (application.resumeUrl) {
            items.push({
                label: 'View Resume',
                url: application.resumeUrl,
                isResume: true,
            });
        }

        // Standard URL fields
        const standardUrlFields: Array<{ key: keyof typeof application; label: string }> = [
            { key: 'portfolio', label: 'Portfolio' },
            { key: 'github', label: 'GitHub' },
            { key: 'linkedin', label: 'LinkedIn' },
            { key: 'figmaUrl', label: 'Figma' },
        ];

        standardUrlFields.forEach(({ key, label }) => {
            const value = application[key];
            if (value && typeof value === 'string' && value.trim()) {
                items.push({ label, url: value.trim() });
            }
        });

        // Custom field responses (URLs and attachments)
        if (application.customFieldResponses && Array.isArray(application.customFieldResponses)) {
            application.customFieldResponses.forEach((response: any) => {
                if (response.type === 'url' && response.value && response.value.trim()) {
                    items.push({
                        label: response.label || 'Custom Link',
                        url: response.value.trim(),
                    });
                } else if (response.type === 'attachment' && response.fileUrl && response.fileUrl.trim()) {
                    items.push({
                        label: response.label || response.fileName || 'Attachment',
                        url: response.fileUrl.trim(),
                        isAttachment: true,
                    });
                }
            });
        }

        return items;
    }, [application]);

    const [updateStatus, { isLoading: updatingStatus }] = useUpdateApplicationStatusMutation();
    const [addTag, { isLoading: addingTag }] = useAddApplicationTagMutation();
    const [removeTag] = useRemoveApplicationTagMutation();
    const [sendInterviewInvite, { isLoading: sendingInvite }] = useSendInterviewInviteMutation();

    async function handleStatusChange(newStatus: ApplicationStatus) {
        if (!id || application?.status === newStatus) return;
        setPipelineError('');
        try {
            await updateStatus({ id, data: { status: newStatus } }).unwrap();
        } catch (error: any) {
            setPipelineError(error?.data?.message || 'Could not update pipeline stage right now.');
        }
    }

    async function handleAddTag(e: React.FormEvent) {
        e.preventDefault();
        const tag = tagInput.trim().toLowerCase();
        if (!id || !tag) return;
        await addTag({ id, data: { tag } });
        setTagInput('');
    }

    async function handleRemoveTag(tag: string) {
        if (!id) return;
        await removeTag({ id, data: { tag } });
    }

    async function handleCopyAssignmentLink() {
        if (!id) return;
        const assignmentLink = `${window.location.origin}/assignment/${id}`;
        await navigator.clipboard.writeText(assignmentLink);
        setAssignmentLinkCopied(true);
        window.setTimeout(() => setAssignmentLinkCopied(false), 2000);
    }

    async function handleSendInterviewInvite() {
        if (!id) return;
        setInviteError('');
        try {
            const result = await sendInterviewInvite(id).unwrap();
            const url = String((result as any)?.data?.bookingUrl || '').trim();
            if (url) {
                setBookingUrlFromInvite(url);
            }
            setInviteSent(true);
        } catch (error: any) {
            setInviteError(
                error?.data?.message ||
                    'Interview scheduling is not ready for this job. Update job scheduling settings and retry.'
            );
        }
    }

    async function handleCopyBookingLink() {
        if (!candidateBookingUrl) return;
        await navigator.clipboard.writeText(candidateBookingUrl);
        setBookingLinkCopied(true);
        window.setTimeout(() => setBookingLinkCopied(false), 2000);
    }

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
                    Loading application...
                </div>
            </div>
        );
    }

    if (error || !application) {
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
                    Application not found
                </div>
            </div>
        );
    }

    const jobTitle =
        application.jobId && typeof application.jobId === 'object'
            ? application.jobId.title || '—'
            : '—';
    const jobDept =
        application.jobId && typeof application.jobId === 'object'
            ? application.jobId.department
            : undefined;
    const currentMeta = STATUS_META[application.status] || STATUS_META.new;
    const pipelineSelectOptions = (() => {
        const base: ApplicationStatus[] = [...STATUS_ORDER, 'rejected'];
        if (!base.includes(application.status)) {
            base.push(application.status);
        }
        return base;
    })();

    return (
        <div
            className="px-8 py-6 max-w-[1280px] mx-auto"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            {/* Breadcrumb */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate('/hiring/applications')}
                    className="flex items-center gap-1.5 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    <ArrowLeft size={16} />
                    Applications
                </button>
                <span style={{ color: 'var(--color-border-default)' }}>/</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {application.name}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-5">
                {/* Left — candidate info */}
                <div className="col-span-2 flex flex-col gap-4">
                    {/* Identity card */}
                    <div
                        className="rounded-xl border p-5"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h1
                                    className="text-xl font-semibold"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    {application.name}
                                </h1>
                                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    {jobTitle}
                                    {jobDept ? ` · ${jobDept}` : ''}
                                </p>
                            </div>
                            <span
                                className="px-2.5 py-1 rounded-md text-xs font-medium"
                                style={{ backgroundColor: currentMeta.bg, color: currentMeta.color }}
                            >
                                {currentMeta.label}
                            </span>
                        </div>

                        <div className="flex items-center gap-6 mt-4">
                            <div
                                className="flex items-center gap-2 text-sm"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                <Mail size={14} />
                                {application.email}
                            </div>
                            <div
                                className="flex items-center gap-2 text-sm"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                <Phone size={14} />
                                {application.phone}
                            </div>
                        </div>

                        <div className="flex items-center flex-wrap gap-3 mt-4">
                            {allLinksAndAttachments.map((item, index) => (
                                <a
                                    key={index}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border font-medium"
                                    style={
                                        item.isResume
                                            ? {
                                                  borderColor: 'var(--color-primary)',
                                                  color: 'var(--color-primary)',
                                                  backgroundColor: '#DCFCE7',
                                              }
                                            : {
                                                  borderColor: 'var(--color-border-default)',
                                                  color: 'var(--color-text-secondary)',
                                              }
                                    }
                                >
                                    {item.label}
                                    <ExternalLink size={11} />
                                </a>
                            ))}
                            <button
                                onClick={handleCopyAssignmentLink}
                                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                }}
                            >
                                Copy Assignment Link
                                <Link size={11} />
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <p style={{ color: 'var(--color-text-muted)' }}>Current Location</p>
                                <p style={{ color: 'var(--color-text-primary)' }}>
                                    {application.location || 'Not provided'}
                                </p>
                            </div>
                            <div>
                                <p style={{ color: 'var(--color-text-muted)' }}>Years of Experience</p>
                                <p style={{ color: 'var(--color-text-primary)' }}>
                                    {typeof application.yearsOfExperience === 'number'
                                        ? application.yearsOfExperience
                                        : 'Not provided'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Experience */}
                    {application.experience && (
                        <div
                            className="rounded-xl border p-5"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <p
                                className="text-xs font-semibold uppercase tracking-wide mb-3"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Experience
                            </p>
                            <p
                                className="text-sm leading-relaxed"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                {application.experience}
                            </p>
                        </div>
                    )}

                    {/* Cover Letter */}
                    {application.coverLetter && (
                        <div
                            className="rounded-xl border p-5"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <p
                                className="text-xs font-semibold uppercase tracking-wide mb-3"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Cover Letter
                            </p>
                            <p
                                className="text-sm leading-relaxed whitespace-pre-wrap"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                {application.coverLetter}
                            </p>
                        </div>
                    )}

                    {application.customFieldResponses?.filter((field: any) => field.type !== 'url' && field.type !== 'attachment').length > 0 && (
                        <div
                            className="rounded-xl border p-5"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <p
                                className="text-xs font-semibold uppercase tracking-wide mb-4"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Additional Responses
                            </p>

                            <div className="space-y-4">
                                {application.customFieldResponses
                                    .filter((field: any) => field.type !== 'url' && field.type !== 'attachment')
                                    .map((field: any) => (
                                        <div key={field.key} className="rounded-lg border p-4" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                                {field.label}
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-primary)' }}>
                                                {field.value || 'No response submitted'}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Assignment Submission */}
                    {submissionForApplication && (
                        <div
                            className="rounded-xl border p-5"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <p
                                className="text-xs font-semibold uppercase tracking-wide mb-3"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Assignment Submission
                            </p>

                            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                <div>
                                    <p style={{ color: 'var(--color-text-muted)' }}>Submitted At</p>
                                    <p style={{ color: 'var(--color-text-primary)' }}>
                                        {new Date(submissionForApplication.submittedAt).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ color: 'var(--color-text-muted)' }}>Submission Status</p>
                                    <p
                                        style={{
                                            color: submissionForApplication.submittedAfterDeadline
                                                ? '#92400E'
                                                : '#166534',
                                        }}
                                    >
                                        {submissionForApplication.submittedAfterDeadline
                                            ? 'Late Submission'
                                            : 'On Time'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                {submissionForApplication.githubLink && (
                                    <a
                                        href={submissionForApplication.githubLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        GitHub
                                        <ExternalLink size={11} />
                                    </a>
                                )}
                                {submissionForApplication.demoLink && (
                                    <a
                                        href={submissionForApplication.demoLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        Demo
                                        <ExternalLink size={11} />
                                    </a>
                                )}
                                {submissionForApplication.videoLink && (
                                    <a
                                        href={submissionForApplication.videoLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        Video
                                        <ExternalLink size={11} />
                                    </a>
                                )}
                                {submissionForApplication.figmaLink && (
                                    <a
                                        href={normalizeExternalUrl(submissionForApplication.figmaLink)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        Figma
                                        <ExternalLink size={11} />
                                    </a>
                                )}
                                {submissionForApplication.attachments?.map((attachment, index) => (
                                    <a
                                        key={`${submissionForApplication._id}-attachment-${index}`}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        {attachment.name}
                                        <ExternalLink size={11} />
                                    </a>
                                ))}
                            </div>

                            <div>
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide mb-2"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    Additional Notes
                                </p>
                                <div
                                    className="rounded-lg border px-3 py-2.5 text-sm whitespace-pre-wrap"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-subtle)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                >
                                    {submissionForApplication.notes?.trim() ||
                                        'No additional notes submitted by candidate.'}
                                </div>
                            </div>

                            {submissionForApplication.customFieldResponses &&
                                submissionForApplication.customFieldResponses.length > 0 && (
                                    <div className="mt-4">
                                        <p
                                            className="text-xs font-semibold uppercase tracking-wide mb-2"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            Custom Assignment Responses
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {submissionForApplication.customFieldResponses.map((field) => (
                                                <div
                                                    key={`${submissionForApplication._id}-${field.key}`}
                                                    className="rounded-lg border px-3 py-2.5 text-sm"
                                                    style={{
                                                        borderColor: 'var(--color-border-default)',
                                                        backgroundColor: 'var(--color-bg-subtle)',
                                                        color: 'var(--color-text-primary)',
                                                    }}
                                                >
                                                    <p
                                                        className="text-xs font-semibold uppercase tracking-wide mb-1"
                                                        style={{ color: 'var(--color-text-muted)' }}
                                                    >
                                                        {field.label}
                                                    </p>
                                                    {(field.type === 'url' || field.type === 'attachment') && field.value ? (
                                                        <a
                                                            href={normalizeExternalUrl(field.value)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            {field.type === 'attachment'
                                                                ? field.fileName || field.label
                                                                : field.value}
                                                            <ExternalLink size={11} />
                                                        </a>
                                                    ) : (
                                                        <p className="whitespace-pre-wrap">
                                                            {field.value || 'No response submitted'}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}

                    {/* Activity Timeline */}
                    <div
                        className="rounded-xl border p-5"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <p
                            className="text-xs font-semibold uppercase tracking-wide mb-3"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Hiring Timeline
                        </p>

                        {majorActivities.length === 0 ? (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                No timeline events yet.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {majorActivities.map((activity: any) => (
                                    <div
                                        key={activity._id}
                                        className="rounded-lg border px-3 py-2.5"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p
                                                className="text-sm font-medium"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {activity.title}
                                            </p>
                                            <span
                                                className="text-xs"
                                                style={{ color: 'var(--color-text-muted)' }}
                                            >
                                                {new Date(activity.createdAt).toLocaleString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                        <p
                                            className="text-xs mt-1"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            {activity.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right — pipeline + tags + meta */}
                <div className="flex flex-col gap-4">
                    {/* Pipeline */}
                    <div
                        className="rounded-xl border p-5"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <p
                            className="text-xs font-semibold uppercase tracking-wide mb-3"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Pipeline Stage
                        </p>

                        <select
                            value={application.status}
                            onChange={(e) => handleStatusChange(e.target.value as ApplicationStatus)}
                            disabled={updatingStatus}
                            className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                                opacity: updatingStatus ? 0.6 : 1,
                            }}
                        >
                            {pipelineSelectOptions.map((status) => (
                                <option key={status} value={status}>
                                    {STATUS_META[status]?.label || status}
                                </option>
                            ))}
                        </select>

                        {(application.status === 'offered' || application.status === 'hired') && (
                            <div
                                className="mt-3 rounded-lg border px-3 py-2.5"
                                style={{
                                    borderColor: currentMeta.bg,
                                    backgroundColor: '#FFFFFF',
                                }}
                            >
                                <p
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    Current Outcome
                                </p>
                                <p
                                    className="text-sm mt-1 font-medium"
                                    style={{ color: currentMeta.color }}
                                >
                                    {currentMeta.label}
                                </p>
                                <p
                                    className="text-xs mt-1"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    Move to Hired only after the candidate accepts the offer.
                                </p>
                            </div>
                        )}

                        {pipelineError && (
                            <p className="text-xs mt-3" style={{ color: 'var(--color-danger)' }}>
                                {pipelineError}
                            </p>
                        )}

                        {(
                            application.status === 'interview' ||
                            application.status === 'interview-scheduled' ||
                            application.status === 'interview-rescheduled'
                        ) && (
                            <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                                Moving a candidate to Interview automatically sends the Cal.com invite.
                            </p>
                        )}
                    </div>

                    {/* Tags */}
                    <div
                        className="rounded-xl border p-5"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <p
                            className="text-xs font-semibold uppercase tracking-wide mb-3"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Tags
                        </p>

                        {application.tags && application.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {application.tags.map((tag: string) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                                        style={{
                                            backgroundColor: 'var(--color-bg-subtle)',
                                            color: 'var(--color-text-secondary)',
                                            border: '1px solid var(--color-border-default)',
                                        }}
                                    >
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="ml-0.5 hover:opacity-70"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                                No tags added
                            </p>
                        )}

                        <form onSubmit={handleAddTag} className="flex gap-2">
                            <div className="relative flex-1">
                                <Tag
                                    size={13}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--color-text-muted)' }}
                                />
                                <input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    placeholder="Add a tag"
                                    className="w-full pl-7 pr-2 h-8 text-xs rounded-lg border outline-none"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!tagInput.trim() || addingTag}
                                className="h-8 px-3 text-xs rounded-lg font-medium"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    opacity: !tagInput.trim() || addingTag ? 0.5 : 1,
                                    cursor:
                                        !tagInput.trim() || addingTag ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Add
                            </button>
                        </form>
                    </div>

                    {/* Interview scheduling */}
                    <div
                        className="rounded-xl border p-5"
                        style={{
                            backgroundColor: 'var(--color-bg-surface)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <p
                            className="text-xs font-semibold uppercase tracking-wide mb-3"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Interview Scheduling
                        </p>

                        <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                            Interview scheduling and meeting link generation are handled via Cal.com.
                            Invite is auto-sent when status changes to Interview, and you can resend it here.
                        </p>

                        {hasInterviewInviteBeenSent && (
                            <p className="text-xs mb-3" style={{ color: '#166534' }}>
                                Candidate has been invited to schedule the interview.
                            </p>
                        )}

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleSendInterviewInvite}
                                disabled={sendingInvite}
                                className="w-full h-8 rounded-lg text-xs inline-flex items-center justify-center gap-1"
                                style={{
                                    backgroundColor: '#166534',
                                    color: 'white',
                                    opacity: sendingInvite ? 0.6 : 1,
                                }}
                            >
                                <Send size={12} />
                                {hasInterviewInviteBeenSent
                                    ? 'Resend Interview Schedule Email'
                                    : 'Send Cal.com Interview Invite'}
                            </button>

                            <button
                                onClick={handleCopyBookingLink}
                                disabled={!candidateBookingUrl}
                                className="w-full h-8 rounded-lg text-xs inline-flex items-center justify-center gap-1 border"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    opacity: candidateBookingUrl ? 1 : 0.6,
                                }}
                            >
                                <Link size={12} />
                                Copy Candidate Booking Link
                            </button>
                        </div>

                        {inviteSent && (
                            <p className="text-xs mt-2" style={{ color: '#166534' }}>
                                Interview invite sent to candidate email.
                            </p>
                        )}

                        {bookingLinkCopied && (
                            <p className="text-xs mt-2" style={{ color: '#166534' }}>
                                Candidate booking link copied.
                            </p>
                        )}

                        {inviteError && (
                            <p className="text-xs mt-2" style={{ color: 'var(--color-danger)' }}>
                                {inviteError}
                            </p>
                        )}
                    </div>

                    {/* Scheduled Interview Details */}
                    {scheduledInterview && (
                        <div
                            className="rounded-xl border p-5"
                            style={{
                                backgroundColor: 'var(--color-bg-surface)',
                                borderColor: 'var(--color-border-default)',
                            }}
                        >
                            <p
                                className="text-xs font-semibold uppercase tracking-wide mb-4"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Scheduled Interview
                            </p>

                            <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                    <Calendar size={14} style={{ color: 'var(--color-text-secondary)', marginTop: '2px', flexShrink: 0 }} />
                                    <div>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            Date & Time
                                        </p>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {new Date(scheduledInterview.scheduledTime).toLocaleString('en-IN', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <Video size={14} style={{ color: 'var(--color-text-secondary)', marginTop: '2px', flexShrink: 0 }} />
                                    <div>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            Meeting Link
                                        </p>
                                        {(() => {
                                            const meetingHref = normalizeMeetingUrl(
                                                scheduledInterview.meetLink
                                            );

                                            if (!meetingHref) {
                                                return (
                                                    <p
                                                        className="text-sm"
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
                                                    className="text-sm font-medium inline-flex items-center gap-1 hover:opacity-75 transition-opacity"
                                                    style={{ color: 'var(--color-primary)' }}
                                                >
                                                    Join Meeting <ExternalLink size={12} />
                                                </a>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <Clock size={14} style={{ color: 'var(--color-text-secondary)', marginTop: '2px', flexShrink: 0 }} />
                                    <div>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            Interviewer
                                        </p>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {scheduledInterview.interviewer}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-2">
                                    <CheckCircle2 size={14} style={{ color: 'var(--color-text-secondary)', marginTop: '2px', flexShrink: 0 }} />
                                    <div>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            Status
                                        </p>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                                            {scheduledInterview.status.replace('-', ' ')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {assignmentLinkCopied && (
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white z-50 pointer-events-none"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <CheckCircle2 size={14} />
                    Assignment link copied
                </div>
            )}
        </div>
    );
}
