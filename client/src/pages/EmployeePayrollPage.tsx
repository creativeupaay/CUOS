import { useState } from 'react';
import { FileText, X, TrendingUp, TrendingDown } from 'lucide-react';
import { useGetMyPayrollsQuery } from '@/features/hrms/hrmsApi';
import type { Payroll } from '@/features/hrms/types/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
    draft: { label: 'Draft', bg: '#F3F4F6', color: '#6B7280' },
    approved: { label: 'Approved', bg: '#DBEAFE', color: '#1D4ED8' },
    paid: { label: 'Paid', bg: '#DCFCE7', color: '#15803D' },
};

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
    return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    );
}

function fmt(n: number) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function PayslipModal({ payroll, onClose }: { payroll: Payroll; onClose: () => void }) {
    const emp = payroll.employeeId as any;
    const name = emp?.userId?.name || emp?.name || 'Employee';
    const empCode = emp?.employeeId || '—';
    const monthLabel = `${MONTHS[payroll.month - 1]} ${payroll.year}`;
    const totalDeductions = Object.values(payroll.deductions || {}).reduce((s: number, v: any) => s + (v || 0), 0);

    return (
        <div className="modal-overlay overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl border shadow-2xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                {/* Payslip header */}
                <div className="p-6 rounded-t-2xl" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #6366F1 100%)' }}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white/70 text-sm font-medium">PAYSLIP</p>
                            <p className="text-white text-xl font-bold mt-1">{monthLabel}</p>
                            <p className="text-white/80 text-sm mt-1">{name} · {empCode}</p>
                        </div>
                        <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer"
                            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                            <X size={16} className="text-white" />
                        </button>
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/20 flex gap-6">
                        <div>
                            <p className="text-white/60 text-xs">Net Salary</p>
                            <p className="text-white text-2xl font-bold">{fmt(payroll.netSalary)}</p>
                        </div>
                        <div>
                            <p className="text-white/60 text-xs">Status</p>
                            <p className="text-white font-semibold capitalize mt-0.5">{payroll.status}</p>
                        </div>
                        {payroll.paidAt && (
                            <div>
                                <p className="text-white/60 text-xs">Paid On</p>
                                <p className="text-white font-semibold mt-0.5">
                                    {new Date(payroll.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Attendance Summary */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                            style={{ color: 'var(--color-text-muted)' }}>Attendance</p>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Working Days', value: payroll.workingDays },
                                { label: 'Present Days', value: payroll.presentDays },
                                { label: 'Hours Worked', value: `${(payroll.totalHoursWorked || 0).toFixed(1)}h` },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl p-3 text-center border"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <div className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{value}</div>
                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Earnings */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                            style={{ color: 'var(--color-text-muted)' }}>Earnings</p>
                        <div className="rounded-xl border overflow-hidden"
                            style={{ borderColor: 'var(--color-border-default)' }}>
                            {[
                                { label: 'Gross Salary', value: payroll.grossSalary },
                                ...(payroll.incentiveAmount ? [{ label: '🏆 Incentive Bonus', value: payroll.incentiveAmount }] : []),
                            ].map(({ label, value }, i) => (
                                <div key={i} className="flex justify-between items-center px-4 py-3"
                                    style={{ borderTop: i > 0 ? '1px solid var(--color-border-default)' : undefined }}>
                                    <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        <TrendingUp size={14} style={{ color: '#15803D' }} /> {label}
                                    </span>
                                    <span className="font-semibold text-sm" style={{ color: '#15803D' }}>{fmt(value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Deductions */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2"
                            style={{ color: 'var(--color-text-muted)' }}>Deductions</p>
                        <div className="rounded-xl border overflow-hidden"
                            style={{ borderColor: 'var(--color-border-default)' }}>
                            {Object.entries(payroll.deductions || {}).filter(([, v]) => (v as number) > 0).map(([key, value], i) => (
                                <div key={key} className="flex justify-between items-center px-4 py-3"
                                    style={{ borderTop: i > 0 ? '1px solid var(--color-border-default)' : undefined }}>
                                    <span className="text-sm capitalize flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        <TrendingDown size={14} style={{ color: '#B91C1C' }} />
                                        {key === 'pf' ? 'PF' : key === 'esi' ? 'ESI' : key === 'tax' ? 'Tax (TDS)' : key === 'leaves' ? 'Leave Deductions' : key}
                                    </span>
                                    <span className="font-semibold text-sm" style={{ color: '#B91C1C' }}>- {fmt(value as number)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center px-4 py-3 font-bold"
                                style={{ borderTop: '1px solid var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Total Deductions</span>
                                <span className="text-sm" style={{ color: '#B91C1C' }}>- {fmt(totalDeductions)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Net Pay */}
                    <div className="rounded-xl p-4 flex justify-between items-center"
                        style={{ background: 'linear-gradient(135deg, #DCFCE7, #DBEAFE)' }}>
                        <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>Net Take-Home</span>
                        <span className="text-2xl font-bold" style={{ color: '#15803D' }}>{fmt(payroll.netSalary)}</span>
                    </div>
                </div>
            </div>
        </div >
    );
}

export default function EmployeePayrollPage() {
    const { data, isLoading } = useGetMyPayrollsQuery();
    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);

    const payrolls: Payroll[] = data?.data?.payrolls || [];

    const totalPaid = payrolls.filter(p => p.status === 'paid').reduce((s, p) => s + p.netSalary, 0);

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-6">
                <FileText size={21} style={{ color: 'var(--color-primary)' }} />
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>My Payslips</h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>View your salary and payslip history</p>
                </div>
            </div>

            {/* Summary cards */}
            {payrolls.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'Total Payslips', value: payrolls.length, color: 'var(--color-primary)', bg: '#EEF2FF' },
                        { label: 'Total Paid Out', value: fmt(totalPaid), color: '#15803D', bg: '#DCFCE7' },
                        { label: 'Latest Net Pay', value: fmt(payrolls[0]?.netSalary || 0), color: '#1D4ED8', bg: '#DBEAFE' },
                    ].map(card => (
                        <div key={card.label} className="rounded-xl border p-5"
                            style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                            <div className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>{card.label}</div>
                            <div className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Payslip list */}
            <div className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                <div className="px-5 py-4 border-b"
                    style={{ borderColor: 'var(--color-border-default)' }}>
                    <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Payslip History</h2>
                </div>
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                            style={{ borderColor: 'var(--color-primary)' }} />
                    </div>
                ) : payrolls.length === 0 ? (
                    <div className="py-20 text-center">
                        <div className="text-5xl mb-3">💰</div>
                        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>No payslips generated yet</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Your payslips will appear here once HR processes them.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Period', 'Working Days', 'Gross Salary', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left font-medium"
                                        style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.map((p, i) => {
                                const totalDed = Object.values(p.deductions || {}).reduce((s: number, v: any) => s + (v || 0), 0);
                                return (
                                    <tr key={p._id} style={{ borderTop: i > 0 ? '1px solid var(--color-border-default)' : undefined }}>
                                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {MONTHS[p.month - 1]} {p.year}
                                        </td>
                                        <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.presentDays} / {p.workingDays}
                                        </td>
                                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {fmt(p.grossSalary)}
                                        </td>
                                        <td className="px-4 py-3" style={{ color: '#B91C1C' }}>- {fmt(totalDed)}</td>
                                        <td className="px-4 py-3 font-bold" style={{ color: '#15803D' }}>
                                            {fmt(p.netSalary)}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => setSelectedPayroll(p)}
                                                className="text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-primary)' }}>
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedPayroll && (
                <PayslipModal payroll={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
            )}
        </div>
    );
}
