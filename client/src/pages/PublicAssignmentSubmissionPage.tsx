import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
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

    const assignment = data?.data.assignment;
    const hasSubmitted = data?.data.hasSubmitted || submitted;

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!applicationId) return;

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
        <div className="min-h-screen px-4 py-8" style={{ backgroundColor: 'var(--color-bg-app)' }}>
            <div
                className="max-w-3xl mx-auto rounded-xl border p-6"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {assignment.title}
                </h1>
                <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {assignment.description}
                </p>

                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                        Instructions
                    </p>
                    <p className="text-sm whitespace-pre-wrap mt-2" style={{ color: 'var(--color-text-primary)' }}>
                        {assignment.instructions}
                    </p>
                    <p className="text-sm mt-3" style={{ color: 'var(--color-text-secondary)' }}>
                        Time Limit: <span className="font-medium">{assignment.timeLimitHours} hours</span>
                    </p>
                </div>

                {hasSubmitted ? (
                    <div
                        className="mt-5 p-3 rounded-lg flex items-center gap-2 text-sm"
                        style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                    >
                        <CheckCircle2 size={16} />
                        Assignment submitted successfully.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                        {assignment.submissionFields.githubLink && (
                            <input
                                type="url"
                                value={githubLink}
                                onChange={(e) => setGithubLink(e.target.value)}
                                placeholder="GitHub repository link"
                                className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        )}
                        {assignment.submissionFields.demoLink && (
                            <input
                                type="url"
                                value={demoLink}
                                onChange={(e) => setDemoLink(e.target.value)}
                                placeholder="Demo link"
                                className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        )}
                        {assignment.submissionFields.videoLink && (
                            <input
                                type="url"
                                value={videoLink}
                                onChange={(e) => setVideoLink(e.target.value)}
                                placeholder="Video walkthrough link"
                                className="w-full h-10 px-3 text-sm rounded-lg border outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        )}
                        {assignment.submissionFields.notes && (
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Additional notes"
                                rows={4}
                                className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-y"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="h-10 px-4 rounded-lg text-sm font-medium"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: '#fff',
                                opacity: submitting ? 0.6 : 1,
                            }}
                        >
                            {submitting ? 'Submitting...' : 'Submit Assignment'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
