import { useState } from 'react';
import {
    useGetLeavesQuery,
    useGetEmployeesQuery,
    useUpdateLeaveStatusMutation,
    useDeleteLeaveMutation,
    useGetEmployeeLeaveBalanceQuery,
} from '@/features/hrms/hrmsApi';
import {
    Plus, X, Check, XCircle, Clock, Calendar, ChevronRight,
    ArrowLeft, AlertCircle, User, Loader2, FileText, Eye, Pencil, Trash2,
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import ApplyLeaveModal from '@/components/organisms/hrms/ApplyLeaveModal';

// ── Types ────────────────────────────────────────────────────────────
const LEAVE_TYPES = ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'paternity', 'sabbatical', 'menstrual', 'wfh'] as const;
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
        sabbatical: { bg: '#F3E8FF', color: '#6B21A8' },
        menstrual: { bg: '#FEE2E2', color: '#991B1B' },
        wfh: { bg: '#FEF3C7', color: '#B45309' },
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

function formatLeaveDate(date: string) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function formatShortLeaveDate(date: string) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    });
}

function formatLeaveDateRange(startDate: string, endDate: string, includeYear = true) {
    const sameDay = startDate === endDate || startDate.slice(0, 10) === endDate.slice(0, 10);
    if (sameDay) {
        return includeYear ? formatLeaveDate(startDate) : formatShortLeaveDate(startDate);
    }

    if (includeYear) {
        return `${formatLeaveDate(startDate)} to ${formatLeaveDate(endDate)}`;
    }

    return `${formatShortLeaveDate(startDate)} → ${formatShortLeaveDate(endDate)}`;
}

function getLeaveEmployee(leave: any) {
    return leave.employeeId as any;
}

// ── Reject Reason Modal ───────────────────────────────────────────────
function RejectModal({
    leaveId, onClose, onConfirm,
}: { leaveId: string; onClose: () => void; onConfirm: (id: string, reason: string) => void }) {
    const [reason, setReason] = useState('');
    return (
        <ModalPortal>

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
        </ModalPortal>
    );
}

function DeleteLeaveModal({
    leave,
    onClose,
    onConfirm,
    isLoading,
}: {
    leave: any;
    onClose: () => void;
    onConfirm: (id: string) => void;
    isLoading: boolean;
}) {
    const emp = getLeaveEmployee(leave);

    return (
        <ModalPortal>
            <div
                className="w-full max-w-md rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={18} style={{ color: '#EF4444' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Delete Leave Request</h3>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                    Delete the leave request for <span className="font-medium">{emp?.userId?.name || 'this employee'}</span>?
                    This will also reverse approved leave effects like attendance and paid leave balance where applicable.
                </p>
                <div
                    className="rounded-lg px-4 py-3 mb-5"
                    style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    <div className="text-sm font-medium capitalize" style={{ color: 'var(--color-text-primary)' }}>{leave.type} leave</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {formatLeaveDateRange(leave.startDate, leave.endDate)} · {leave.days} day{leave.days !== 1 ? 's' : ''}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => onConfirm(leave._id)}
                        disabled={isLoading}
                        className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: '#EF4444' }}
                    >
                        {isLoading ? 'Deleting...' : 'Delete'}
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
        </ModalPortal>
    );
}

