import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useResolveReceivableFxRatesMutation } from '@/features/finance/api/financeApi';

// ── Types ─────────────────────────────────────────────────────────────────

export interface FxRateRequiredWarning {
    code: 'FX_RATE_REQUIRED';
    message: string;
    source: 'phase-payment';
    projectId: string;
    phaseId: string;
    currency: string;
    date: string;
    /** Optional display label for the project/phase */
    label?: string;
}

interface ResolveFxRatesModalProps {
    warnings: FxRateRequiredWarning[];
    onClose: () => void;
    onResolved: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ResolveFxRatesModal({
    warnings,
    onClose,
    onResolved,
}: ResolveFxRatesModalProps) {
    const [rates, setRates] = useState<Record<string, string>>({});
    const [resolveRates, { isLoading: isSaving }] = useResolveReceivableFxRatesMutation();

    // De-duplicate warnings by phaseId (same phase may appear once per FX attempt)
    const uniqueWarnings = useMemo(() => {
        const seen = new Set<string>();
        return warnings.filter((w) => {
            if (seen.has(w.phaseId)) return false;
            seen.add(w.phaseId);
            return true;
        });
    }, [warnings]);

    const canSubmit = useMemo(
        () => uniqueWarnings.every((w) => Number(rates[w.phaseId] || 0) > 0),
        [rates, uniqueWarnings]
    );

    const handleSubmit = async () => {
        if (!canSubmit || isSaving) return;

        const resolutions = uniqueWarnings.map((w) => ({
            projectId: w.projectId,
            phaseId: w.phaseId,
            rate: Number(rates[w.phaseId]),
        }));

        try {
            const result = await resolveRates({ resolutions }).unwrap();
            const failed = result.data?.filter((r) => !r.success) ?? [];

            if (failed.length === 0) {
                toast.success('FX rates saved. Receivables will refresh shortly.');
                onResolved();
                onClose();
            } else if (failed.length < resolutions.length) {
                toast.success('Some FX rates saved. Refreshing receivables.');
                onResolved();
                onClose();
            } else {
                toast.error('Failed to save FX rates. Please try again.');
            }
        } catch {
            toast.error('Failed to save FX rates. Please try again.');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[400] flex items-center justify-center p-4"
            onKeyDown={handleKeyDown}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0"
                style={{ backgroundColor: 'rgba(17,24,39,0.42)' }}
                onClick={onClose}
            />

            {/* Modal */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="resolve-fx-modal-title"
                className="relative w-full max-w-xl rounded-lg border shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                {/* Header */}
                <div
                    className="flex items-start justify-between gap-4 border-b px-5 py-4"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-start gap-3">
                        <div
                            className="mt-0.5 rounded-md p-2"
                            style={{ backgroundColor: '#FFFBEB', color: 'var(--color-warning)' }}
                        >
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <h2
                                id="resolve-fx-modal-title"
                                className="text-base font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Enter INR conversion rate
                            </h2>
                            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Live FX lookup failed for the following phase payments. Enter the current INR value
                                for&nbsp;1&nbsp;unit of each currency to include them in receivables.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="rounded-md p-1.5 hover:bg-black/5"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-3 px-5 py-4 max-h-80 overflow-y-auto">
                    {uniqueWarnings.map((w) => (
                        <div
                            key={w.phaseId}
                            className="rounded-lg border p-3"
                            style={{ borderColor: 'var(--color-border-default)' }}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {w.label ?? w.message}
                                    </p>
                                    <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {w.currency} · due {w.date}
                                    </p>
                                </div>
                                <label
                                    className="min-w-[180px] text-xs font-medium"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    1&nbsp;{w.currency}&nbsp;=&nbsp;INR
                                    <input
                                        id={`fx-rate-${w.phaseId}`}
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        placeholder="e.g. 83.50"
                                        value={rates[w.phaseId] ?? ''}
                                        onChange={(e) =>
                                            setRates((prev) => ({ ...prev, [w.phaseId]: e.target.value }))
                                        }
                                        className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-text-primary)',
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div
                    className="flex justify-end gap-3 border-t px-5 py-4"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-md border px-4 text-sm font-medium"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!canSubmit || isSaving}
                        onClick={handleSubmit}
                        className="h-10 rounded-md px-4 text-sm font-semibold disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}
                    >
                        {isSaving ? 'Saving…' : 'Save rates'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
