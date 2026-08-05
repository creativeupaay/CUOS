import { X, TrendingUp, TrendingDown } from 'lucide-react';
import type { Payroll, Employee } from '@/features/hrms';
import ModalPortal from '@/components/ui/ModalPortal';
import { formatCurrency } from '@/features/finance';
import { MONTHS, PAYOUT_ACCOUNT_LABELS, calculateTotalDeductions } from '@/features/hrms';

interface PayslipModalProps {
    payroll: Payroll;
    onClose: () => void;
}

export default function PayslipModal({ payroll, onClose }: PayslipModalProps) {
    const emp = payroll.employeeId as Employee;
    const name = emp?.userId?.name || emp?.employeeId || 'Employee';
    const empCode = emp?.employeeId || '—';
    const monthLabel = `${MONTHS[payroll.month - 1]} ${payroll.year}`;
    const totalDeductions = calculateTotalDeductions(payroll.deductions);

    return (
        <ModalPortal className="overflow-y-auto">
            <div
                className="w-full max-w-lg rounded-2xl border shadow-2xl"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                {/* Payslip header */}
                <div
                    className="p-6 rounded-t-2xl"
                    style={{
                        background: 'linear-gradient(135deg, var(--color-primary) 0%, #6366F1 100%)',
                    }}
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white/70 text-sm font-medium">PAYSLIP</p>
                            <p className="text-white text-xl font-bold mt-1">{monthLabel}</p>
                            <p className="text-white/80 text-sm mt-1">
                                {name} · {empCode}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg cursor-pointer"
                            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                        >
                            <X size={16} className="text-white" />
                        </button>
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/20 flex gap-6">
                        <div>
                            <p className="text-white/60 text-xs">Net Salary</p>
                            <p className="text-white text-2xl font-bold">{formatCurrency(payroll.netSalary)}</p>
                        </div>
                        <div>
                            <p className="text-white/60 text-xs">Status</p>
                            <p className="text-white font-semibold capitalize mt-0.5">{payroll.status}</p>
                        </div>
                        <div>
                            <p className="text-white/60 text-xs">Paid From</p>
                            <p className="text-white font-semibold mt-0.5">
                                {PAYOUT_ACCOUNT_LABELS[payroll.payoutAccountKey] || 'HDFC (GST)'}
                            </p>
                        </div>
                        {payroll.paidAt && (
                            <div>
                                <p className="text-white/60 text-xs">Paid On</p>
                                <p className="text-white font-semibold mt-0.5">
                                    {new Date(payroll.paidAt).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                    })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Attendance Summary */}
                    <div>
                        <p
                            className="text-xs font-semibold uppercase tracking-wide mb-2"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            Attendance
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                                { label: 'Working Days', value: payroll.workingDays },
                                { label: 'Present Days', value: payroll.presentDays },
                                { label: 'Payable Days', value: payroll.payableDays },
                                {
                                    label: 'Hours Worked',
                                    value: `${(payroll.totalHoursWorked || 0).toFixed(1)}h`,
                                },
                            ].map(({ label, value }) => (
                                <div
                                    key={label}
                                    className="rounded-xl p-3 text-center border"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-subtle)',
                                    }}
                                >
                                    <div
                                        className="font-bold text-lg"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        {value}
                                    </div>
                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Earnings */}
                    <div>
                        <p
                            className="text-xs font-semibold uppercase tracking-wide mb-2"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            Earnings
                        </p>
                        <div
                            className="rounded-xl border overflow-hidden"
                            style={{ borderColor: 'var(--color-border-default)' }}
                        >
                            {[
                                { label: 'Gross Salary', value: payroll.grossSalary },
                                ...(payroll.incentiveAmount
                                    ? [{ label: 'Bonus', value: payroll.incentiveAmount }]
                                    : []),
                            ].map(({ label, value }, i) => (
                                <div
                                    key={i}
                                    className="flex justify-between items-center px-4 py-3"
                                    style={{
                                        borderTop: i > 0 ? '1px solid var(--color-border-default)' : undefined,
                                    }}
                                >
                                    <span
                                        className="text-sm flex items-center gap-1.5"
                                        style={{ color: 'var(--color-text-secondary)' }}
                                    >
                                        <TrendingUp size={14} style={{ color: '#15803D' }} /> {label}
                                    </span>
                                    <span className="font-semibold text-sm" style={{ color: '#15803D' }}>
                                        {formatCurrency(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Deductions */}
                    <div>
                        <p
                            className="text-xs font-semibold uppercase tracking-wide mb-2"
                            style={{ color: 'var(--color-text-muted)' }}
                        >
                            Deductions
                        </p>
                        <div
                            className="rounded-xl border overflow-hidden"
                            style={{ borderColor: 'var(--color-border-default)' }}
                        >
                            {Object.entries(payroll.deductions || {})
                                .filter(([, v]) => (v as number) > 0)
                                .map(([key, value], i) => (
                                    <div
                                        key={key}
                                        className="flex justify-between items-center px-4 py-3"
                                        style={{
                                            borderTop:
                                                i > 0 ? '1px solid var(--color-border-default)' : undefined,
                                        }}
                                    >
                                        <span
                                            className="text-sm capitalize flex items-center gap-1.5"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            <TrendingDown size={14} style={{ color: '#B91C1C' }} />
                                            {key === 'pf'
                                                ? 'PF'
                                                : key === 'esi'
                                                ? 'ESI'
                                                : key === 'tax'
                                                ? 'Tax (TDS)'
                                                : key === 'leaves'
                                                ? 'Leave Deductions'
                                                : key}
                                        </span>
                                        <span className="font-semibold text-sm" style={{ color: '#B91C1C' }}>
                                            - {formatCurrency(value as number)}
                                        </span>
                                    </div>
                                ))}
                            <div
                                className="flex justify-between items-center px-4 py-3 font-bold"
                                style={{
                                    borderTop: '1px solid var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-subtle)',
                                }}
                            >
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                    Total Deductions
                                </span>
                                <span className="text-sm" style={{ color: '#B91C1C' }}>
                                    - {formatCurrency(totalDeductions)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Net Pay */}
                    <div
                        className="rounded-xl p-4 flex justify-between items-center"
                        style={{ background: 'linear-gradient(135deg, #DCFCE7, #DBEAFE)' }}
                    >
                        <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            Net Take-Home
                        </span>
                        <span className="text-2xl font-bold" style={{ color: '#15803D' }}>
                            {formatCurrency(payroll.netSalary)}
                        </span>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
