import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    ExternalLink,
    Link,
    Loader2,
    Mail,
    Phone,
    Send,
    Tag,
    X,
} from 'lucide-react';
import {
    useGetApplicationByIdQuery,
    useGetApplicationTimelineQuery,
    useApplyFinalDecisionMutation,
    useSendInterviewInviteMutation,
    useUpdateApplicationStatusMutation,
    useAddApplicationTagMutation,
    useRemoveApplicationTagMutation,
} from '@/features/hiring/hiringApi';
import type { ApplicationStatus } from '@/features/hiring/types/types';

const STATUS_META: Record<ApplicationStatus, { label: string; color: string; bg: string }> = {
    new: { label: 'New', color: '#1D4ED8', bg: '#DBEAFE' },
    screening: { label: 'Screening', color: '#92400E', bg: '#FEF3C7' },
    shortlisted: { label: 'Shortlisted', color: '#166534', bg: '#DCFCE7' },
    'assignment-round': { label: 'Assignment', color: '#6D28D9', bg: '#EDE9FE' },
    'assignment-submitted': { label: 'Assignment Submitted', color: '#7C3AED', bg: '#F3E8FF' },
    interview: { label: 'Interview', color: '#0F766E', bg: '#CCFBF1' },
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
];

export default function HiringApplicationDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [tagInput, setTagInput] = useState('');
    const [assignmentLinkCopied, setAssignmentLinkCopied] = useState(false);
    const [inviteSent, setInviteSent] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [salaryInput, setSalaryInput] = useState('');
    const [positionInput, setPositionInput] = useState('');
    const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
    const [decisionMessage, setDecisionMessage] = useState('');
    const [pipelineError, setPipelineError] = useState('');

    const { data, isLoading, error } = useGetApplicationByIdQuery(id!, { skip: !id });
    const application = data?.data.application;
    const { data: timelineData } = useGetApplicationTimelineQuery(id!, { skip: !id });
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

    const [updateStatus, { isLoading: updatingStatus }] = useUpdateApplicationStatusMutation();
    const [applyFinalDecision, { isLoading: deciding }] = useApplyFinalDecisionMutation();
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
            await sendInterviewInvite(id).unwrap();
            setInviteSent(true);
            window.setTimeout(() => setInviteSent(false), 2000);
        } catch (error: any) {
            setInviteError(
                error?.data?.message ||
                    'Interview scheduling is not ready for this job. Update job scheduling settings and retry.'
            );
        }
    }

    async function handleRejectDecision() {
        if (!id) return;
        await applyFinalDecision({
            id,
            data: {
                decision: 'rejected',
            },
        }).unwrap();

        setDecisionMessage('Candidate moved to Rejected and rejection email sent.');
        window.setTimeout(() => setDecisionMessage(''), 2500);
    }

    async function handleAcceptDecision() {
        if (!id || !salaryInput.trim() || !positionInput.trim() || !offerLetterFile) return;

        await applyFinalDecision({
            id,
            data: {
                decision: 'accepted',
                salary: salaryInput.trim(),
                position: positionInput.trim(),
                offerLetter: offerLetterFile,
            },
        }).unwrap();

        setDecisionMessage('Candidate moved to Offer and offer email sent.');
        setOfferLetterFile(null);
        window.setTimeout(() => setDecisionMessage(''), 2500);
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

                        <div className="flex items-center gap-3 mt-4">
                            {application.resumeUrl && (
                                <a
                                    href={application.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border font-medium"
                                    style={{
                                        borderColor: 'var(--color-primary)',
                                        color: 'var(--color-primary)',
                                        backgroundColor: '#DCFCE7',
                                    }}
                                >
                                    View Resume
                                    <ExternalLink size={11} />
                                </a>
                            )}
                            {application.portfolio && (
                                <a
                                    href={application.portfolio}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        color: 'var(--color-text-secondary)',
                                    }}
                                >
                                    Portfolio
                                    <ExternalLink size={11} />
                                </a>
                            )}
                            {application.linkedin && (
                                <a
                                    href={application.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        color: 'var(--color-text-secondary)',
                                    }}
                                >
                                    LinkedIn
                                    <ExternalLink size={11} />
                                </a>
                            )}
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

                        <div className="flex flex-col gap-1">
                            {STATUS_ORDER.map((s) => {
                                const meta = STATUS_META[s];
                                const isActive = application.status === s;
                                return (
                                    <button
                                        key={s}
                                        onClick={() => handleStatusChange(s)}
                                        disabled={updatingStatus}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left"
                                        style={{
                                            backgroundColor: isActive ? meta.bg : 'transparent',
                                            color: isActive ? meta.color : 'var(--color-text-secondary)',
                                            fontWeight: isActive ? 500 : 400,
                                            border: isActive
                                                ? `1px solid ${meta.color}30`
                                                : '1px solid transparent',
                                            opacity: updatingStatus ? 0.6 : 1,
                                            cursor: updatingStatus ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{
                                                backgroundColor: isActive
                                                    ? meta.color
                                                    : 'var(--color-border-default)',
                                            }}
                                        />
                                        {meta.label}
                                    </button>
                                );
                            })}

                            {/* Reject — separate danger action */}
                            <button
                                onClick={() => handleStatusChange('rejected')}
                                disabled={updatingStatus}
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left mt-1"
                                style={{
                                    backgroundColor:
                                        application.status === 'rejected' ? '#FEE2E2' : 'transparent',
                                    color:
                                        application.status === 'rejected'
                                            ? '#B91C1C'
                                            : 'var(--color-text-secondary)',
                                    border:
                                        application.status === 'rejected'
                                            ? '1px solid #fca5a530'
                                            : '1px solid transparent',
                                    opacity: updatingStatus ? 0.6 : 1,
                                    cursor: updatingStatus ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{
                                        backgroundColor:
                                            application.status === 'rejected'
                                                ? '#B91C1C'
                                                : 'var(--color-border-default)',
                                    }}
                                />
                                Rejected
                            </button>
                        </div>

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
                                    Offers should be sent from the Final Decision section. Use Hired only after the candidate accepts the offer.
                                </p>
                            </div>
                        )}

                        {pipelineError && (
                            <p className="text-xs mt-3" style={{ color: 'var(--color-danger)' }}>
                                {pipelineError}
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
                            Send the invite to share the candidate's booking link.
                        </p>

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
                            Send Cal.com Interview Invite
                        </button>

                        {inviteSent && (
                            <p className="text-xs mt-2" style={{ color: '#166534' }}>
                                Interview invite sent to candidate email.
                            </p>
                        )}

                        {inviteError && (
                            <p className="text-xs mt-2" style={{ color: 'var(--color-danger)' }}>
                                {inviteError}
                            </p>
                        )}
                    </div>

                    {/* Meta */}
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
                            Details
                        </p>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-sm">
                                <span style={{ color: 'var(--color-text-muted)' }}>Applied</span>
                                <span style={{ color: 'var(--color-text-primary)' }}>
                                    {new Date(application.createdAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span style={{ color: 'var(--color-text-muted)' }}>Last updated</span>
                                <span style={{ color: 'var(--color-text-primary)' }}>
                                    {new Date(application.updatedAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Final Decision */}
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
                            Final Decision
                        </p>

                        <div className="space-y-2 mb-3">
                            <input
                                value={positionInput}
                                onChange={(e) => setPositionInput(e.target.value)}
                                placeholder="Position (for offer)"
                                className="w-full h-8 px-2 text-xs rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                            <input
                                value={salaryInput}
                                onChange={(e) => setSalaryInput(e.target.value)}
                                placeholder="Salary (for offer)"
                                className="w-full h-8 px-2 text-xs rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)}
                                className="w-full text-xs"
                                style={{ color: 'var(--color-text-secondary)' }}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleAcceptDecision}
                                disabled={deciding || !positionInput.trim() || !salaryInput.trim() || !offerLetterFile}
                                className="flex-1 h-8 rounded-lg text-xs"
                                style={{
                                    backgroundColor: '#0369A1',
                                    color: '#fff',
                                    opacity:
                                        deciding || !positionInput.trim() || !salaryInput.trim() || !offerLetterFile
                                            ? 0.6
                                            : 1,
                                }}
                            >
                                Accept & Send Offer
                            </button>
                            <button
                                onClick={handleRejectDecision}
                                disabled={deciding}
                                className="flex-1 h-8 rounded-lg text-xs"
                                style={{
                                    backgroundColor: '#B91C1C',
                                    color: '#fff',
                                    opacity: deciding ? 0.6 : 1,
                                }}
                            >
                                Reject Candidate
                            </button>
                        </div>

                        {decisionMessage && (
                            <p className="text-xs mt-2" style={{ color: '#166534' }}>
                                {decisionMessage}
                            </p>
                        )}
                    </div>
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
