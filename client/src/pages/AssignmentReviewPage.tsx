import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    ExternalLink,
    Loader2,
    Plus,
    Trash2,
    XCircle,
} from 'lucide-react';
import {
    useCreateAssignmentMutation,
    useDeleteAssignmentMutation,
    useGetAssignmentsByJobQuery,
    useGetAssignmentSubmissionsQuery,
    useGetJobsQuery,
    useSendInterviewInviteMutation,
    useUpdateApplicationStatusMutation,
} from '@/features/hiring/hiringApi';
import type { AssignmentSubmissionFields } from '@/features/hiring/types/types';

const DEFAULT_SUBMISSION_FIELDS: AssignmentSubmissionFields = {
    githubLink: true,
    demoLink: true,
    videoLink: true,
    notes: true,
};

export default function AssignmentReviewPage() {
    const [jobId, setJobId] = useState('');
    const [assignmentId, setAssignmentId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [timeLimitHours, setTimeLimitHours] = useState<number>(24);
    const [submissionFields, setSubmissionFields] = useState<AssignmentSubmissionFields>(
        DEFAULT_SUBMISSION_FIELDS
    );

    const { data: jobsData, isLoading: loadingJobs } = useGetJobsQuery({ limit: 200 });
    const jobs = jobsData?.data.jobs || [];

    const { data: assignmentsData, isFetching: loadingAssignments } = useGetAssignmentsByJobQuery(
        jobId,
        {
            skip: !jobId,
        }
    );
    const assignments = assignmentsData?.data.assignments || [];

    const { data: submissionsData, isFetching: loadingSubmissions } = useGetAssignmentSubmissionsQuery(
        assignmentId,
        {
            skip: !assignmentId,
        }
    );
    const submissions = submissionsData?.data.submissions || [];

    const [createAssignment, { isLoading: creatingAssignment }] = useCreateAssignmentMutation();
    const [deleteAssignment, { isLoading: deletingAssignment }] = useDeleteAssignmentMutation();
    const [updateStatus, { isLoading: updatingStatus }] = useUpdateApplicationStatusMutation();
    const [sendInterviewInvite, { isLoading: sendingInvite }] = useSendInterviewInviteMutation();

    const selectedAssignment = useMemo(
        () => assignments.find((item) => item._id === assignmentId),
        [assignments, assignmentId]
    );

    async function handleCreateAssignment(e: FormEvent) {
        e.preventDefault();
        if (!jobId) return;

        const payload = {
            jobId,
            title: title.trim(),
            description: description.trim(),
            instructions: instructions.trim(),
            timeLimitHours,
            submissionFields,
        };

        if (!payload.title || !payload.description || !payload.instructions) return;

        const created = await createAssignment(payload).unwrap();
        setAssignmentId(created.data.assignment._id);
        setTitle('');
        setDescription('');
        setInstructions('');
        setTimeLimitHours(24);
        setSubmissionFields(DEFAULT_SUBMISSION_FIELDS);
    }

    async function handleDeleteAssignment() {
        if (!assignmentId) return;
        await deleteAssignment(assignmentId).unwrap();
        setAssignmentId('');
    }

    async function moveToInterview(applicationId: string) {
        await sendInterviewInvite(applicationId).unwrap();
    }

    async function rejectCandidate(applicationId: string) {
        await updateStatus({ id: applicationId, data: { status: 'rejected' } });
    }

    return (
        <div
            className="px-8 py-6 max-w-[1280px] mx-auto"
            style={{ backgroundColor: 'var(--color-bg-app)', minHeight: '100vh' }}
        >
            <div className="mb-6">
                <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Assignment Review
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Create assignments for shortlisted candidates and evaluate submissions.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-5">
                <div className="col-span-1 flex flex-col gap-4">
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

                        <form onSubmit={handleCreateAssignment} className="space-y-3">
                            <select
                                value={jobId}
                                onChange={(e) => {
                                    setJobId(e.target.value);
                                    setAssignmentId('');
                                }}
                                disabled={loadingJobs}
                                className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
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

                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Assignment title"
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
                                className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-y"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />

                            <input
                                type="number"
                                value={timeLimitHours}
                                onChange={(e) => setTimeLimitHours(Math.max(1, Number(e.target.value) || 1))}
                                min={1}
                                className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />

                            <div className="pt-1">
                                <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                    Submission Fields
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.keys(submissionFields) as (keyof AssignmentSubmissionFields)[]).map(
                                        (key) => (
                                            <label
                                                key={key}
                                                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border"
                                                style={{
                                                    borderColor: 'var(--color-border-default)',
                                                    color: 'var(--color-text-secondary)',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={submissionFields[key]}
                                                    onChange={(e) =>
                                                        setSubmissionFields((prev) => ({
                                                            ...prev,
                                                            [key]: e.target.checked,
                                                        }))
                                                    }
                                                />
                                                {key}
                                            </label>
                                        )
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={
                                    !jobId ||
                                    !title.trim() ||
                                    !description.trim() ||
                                    !instructions.trim() ||
                                    creatingAssignment
                                }
                                className="w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: '#fff',
                                    opacity:
                                        !jobId ||
                                        !title.trim() ||
                                        !description.trim() ||
                                        !instructions.trim() ||
                                        creatingAssignment
                                            ? 0.6
                                            : 1,
                                    cursor:
                                        !jobId ||
                                        !title.trim() ||
                                        !description.trim() ||
                                        !instructions.trim() ||
                                        creatingAssignment
                                            ? 'not-allowed'
                                            : 'pointer',
                                }}
                            >
                                {creatingAssignment ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                Create Assignment
                            </button>
                        </form>
                    </div>

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
                            Assignment Picker
                        </p>

                        {loadingAssignments ? (
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Loading assignments...
                            </p>
                        ) : (
                            <select
                                value={assignmentId}
                                onChange={(e) => setAssignmentId(e.target.value)}
                                disabled={!jobId}
                                className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            >
                                <option value="">Select assignment</option>
                                {assignments.map((assignment) => (
                                    <option key={assignment._id} value={assignment._id}>
                                        {assignment.title}
                                    </option>
                                ))}
                            </select>
                        )}

                        {selectedAssignment && (
                            <div className="mt-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                <p>Time Limit: {selectedAssignment.timeLimitHours} hours</p>
                                <button
                                    onClick={handleDeleteAssignment}
                                    disabled={deletingAssignment}
                                    className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border"
                                    style={{
                                        borderColor: '#FCA5A5',
                                        color: '#B91C1C',
                                        opacity: deletingAssignment ? 0.6 : 1,
                                    }}
                                >
                                    {deletingAssignment ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-span-2">
                    <div
                        className="rounded-xl border overflow-hidden"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                Candidate Submissions
                            </h2>
                        </div>

                        {!assignmentId ? (
                            <div className="p-10 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Select an assignment to review submissions.
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
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                        {['Candidate', 'GitHub', 'Demo', 'Video', 'Submission Time', 'Actions'].map((head) => (
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
                                    {submissions.map((submission, idx) => {
                                        const candidate =
                                            typeof submission.applicationId === 'object'
                                                ? submission.applicationId
                                                : undefined;

                                        return (
                                            <tr
                                                key={submission._id}
                                                style={{
                                                    borderBottom:
                                                        idx === submissions.length - 1
                                                            ? 'none'
                                                            : '1px solid var(--color-border-default)',
                                                }}
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                        {candidate?.name || 'Candidate'}
                                                    </p>
                                                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {candidate?.email || 'N/A'}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {submission.githubLink ? (
                                                        <a
                                                            href={submission.githubLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            Open <ExternalLink size={11} />
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {submission.demoLink ? (
                                                        <a
                                                            href={submission.demoLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            Open <ExternalLink size={11} />
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {submission.videoLink ? (
                                                        <a
                                                            href={submission.videoLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            Open <ExternalLink size={11} />
                                                        </a>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                                    )}
                                                </td>
                                                <td
                                                    className="px-4 py-3 text-xs"
                                                    style={{ color: 'var(--color-text-secondary)' }}
                                                >
                                                    {new Date(submission.submittedAt).toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {candidate?._id ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => rejectCandidate(candidate._id)}
                                                                disabled={updatingStatus}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs"
                                                                style={{
                                                                    borderColor: '#FCA5A5',
                                                                    color: '#B91C1C',
                                                                    opacity: updatingStatus ? 0.6 : 1,
                                                                }}
                                                            >
                                                                <XCircle size={11} />
                                                                Reject
                                                            </button>
                                                            <button
                                                                onClick={() => moveToInterview(candidate._id)}
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
                </div>
            </div>
        </div>
    );
}
