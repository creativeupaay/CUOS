import { useState } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import type { Employee } from '@/features/hrms';
import ModalPortal from '@/components/ui/ModalPortal';
import { MONTHS } from '@/features/hrms';

interface GeneratePayrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    onGenerate: (form: {
        employeeId: string;
        month: number;
        year: number;
        payDate?: string;
    }) => Promise<void>;
    isGenerating: boolean;
    showPayDate?: boolean;
    defaultMonth?: number;
    defaultYear?: number;
}

const buildPayDate = (month: number, year: number) => {
    return new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
};

export default function GeneratePayrollModal({
    isOpen,
    onClose,
    employees,
    onGenerate,
    isGenerating,
    showPayDate = false,
    defaultMonth,
    defaultYear,
}: GeneratePayrollModalProps) {
    const currentDate = new Date();
    const fallbackDate = new Date(currentDate);
    fallbackDate.setMonth(fallbackDate.getMonth() - 1);

    const initialMonth = defaultMonth || fallbackDate.getMonth() + 1;
    const initialYear = defaultYear || fallbackDate.getFullYear();

    const [form, setForm] = useState({
        employeeId: '',
        month: initialMonth,
        year: initialYear,
        payDate: buildPayDate(initialMonth, initialYear),
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload: {
            employeeId: string;
            month: number;
            year: number;
            payDate?: string;
        } = {
            employeeId: form.employeeId,
            month: form.month,
            year: form.year,
        };
        if (showPayDate) {
            payload.payDate = form.payDate;
        }
        await onGenerate(payload);
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
                    maxWidth: '420px',
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                    boxShadow: 'var(--shadow-xl)',
                }}
            >
                <div className="flex items-center justify-between mb-5">
                    <h2
                        className="text-base font-bold"
                        style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                    >
                        Generate — Single Employee
                    </h2>
                    <button onClick={onClose} style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            className="block text-xs font-semibold mb-1.5"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            Select Employee
                        </label>
                        <select
                            required
                            value={form.employeeId}
                            onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                            className="w-full"
                            style={{ ...selectStyle, width: '100%' }}
                        >
                            <option value="">— Select employee —</option>
                            {employees.map((emp) => (
                                <option key={emp._id} value={emp._id}>
                                    {emp.userId?.name || emp.employeeId} — {emp.designation}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className={`grid gap-3 ${showPayDate ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <div>
                            <label
                                className="block text-xs font-semibold mb-1.5"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Month
                            </label>
                            <select
                                value={form.month}
                                onChange={(e) => {
                                    const m = parseInt(e.target.value);
                                    setForm({ ...form, month: m, payDate: buildPayDate(m, form.year) });
                                }}
                                className="w-full"
                                style={{ ...selectStyle, width: '100%' }}
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i + 1}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label
                                className="block text-xs font-semibold mb-1.5"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Year
                            </label>
                            <select
                                value={form.year}
                                onChange={(e) => {
                                    const y = parseInt(e.target.value);
                                    setForm({ ...form, year: y, payDate: buildPayDate(form.month, y) });
                                }}
                                className="w-full"
                                style={{ ...selectStyle, width: '100%' }}
                            >
                                {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map(
                                    (y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    )
                                )}
                            </select>
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
                                    value={form.payDate}
                                    onChange={(e) => setForm({ ...form, payDate: e.target.value })}
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
                    <div className="flex gap-3 pt-1">
                        <button
                            type="submit"
                            disabled={isGenerating}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer disabled:opacity-60"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                boxShadow: 'var(--shadow-brand)',
                            }}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" /> Generating…
                                </>
                            ) : (
                                <>
                                    <Plus size={15} /> Generate
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-sm rounded-xl border cursor-pointer btn btn-ghost"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </ModalPortal>
    );
}
