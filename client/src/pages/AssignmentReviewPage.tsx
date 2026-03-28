import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    Plus,
    CheckCircle2,
    ExternalLink,
    Figma,
    Loader2,
    Paperclip,
    Pencil,
    Clock3,
    XCircle,
    Trash2,
} from 'lucide-react';
import {
    useCreateAssignmentMutation,
    useGetAssignmentsByJobQuery,
    useGetAssignmentSubmissionsQuery,
    useGetJobsQuery,
    useSendInterviewInviteMutation,
    useUpdateAssignmentMutation,
    useUpdateApplicationStatusMutation,
} from '@/features/hiring/hiringApi';
import type {
    AssignmentCustomSubmissionFieldType,
    AssignmentSubmission,
    AssignmentSubmissionFields,
} from '@/features/hiring/types/types';

type AssignmentTab = 'assignments' | 'assignment-review';
type SubmissionTimingFilter = 'all' | 'on-time' | 'late';
type SubmissionActionState = 'rejected' | 'invited';
type BuiltInSubmissionFieldKey = Exclude<keyof AssignmentSubmissionFields, 'customFields'>;

const DEFAULT_SUBMISSION_FIELDS: AssignmentSubmissionFields = {
    githubLink: true,
    demoLink: true,
    videoLink: true,
    figmaLink: false,
    attachments: false,
    notes: true,
    customFields: [],
};

const SUBMISSION_FIELD_OPTIONS: {
    key: BuiltInSubmissionFieldKey;
    label: string;
    description: string;
}[] = [
    { key: 'githubLink', label: 'GitHub Link', description: 'Repository or code link' },
    { key: 'demoLink', label: 'Demo Link', description: 'Live demo or preview URL' },
    { key: 'videoLink', label: 'Video Link', description: 'Walkthrough or presentation video' },
    { key: 'figmaLink', label: 'Figma Link', description: 'Design file or prototype URL' },
    { key: 'attachments', label: 'Attachments', description: 'Files like images, videos, PDFs, or docs' },
    { key: 'notes', label: 'Notes', description: 'Extra written explanation from candidate' },
];

const CUSTOM_SUBMISSION_FIELD_TYPES: {
    value: AssignmentCustomSubmissionFieldType;
    label: string;
}[] = [
    { value: 'text', label: 'Text' },
    { value: 'url', label: 'URL' },
    { value: 'number', label: 'Number' },
    { value: 'note', label: 'Long Text' },
    { value: 'date', label: 'Date' },
    { value: 'attachment', label: 'Attachment' },
];

function toCustomSubmissionFieldKey(name: string) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return `custom_${slug || 'field'}_${Date.now().toString(36)}`;
}

