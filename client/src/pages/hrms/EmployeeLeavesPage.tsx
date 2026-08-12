import { useState } from 'react';
import { ListTodo, Plus, X, Loader2, Home, XCircle } from 'lucide-react';
import {
    useGetMyLeavesQuery,
    useGetLeaveBalanceQuery,
    useUpdateLeaveStatusMutation,
} from '@/features/hrms/hrmsApi';
import type { Leave } from '@/features/hrms';
import ModalPortal from '@/components/ui/ModalPortal';
import ApplyLeaveModal from '@/components/organisms/hrms/ApplyLeaveModal';

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
    sabbatical: { label: 'Sabbatical', emoji: '🧘‍♂️', bg: '#F3E8FF', color: '#6B21A8' },
    menstrual: { label: 'Menstrual', emoji: '🩸', bg: '#FEE2E2', color: '#991B1B' },
    wfh: { label: 'WFH', emoji: '💻', bg: '#FEF3C7', color: '#B45309' },
};

function LeaveTypeBadge({ type, isPaid }: { type: string; isPaid?: boolean }) {
    const cfg = TYPE_CFG[type] || { label: type, emoji: '📝', bg: '#F3F4F6', color: '#6B7280' };
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block w-fit"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.emoji} {cfg.label}
            </span>
            {/* WFH is neither paid nor unpaid — hide that label */}
            {type !== 'wfh' && (
                <span className="text-xs" style={{ color: isPaid ? '#15803D' : '#9D174D' }}>
                    {isPaid ? '✓ Paid' : '✗ Unpaid'}
                </span>
            )}
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────
function formatDate(iso: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
}

function formatShortDate(iso: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', timeZone: 'UTC',
    });
}

function formatDateRange(startDate: string, endDate: string, includeYear = true) {
    if (!startDate) return '';
    const sameDay = startDate === endDate || startDate.slice(0, 10) === endDate?.slice(0, 10);
    if (sameDay) {
        return includeYear ? formatDate(startDate) : formatShortDate(startDate);
    }

    if (includeYear) {
        return `${formatDate(startDate)} → ${formatDate(endDate)}`;
    }

    return `${formatShortDate(startDate)} → ${formatShortDate(endDate)}`;
}