function EditLeaveStatusModal({
    leave,
    onClose,
    onConfirm,
    isLoading,
}: {
    leave: any;
    onClose: () => void;
    onConfirm: (
        id: string,
        status: 'approved' | 'rejected' | 'cancelled',
        reason: string,
        type: LeaveType,
        isPaid: boolean
    ) => void;
    isLoading: boolean;
}) {
    const [status, setStatus] = useState<'approved' | 'rejected' | 'cancelled'>(
        leave.status === 'pending' ? 'approved' : leave.status
    );
    const [type, setType] = useState<LeaveType>(leave.type as LeaveType);
    const [isPaid, setIsPaid] = useState<boolean>(leave.isPaid !== false);
    const [reason, setReason] = useState(leave.rejectionReason || '');
    const emp = getLeaveEmployee(leave);

    return (
        <ModalPortal>
            <div
                className="w-full max-w-lg rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex items-center gap-2 mb-5">
                    <Pencil size={18} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Edit Leave Status</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {emp?.userId?.name || 'Employee'} · {leave.type} leave
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Leave Type
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {LEAVE_TYPES.map((t) => {
                                const c = typeCfg(t);
                                const selected = type === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            setType(t);
                                            if (t === 'unpaid') {
                                                setIsPaid(false);
                                            }
                                        }}
                                        className="px-3 py-1.5 text-xs font-medium rounded-full border cursor-pointer capitalize transition-all"
                                        style={{
                                            backgroundColor: selected ? c.bg : 'var(--color-bg-surface)',
                                            color: selected ? c.color : 'var(--color-text-muted)',
                                            borderColor: selected ? c.color + '60' : 'var(--color-border-default)',
                                            fontWeight: selected ? 600 : 400,
                                        }}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Leave Treatment
                        </label>
                        <div
                            className="flex rounded-lg border overflow-hidden w-fit"
                            style={{ borderColor: 'var(--color-border-default)' }}
                        >
                            {([true, false] as const).map((paid) => {
                                const disabled = type === 'unpaid' && paid;
                                return (
                                    <button
                                        key={String(paid)}
                                        type="button"
                                        onClick={() => {
                                            if (!disabled) {
                                                setIsPaid(paid);
                                            }
                                        }}
                                        disabled={disabled}
                                        className="px-4 py-2 text-sm font-medium cursor-pointer transition-all disabled:opacity-40"
                                        style={{
                                            backgroundColor: isPaid === paid
                                                ? (paid ? 'var(--color-primary)' : '#EF4444')
                                                : 'var(--color-bg-surface)',
                                            color: isPaid === paid ? 'white' : 'var(--color-text-muted)',
                                        }}
                                    >
                                        {paid ? 'Paid' : 'Unpaid'}
                                    </button>
                                );
                            })}
                        </div>
                        {type === 'unpaid' && (
                            <p className="text-xs mt-1.5" style={{ color: '#EF4444' }}>
                                Unpaid leave type is always treated as unpaid.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Status
                        </label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as 'approved' | 'rejected' | 'cancelled')}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        >
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Rejection Reason
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            placeholder={status === 'rejected' ? 'Add reason for rejection' : 'Optional note'}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />
                    </div>

                    <div
                        className="rounded-lg px-4 py-3"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            {formatLeaveDateRange(leave.startDate, leave.endDate)}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Changing the status will also update leave-linked attendance and paid leave balance.
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-5">
                    <button
                        onClick={() => onConfirm(leave._id, status, reason, type, isPaid)}
                        disabled={isLoading}
                        className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
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
        </ModalPortal>
    );
}

function ViewLeaveModal({ leave, onClose }: { leave: any; onClose: () => void }) {
    const emp = getLeaveEmployee(leave);

    return (
        <ModalPortal>
            <div
                className="w-full max-w-xl rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Eye size={18} style={{ color: 'var(--color-primary)' }} />
                        <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Leave Request Details</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded cursor-pointer hover:bg-gray-100">
                        <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Employee</p>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{emp?.userId?.name || '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Status</p>
                        <StatusBadge status={leave.status} />
                    </div>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Leave Type</p>
                        <LeaveBadge type={leave.type} />
                    </div>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Payment</p>
                        <span
                            className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{
                                backgroundColor: leave.isPaid ? '#DCFCE7' : '#FEE2E2',
                                color: leave.isPaid ? '#15803D' : '#991B1B',
                            }}
                        >
                            {leave.isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Start Date</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{formatLeaveDate(leave.startDate)}</p>
                    </div>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>End Date</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{formatLeaveDate(leave.endDate)}</p>
                    </div>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Days</p>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{leave.days}</p>
                    </div>
                    <div>
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Processed By</p>
                        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{leave.approvedBy?.name || '—'}</p>
                    </div>
                </div>

                <div className="mt-4">
                    <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Reason</p>
                    <div
                        className="rounded-lg px-4 py-3 text-sm"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}
                    >
                        {leave.reason}
                    </div>
                </div>

                {leave.rejectionReason && (
                    <div className="mt-4">
                        <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Rejection Reason</p>
                        <div
                            className="rounded-lg px-4 py-3 text-sm"
                            style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}
                        >
                            {leave.rejectionReason}
                        </div>
                    </div>
                )}

                <div className="flex justify-end mt-5">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </ModalPortal>
    );
}

