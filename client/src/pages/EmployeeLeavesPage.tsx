import { useState } from 'react';
import { ListTodo, Plus, X, Loader2, CalendarDays, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
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

// ── Leave type config for the modal ──────────────────────────────────
const LEAVE_TYPES = [
    { value: 'casual', label: 'Casual', emoji: '🌴', isPaid: true },
    { value: 'sick', label: 'Sick', emoji: '🤒', isPaid: true },
    { value: 'earned', label: 'Earned', emoji: '⭐', isPaid: true },
    { value: 'unpaid', label: 'Unpaid', emoji: '📋', isPaid: false },
    { value: 'maternity', label: 'Maternity', emoji: '🤱', isPaid: true },
    { value: 'paternity', label: 'Paternity', emoji: '👨‍👶', isPaid: true },
];

// ── Apply Leave Modal ─────────────────────────────────────────────────
function ApplyLeaveModal({
    onClose,
    balanceMap,
}: {
    onClose: () => void;
    balanceMap: Record<string, { quota: number; used: number; pending: number }>;
}) {
    const [form, setForm] = useState({
        type: 'earned',
        startDate: '',
        endDate: '',
        reason: '',
    });
    const [createLeave, { isLoading }] = useCreateLeaveMutation();
    const [error, setError] = useState('');

    const selectedType = LEAVE_TYPES.find(lt => lt.value === form.type)!;
    const isPaid = selectedType.isPaid;

    const duration = (() => {
        if (!form.startDate || !form.endDate) return 0;
        const s = new Date(form.startDate);
        const e = new Date(form.endDate);
        if (e < s) return 0;
        return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    })();

    const typeBalance = balanceMap[form.type];
    const remaining = typeBalance ? typeBalance.pending : null;
    const isExhausted = isPaid && remaining !== null && remaining <= 0;
    const willExceed = isPaid && remaining !== null && duration > remaining;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!form.startDate || !form.endDate || !form.reason.trim()) {
            setError('Please fill all required fields');
            return;
        }
        if (new Date(form.endDate) < new Date(form.startDate)) {
            setError('End date cannot be before start date');
            return;
        }
        if (duration < 1) {
            setError('Leave duration must be at least 1 day');
            return;
        }
        if (willExceed) {
            setError(`Only ${remaining} day(s) of ${selectedType.label.toLowerCase()} leave remaining`);
            return;
        }
        try {
            await createLeave({
                type: form.type as any,
                startDate: form.startDate,
                endDate: form.endDate,
                days: duration,
                reason: form.reason,
                isPaid,
            }).unwrap();
            onClose();
        } catch (err: any) {
            setError(err?.data?.message || err?.message || 'Failed to apply for leave');
        }
    };

    // Today's date for the min date attr
    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <div className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center gap-2">
                        <CalendarDays size={18} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Apply for Leave
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                        <X size={16} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Leave Type Grid */}
                    <div>
                        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Leave Type <span style={{ color: 'var(--color-primary)' }}>*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {LEAVE_TYPES.map(lt => {
                                const bal = balanceMap[lt.value];
                                const rem = bal?.pending ?? null;
                                const exhausted = lt.isPaid && rem !== null && rem <= 0;
                                const selected = form.type === lt.value;
                                return (
                                    <button
                                        key={lt.value}
                                        type="button"
                                        disabled={exhausted}
                                        onClick={() => !exhausted && setForm(f => ({ ...f, type: lt.value }))}
                                        className="relative py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center"
                                        style={{
                                            backgroundColor: selected ? 'var(--color-primary)' : exhausted ? 'var(--color-bg-subtle)' : 'transparent',
                                            color: selected ? '#fff' : exhausted ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                                            borderColor: selected ? 'var(--color-primary)' : 'var(--color-border-default)',
                                            cursor: exhausted ? 'not-allowed' : 'pointer',
                                            opacity: exhausted ? 0.6 : 1,
                                        }}>
                                        <div>{lt.emoji} {lt.label}</div>
                                        {lt.isPaid && rem !== null && (
                                            <div className="text-[10px] mt-0.5 font-normal opacity-80">
                                                {exhausted ? '🚫 Exhausted' : `${rem} left`}
                                            </div>
                                        )}
                                        {!lt.isPaid && (
                                            <div className="text-[10px] mt-0.5 font-normal opacity-80">Unpaid</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Paid / Unpaid indicator */}
                        <div className="mt-2 text-xs font-medium px-2 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                            style={{ backgroundColor: isPaid ? '#DCFCE7' : '#FEE2E2', color: isPaid ? '#15803D' : '#B91C1C' }}>
                            {isPaid ? '✅ Paid Leave' : '📋 Unpaid Leave (deducted from salary)'}
                        </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                Start Date <span style={{ color: 'var(--color-primary)' }}>*</span>
                            </label>
                            <input type="date" value={form.startDate} min={today}
                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: f.endDate < e.target.value ? '' : f.endDate }))}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                End Date <span style={{ color: 'var(--color-primary)' }}>*</span>
                            </label>
                            <input type="date" value={form.endDate} min={form.startDate || today}
                                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                    </div>

                    {/* Duration pill */}
                    {duration > 0 && (
                        <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${willExceed ? '' : ''}`}
                            style={{
                                backgroundColor: willExceed ? '#FEE2E2' : '#DBEAFE',
                                color: willExceed ? '#B91C1C' : '#1D4ED8'
                            }}>
                            📅 {duration} {duration === 1 ? 'day' : 'days'}
                            {isPaid && remaining !== null && (
                                <span className="ml-auto text-xs font-normal opacity-80">
                                    {remaining} day(s) remaining in quota
                                </span>
                            )}
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="text-sm font-medium block mb-1" style={{ color: 'var(--color-text-primary)' }}>
                            Reason <span style={{ color: 'var(--color-primary)' }}>*</span>
                        </label>
                        <textarea value={form.reason}
                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            rows={3} placeholder="Briefly describe your reason for leave..."
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                        />
                    </div>

                    {error && (
                        <p className="text-sm px-3 py-2 rounded-lg" style={{ color: '#B91C1C', backgroundColor: '#FEE2E2' }}>
                            ⚠️ {error}
                        </p>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-colors"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading || isExhausted}
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
    const { data: leavesData, isLoading } = useGetMyLeavesQuery({});
    const { data: balanceData } = useGetLeaveBalanceQuery();

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

            {/* Leave Balance Breakdown */}
            {balanceArr.length > 0 && (
                <div className="rounded-xl border p-5 mb-6"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Leave Balance Breakdown</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {balanceArr.map((b: any) => {
                            const cfg = TYPE_CFG[b.type] || { label: b.type, emoji: '📝', bg: '#F3F4F6', color: '#6B7280' };
                            const pct = b.quota > 0 ? Math.round(((b.quota - (b.used || 0)) / b.quota) * 100) : 0;
                            const remaining = Math.max(0, b.quota - (b.used || 0));
                            if (b.quota === 0 && b.type !== 'unpaid') return null; // hide 0-quota types
                            if (b.type === 'unpaid') return null; // hide unpaid (unlimited)
                            return (
                                <div key={b.type} className="rounded-xl p-3 border"
                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <span>{cfg.emoji}</span>
                                        <span className="text-xs font-semibold capitalize" style={{ color: cfg.color }}>{cfg.label}</span>
                                    </div>
                                    <div className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                                        {remaining}
                                        <span className="text-sm font-normal" style={{ color: 'var(--color-text-muted)' }}> / {b.quota}</span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border-default)' }}>
                                        <div className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                                    </div>
                                    <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        {b.used || 0} used
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Leave History Table */}
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

            {/* FAB — Apply for Leave */}
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
                    balanceMap={balanceMap}
                />
            )}
        </div>
    );
}
