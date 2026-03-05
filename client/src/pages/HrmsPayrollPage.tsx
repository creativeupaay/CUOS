import { useState } from 'react';
import {
    useGetPayrollsQuery,
    useGeneratePayrollMutation,
    useGenerateBulkPayrollMutation,
    useUpdatePayrollStatusMutation,
    useGetEmployeesQuery,
} from '@/features/hrms/hrmsApi';
import {
    Plus, DollarSign, Check, CreditCard, X, Loader2,
    Users, Sparkles, AlertTriangle, CheckCircle2, ChevronDown,
} from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: '#FEF9C3', color: '#92400E', label: 'Draft' },
    approved: { bg: '#DBEAFE', color: '#1D4ED8', label: 'Approved' },
    paid: { bg: '#D1FAE5', color: '#059669', label: 'Paid' },
};

export default function HrmsPayrollPage() {
    const currentDate = new Date();
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [year, setYear] = useState(currentDate.getFullYear());
    const [showSingleModal, setShowSingleModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkMonth, setBulkMonth] = useState(currentDate.getMonth() + 1);
    const [bulkYear, setBulkYear] = useState(currentDate.getFullYear());
    const [bulkResult, setBulkResult] = useState<{ generated: number; skipped: number; failed: number; errors: string[] } | null>(null);
    const [genForm, setGenForm] = useState({ employeeId: '', month: currentDate.getMonth() + 1, year: currentDate.getFullYear() });

    const { data, isLoading } = useGetPayrollsQuery({ month, year });
    const { data: empData } = useGetEmployeesQuery({ limit: 200 });
    const [generatePayroll, { isLoading: genSingle }] = useGeneratePayrollMutation();
    const [generateBulkPayroll, { isLoading: genBulk }] = useGenerateBulkPayrollMutation();
    const [updateStatus] = useUpdatePayrollStatusMutation();

    const payrolls = data?.data?.payrolls || [];
    const employees = empData?.data?.employees || [];

    /* ── single generate ─────────────────────────────────────── */
    const handleSingleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await generatePayroll(genForm).unwrap();
            setShowSingleModal(false);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to generate payroll');
        }
    };

    /* ── bulk generate ───────────────────────────────────────── */
    const handleBulkGenerate = async () => {
        try {
            const response = await generateBulkPayroll({ month: bulkMonth, year: bulkYear }).unwrap();
            // RTK unwrap() gives us the full ApiResponse: { status, data: { generated, skipped, failed, errors } }
            const payload = (response as any)?.data ?? response;
            setBulkResult({
                generated: payload?.generated ?? 0,
                skipped: payload?.skipped ?? 0,
                failed: payload?.failed ?? 0,
                errors: payload?.errors ?? [],
            });
        } catch (err: any) {
            // Show errors inside the result screen rather than a browser alert
            setBulkResult({
                generated: 0,
                skipped: 0,
                failed: 1,
                errors: [err?.data?.message || err?.message || 'Bulk generation failed. Check server logs.'],
            });
        }
    };

    const selectStyle: React.CSSProperties = {
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
        <div className="mx-auto page-enter" style={{ maxWidth: '1200px' }}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1
                        className="text-2xl font-bold mb-0.5"
                        style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}
                    >
                        Payroll
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Generate, approve, and track salary payouts
                    </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                    {/* Bulk generate */}
                    <button
                        onClick={() => { setBulkResult(null); setShowBulkModal(true); }}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl cursor-pointer transition-all"
                        style={{
                            background: 'linear-gradient(135deg,#059669,#0EA5E9)',
                            color: 'white',
                            boxShadow: 'var(--shadow-brand)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <Users size={15} />
                        Generate All
                    </button>
                    {/* Single generate */}
                    <button
                        onClick={() => setShowSingleModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl cursor-pointer btn btn-ghost"
                    >
                        <Plus size={15} />
                        Single Employee
                    </button>
                </div>
            </div>

            {/* ── Filter bar ─────────────────────────────────────────── */}
            <div className="flex gap-3 mb-6">
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} style={selectStyle}>
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={selectStyle}>
                    {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            {/* ── Payroll Table ───────────────────────────────────────── */}
            <div
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', boxShadow: 'var(--shadow-xs)' }}
            >
                {isLoading ? (
                    <div className="p-12 flex items-center justify-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                        Loading payrolls…
                    </div>
                ) : payrolls.length === 0 ? (
                    <div className="p-16 flex flex-col items-center justify-center">
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                            style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-muted)' }}
                        >
                            <DollarSign size={28} />
                        </div>
                        <p className="text-base font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            No payroll records
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            No records for {MONTHS[month - 1]} {year}. Click "Generate All" to run bulk payroll.
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Employee', 'Working Days', 'Hours', 'Gross', 'Deductions', 'Net Salary', 'Status', 'Actions'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.map((p) => {
                                const ss = STATUS_STYLE[p.status] || STATUS_STYLE.draft;
                                const totalDed = p.deductions.pf + p.deductions.esi + p.deductions.tax + p.deductions.leaves + p.deductions.penalties;
                                return (
                                    <tr key={p._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {typeof p.employeeId === 'object' ? ((p.employeeId as any)?.userId?.name || '—') : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.presentDays}/{p.workingDays}
                                        </td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                            {p.totalHoursWorked}h
                                            {p.overtime > 0 && <span className="ml-1 text-xs" style={{ color: 'var(--color-primary)' }}>(+{p.overtime}h OT)</span>}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                            ₹{p.grossSalary.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#EF4444' }}>
                                            -₹{totalDed.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                                            ₹{p.netSalary.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: ss.bg, color: ss.color }}>
                                                {ss.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1.5">
                                                {p.status === 'draft' && (
                                                    <button
                                                        onClick={() => updateStatus({ id: p._id, data: { status: 'approved' } })}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white rounded-lg cursor-pointer"
                                                        style={{ backgroundColor: '#3B82F6' }}
                                                    >
                                                        <Check size={11} /> Approve
                                                    </button>
                                                )}
                                                {p.status === 'approved' && (
                                                    <button
                                                        onClick={() => updateStatus({ id: p._id, data: { status: 'paid' } })}
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white rounded-lg cursor-pointer"
                                                        style={{ backgroundColor: 'var(--color-success)' }}
                                                    >
                                                        <CreditCard size={11} /> Mark Paid
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

            {/* ════════════════════════════════════════════════════════
                BULK GENERATE MODAL
                ══════════════════════════════════════════════════════ */}
            {showBulkModal && (
                <div className="modal-overlay">

                    <div
                        className="animate-scale-in w-full rounded-2xl border p-6"
                        style={{ maxWidth: '460px', backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', boxShadow: 'var(--shadow-xl)' }}
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
                                    <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                                        Generate Payroll for All
                                    </h2>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        Runs payroll for every active employee
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => { setShowBulkModal(false); setBulkResult(null); }} style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* Result display */}
                        {bulkResult ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Generated', value: bulkResult.generated, color: '#10B981', bg: '#D1FAE5' },
                                        { label: 'Skipped', value: bulkResult.skipped, color: '#F59E0B', bg: '#FEF3C7' },
                                        { label: 'Failed', value: bulkResult.failed, color: '#EF4444', bg: '#FEE2E2' },
                                    ].map(({ label, value, color, bg }) => (
                                        <div key={label} className="rounded-xl p-4 text-center" style={{ backgroundColor: bg }}>
                                            <div className="text-2xl font-bold" style={{ color, fontFamily: 'Outfit, sans-serif' }}>{value}</div>
                                            <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
                                        </div>
                                    ))}
                                </div>

                                {bulkResult.errors.length > 0 && (
                                    <div className="rounded-xl p-3" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <AlertTriangle size={13} style={{ color: '#EF4444' }} />
                                            <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>Errors</span>
                                        </div>
                                        <div className="space-y-1 max-h-28 overflow-y-auto">
                                            {bulkResult.errors.map((e, i) => (
                                                <p key={i} className="text-xs" style={{ color: '#991B1B' }}>{e}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#059669' }}>
                                    <CheckCircle2 size={16} />
                                    Payroll generation complete!
                                </div>

                                <button
                                    onClick={() => { setShowBulkModal(false); setBulkResult(null); }}
                                    className="w-full py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer"
                                    style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)' }}
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Month + Year pickers */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Month</label>
                                        <div className="relative">
                                            <select
                                                value={bulkMonth}
                                                onChange={(e) => setBulkMonth(parseInt(e.target.value))}
                                                className="w-full appearance-none"
                                                style={{ ...selectStyle, width: '100%', paddingRight: '32px' }}
                                            >
                                                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                            </select>
                                            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Year</label>
                                        <div className="relative">
                                            <select
                                                value={bulkYear}
                                                onChange={(e) => setBulkYear(parseInt(e.target.value))}
                                                className="w-full appearance-none"
                                                style={{ ...selectStyle, width: '100%', paddingRight: '32px' }}
                                            >
                                                {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                                                    <option key={y} value={y}>{y}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Info note */}
                                <div
                                    className="rounded-xl p-3 text-xs"
                                    style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-darker)' }}
                                >
                                    Payroll will be generated for all <strong>active</strong> and <strong>probation</strong> employees who have a salary structure set up. Already-generated records for this period will be skipped.
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleBulkGenerate}
                                        disabled={genBulk}
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer disabled:opacity-60 transition-all"
                                        style={{ background: 'linear-gradient(135deg,#059669,#0EA5E9)', boxShadow: 'var(--shadow-brand)' }}
                                    >
                                        {genBulk ? (
                                            <><Loader2 size={15} className="animate-spin" /> Generating…</>
                                        ) : (
                                            <><Sparkles size={15} /> Generate for All Employees</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => { setShowBulkModal(false); setBulkResult(null); }}
                                        className="px-4 py-2.5 text-sm rounded-xl border cursor-pointer btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                SINGLE EMPLOYEE MODAL
                ══════════════════════════════════════════════════════ */}
            {showSingleModal && (
                <div className="modal-overlay">

                    <div
                        className="animate-scale-in w-full rounded-2xl border p-6"
                        style={{ maxWidth: '420px', backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', boxShadow: 'var(--shadow-xl)' }}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                                Generate — Single Employee
                            </h2>
                            <button onClick={() => setShowSingleModal(false)} style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSingleGenerate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Select Employee</label>
                                <select
                                    required
                                    value={genForm.employeeId}
                                    onChange={(e) => setGenForm({ ...genForm, employeeId: e.target.value })}
                                    className="w-full"
                                    style={{ ...selectStyle, width: '100%' }}
                                >
                                    <option value="">— Select employee —</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={emp._id}>
                                            {(emp.userId as any)?.name || emp.employeeId} — {emp.designation}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Month</label>
                                    <select value={genForm.month} onChange={(e) => setGenForm({ ...genForm, month: parseInt(e.target.value) })} className="w-full" style={{ ...selectStyle, width: '100%' }}>
                                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Year</label>
                                    <select value={genForm.year} onChange={(e) => setGenForm({ ...genForm, year: parseInt(e.target.value) })} className="w-full" style={{ ...selectStyle, width: '100%' }}>
                                        {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i).map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="submit"
                                    disabled={genSingle}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl cursor-pointer disabled:opacity-60"
                                    style={{ backgroundColor: 'var(--color-primary)', boxShadow: 'var(--shadow-brand)' }}
                                >
                                    {genSingle ? <><Loader2 size={15} className="animate-spin" /> Generating…</> : 'Generate'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSingleModal(false)}
                                    className="px-4 py-2.5 text-sm rounded-xl border cursor-pointer btn btn-ghost"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