// ── Employee Leave Detail View ───────────────────────────────────────────────
function EmployeeLeaveDetail({ emp, onBack }: { emp: any; onBack: () => void }) {
    const currentYear = new Date().getFullYear();
    const { data, isLoading } = useGetLeavesQuery({ employeeId: emp._id });
    const { data: balanceData } = useGetEmployeeLeaveBalanceQuery(
        { employeeId: emp._id, year: currentYear }
    );

    const leaves = (data?.data?.leaves || []) as any[];
    const balanceArr = (balanceData?.data?.balance || []) as any[];
    const leaveSummary = balanceData?.data?.leaveSummary;

    // Use real balance data from LeaveBalance model (synced by backend)
    const earnedBalance = balanceArr.find((b: any) => b.type === 'earned');
    const paidQuota = earnedBalance?.quota ?? (emp as any).paidLeavesPerYear ?? 12;
    const totalPaid = earnedBalance?.used ?? leaveSummary?.paid?.days ?? 0;
    const paidRemaining = earnedBalance?.pending ?? Math.max(0, paidQuota - totalPaid);

    // WFH is separate — not paid or unpaid leave
    const totalUnpaid = leaveSummary?.unpaid?.days ?? 0;
    const totalWfh = leaveSummary?.wfh?.days ?? 0;
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
            <div className="grid grid-cols-5 gap-4 mb-6">
                {[
                    { label: `Paid Leaves Remaining (${currentYear})`, value: `${paidRemaining}/${paidQuota}`, color: '#2563EB' },
                    { label: `Paid Leaves Taken (${currentYear})`, value: totalPaid, color: '#16A34A' },
                    { label: `Unpaid Leaves Taken (${currentYear})`, value: totalUnpaid, color: '#EF4444' },
                    { label: `WFH Days (${currentYear})`, value: totalWfh, color: '#B45309' },
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
                                        {formatLeaveDateRange(leave.startDate, leave.endDate, false)}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{leave.days}</td>
                                    <td className="px-4 py-3">
                                        {leave.type === 'wfh' ? (
                                            <span
                                                className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}
                                            >
                                                WFH
                                            </span>
                                        ) : (
                                            <span
                                                className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: leave.isPaid ? '#DCFCE7' : '#FEE2E2',
                                                    color: leave.isPaid ? '#15803D' : '#991B1B',
                                                }}
                                            >
                                                {leave.isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        )}
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
    const [viewingLeave, setViewingLeave] = useState<any>(null);
    const [editingLeave, setEditingLeave] = useState<any>(null);
    const [deletingLeave, setDeletingLeave] = useState<any>(null);

    // Status filter for "All Requests" tab
    const [statusFilter, setStatusFilter] = useState('');

    const { data: allLeavesData, isLoading: loadingAll, refetch: refetchAll } = useGetLeavesQuery({
        status: statusFilter || undefined,
    });
    const { data: pendingData, isLoading: loadingPending, refetch: refetchPending } = useGetLeavesQuery({ status: 'pending' });
    const { data: empsData, isLoading: loadingEmps } = useGetEmployeesQuery({ limit: 100 });

    const [updateStatus, { isLoading: updatingStatus }] = useUpdateLeaveStatusMutation();
    const [deleteLeave, { isLoading: deletingLeaveRequest }] = useDeleteLeaveMutation();

    const allLeaves = (allLeavesData?.data?.leaves || []) as any[];
    const pendingLeaves = (pendingData?.data?.leaves || []) as any[];
    const employees = (empsData?.data?.employees || []) as any[];

    const refreshLeaveLists = async () => {
        await Promise.all([refetchAll(), refetchPending()]);
    };

    const handleApprove = async (id: string) => {
        try {
            await updateStatus({ id, data: { status: 'approved' } }).unwrap();
            await refreshLeaveLists();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to approve leave request');
        }
    };

    const handleReject = async (id: string, reason: string) => {
        try {
            await updateStatus({ id, data: { status: 'rejected', rejectionReason: reason } }).unwrap();
            setRejectingId(null);
            await refreshLeaveLists();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to reject leave request');
        }
    };

    const handleEditStatus = async (
        id: string,
        status: 'approved' | 'rejected' | 'cancelled',
        reason: string,
        type: LeaveType,
        isPaid: boolean
    ) => {
        try {
            await updateStatus({
                id,
                data: {
                    status,
                    rejectionReason: status === 'rejected' ? reason : undefined,
                    type,
                    isPaid,
                },
            }).unwrap();
            setEditingLeave(null);
            await refreshLeaveLists();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to update leave status');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteLeave(id).unwrap();
            setDeletingLeave(null);
            setViewingLeave(null);
            await refreshLeaveLists();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to delete leave request');
        }
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
                                                        {formatLeaveDateRange(leave.startDate, leave.endDate)}
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
                                                    {leave.type === 'wfh' ? (
                                                        <span
                                                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                            style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}
                                                        >
                                                            WFH
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                            style={{
                                                                backgroundColor: leave.isPaid ? '#DCFCE7' : '#FEE2E2',
                                                                color: leave.isPaid ? '#15803D' : '#991B1B',
                                                            }}
                                                        >
                                                            {leave.isPaid !== false ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                    {formatLeaveDateRange(leave.startDate, leave.endDate, false)}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{leave.days}</td>
                                                <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                    {leave.reason}
                                                </td>
                                                <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {leave.status === 'pending' && (
                                                            <>
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
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => setViewingLeave(leave)}
                                                            className="p-1.5 rounded border cursor-pointer"
                                                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                                                            title="View leave request"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingLeave(leave)}
                                                            className="p-1.5 rounded border cursor-pointer"
                                                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-primary)' }}
                                                            title="Edit leave status"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingLeave(leave)}
                                                            className="p-1.5 rounded border cursor-pointer"
                                                            style={{ borderColor: '#FECACA', color: '#DC2626' }}
                                                            title="Delete leave request"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
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
                                        {['Employee', 'Department', 'Designation', 'Paid Leaves Available', 'Details'].map((h) => (
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
            {viewingLeave && (
                <ViewLeaveModal
                    leave={viewingLeave}
                    onClose={() => setViewingLeave(null)}
                />
            )}
            {editingLeave && (
                <EditLeaveStatusModal
                    leave={editingLeave}
                    onClose={() => setEditingLeave(null)}
                    onConfirm={handleEditStatus}
                    isLoading={updatingStatus}
                />
            )}
            {deletingLeave && (
                <DeleteLeaveModal
                    leave={deletingLeave}
                    onClose={() => setDeletingLeave(null)}
                    onConfirm={handleDelete}
                    isLoading={deletingLeaveRequest}
                />
            )}
        </div>
    );
}
