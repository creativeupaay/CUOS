import { useState } from 'react';
import { useGetPayrollsQuery, useGeneratePayrollMutation, useUpdatePayrollStatusMutation, useGetEmployeesQuery } from '@/features/hrms/hrmsApi';
import { Plus, DollarSign, Check, CreditCard, X } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function HrmsPayrollPage() {
    const currentDate = new Date();
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [year, setYear] = useState(currentDate.getFullYear());
    const [showGenerate, setShowGenerate] = useState(false);
    const [genForm, setGenForm] = useState({ employeeId: '', month: currentDate.getMonth() + 1, year: currentDate.getFullYear() });

    const { data, isLoading } = useGetPayrollsQuery({ month, year });
    const { data: empData } = useGetEmployeesQuery({ limit: 100 });
    const [generatePayroll, { isLoading: generating }] = useGeneratePayrollMutation();
    const [updateStatus] = useUpdatePayrollStatusMutation();

    const payrolls = data?.data?.payrolls || [];
    const employees = empData?.data?.employees || [];

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await generatePayroll(genForm).unwrap();
            setShowGenerate(false);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to generate payroll');
        }
    };

    const getStatusStyle = (s: string) => {
        switch (s) {
            case 'approved': return { bg: '#DBEAFE', color: '#1D4ED8' };
            case 'paid': return { bg: 'var(--color-success-soft)', color: 'var(--color-success)' };
            default: return { bg: 'var(--color-warning-soft)', color: '#92400E' };
        }
    };

    return (
        <div className="mx-auto" style={{ maxWidth: '1200px' }}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Payroll</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Generate, approve, and track salary payouts</p>
                </div>
                <button onClick={() => setShowGenerate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer"
                    style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Plus size={16} /> Generate Payroll
                </button>
            </div>

            {/* Month/Year filter */}
            <div className="flex gap-3 mb-6">
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="px-3 py-2.5 text-sm rounded-lg border cursor-pointer"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                    className="px-3 py-2.5 text-sm rounded-lg border cursor-pointer"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                    {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            {/* Generate Modal */}
            {showGenerate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-full max-w-md rounded-xl border p-6" style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Generate Payroll</h2>
                            <button onClick={() => setShowGenerate(false)} className="cursor-pointer"><X size={20} style={{ color: 'var(--color-text-muted)' }} /></button>
                        </div>
                        <form onSubmit={handleGenerate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Select Employee</label>
                                <select required value={genForm.employeeId} onChange={(e) => setGenForm({ ...genForm, employeeId: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                                    <option value="">— Select employee —</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={emp._id}>
                                            {(emp.userId as any)?.name || emp.employeeId} — {emp.designation}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Month</label>
                                    <select value={genForm.month} onChange={(e) => setGenForm({ ...genForm, month: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border cursor-pointer"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Year</label>
                                    <input type="number" required value={genForm.year} onChange={(e) => setGenForm({ ...genForm, year: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button type="submit" disabled={generating}
                                    className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)' }}>
                                    {generating ? 'Generating...' : 'Generate'}
                                </button>
                                <button type="button" onClick={() => setShowGenerate(false)}
                                    className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payroll Table */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                {isLoading ? (
                    <div className="p-12 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
                ) : payrolls.length === 0 ? (
                    <div className="p-12 text-center">
                        <DollarSign size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No payroll records for {MONTHS[month - 1]} {year}</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Employee', 'Working Days', 'Hours', 'Gross', 'Deductions', 'Net Salary', 'Status', 'Actions'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.map((p) => {
                                const statusStyle = getStatusStyle(p.status);
                                const totalDeductions = p.deductions.pf + p.deductions.esi + p.deductions.tax + p.deductions.leaves + p.deductions.penalties;
                                return (
                                    <tr key={p._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                            {typeof p.employeeId === 'object' ? ((p.employeeId as any)?.userId?.name || '—') : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.presentDays}/{p.workingDays}
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.totalHoursWorked}h {p.overtime > 0 && <span className="text-xs" style={{ color: 'var(--color-primary)' }}>(+{p.overtime}h OT)</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>₹{p.grossSalary.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: '#EF4444' }}>-₹{totalDeductions.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-success)' }}>₹{p.netSalary.toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                                                {p.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                {p.status === 'draft' && (
                                                    <button onClick={() => updateStatus({ id: p._id, data: { status: 'approved' } })}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white rounded cursor-pointer" style={{ backgroundColor: '#3B82F6' }}>
                                                        <Check size={12} /> Approve
                                                    </button>
                                                )}
                                                {p.status === 'approved' && (
                                                    <button onClick={() => updateStatus({ id: p._id, data: { status: 'paid' } })}
                                                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white rounded cursor-pointer" style={{ backgroundColor: 'var(--color-success)' }}>
                                                        <CreditCard size={12} /> Mark Paid
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
