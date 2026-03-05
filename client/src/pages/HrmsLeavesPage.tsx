import { useState } from 'react';
import {
    useGetLeavesQuery,
    useGetEmployeesQuery,
    useCreateLeaveMutation,
    useUpdateLeaveStatusMutation,
} from '@/features/hrms/hrmsApi';
import {
    Plus, X, Check, XCircle, Clock, Calendar, ChevronRight,
    ArrowLeft, AlertCircle, User, Loader2, FileText,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────
const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity'] as const;
type LeaveType = typeof LEAVE_TYPES[number];

// ── Helpers ──────────────────────────────────────────────────────────
function statusCfg(s: string) {
    switch (s) {
        case 'approved': return { bg: '#DCFCE7', color: '#15803D', icon: Check };
        case 'rejected': return { bg: '#FEE2E2', color: '#991B1B', icon: XCircle };
        case 'cancelled': return { bg: '#F3F4F6', color: '#6B7280', icon: X };
        default: return { bg: '#FEF3C7', color: '#92400E', icon: Clock };
    }
}

function typeCfg(t: string) {
    const m: Record<string, { bg: string; color: string }> = {
        casual: { bg: '#DBEAFE', color: '#1D4ED8' },
        sick: { bg: '#FEE2E2', color: '#991B1B' },
        earned: { bg: '#DCFCE7', color: '#15803D' },
        unpaid: { bg: '#F3E8FF', color: '#6B21A8' },
        maternity: { bg: '#FCE7F3', color: '#9D174D' },
        paternity: { bg: '#FFEDD5', color: '#9A3412' },
    };
    return m[t] || { bg: '#F3F4F6', color: '#6B7280' };
}

function getDeptColor(d: string) {
    const m: Record<string, string> = {
        engineering: '#3B82F6', design: '#8B5CF6',
        marketing: '#F59E0B', finance: '#10B981', hr: '#EC4899', admin: '#6B7280'
    };
    return m[d] || '#6B7280';
}

function LeaveBadge({ type }: { type: string }) {
    const c = typeCfg(type);
    return (
        <span
            className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize"
            style={{ backgroundColor: c.bg, color: c.color }}
        >
            {type}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const c = statusCfg(status);
    const Icon = c.icon;
    return (
        <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize"
            style={{ backgroundColor: c.bg, color: c.color }}
        >
            <Icon size={11} />
            {status}
        </span>
    );
}

// ── Reject Reason Modal ───────────────────────────────────────────────
function RejectModal({
    leaveId, onClose, onConfirm,
}: { leaveId: string; onClose: () => void; onConfirm: (id: string, reason: string) => void }) {
    const [reason, setReason] = useState('');
    return (
        <div className="modal-overlay">

            <div
                className="w-full max-w-sm rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex items-center gap-2 mb-4">
                    <AlertCircle size={18} style={{ color: '#EF4444' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Reject Leave</h3>
                </div>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none mb-4"
                    style={{
                        borderColor: 'var(--color-border-default)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                    }}
                />
                <div className="flex gap-3">
                    <button
                        onClick={() => onConfirm(leaveId, reason)}
                        className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer"
                        style={{ backgroundColor: '#EF4444' }}
                    >
                        Reject
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Apply Leave Modal ─────────────────────────────────────────────────
function ApplyLeaveModal({ onClose }: { onClose: () => void }) {
    const [createLeave, { isLoading }] = useCreateLeaveMutation();
    const [form, setForm] = useState({
        type: 'casual' as LeaveType,
        startDate: '',
        endDate: '',
        days: 1,
        reason: '',
        isPaid: true,
    });

    // Auto-calculate days when dates change
    const calcDays = (start: string, end: string) => {
        if (start && end) {
            const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24) + 1;
            return Math.max(0.5, diff);
        }
        return 1;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createLeave(form).unwrap();
            onClose();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to apply leave');
        }
    };

    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div className="modal-overlay">

            <div
                className="w-full max-w-lg rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Apply for Leave
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                        <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Leave Type */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Leave Type
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {LEAVE_TYPES.map((t) => {
                                const c = typeCfg(t);
                                const sel = form.type === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setForm({ ...form, type: t })}
                                        className="px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer capitalize transition-all"
                                        style={{
                                            backgroundColor: sel ? c.bg : 'var(--color-bg-surface)',
                                            color: sel ? c.color : 'var(--color-text-muted)',
                                            borderColor: sel ? c.color + '60' : 'var(--color-border-default)',
                                            fontWeight: sel ? 600 : 400,
                                        }}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Paid / Unpaid toggle */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Leave Treatment
                        </label>
                        <div
                            className="flex rounded-lg border overflow-hidden w-fit"
                            style={{ borderColor: 'var(--color-border-default)' }}
                        >
                            {([true, false] as const).map((paid) => (
                                <button
                                    key={String(paid)}
                                    type="button"
                                    onClick={() => setForm({ ...form, isPaid: paid })}
                                    className="px-4 py-2 text-sm font-medium cursor-pointer transition-all"
                                    style={{
                                        backgroundColor: form.isPaid === paid
                                            ? (paid ? 'var(--color-primary)' : '#EF4444')
                                            : 'var(--color-bg-surface)',
                                        color: form.isPaid === paid ? 'white' : 'var(--color-text-muted)',
                                    }}
                                >
                                    {paid ? '💰 Paid Leave' : '⛔ Unpaid Leave'}
                                </button>
                            ))}
                        </div>
                        {!form.isPaid && (
                            <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>
                                This leave will be deducted from the employee's salary.
                            </p>
                        )}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Start Date *</label>
                            <input
                                type="date" required value={form.startDate}
                                onChange={(e) => {
                                    const d = calcDays(e.target.value, form.endDate);
                                    setForm({ ...form, startDate: e.target.value, days: d });
                                }}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>End Date *</label>
                            <input
                                type="date" required value={form.endDate}
                                min={form.startDate}
                                onChange={(e) => {
                                    const d = calcDays(form.startDate, e.target.value);
                                    setForm({ ...form, endDate: e.target.value, days: d });
                                }}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>No. of Days</label>
                            <input
                                type="number" required min={0.5} step={0.5} value={form.days}
                                onChange={(e) => setForm({ ...form, days: parseFloat(e.target.value) })}
                                className="w-full px-3 py-2.5 text-sm rounded-lg border" style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Reason *</label>
                        <textarea
                            required value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            rows={3} placeholder="Describe the reason for leave..."
                            className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none"
                            style={inputStyle}
                        />
                    </div>

                    {/* Summary pill */}
                    {form.startDate && form.endDate && (
                        <div
                            className="rounded-lg px-4 py-2.5 flex items-center justify-between"
                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                <span className="font-medium capitalize">{form.type}</span> leave
                                ·&nbsp;{new Date(form.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                &nbsp;→&nbsp;{new Date(form.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                            <span
                                className="text-base font-bold"
                                style={{ color: form.isPaid ? 'var(--color-primary)' : '#EF4444' }}
                            >
                                {form.days} day{form.days !== 1 ? 's' : ''}
                                &nbsp;·&nbsp;{form.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isLoading ? <><Loader2 size={15} className="animate-spin" /> Applying…</> : 'Apply for Leave'}
                        </button>
                        <button
                            type="button" onClick={onClose}
                            className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Employee Leave Detail View ────────────────────────────────────────
function EmployeeLeaveDetail({ emp, onBack }: { emp: any; onBack: () => void }) {
    const { data, isLoading } = useGetLeavesQuery({ employeeId: emp._id });
    const leaves = (data?.data?.leaves || []) as any[];

    const totalPaid = leaves.filter(l => l.isPaid && l.status === 'approved').reduce((s: number, l: any) => s + l.days, 0);
    const totalUnpaid = leaves.filter((l: any) => !l.isPaid && l.status === 'approved').reduce((s: number, l: any) => s + l.days, 0);
    const pending = leaves.filter((l: any) => l.status === 'pending').length;

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={onBack}
                    className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <ArrowLeft size={16} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold"
                        style={{ backgroundColor: getDeptColor(emp.department) }}
                    >
                        {(emp.userId?.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {emp.userId?.name}
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {emp.employeeId} · {emp.designation}
                        </p>
                    </div>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Paid Leaves Taken', value: totalPaid, color: '#16A34A' },
                    { label: 'Unpaid Leaves Taken', value: totalUnpaid, color: '#EF4444' },
                    { label: 'Pending Requests', value: pending, color: '#F59E0B' },
                ].map(({ label, value, color }) => (
                    <div
                        key={label}
                        className="rounded-xl border p-4 text-center"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        <div className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Leave history */}
            <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >
                {isLoading ? (
                    <div className="p-10 text-center">
                        <Loader2 size={28} className="mx-auto mb-2 animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="p-10 text-center">
                        <FileText size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No leave requests for this employee</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Type', 'Dates', 'Days', 'Paid/Unpaid', 'Reason', 'Status'].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaves.map((leave: any) => (
                                <tr key={leave._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                    <td className="px-4 py-3"><LeaveBadge type={leave.type} /></td>
                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        {new Date(leave.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                                        &nbsp;→&nbsp;
                                        {new Date(leave.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{leave.days}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: leave.isPaid ? '#DCFCE7' : '#FEE2E2',
                                                color: leave.isPaid ? '#15803D' : '#991B1B',
                                            }}
                                        >
                                            {leave.isPaid ? 'Paid' : 'Unpaid'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm max-w-[180px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                                        {leave.reason}
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════
export default function HrmsLeavesPage() {
    const [tab, setTab] = useState<'pending' | 'all' | 'employees'>('pending');
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [selectedEmp, setSelectedEmp] = useState<any>(null);

    // Status filter for "All Requests" tab
    const [statusFilter, setStatusFilter] = useState('');

    const { data: allLeavesData, isLoading: loadingAll, refetch } = useGetLeavesQuery({
        status: statusFilter || undefined,
    });
    const { data: pendingData, isLoading: loadingPending } = useGetLeavesQuery({ status: 'pending' });
    const { data: empsData, isLoading: loadingEmps } = useGetEmployeesQuery({ limit: 100 });

    const [updateStatus] = useUpdateLeaveStatusMutation();

    const allLeaves = (allLeavesData?.data?.leaves || []) as any[];
    const pendingLeaves = (pendingData?.data?.leaves || []) as any[];
    const employees = (empsData?.data?.employees || []) as any[];

    const handleApprove = async (id: string) => {
        try {
            await updateStatus({ id, data: { status: 'approved' } }).unwrap();
            refetch();
        } catch { /* noop */ }
    };

    const handleReject = async (id: string, reason: string) => {
        try {
            await updateStatus({ id, data: { status: 'rejected', rejectionReason: reason } }).unwrap();
            setRejectingId(null);
            refetch();
        } catch { /* noop */ }
    };

    // If employee detail view is open
    if (selectedEmp) {
        return (
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <EmployeeLeaveDetail emp={selectedEmp} onBack={() => setSelectedEmp(null)} />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

            {/* ── Header ───────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-2.5">
                    <Calendar size={21} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Leaves</h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            Manage leave requests and track employee absences
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowApplyModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                >
                    <Plus size={16} /> Apply Leave
                </button>
            </div>

            {/* ── Tabs ─────────────────────────────────────────── */}
            <div
                className="flex rounded-xl p-1 mb-6 w-fit"
                style={{ backgroundColor: 'var(--color-bg-subtle)' }}
            >
                {([
                    { key: 'pending', label: `Pending Approval${pendingLeaves.length > 0 ? ` (${pendingLeaves.length})` : ''}` },
                    { key: 'all', label: 'All Requests' },
                    { key: 'employees', label: 'Employee Wise' },
                ] as const).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all"
                        style={{
                            backgroundColor: tab === key ? 'var(--color-bg-surface)' : 'transparent',
                            color: tab === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Tab: Pending Approval ─────────────────────────── */}
            {tab === 'pending' && (
                <div>
                    {loadingPending ? (
                        <div className="p-16 text-center">
                            <Loader2 size={28} className="mx-auto mb-2 animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    ) : pendingLeaves.length === 0 ? (
                        <div
                            className="rounded-xl border p-16 text-center"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                        >
                            <Check size={40} className="mx-auto mb-3" style={{ color: '#16A34A' }} />
                            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>All caught up!</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>No pending leave requests to review.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingLeaves.map((leave: any) => {
                                const emp = leave.employeeId as any;
                                return (
                                    <div
                                        key={leave._id}
                                        className="rounded-xl border p-5 flex items-start justify-between gap-6"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                                    >
                                        {/* Left: employee info */}
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                                                style={{ backgroundColor: getDeptColor(emp?.department || '') }}
                                            >
                                                {(emp?.userId?.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                        {emp?.userId?.name || emp?.userId?.email || 'Unknown'}
                                                    </span>
                                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        {emp?.employeeId} · {emp?.designation}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                                    <LeaveBadge type={leave.type} />
                                                    <span
                                                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: leave.isPaid ? '#DCFCE7' : '#FEE2E2',
                                                            color: leave.isPaid ? '#15803D' : '#991B1B',
                                                        }}
                                                    >
                                                        {leave.isPaid ? 'Paid' : 'Unpaid'}
                                                    </span>
                                                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        {leave.days} day{leave.days !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                        📅&nbsp;
                                                        {new Date(leave.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        &nbsp;→&nbsp;
                                                        {new Date(leave.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                        📝&nbsp;{leave.reason}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: action buttons */}
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleApprove(leave._id)}
                                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                style={{ backgroundColor: '#16A34A' }}
                                            >
                                                <Check size={14} /> Approve
                                            </button>
                                            <button
                                                onClick={() => setRejectingId(leave._id)}
                                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                style={{ backgroundColor: '#EF4444' }}
                                            >
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: All Requests ─────────────────────────────── */}
            {tab === 'all' && (
                <div>
                    {/* Filter bar */}
                    <div className="flex gap-3 mb-5">
                        {['', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
                            <button
                                key={s || 'all'}
                                onClick={() => setStatusFilter(s)}
                                className="px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer capitalize transition-all"
                                style={{
                                    ...(statusFilter === s
                                        ? { backgroundColor: 'var(--color-primary)', color: 'white', borderColor: 'var(--color-primary)' }
                                        : { backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)', borderColor: 'var(--color-border-default)' }),
                                }}
                            >
                                {s || 'All'}
                            </button>
                        ))}
                    </div>

                    <div
                        className="rounded-xl border overflow-hidden"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                    >
                        {loadingAll ? (
                            <div className="p-14 text-center">
                                <Loader2 size={28} className="mx-auto mb-2 animate-spin" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        ) : allLeaves.length === 0 ? (
                            <div className="p-14 text-center">
                                <FileText size={36} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No leave requests found</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                        {['Employee', 'Type', 'Paid/Unpaid', 'Dates', 'Days', 'Reason', 'Status', 'Actions'].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                                style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {allLeaves.map((leave: any) => {
                                        const emp = leave.employeeId as any;
                                        return (
                                            <tr key={leave._id} className="border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                                            style={{ backgroundColor: getDeptColor(emp?.department || '') }}
                                                        >
                                                            {(emp?.userId?.name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                                {emp?.userId?.name || '—'}
                                                            </div>
                                                            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                {emp?.employeeId}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3"><LeaveBadge type={leave.type} /></td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: leave.isPaid ? '#DCFCE7' : '#FEE2E2',
                                                            color: leave.isPaid ? '#15803D' : '#991B1B',
                                                        }}
                                                    >
                                                        {leave.isPaid !== false ? 'Paid' : 'Unpaid'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {new Date(leave.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    &nbsp;→&nbsp;
                                                    {new Date(leave.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{leave.days}</td>
                                                <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                    {leave.reason}
                                                </td>
                                                <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                                                <td className="px-4 py-3">
                                                    {leave.status === 'pending' && (
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => handleApprove(leave._id)}
                                                                className="px-2 py-1 text-xs font-medium text-white rounded cursor-pointer"
                                                                style={{ backgroundColor: '#16A34A' }}
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => setRejectingId(leave._id)}
                                                                className="px-2 py-1 text-xs font-medium text-white rounded cursor-pointer"
                                                                style={{ backgroundColor: '#EF4444' }}
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tab: Employee Wise ────────────────────────────── */}
            {tab === 'employees' && (
                <div>
                    {loadingEmps ? (
                        <div className="p-16 text-center">
                            <Loader2 size={28} className="mx-auto mb-2 animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="p-16 text-center">
                            <User size={36} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No employees found</p>
                        </div>
                    ) : (
                        <div
                            className="rounded-xl border overflow-hidden"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                        >
                            <table className="w-full">
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                        {['Employee', 'Department', 'Designation', 'Paid Leaves / Year', 'Details'].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                                style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map((emp: any) => (
                                        <tr
                                            key={emp._id}
                                            className="border-t cursor-pointer hover:bg-gray-50 transition-colors"
                                            style={{ borderColor: 'var(--color-border-default)' }}
                                            onClick={() => setSelectedEmp(emp)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                                                        style={{ backgroundColor: getDeptColor(emp.department) }}
                                                    >
                                                        {(emp.userId?.name || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                            {emp.userId?.name}
                                                        </div>
                                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                            {emp.employeeId}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className="text-xs font-medium px-2 py-1 rounded-full capitalize"
                                                    style={{ backgroundColor: getDeptColor(emp.department) + '20', color: getDeptColor(emp.department) }}
                                                >
                                                    {emp.department}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                {emp.designation}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                                                {(emp as any).paidLeavesPerYear ?? 12} days/year
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedEmp(emp); }}
                                                    className="flex items-center gap-1 text-xs font-medium cursor-pointer hover:underline"
                                                    style={{ color: 'var(--color-primary)' }}
                                                >
                                                    View history <ChevronRight size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Modals ───────────────────────────────────────── */}
            {showApplyModal && <ApplyLeaveModal onClose={() => setShowApplyModal(false)} />}
            {rejectingId && (
                <RejectModal
                    leaveId={rejectingId}
                    onClose={() => setRejectingId(null)}
                    onConfirm={handleReject}
                />
            )}
        </div>
    );
}