export default function AssignmentReviewPage() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<AssignmentTab>('assignments');
    const [jobId, setJobId] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [timeLimitDays, setTimeLimitDays] = useState<number>(2);
    const [submissionTimingFilter, setSubmissionTimingFilter] =
        useState<SubmissionTimingFilter>('all');
    const [submissionActionById, setSubmissionActionById] = useState<Record<string, SubmissionActionState>>({});
    const [customFieldName, setCustomFieldName] = useState('');
    const [customFieldType, setCustomFieldType] = useState<AssignmentCustomSubmissionFieldType>('text');
    const [customFieldPlaceholder, setCustomFieldPlaceholder] = useState('');
    const [submissionFields, setSubmissionFields] = useState<AssignmentSubmissionFields>(
        DEFAULT_SUBMISSION_FIELDS
    );
    const focusedApplicationId = searchParams.get('applicationId') || '';
    const requestedJobId = searchParams.get('jobId') || '';
    const requestedTab = searchParams.get('tab');

    useEffect(() => {
        if (requestedJobId) {
            setJobId(requestedJobId);
        }
    }, [requestedJobId]);

    useEffect(() => {
        if (requestedTab === 'assignment-review' || requestedTab === 'assignments') {
            setActiveTab(requestedTab);
        }
    }, [requestedTab]);

    const { data: jobsData, isLoading: loadingJobs } = useGetJobsQuery({ limit: 200 });
    const jobs = jobsData?.data.jobs || [];

    const { data: assignmentsData, isFetching: loadingAssignments } = useGetAssignmentsByJobQuery(
        jobId,
        {
            skip: !jobId,
        }
    );
    const selectedAssignment = assignmentsData?.data.assignments?.[0];
    const assignmentId = selectedAssignment?._id || '';

    const { data: submissionsData, isFetching: loadingSubmissions } = useGetAssignmentSubmissionsQuery(
        assignmentId,
        {
            skip: !assignmentId,
        }
    );
    const submissions = submissionsData?.data.submissions || [];
    const filteredSubmissions = useMemo(
        () =>
            submissions.filter((submission) => {
                const candidate =
                    typeof submission.applicationId === 'object' ? submission.applicationId : undefined;

                if (focusedApplicationId && candidate?._id !== focusedApplicationId) {
                    return false;
                }
                if (submissionTimingFilter === 'late') {
                    return Boolean(submission.submittedAfterDeadline);
                }
                if (submissionTimingFilter === 'on-time') {
                    return !submission.submittedAfterDeadline;
                }
                return true;
            }),
        [submissions, submissionTimingFilter, focusedApplicationId]
    );

    const getSubmissionActionState = (submission: AssignmentSubmission): SubmissionActionState | null => {
        const localState = submissionActionById[submission._id];
        if (localState) {
            return localState;
        }

        const candidate =
            typeof submission.applicationId === 'object' ? submission.applicationId : undefined;
        if (candidate?.status === 'rejected') {
            return 'rejected';
        }
        if (
            candidate?.status === 'interview' ||
            candidate?.status === 'interview-scheduled' ||
            candidate?.status === 'interview-rescheduled'
        ) {
            return 'invited';
        }

        return null;
    };

    const sortedSubmissions = useMemo(
        () =>
            [...filteredSubmissions].sort((a, b) => {
                const aResolved = Boolean(getSubmissionActionState(a));
                const bResolved = Boolean(getSubmissionActionState(b));

                if (aResolved === bResolved) {
                    return 0;
                }

                return aResolved ? 1 : -1;
            }),
        [filteredSubmissions, submissionActionById]
    );

    const formatSubmissionTime = (value: string) =>
        new Date(value).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

    const [createAssignment, { isLoading: creatingAssignment }] = useCreateAssignmentMutation();
    const [updateAssignment, { isLoading: updatingAssignment }] = useUpdateAssignmentMutation();
    const [updateStatus, { isLoading: updatingStatus }] = useUpdateApplicationStatusMutation();
    const [sendInterviewInvite, { isLoading: sendingInvite }] = useSendInterviewInviteMutation();

    const hasAtLeastOneSubmissionField =
        SUBMISSION_FIELD_OPTIONS.some((field) => Boolean(submissionFields[field.key])) ||
        submissionFields.customFields.length > 0;

    const selectedJob = useMemo(
        () => jobs.find((job) => job._id === jobId),
        [jobs, jobId]
    );

    useEffect(() => {
        if (!selectedAssignment) {
            setIsEditing(false);
            setTitle('');
            setDescription('');
            setInstructions('');
            setTimeLimitDays(2);
            setSubmissionFields(DEFAULT_SUBMISSION_FIELDS);
            setCustomFieldName('');
            setCustomFieldType('text');
            setCustomFieldPlaceholder('');
            return;
        }

        setTitle(selectedAssignment.title || '');
        setDescription(selectedAssignment.description || '');
        setInstructions(selectedAssignment.instructions || '');
        setTimeLimitDays(selectedAssignment.timeLimitDays || 2);
        setSubmissionFields({
            ...DEFAULT_SUBMISSION_FIELDS,
            ...selectedAssignment.submissionFields,
            customFields: selectedAssignment.submissionFields?.customFields || [],
        });
    }, [selectedAssignment?._id]);

    function addCustomSubmissionField() {
        const trimmedName = customFieldName.trim();
        const trimmedPlaceholder = customFieldPlaceholder.trim();
        if (!trimmedName) return;

        setSubmissionFields((prev) => ({
            ...prev,
            customFields: [
                ...prev.customFields,
                {
                    key: toCustomSubmissionFieldKey(trimmedName),
                    label: trimmedName,
                    type: customFieldType,
                    placeholder: trimmedPlaceholder || undefined,
                },
            ],
        }));

        setCustomFieldName('');
        setCustomFieldType('text');
        setCustomFieldPlaceholder('');
    }

    function removeCustomSubmissionField(key: string) {
        setSubmissionFields((prev) => ({
            ...prev,
            customFields: prev.customFields.filter((field) => field.key !== key),
        }));
    }

    async function handleSaveAssignment(e: FormEvent) {
        e.preventDefault();
        if (!jobId) return;

        const payload = {
            jobId,
            title: title.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
            timeLimitDays,
            submissionFields,
        };

        if (!payload.title || !payload.description || !payload.instructions) return;

        if (selectedAssignment?._id) {
            await updateAssignment({
                id: selectedAssignment._id,
                data: {
                    title: payload.title,
                    description: payload.description,
                    instructions: payload.instructions,
                    timeLimitDays: payload.timeLimitDays,
                    submissionFields: payload.submissionFields,
                },
            }).unwrap();
            setIsEditing(false);
            return;
        }

        await createAssignment(payload).unwrap();
        setIsEditing(false);
    }

    async function moveToInterview(submissionId: string, applicationId: string) {
        setInviteError('');
        try {
            await sendInterviewInvite(applicationId).unwrap();
            setSubmissionActionById((prev) => ({
                ...prev,
                [submissionId]: 'invited',
            }));
        } catch (error: any) {
            setInviteError(
                error?.data?.message ||
                    'Interview scheduling is not ready for this job. Update job scheduling settings and retry.'
            );
        }
    }

    async function rejectCandidate(submissionId: string, applicationId: string) {
        await updateStatus({ id: applicationId, data: { status: 'rejected' } }).unwrap();
        setSubmissionActionById((prev) => ({
            ...prev,
            [submissionId]: 'rejected',
        }));
    }

    return (
        <div
            className="px-8 py-6 max-w-[1280px] mx-auto"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            <div className="mb-6">
                <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Assignment
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Create and edit assignments job-wise, and review candidate submissions.
                </p>
            </div>

            {inviteError && (
                <div
                    className="mb-4 rounded-lg border px-3 py-2 text-sm"
                    style={{
                        color: 'var(--color-danger)',
                        borderColor: 'var(--color-danger)',
                        backgroundColor: 'var(--color-danger-soft)',
                    }}
                >
                    {inviteError}
                </div>
            )}

            <div className="mb-5 flex items-center gap-2">
                <button
                    onClick={() => setActiveTab('assignments')}
                    className="px-3.5 py-2 rounded-lg text-sm font-medium border"
                    style={{
                        borderColor:
                            activeTab === 'assignments'
                                ? 'var(--color-primary)'
                                : 'var(--color-border-default)',
                        backgroundColor:
                            activeTab === 'assignments'
                                ? 'var(--color-primary-soft)'
                                : 'var(--color-bg-surface)',
                        color:
                            activeTab === 'assignments'
                                ? 'var(--color-primary-darker)'
                                : 'var(--color-text-secondary)',
                    }}
                >
                    Assignments
                </button>
                <button
                    onClick={() => setActiveTab('assignment-review')}
                    className="px-3.5 py-2 rounded-lg text-sm font-medium border"
                    style={{
                        borderColor:
                            activeTab === 'assignment-review'
                                ? 'var(--color-primary)'
                                : 'var(--color-border-default)',
                        backgroundColor:
                            activeTab === 'assignment-review'
                                ? 'var(--color-primary-soft)'
                                : 'var(--color-bg-surface)',
                        color:
                            activeTab === 'assignment-review'
                                ? 'var(--color-primary-darker)'
                                : 'var(--color-text-secondary)',
                    }}
                >
                    Assignment Review
                </button>
            </div>

            <div
                className="rounded-xl border p-5 mb-4"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <p
                    className="text-xs font-semibold uppercase tracking-wide mb-2"
                    style={{ color: 'var(--color-text-secondary)' }}
                >
                    Job
                </p>
                <select
                    value={jobId}
                    onChange={(e) => {
                        setJobId(e.target.value);
                        setIsEditing(false);
                    }}
                    disabled={loadingJobs}
                    className="w-full max-w-md h-10 px-3 text-sm rounded-lg border outline-none"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                >
                    <option value="">Select job</option>
                    {jobs.map((job) => (
                        <option key={job._id} value={job._id}>
                            {job.title}
                        </option>
                    ))}
                </select>

                {jobId && (
                    <div className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {loadingAssignments
                            ? 'Checking assignment...'
                            : selectedAssignment
                              ? 'Existing assignment found. Click Edit Existing Assignment to modify it.'
                              : 'No assignment exists for this job. Create it now.'}
                    </div>
                )}

                {selectedAssignment && activeTab === 'assignments' && (
                    <div className="mt-3">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs"
                            style={{
                                borderColor: 'var(--color-primary)',
                                color: 'var(--color-primary)',
                            }}
                        >
                            <Pencil size={12} />
                            Edit Existing Assignment
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'assignments' && (
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
                        Assignment Setup
                    </p>

                    <form onSubmit={handleSaveAssignment} className="space-y-3 max-w-3xl">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Assignment title"
                            disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                            className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />

                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description"
                            rows={3}
                            disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                            className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-y"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />

                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Instructions for candidates"
                            rows={4}
                            disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                            className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-y"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />

                        <div className="relative w-full">
                            <input
                                type="number"
                                value={timeLimitDays}
                                onChange={(e) =>
                                    setTimeLimitDays(Math.max(1, Number(e.target.value) || 1))
                                }
                                min={1}
                                disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                                className="w-full h-10 pl-3 pr-9 text-sm rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                            <span
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                days
                            </span>
                        </div>

                        <div className="pt-1">
                            <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                Submission Fields
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {SUBMISSION_FIELD_OPTIONS.map((field) => (
                                    <label
                                        key={field.key}
                                        className="flex items-start gap-3 text-xs px-3 py-2.5 rounded-lg border"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            color: 'var(--color-text-secondary)',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={submissionFields[field.key]}
                                            disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                                            onChange={(e) =>
                                                setSubmissionFields((prev) => ({
                                                    ...prev,
                                                    [field.key]: e.target.checked,
                                                }))
                                            }
                                        />
                                        <span>
                                            <span className="block font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                {field.label}
                                            </span>
                                            <span className="block mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                {field.description}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>

                            <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'var(--color-border-default)' }}>
                                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                                    Custom Fields
                                </p>

                                {submissionFields.customFields.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                        {submissionFields.customFields.map((field) => (
                                            <div
                                                key={field.key}
                                                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2"
                                                style={{ borderColor: 'var(--color-border-default)' }}
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        {field.label}
                                                    </p>
                                                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                                        {field.type.toUpperCase()}
                                                        {field.placeholder ? ` • ${field.placeholder}` : ''}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomSubmissionField(field.key)}
                                                    disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border"
                                                    style={{ borderColor: '#FCA5A5', color: '#B91C1C' }}
                                                >
                                                    <Trash2 size={11} />
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                        No custom fields added yet.
                                    </p>
                                )}

                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <input
                                        value={customFieldName}
                                        onChange={(e) => setCustomFieldName(e.target.value)}
                                        disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                                        placeholder="Field name"
                                        className="h-9 px-2.5 text-xs rounded-md border outline-none"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    />
                                    <select
                                        value={customFieldType}
                                        onChange={(e) => setCustomFieldType(e.target.value as AssignmentCustomSubmissionFieldType)}
                                        disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                                        className="h-9 px-2.5 text-xs rounded-md border outline-none"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        {CUSTOM_SUBMISSION_FIELD_TYPES.map((typeOption) => (
                                            <option key={typeOption.value} value={typeOption.value}>
                                                {typeOption.label}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        value={customFieldPlaceholder}
                                        onChange={(e) => setCustomFieldPlaceholder(e.target.value)}
                                        disabled={!jobId || (Boolean(selectedAssignment) && !isEditing)}
                                        placeholder="Placeholder"
                                        className="h-9 px-2.5 text-xs rounded-md border outline-none"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={addCustomSubmissionField}
                                    disabled={!customFieldName.trim() || !jobId || (Boolean(selectedAssignment) && !isEditing)}
                                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium"
                                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                                >
                                    <Plus size={12} />
                                    Add Custom Field
                                </button>
                            </div>

                            {!hasAtLeastOneSubmissionField && (
                                <p className="text-xs mt-2" style={{ color: '#B91C1C' }}>
                                    Enable at least one field so candidates can submit assignment.
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={
                                !jobId ||
                                !title.trim() ||
                                !description.trim() ||
                                !instructions.trim() ||
                                !hasAtLeastOneSubmissionField ||
                                creatingAssignment ||
                                updatingAssignment ||
                                (Boolean(selectedAssignment) && !isEditing)
                            }
                            className="h-10 px-4 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: '#fff',
                                opacity:
                                    !jobId ||
                                    !title.trim() ||
                                    !description.trim() ||
                                    !instructions.trim() ||
                                    !hasAtLeastOneSubmissionField ||
                                    creatingAssignment ||
                                    updatingAssignment ||
                                    (Boolean(selectedAssignment) && !isEditing)
                                        ? 0.6
                                        : 1,
                                cursor:
                                    !jobId ||
                                    !title.trim() ||
                                    !description.trim() ||
                                    !instructions.trim() ||
                                    !hasAtLeastOneSubmissionField ||
                                    creatingAssignment ||
                                    updatingAssignment ||
                                    (Boolean(selectedAssignment) && !isEditing)
                                        ? 'not-allowed'
                                        : 'pointer',
                            }}
                        >
                            {creatingAssignment || updatingAssignment ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Pencil size={14} />
                            )}
                            {selectedAssignment ? 'Update Assignment' : 'Create Assignment'}
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'assignment-review' && (
                <div
                    className="rounded-xl border overflow-hidden"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                    }}
                >
                    <div
                        className="px-4 py-3 border-b flex items-center justify-between gap-3"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Candidate Submissions{selectedJob?.title ? ` - ${selectedJob.title}` : ''}
                        </h2>

                        <div className="flex items-center gap-2">
                            {(
                                [
                                    { key: 'all', label: 'All' },
                                    { key: 'on-time', label: 'On Time' },
                                    { key: 'late', label: 'Late' },
                                ] as { key: SubmissionTimingFilter; label: string }[]
                            ).map((filterOption) => (
                                <button
                                    key={filterOption.key}
                                    onClick={() => setSubmissionTimingFilter(filterOption.key)}
                                    className="px-2.5 py-1.5 rounded-md border text-xs font-medium"
                                    style={{
                                        borderColor:
                                            submissionTimingFilter === filterOption.key
                                                ? 'var(--color-primary)'
                                                : 'var(--color-border-default)',
                                        backgroundColor:
                                            submissionTimingFilter === filterOption.key
                                                ? 'var(--color-primary-soft)'
                                                : 'var(--color-bg-surface)',
                                        color:
                                            submissionTimingFilter === filterOption.key
                                                ? 'var(--color-primary-darker)'
                                                : 'var(--color-text-secondary)',
                                    }}
                                >
                                    {filterOption.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!assignmentId ? (
                        <div className="p-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            Select a job that has an assignment to review submissions.
                        </div>
                    ) : loadingSubmissions ? (
                        <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            Loading submissions...
                        </div>
                    ) : submissions.length === 0 ? (
                        <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            <AlertCircle size={16} />
                            No submissions yet.
                        </div>
                    ) : filteredSubmissions.length === 0 ? (
                        <div className="p-10 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            <AlertCircle size={16} />
                            No {submissionTimingFilter === 'all' ? '' : submissionTimingFilter === 'late' ? 'late ' : 'on-time '}submissions found.
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                    {['Candidate', 'Links', 'Files', 'Submission Time', 'Status', 'Actions'].map((head) => (
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
                                {sortedSubmissions.map((submission, idx) => {
                                    const candidate =
                                        typeof submission.applicationId === 'object'
                                            ? submission.applicationId
                                            : undefined;
                                    const actionState = getSubmissionActionState(submission);

                                    return (
                                        <tr
                                            key={submission._id}
                                            style={{
                                                borderBottom:
                                                    idx === sortedSubmissions.length - 1
                                                        ? 'none'
                                                        : '1px solid var(--color-border-default)',
                                            }}
                                        >
                                            <td className="px-4 py-3">
                                                {candidate?._id ? (
                                                    <a
                                                        href={`/hiring/applications/${candidate._id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-medium"
                                                        style={{ color: 'var(--color-text-primary)', textDecoration: 'none' }}
                                                    >
                                                        {candidate?.name || 'Candidate'}
                                                    </a>
                                                ) : (
                                                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                        {candidate?.name || 'Candidate'}
                                                    </p>
                                                )}
                                                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {candidate?.email || 'N/A'}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col items-start gap-1.5">
                                                    {submission.githubLink && (
                                                        <a
                                                            href={submission.githubLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            GitHub <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                    {submission.demoLink && (
                                                        <a
                                                            href={submission.demoLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            Demo <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                    {submission.videoLink && (
                                                        <a
                                                            href={submission.videoLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            Video <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                    {submission.figmaLink && (
                                                        <a
                                                            href={submission.figmaLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            <Figma size={11} />
                                                            Figma <ExternalLink size={11} />
                                                        </a>
                                                    )}
                                                    {submission.customFieldResponses
                                                        ?.filter((field) => field.type === 'url' && field.value)
                                                        .map((field) => (
                                                            <a
                                                                key={`${submission._id}-${field.key}`}
                                                                href={field.value}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs"
                                                                style={{ color: 'var(--color-primary)' }}
                                                            >
                                                                {field.label} <ExternalLink size={11} />
                                                            </a>
                                                        ))}
                                                    {!submission.githubLink &&
                                                        !submission.demoLink &&
                                                        !submission.videoLink &&
                                                        !submission.figmaLink &&
                                                        !submission.customFieldResponses?.some(
                                                            (field) => field.type === 'url' && field.value
                                                        ) && (
                                                            <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                                        )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col items-start gap-1.5">
                                                    {submission.attachments?.length ? (
                                                        submission.attachments.map((attachment, attachmentIndex) => (
                                                            <a
                                                                key={`${submission._id}-attachment-${attachmentIndex}`}
                                                                href={attachment.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-xs"
                                                                style={{ color: 'var(--color-primary)' }}
                                                            >
                                                                <Paperclip size={11} />
                                                                {attachment.name}
                                                            </a>
                                                        ))
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                                                    )}

                                                    {submission.customFieldResponses
                                                        ?.filter(
                                                            (field) =>
                                                                field.type !== 'url' && field.value
                                                        )
                                                        .map((field) => (
                                                            field.type === 'attachment' ? (
                                                                <a
                                                                    key={`${submission._id}-${field.key}`}
                                                                    href={field.value}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-xs"
                                                                    style={{ color: 'var(--color-primary)' }}
                                                                >
                                                                    <Paperclip size={11} />
                                                                    {field.label}
                                                                    <ExternalLink size={11} />
                                                                </a>
                                                            ) : (
                                                            <p
                                                                key={`${submission._id}-${field.key}`}
                                                                className="text-xs"
                                                                style={{ color: 'var(--color-text-secondary)' }}
                                                            >
                                                                <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                                    {field.label}:
                                                                </span>{' '}
                                                                {field.value}
                                                            </p>
                                                            )
                                                        ))}
                                                </div>
                                            </td>
                                            <td
                                                className="px-4 py-3 text-xs"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                {formatSubmissionTime(submission.submittedAt)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {submission.submittedAfterDeadline ? (
                                                    <span
                                                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
                                                        style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                                                    >
                                                        <Clock3 size={11} />
                                                        Late Submission
                                                    </span>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
                                                        style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                                                    >
                                                        On Time
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {candidate?._id ? (
                                                    actionState ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
                                                            style={{
                                                                backgroundColor:
                                                                    actionState === 'rejected'
                                                                        ? '#FEE2E2'
                                                                        : '#DCFCE7',
                                                                color:
                                                                    actionState === 'rejected'
                                                                        ? '#B91C1C'
                                                                        : '#166534',
                                                            }}
                                                        >
                                                            {actionState === 'rejected'
                                                                ? 'Rejected'
                                                                : 'Invited to Interview'}
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => rejectCandidate(submission._id, candidate._id)}
                                                                disabled={updatingStatus || sendingInvite}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs"
                                                                style={{
                                                                    borderColor: '#FCA5A5',
                                                                    color: '#B91C1C',
                                                                    opacity: updatingStatus || sendingInvite ? 0.6 : 1,
                                                                }}
                                                            >
                                                                <XCircle size={11} />
                                                                Reject
                                                            </button>
                                                            <button
                                                                onClick={() => moveToInterview(submission._id, candidate._id)}
                                                                disabled={updatingStatus || sendingInvite}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs"
                                                                style={{
                                                                    borderColor: '#86EFAC',
                                                                    color: '#166534',
                                                                    opacity: updatingStatus || sendingInvite ? 0.6 : 1,
                                                                }}
                                                            >
                                                                <CheckCircle2 size={11} />
                                                                Invite to Interview
                                                            </button>
                                                        </div>
                                                    )
                                                ) : (
                                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        N/A
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

        </div>
    );
}
