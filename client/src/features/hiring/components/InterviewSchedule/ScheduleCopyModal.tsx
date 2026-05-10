import React from 'react';
import { createPortal } from 'react-dom';
import { Copy, Loader2, X } from 'lucide-react';
import type { JobSummary } from '@/features/hiring/index';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CopySourceSummary {
    weekdays: string;
    hours: string;
    availableRanges: string;
}

interface Props {
    isOpen: boolean;
    sourceJobs: JobSummary[];
    copySourceJobId: string;
    copySourceSummary: CopySourceSummary | null;
    isLoadingCopySourceJob: boolean;
    onClose: () => void;
    onChangeCopySourceJobId: (id: string) => void;
    onApply: () => void;
}

const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border-default)',
    color: 'var(--color-text-primary)',
    outline: 'none',
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ScheduleCopyModal({
    isOpen,
    sourceJobs,
    copySourceJobId,
    copySourceSummary,
    isLoadingCopySourceJob,
    onClose,
    onChangeCopySourceJobId,
    onApply,
}: Props) {
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-8 md:pt-12"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}
        >
            <div
                className="w-full max-w-lg rounded-2xl border p-5 shadow-xl"
                style={{
                    borderColor: 'var(--color-border-default)',
                    backgroundColor: 'var(--color-bg-surface)',
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p
                            className="text-base font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Copy Interview Schedule
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Choose another job and copy its interview availability setup into the current job.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full inline-flex items-center justify-center"
                        style={{
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-secondary)',
                        }}
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Job selector */}
                <div className="mt-4 flex flex-col gap-1.5">
                    <label
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                    >
                        Copy From Job
                    </label>
                    <select
                        value={copySourceJobId}
                        onChange={(e) => onChangeCopySourceJobId(e.target.value)}
                        className="px-3 py-2.5 text-sm rounded-lg border w-full"
                        style={inputStyle}
                    >
                        {sourceJobs.map((job) => (
                            <option key={job._id} value={job._id}>
                                {job.title} - {job.department}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Preview panel */}
                <div
                    className="mt-4 rounded-xl border p-4 text-sm"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-subtle)',
                    }}
                >
                    {isLoadingCopySourceJob ? (
                        <div
                            className="inline-flex items-center gap-2"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            <Loader2 size={15} className="animate-spin" />
                            Loading source schedule...
                        </div>
                    ) : copySourceSummary ? (
                        <div className="space-y-2">
                            {[
                                { label: 'Weekdays', value: copySourceSummary.weekdays },
                                { label: 'Hours', value: copySourceSummary.hours },
                                { label: 'Date ranges', value: copySourceSummary.availableRanges },
                            ].map(({ label, value }) => (
                                <p key={label} style={{ color: 'var(--color-text-secondary)' }}>
                                    {label}:{' '}
                                    <strong style={{ color: 'var(--color-text-primary)' }}>
                                        {value || '-'}
                                    </strong>
                                </p>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Select a job to preview its schedule.
                        </p>
                    )}
                </div>

                {/* Footer actions */}
                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-2 rounded-lg text-sm border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onApply}
                        disabled={!copySourceJobId || isLoadingCopySourceJob}
                        className="px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            color: '#fff',
                            opacity: !copySourceJobId || isLoadingCopySourceJob ? 0.6 : 1,
                        }}
                    >
                        <Copy size={14} />
                        Copy Into Current Job
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
