import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useGetMyPayrollsQuery } from '@/features/hrms/hrmsApi';
import type { Payroll } from '@/features/hrms';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import PayslipModal from '@/components/organisms/hrms/PayslipModal';
import { formatCurrency } from '@/features/finance';
import { MONTHS, calculateTotalDeductions } from '@/features/hrms';

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
                        { label: 'Total Paid Out', value: formatCurrency(totalPaid), color: '#15803D', bg: '#DCFCE7' },
                        { label: 'Latest Net Pay', value: formatCurrency(payrolls[0]?.netSalary || 0), color: '#1D4ED8', bg: '#DBEAFE' },
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
                                {['Period', 'Payable Days', 'Gross Salary', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left font-medium"
                                        style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.map((p, i) => {
                                const totalDed = calculateTotalDeductions(p.deductions);
                                return (
                                    <tr key={p._id} style={{ borderTop: i > 0 ? '1px solid var(--color-border-default)' : undefined }}>
                                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {MONTHS[p.month - 1]} {p.year}
                                        </td>
                                        <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.payableDays} / {new Date(p.year, p.month, 0).getDate()}
                                        </td>
                                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {formatCurrency(p.grossSalary)}
                                        </td>
                                        <td className="px-4 py-3" style={{ color: '#B91C1C' }}>- {formatCurrency(totalDed)}</td>
                                        <td className="px-4 py-3 font-bold" style={{ color: '#15803D' }}>
                                            {formatCurrency(p.netSalary)}
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
