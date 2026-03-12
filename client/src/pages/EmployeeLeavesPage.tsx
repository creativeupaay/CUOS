import { useState } from 'react';
import { ListTodo, Plus, X, Loader2, Calendar, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import {
    useGetMyLeavesQuery,
    useGetLeaveBalanceQuery,
    useCreateLeaveMutation,
} from '@/features/hrms/hrmsApi';
import type { Leave } from '@/features/hrms/types/types';

// ── Status badge ──────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: 'Pending', bg: '#FEF9C3', color: '#854D0E' },
    approved: { label: 'Approved', bg: '#DCFCE7', color: '#15803D' },
    rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#B91C1C' },
    cancelled: { label: 'Cancelled', bg: '#F3F4F6', color: '#6B7280' },
};

function LeaveStatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    return (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    );
}

// ── Leave type display ────────────────────────────────────────────────
const TYPE_CFG: Record<string, { label: string; emoji: string; bg: string; color: string }> = {
    casual: { label: 'Casual', emoji: '🌴', bg: '#DBEAFE', color: '#1D4ED8' },
    sick: { label: 'Sick', emoji: '🤒', bg: '#FEE2E2', color: '#991B1B' },
    earned: { label: 'Earned', emoji: '⭐', bg: '#DCFCE7', color: '#15803D' },
    unpaid: { label: 'Unpaid', emoji: '📋', bg: '#F3E8FF', color: '#6B21A8' },
    maternity: { label: 'Maternity', emoji: '🤱', bg: '#FCE7F3', color: '#9D174D' },
    paternity: { label: 'Paternity', emoji: '👨‍👶', bg: '#FFEDD5', color: '#9A3412' },
};

function LeaveTypeBadge({ type, isPaid }: { type: string; isPaid?: boolean }) {
    const cfg = TYPE_CFG[type] || { label: type, emoji: '📝', bg: '#F3F4F6', color: '#6B7280' };
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block w-fit"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.emoji} {cfg.label}
            </span>
            <span className="text-xs" style={{ color: isPaid ? '#15803D' : '#9D174D' }}>
                {isPaid ? '✓ Paid' : '✗ Unpaid'}
            </span>
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
}

