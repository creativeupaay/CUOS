import { useState } from 'react';
import { X, Loader2, Sparkles, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import { MONTHS } from '@/features/hrms';

interface GenerateBulkPayrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (form: {
        month: number;
        year: number;
        payDate?: string;
    }) => Promise<{
        generated: number;
        skipped: number;
        failed: number;
        errors: string[];
    }>;
    isGenerating: boolean;
    showPayDate?: boolean;
    defaultMonth?: number;
    defaultYear?: number;
}

const buildPayDate = (month: number, year: number) => {
    return new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
};

export default function GenerateBulkPayrollModal({
    isOpen,
    onClose,
    onGenerate,
    isGenerating,
    showPayDate = false,
    defaultMonth,
    defaultYear,
}: GenerateBulkPayrollModalProps) {
    const currentDate = new Date();
    const fallbackDate = new Date(currentDate);
    fallbackDate.setMonth(fallbackDate.getMonth() - 1);

    const initialMonth = defaultMonth || fallbackDate.getMonth() + 1;
    const initialYear = defaultYear || fallbackDate.getFullYear();

    const [formMonth, setFormMonth] = useState(initialMonth);
    const [formYear, setFormYear] = useState(initialYear);
    const [payDate, setPayDate] = useState(buildPayDate(initialMonth, initialYear));

    const [bulkResult, setBulkResult] = useState<{
        generated: number;
        skipped: number;
        failed: number;
        errors: string[];
    } | null>(null);

    if (!isOpen) return null;

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: { month: number; year: number; payDate?: string } = {
                month: formMonth,
                year: formYear,
            };
            if (showPayDate) {
                payload.payDate = payDate;
            }
            const result = await onGenerate(payload);
            setBulkResult(result);
        } catch (err) {
            const error = err as { data?: { message?: string }; message?: string };
            setBulkResult({
                generated: 0,
                skipped: 0,
                failed: 1,
                errors: [error?.data?.message || error?.message || 'Bulk generation failed.'],
            });
        }
    };

    const selectStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
        borderRadius: '10px',
        border: '1.5px solid var(--color-border-default)',
        padding: '0 12px',
        height: '38px',
        fontSize: '13.5px',
        cursor: 'pointer',
        outline: 'none',
    };

    return (
        <ModalPortal>
            <div
                className="animate-scale-in w-full rounded-2xl border p-6"
                style={{
                    maxWidth: '460px',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                    boxShadow: 'var(--shadow-xl)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                        >
                            <Sparkles size={18} className="text-white" />
                        </div>
                        <div>
                            <h2
                                className="text-base font-bold"
                                style={{
                                    color: 'var(--color-text-primary)',
                                    fontFamily: 'Outfit, sans-serif',
                                }}
                            >
                                Generate Payroll for All
                            </h2>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                Runs payroll for every active employee
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            onClose();
                            setBulkResult(null);
                        }}
                        style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Result display */}
                {bulkResult ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                {
                                    label: 'Generated',
                                    value: bulkResult.generated,
                                    color: '#10B981',
                                    bg: '#D1FAE5',
                                },
                                {
                                    label: 'Skipped',
                                    value: bulkResult.skipped,
                                    color: '#F59E0B',
                                    bg: '#FEF3C7',
                                },
                                {
                                    label: 'Failed',
                                    value: bulkResult.failed,
                                    color: '#EF4444',
                                    bg: '#FEE2E2',
                                },
                            ].map(({ label, value, color, bg }) => (
                                <div
                                    key={label}
                                    className="rounded-xl p-4 text-center"
                                    style={{ backgroundColor: bg }}
                                >
                                    <div
                                        className="text-2xl font-bold"
                                        style={{ color, fontFamily: 'Outfit, sans-serif' }}
                                    >
                                        {value}
                                    </div>
                                    <div className="text-xs font-semibold mt-0.5" style={{ color }}>
                                        {label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {bulkResult.errors && bulkResult.errors.length > 0 && (
                            <div
                                className="rounded-xl p-3"
                                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                            >
                                <div className="flex items-center gap-1.5 mb-2">
                                    <AlertTriangle size={13} style={{ color: '#EF4444' }} />
                                    <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>
                                        Errors
                                    </span>
                                </div>
                                <div className="space-y-1 max-h-28 overflow-y-auto">
                                    {bulkResult.errors.map((e, i) => (
                                        <p key={i} className="text-xs" style={{ color: '#991B1B' }}>
                                            {e}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#059669' }}>
                            <CheckCircle2 size={16} />
                            Payroll generation complete!
                        </div>

                        <button
                            onClick={() => {
                                onClose();
                                setBulkResult(null);
                            }}
                            className="w-full py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer"
                            style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {/* Month + Year + optional Pay Date pickers */}
                        <div className={`grid gap-3 ${showPayDate ? 'grid-cols-3' : 'grid-cols-2'}`}>
                            <div>
                                <label
                                    className="block text-xs font-semibold mb-1.5"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    Month
                                </label>
                                <div className="relative">
                                    <select
                                        value={formMonth}
                                        onChange={(e) => {
                                            const m = parseInt(e.target.value);
                                            setFormMonth(m);
                                            setPayDate(buildPayDate(m, formYear));
                                        }}
                                        className="w-full appearance-none"
                                        style={{ ...selectStyle, width: '100%', paddingRight: '32px' }}
                                    >
                                        {MONTHS.map((m, i) => (
                                            <option key={m} value={i + 1}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown
                                        size={13}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label
                                    className="block text-xs font-semibold mb-1.5"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                >
                                    Year
                                </label>
                                <div className="relative">
                                    <select
                                        value={formYear}
                                        onChange={(e) => {
                                            const y = parseInt(e.target.value);
                                            setFormYear(y);
                                            setPayDate(buildPayDate(formMonth, y));
                                        }}
                                        className="w-full appearance-none"
                                        style={{ ...selectStyle, width: '100%', paddingRight: '32px' }}
                                    >
                                        {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(
                                            (y) => (
                                                <option key={y} value={y}>
                                                    {y}
                                                </option>
                                            )
                                        )}
                                    </select>
                                    <ChevronDown
                                        size={13}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    />
                                </div>
                            </div>
                            {showPayDate && (
                                <div>
                                    <label
                                        className="block text-xs font-semibold mb-1.5"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        Pay Date
                                    </label>
                                    <input
                                        type="date"
                                        value={payDate}
                                        onChange={(e) => setPayDate(e.target.value)}
                                        className="w-full"
                                        style={{
                                            ...selectStyle,
                                            width: '100%',
                                            padding: '0 8px',
                                            height: '38px',
                                            borderRadius: '10px',
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Info note */}
                        <div
                            className="rounded-xl p-3 text-xs"
                            style={{
                                backgroundColor: 'var(--color-primary-soft)',
                                color: 'var(--color-primary-darker)',
                            }}
                        >
                            Payroll will be generated for all <strong>active</strong> employees who have a salary
                            structure set up. Leaves do not reduce salary, and mid-month joins/effective dates are
                            prorated on a 30-day payroll basis.
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={isGenerating}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer disabled:opacity-60 transition-all"
                                style={{
                                    background: 'linear-gradient(135deg,#059669,#0EA5E9)',
                                    boxShadow: 'var(--shadow-brand)',
                                }}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" /> Generating…
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={15} /> Generate for All Employees
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    setBulkResult(null);
                                }}
                                className="px-4 py-2.5 text-sm rounded-xl border cursor-pointer btn btn-ghost"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </ModalPortal>
    );
}
