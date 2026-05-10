import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export type ManualFxRateRequirement = {
    phaseIndex: number;
    phaseId?: string;
    phaseName: string;
    currency: string;
    date: string;
    amount: number;
};

type ManualFxRateModalProps = {
    requirements: ManualFxRateRequirement[];
    isSaving?: boolean;
    onClose: () => void;
    onSubmit: (rates: Record<number, number>) => void;
};

export default function ManualFxRateModal({
    requirements,
    isSaving = false,
    onClose,
    onSubmit,
}: ManualFxRateModalProps) {
    const [rates, setRates] = useState<Record<number, string>>({});

    const canSubmit = useMemo(
        () => requirements.every((item) => Number(rates[item.phaseIndex] || 0) > 0),
        [rates, requirements]
    );

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit(Object.fromEntries(
            requirements.map((item) => [item.phaseIndex, Number(rates[item.phaseIndex])])
        ));
    };

    return createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(17,24,39,0.42)' }} onClick={onClose} />
            <div
                className="relative w-full max-w-xl rounded-lg border shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md p-2" style={{ backgroundColor: '#FFFBEB', color: 'var(--color-warning)' }}>
                            <AlertTriangle size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>Enter INR conversion rate</h2>
                            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Automatic FX lookup is unavailable. Enter the current INR value for 1 unit of each currency to save these phase payments.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1.5 hover:bg-black/5" style={{ color: 'var(--color-text-muted)' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-3 px-5 py-4">
                    {requirements.map((item) => (
                        <div key={`${item.phaseIndex}-${item.currency}-${item.date}`} className="rounded-lg border p-3" style={{ borderColor: 'var(--color-border-default)' }}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.phaseName}</p>
                                    <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {item.currency} {Number(item.amount || 0).toLocaleString()} due {new Date(item.date).toLocaleDateString('en-IN')}
                                    </p>
                                </div>
                                <label className="min-w-[180px] text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                    1 {item.currency} = INR
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.0001"
                                        value={rates[item.phaseIndex] || ''}
                                        onChange={(event) => setRates((prev) => ({ ...prev, [item.phaseIndex]: event.target.value }))}
                                        className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end gap-3 border-t px-5 py-4" style={{ borderColor: 'var(--color-border-default)' }}>
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
                        {isSaving ? 'Saving...' : 'Save with manual rate'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