// ── Cancel Leave Modal ─────────────────────────────────────────────────
function CancelLeaveModal({ leave, onClose, onConfirm, isLoading }: {
    leave: Leave;
    onClose: () => void;
    onConfirm: (id: string) => void;
    isLoading: boolean;
}) {
    const cfg = TYPE_CFG[(leave as any).type] || { label: (leave as any).type, emoji: '📝' };
    return (
        <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                onClick={onClose}
            >
                <div className="rounded-2xl border shadow-2xl w-full max-w-sm p-6"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Cancel Leave Request</h3>
                        <button onClick={onClose} className="p-1.5 rounded-lg cursor-pointer"
                            style={{ color: 'var(--color-text-muted)' }}>
                            <X size={18} />
                        </button>
                    </div>
                    <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                        Are you sure you want to cancel your {cfg.emoji} {cfg.label} leave request?
                        This action cannot be undone.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                        >
                            Keep Leave
                        </button>
                        <button
                            onClick={() => onConfirm(leave._id)}
                            disabled={isLoading}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
                            style={{ backgroundColor: '#DC2626' }}
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Yes, Cancel'}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function EmployeeLeavesPage() {
    const [showModal, setShowModal] = useState(false);
    const [cancelLeave, setCancelLeave] = useState<Leave | null>(null);
    // Leave data is not realtime — it only changes when an admin acts on a request.
    // The 5-min RTK Query cache (keepUnusedDataFor: 300) is sufficient.
    // Mutations in ApplyLeaveModal already invalidate 'Leaves' tags on submit.
    const { data: leavesData, isLoading } = useGetMyLeavesQuery({});
    const { data: balanceData } = useGetLeaveBalanceQuery(undefined);
    const [updateLeaveStatus, { isLoading: isCancelling }] = useUpdateLeaveStatusMutation();

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

    // Calculate metrics
    const earnedBal = balanceMap['earned'] || { quota: 0, used: 0, pending: 0 };
    const paidQuota = earnedBal.quota;
    const paidUsed = earnedBal.used;
    const paidRemaining = Math.max(0, paidQuota - paidUsed);

    const unpaidLeavesTaken = approvedThisYear
        .filter((l: any) => l.isPaid === false && l.type !== 'wfh')
        .reduce((sum, l: any) => sum + ((l as any).days || 1), 0);
    const wfhTaken = approvedThisYear
        .filter((l: any) => l.type === 'wfh')
        .reduce((sum, l: any) => sum + ((l as any).days || 1), 0);

    const handleCancelLeave = async (id: string) => {
        try {
            await updateLeaveStatus({ id, data: { status: 'cancelled' } }).unwrap();
            setCancelLeave(null);
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to cancel leave');
        }
    };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                        <ListTodo size={24} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                        
                        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Manage your leave balances and requests</p>
                    </div>
                </div>
            </div>

            {/* Leave Balance Metrics */}
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>Leave Balance</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {[
                    { label: 'Total Paid Leave Balance', value: paidQuota, color: '#1E40AF', bg: '#DBEAFE' },
                    { label: 'Paid Leaves taken', value: paidUsed, color: '#991B1B', bg: '#FEE2E2' },
                    { label: 'Paid Leaves balance pending', value: paidRemaining, color: '#15803D', bg: '#DCFCE7' },
                    { label: 'Unpaid Leaves taken', value: unpaidLeavesTaken, color: '#6B21A8', bg: '#F3E8FF' },
                    { label: 'Work from Home Taken', value: wfhTaken, icon: <Home size={16} />, color: '#B45309', bg: '#FEF3C7' },
                ].map((metric, idx) => (
                    <div key={idx} className="rounded-2xl p-4 flex flex-col justify-between border shadow-sm"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="text-xs font-semibold uppercase tracking-wider mb-3 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                            {metric.label}
                        </div>
                        <div className="text-3xl font-black flex items-center gap-2" style={{ color: metric.color }}>
                            {metric.icon && metric.icon} {metric.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Leave History Table */}
            <div className="rounded-2xl border shadow-sm overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                <div className="px-6 py-5 border-b flex items-center justify-between"
                    style={{ borderColor: 'var(--color-border-default)' }}>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>Leave History</h2>
                    {leaves.length > 0 && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                            {leaves.length} records
                        </span>
                    )}
                </div>
                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="py-24 text-center">
                        <div className="text-5xl mb-4">🌴</div>
                        <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>No leave history</h3>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            You haven&apos;t requested any leaves yet. Click below to apply!
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                    {['Type', 'Duration', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-6 py-4 text-left font-bold text-xs uppercase tracking-wider"
                                            style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {leaves.map((leave, i) => (
                                    <tr key={leave._id} className="hover:bg-black/5 transition-colors" style={{
                                        borderTop: i > 0 ? '1px solid var(--color-border-default)' : undefined
                                    }}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <LeaveTypeBadge
                                                type={(leave as any).type || 'earned'}
                                                isPaid={(leave as any).isPaid}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {formatDateRange(leave.startDate, leave.endDate)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                            {(leave as any).days ?? 1}
                                        </td>
                                        <td className="px-6 py-4 max-w-[200px] truncate" style={{ color: 'var(--color-text-secondary)' }}>
                                            {leave.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <LeaveStatusBadge status={leave.status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* Employee can only cancel their own PENDING leaves */}
                                            {leave.status === 'pending' && (
                                                <button
                                                    onClick={() => setCancelLeave(leave)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors"
                                                    style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C' }}
                                                    title="Cancel leave request"
                                                >
                                                    <XCircle size={13} /> Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* FAB — Apply for Leave */}
            <button
                onClick={() => setShowModal(true)}
                className="fixed bottom-10 right-10 flex items-center gap-2.5 px-6 py-4 rounded-2xl text-sm font-bold text-white shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-all z-40"
                style={{ backgroundColor: 'var(--color-primary)' }}>
                <Plus size={20} strokeWidth={3} />
                Apply for Leave
            </button>

            {/* Apply Leave Modal — shared organism with full two-column layout and live preview */}
            {showModal && (
                <ApplyLeaveModal onClose={() => setShowModal(false)} />
            )}

            {cancelLeave && (
                <CancelLeaveModal
                    leave={cancelLeave}
                    onClose={() => setCancelLeave(null)}
                    onConfirm={handleCancelLeave}
                    isLoading={isCancelling}
                />
            )}
        </div>
    );
}
