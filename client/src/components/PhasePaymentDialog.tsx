import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, DollarSign, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import type { ProjectPhase } from '@/features/project';

interface PhasePaymentDialogProps {
    phase: ProjectPhase & { _id: string };
    projectCurrency: string;
    projectBudget?: number;
    defaultBankAccount?: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    onClose: () => void;
    onConfirm: (data: {
        phaseId: string;
        receivedAmount: number;
        bankAccountKey: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
        receivedDate: string;
        notes?: string;
    }) => Promise<void>;
}

export default function PhasePaymentDialog({
    phase,
    projectCurrency,
    projectBudget,
    defaultBankAccount,
    onClose,
    onConfirm,
}: PhasePaymentDialogProps) {
    const [receivedAmount, setReceivedAmount] = useState<number>(0);
    const [bankAccountKey, setBankAccountKey] = useState<'hdfc_gst' | 'sbi_non_gst' | 'cash'>(
        phase.paymentBankAccount || defaultBankAccount || 'hdfc_gst'
    );
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Lock body scroll when dialog is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Calculate expected amount
    const calculateExpectedAmount = () => {
        if (phase.paymentAmount && phase.paymentAmount > 0) {
            return phase.paymentAmount;
        }
        if (phase.paymentPercentage && phase.paymentPercentage > 0 && projectBudget && projectBudget > 0) {
            return (projectBudget * phase.paymentPercentage) / 100;
        }
        return 0;
    };

    const expectedAmount = calculateExpectedAmount();
    const currency = phase.paymentCurrency || projectCurrency || 'INR';

    const handleSubmit = async () => {
        setError('');

        if (!receivedAmount || receivedAmount <= 0) {
            setError('Please enter a valid received amount');
            return;
        }

        try {
            setIsSubmitting(true);
            await onConfirm({
                phaseId: phase._id,
                receivedAmount,
                bankAccountKey,
                receivedDate,
                notes,
            });
            onClose();
        } catch (err: any) {
            setError(err?.data?.message || 'Failed to mark payment as received');
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[300]"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                onClick={onClose}
            />

            {/* Dialog */}
            <div
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[301] w-full max-w-md"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderRadius: '1rem',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.2s ease-out',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center gap-2">
                        <DollarSign size={18} style={{ color: 'var(--color-success)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Mark Payment Received
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded transition-colors hover:bg-black/5"
                        style={{ color: 'var(--color-text-muted)' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Phase Info */}
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            Phase
                        </p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                            {phase.name}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Expected: {currency} {expectedAmount.toLocaleString()}
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                            <p className="text-xs">{error}</p>
                        </div>
                    )}

                    {/* Received Amount */}
                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Amount Received *
                        </label>
                        <input
                            type="number"
                            value={receivedAmount || ''}
                            onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                            placeholder={`0.00 ${currency}`}
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                            autoFocus
                        />
                    </div>

                    {/* Bank Account */}
                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Received In Bank Account *
                        </label>
                        <select
                            value={bankAccountKey}
                            onChange={(e) => setBankAccountKey(e.target.value as any)}
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        >
                            <option value="hdfc_gst">HDFC GST</option>
                            <option value="sbi_non_gst">SBI Non-GST</option>
                            <option value="cash">Cash</option>
                        </select>
                    </div>

                    {/* Received Date */}
                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Received Date *
                        </label>
                        <input
                            type="date"
                            value={receivedDate}
                            onChange={(e) => setReceivedDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any payment notes..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-colors"
                        style={{ backgroundColor: 'var(--color-success)' }}
                    >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
}