// ── Apply Leave Modal ─────────────────────────────────────────────────
function ApplyLeaveModal({ onClose }: { onClose: () => void }) {
    const [createLeave, { isLoading }] = useCreateLeaveMutation();
    const [form, setForm] = useState({
        type: 'earned',
        startDate: '',
        endDate: '',
        days: 1,
        reason: '',
        isPaid: true,
    });

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
            await createLeave(form as any).unwrap();
            onClose();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to apply leave');
        }
    };

    const TYPES = ['casual', 'sick', 'earned', 'maternity', 'paternity'];

    return (
        <div className="modal-overlay items-end sm:items-center">
            <div className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center gap-2">
                        <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Apply for Leave
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                        <X size={16} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Leave Type */}
                    <div>
                        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Leave Type <span style={{ color: 'var(--color-primary)' }}>*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {TYPES.map(t => {
                                const cfg = TYPE_CFG[t] || { label: t, emoji: '📝', bg: '#F3F4F6', color: '#6B7280' };
                                const sel = form.type === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, type: t }))}
                                        className="px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer capitalize transition-all"
                                        style={{
                                            backgroundColor: sel ? cfg.bg : 'transparent',
                                            color: sel ? cfg.color : 'var(--color-text-muted)',
                                            borderColor: sel ? cfg.color + '60' : 'var(--color-border-default)',
                                            fontWeight: sel ? 600 : 400,
                                        }}
                                    >
                                        {cfg.emoji} {cfg.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Paid / Unpaid toggle */}
                    <div>
                        <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                            Leave Treatment
                        </label>
                        <div className="flex rounded-lg border overflow-hidden w-fit"
                            style={{ borderColor: 'var(--color-border-default)' }}>
                            {([true, false] as const).map((paid) => (
                                <button
                                    key={String(paid)}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, isPaid: paid }))}
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
                    </div>

                    {/* Dates + days */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                Start Date <span style={{ color: 'var(--color-primary)' }}>*</span>
                            </label>
                            <input type="date" required value={form.startDate}
                                onChange={e => {
                                    const d = calcDays(e.target.value, form.endDate);
                                    setForm(f => ({ ...f, startDate: e.target.value, days: d }));
                                }}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                End Date <span style={{ color: 'var(--color-primary)' }}>*</span>
                            </label>
                            <input type="date" required value={form.endDate} min={form.startDate}
                                onChange={e => {
                                    const d = calcDays(form.startDate, e.target.value);
                                    setForm(f => ({ ...f, endDate: e.target.value, days: d }));
                                }}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>Days</label>
                            <input type="number" required min={0.5} step={0.5} value={form.days}
                                onChange={e => setForm(f => ({ ...f, days: parseFloat(e.target.value) }))}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>
                            Reason <span style={{ color: 'var(--color-primary)' }}>*</span>
                        </label>
                        <textarea required value={form.reason}
                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            rows={3} placeholder="Briefly describe your reason for leave..."
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                        />
                    </div>

                    {/* Summary */}
                    {form.startDate && form.endDate && (
                        <div className="rounded-lg px-4 py-2.5 flex items-center justify-between"
                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                <span className="font-medium capitalize">{form.type}</span> leave
                                &nbsp;·&nbsp;{new Date(form.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                &nbsp;→&nbsp;{new Date(form.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-base font-bold"
                                style={{ color: form.isPaid ? 'var(--color-primary)' : '#EF4444' }}>
                                {form.days} day{form.days !== 1 ? 's' : ''} · {form.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-colors"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer disabled:opacity-50 transition-colors"
                            style={{ backgroundColor: 'var(--color-primary)' }}>
                            {isLoading ? <Loader2 size={15} className="animate-spin" /> : null}
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function EmployeeLeavesPage() {
    const [showModal, setShowModal] = useState(false);
    const { data: leavesData, isLoading } = useGetMyLeavesQuery({}, { refetchOnMountOrArgChange: true, pollingInterval: 30000 });
    const { data: balanceData } = useGetLeaveBalanceQuery(undefined, { refetchOnMountOrArgChange: true, pollingInterval: 30000 });

    const leaves: Leave[] = (leavesData?.data as any)?.leaves || [];
    const balanceArr: any[] = (balanceData?.data as any)?.balance || [];

    // Build quick lookup map: type → { quota, used, pending }
    const balanceMap: Record<string, { quota: number; used: number; pending: number }> = {};
    balanceArr.forEach((b: any) => { balanceMap[b.type] = b; });

    // Stats
    const currentYear = new Date().getFullYear();
    const approvedThisYear = leaves.filter(l =>
        l.status === 'approved' && new Date(l.startDate).getFullYear() === currentYear
    );
    const totalTaken = approvedThisYear.reduce((sum, l) => sum + ((l as any).days || 1), 0);
    const pendingCount = leaves.filter(l => l.status === 'pending').length;

    // Paid leaves: quota and remaining from 'earned' bucket
    const earnedBal = balanceMap['earned'];
    const paidQuota = earnedBal?.quota ?? 0;
    const paidUsed = earnedBal?.used ?? 0;
    const paidRemaining = earnedBal ? Math.max(0, paidQuota - paidUsed) : '—';

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <ListTodo size={21} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>My Leaves</h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Track your leave requests and balance</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    {
                        label: 'Paid Leaves Balance',
                        value: typeof paidRemaining === 'number' ? `${paidRemaining} / ${paidQuota}` : '—',
                        sub: typeof paidRemaining === 'number' ? `${paidUsed} used` : '',
                        icon: CheckCircle2,
                        color: '#15803D', bg: '#DCFCE7',
                    },
                    {
                        label: `Total Leaves Taken (${currentYear})`,
                        value: totalTaken,
                        sub: `${approvedThisYear.length} approved request${approvedThisYear.length !== 1 ? 's' : ''}`,
                        icon: TrendingDown,
                        color: '#C2410C', bg: '#FFEDD5',
                    },
                    {
                        label: 'Pending Requests',
                        value: pendingCount,
                        sub: pendingCount ? 'Awaiting approval' : 'All clear',
                        icon: Clock,
                        color: '#854D0E', bg: '#FEF9C3',
                    },
                ].map(card => (
                    <div key={card.label} className="rounded-xl border p-5"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: card.bg }}>
                                <card.icon size={16} style={{ color: card.color }} />
                            </div>
                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                                {card.label}
                            </span>
                        </div>
                        <div className="text-2xl font-bold mb-0.5" style={{ color: card.color }}>{card.value}</div>
                        {card.sub && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{card.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Leave History Table */
            <div className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                <div className="px-5 py-4 border-b flex items-center justify-between"
                    style={{ borderColor: 'var(--color-border-default)' }}>
                    <h2 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Leave Requests</h2>
                    {leaves.length > 0 && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {leaves.length} request{leaves.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                            style={{ borderColor: 'var(--color-primary)' }} />
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-4xl mb-3">🌴</div>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            No leave requests yet. Click the button below to apply!
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                {['Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left font-medium"
                                        style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {leaves.map((leave, i) => (
                                <tr key={leave._id} style={{
                                    borderTop: i > 0 ? '1px solid var(--color-border-default)' : undefined
                                }}>
                                    <td className="px-4 py-3">
                                        <LeaveTypeBadge
                                            type={(leave as any).type || 'earned'}
                                            isPaid={(leave as any).isPaid}
                                        />
                                    </td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                                        {formatDate(leave.startDate)}
                                    </td>
                                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                                        {formatDate(leave.endDate)}
                                    </td>
                                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                        {(leave as any).days ?? 1}
                                    </td>
                                    <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                        {leave.reason}
                                    </td>
                                    <td className="px-4 py-3">
                                        <LeaveStatusBadge status={leave.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
}
            /* FAB — Apply for Leave */ 
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-transform z-40"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                <Plus size={18} />
                Apply for Leave
            </button>

            {showModal && (
                <ApplyLeaveModal
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}
