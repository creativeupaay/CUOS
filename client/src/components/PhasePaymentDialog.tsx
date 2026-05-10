import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, DollarSign, CheckCircle2, Loader2, AlertCircle, Info } from 'lucide-react';
import type { ProjectPhase } from '@/features/project';
import { useGetExchangeRateQuery } from '@/features/finance/api/financeApi';

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
        manualExchangeRate?: number;
        markAsFullyPaid?: boolean;
        adjustPhaseValue?: boolean;
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
    const [receivedAmount, setReceivedAmount] = useState<number | ''>('');
    const [bankAccountKey, setBankAccountKey] = useState<'hdfc_gst' | 'sbi_non_gst' | 'cash'>(
        phase.paymentBankAccount || defaultBankAccount || 'hdfc_gst'
    );
    const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [manualExchangeRate, setManualExchangeRate] = useState<number | ''>('');
    const [needsManualFxRate, setNeedsManualFxRate] = useState(false);
    const [markAsFullyPaid, setMarkAsFullyPaid] = useState(false);
    const [adjustPhaseValue, setAdjustPhaseValue] = useState(false);
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
    const expectedAmount = useMemo(() => {
        if (phase.paymentAmount && phase.paymentAmount > 0) {
            return phase.paymentAmount;
        }
        if (phase.paymentPercentage && phase.paymentPercentage > 0 && projectBudget && projectBudget > 0) {
            return (projectBudget * phase.paymentPercentage) / 100;
        }
        return 0;
    }, [phase.paymentAmount, phase.paymentPercentage, projectBudget]);

    const currency = phase.paymentCurrency || projectCurrency || 'INR';

    // Fetch exchange rate if currency is not INR
    const { data: exchangeRateData, isLoading: isFxLoading, error: fxError } = useGetExchangeRateQuery(currency, {
        skip: currency === 'INR',
    });

    const isFxFallback = exchangeRateData?.data?.isFallback;
    const autoFxRate = exchangeRateData?.data?.rate || 0;

    // Calculate expected INR
    const calculatedExpectedINR = useMemo(() => {
        if (currency === 'INR') return expectedAmount;
        if (autoFxRate > 0) return expectedAmount * autoFxRate;
        if (manualExchangeRate) return expectedAmount * Number(manualExchangeRate);
        return 0;
    }, [currency, expectedAmount, autoFxRate, manualExchangeRate]);

    // Automatically set the received amount once we have calculated the expected INR
    useEffect(() => {
        if (receivedAmount === '' && calculatedExpectedINR > 0) {
            setReceivedAmount(Number(calculatedExpectedINR.toFixed(2)));
        }
    }, [calculatedExpectedINR, receivedAmount]);

    // Check if there is a difference
    const diff = Number(receivedAmount) - calculatedExpectedINR;
    const hasDifference = Math.abs(diff) > 0.01 && calculatedExpectedINR > 0;
    const isOverpayment = diff > 0.01;
    const isUnderpayment = diff < -0.01;

    const handleSubmit = async () => {
        setError('');

        const finalReceivedAmount = Number(receivedAmount);
        const finalManualFxRate = Number(manualExchangeRate);

        if (!finalReceivedAmount || finalReceivedAmount <= 0) {
            setError('Please enter a valid received amount');
            return;
        }

        if (needsManualFxRate && currency !== 'INR' && (!finalManualFxRate || finalManualFxRate <= 0)) {
            setError(`Please enter the INR value for 1 ${currency}`);
            return;
        }

        try {
            setIsSubmitting(true);
            await onConfirm({
                phaseId: phase._id,
                receivedAmount: finalReceivedAmount,
                bankAccountKey,
                receivedDate,
                notes,
                manualExchangeRate: needsManualFxRate ? finalManualFxRate : undefined,
                markAsFullyPaid: isUnderpayment ? markAsFullyPaid : undefined,
                adjustPhaseValue: isOverpayment ? adjustPhaseValue : undefined,
            });
            onClose();
        } catch (err: any) {
            if (err?.data?.error?.code === 'FX_RATE_REQUIRED') {
                setNeedsManualFxRate(true);
                setError(`Automatic FX lookup is unavailable. Enter the INR value for 1 ${currency} to continue.`);
                setIsSubmitting(false);
                return;
            }
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
                            Expected contract value: {currency} {expectedAmount.toLocaleString()}
                        </p>
                        {currency !== 'INR' && calculatedExpectedINR > 0 && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                Expected INR value: {calculatedExpectedINR.toFixed(2)} INR
                                {isFxFallback && ' (using fallback rate)'}
                            </p>
                        )}
                        {isFxLoading && (
                            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                                <Loader2 size={10} className="animate-spin" /> Fetching exchange rate...
                            </p>
                        )}
                        {fxError && !needsManualFxRate && (
                            <p className="text-xs mt-0.5 text-red-500">
                                Failed to fetch exchange rate.
                            </p>
                        )}
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
                            Actual INR Received *
                        </label>
                        <input
                            type="number"
                            value={receivedAmount}
                            onChange={(e) => {
                                const val = e.target.value;
                                setReceivedAmount(val === '' ? '' : parseFloat(val));
                            }}
                            placeholder="0.00 INR"
                            className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                            autoFocus
                        />
                    </div>

                    {/* Difference Indicator & Options */}
                    {hasDifference && (
                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'var(--color-bg-subtle)', borderColor: 'var(--color-border-default)' }}>
                            <div className="flex items-start gap-2">
                                <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
                                <div className="text-sm">
                                    <p style={{ color: 'var(--color-text-primary)' }} className="font-medium mb-1">
                                        Amount Difference Detected
                                    </p>
                                    <p className="text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                                        Expected: {calculatedExpectedINR.toFixed(2)} INR
                                        <br />
                                        Received: {Number(receivedAmount).toFixed(2)} INR
                                        <br />
                                        Difference: {Math.abs(diff).toFixed(2)} INR {isOverpayment ? '(Overpayment)' : '(Underpayment)'}
                                    </p>

                                    {isUnderpayment && (
                                        <label className="flex items-start gap-2 cursor-pointer mt-2 group">
                                            <div className="relative flex items-center justify-center mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={markAsFullyPaid}
                                                    onChange={(e) => setMarkAsFullyPaid(e.target.checked)}
                                                    className="w-4 h-4 border-2 rounded appearance-none cursor-pointer peer"
                                                    style={{ borderColor: 'var(--color-border-default)' }}
                                                />
                                                <CheckCircle2 size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                                <div className="absolute inset-0 rounded bg-[var(--color-primary)] opacity-0 peer-checked:opacity-100 pointer-events-none -z-10" />
                                            </div>
                                            <span className="text-xs leading-tight select-none pt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                                                Mark phase as fully paid? 
                                                <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    Difference will be recorded as FX Fees / Bank Charges.
                                                </span>
                                            </span>
                                        </label>
                                    )}

                                    {isOverpayment && (
                                        <label className="flex items-start gap-2 cursor-pointer mt-2 group">
                                            <div className="relative flex items-center justify-center mt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={adjustPhaseValue}
                                                    onChange={(e) => setAdjustPhaseValue(e.target.checked)}
                                                    className="w-4 h-4 border-2 rounded appearance-none cursor-pointer peer"
                                                    style={{ borderColor: 'var(--color-border-default)' }}
                                                />
                                                <CheckCircle2 size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                                <div className="absolute inset-0 rounded bg-[var(--color-primary)] opacity-0 peer-checked:opacity-100 pointer-events-none -z-10" />
                                            </div>
                                            <span className="text-xs leading-tight select-none pt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                                                Adjust phase value to match received amount?
                                                <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    If unchecked, the extra amount will be recorded as FX difference/Tip.
                                                </span>
                                            </span>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {needsManualFxRate && currency !== 'INR' && (
                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                1 {currency} = INR *
                            </label>
                            <input
                                type="number"
                                value={manualExchangeRate}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setManualExchangeRate(val === '' ? '' : parseFloat(val));
                                }}
                                placeholder="Enter current INR rate"
                                className="w-full px-3 py-2 text-sm border rounded-lg outline-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        </div>
                    )}

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
