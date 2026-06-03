import { useState } from 'react';
import { ListTodo, Plus, X, Loader2, Calendar, FileText, Home, XCircle } from 'lucide-react';
import {
    useGetMyLeavesQuery,
    useGetLeaveBalanceQuery,
    useCreateLeaveMutation,
    useUpdateLeaveStatusMutation,
    useGetHolidaysQuery
} from '@/features/hrms/hrmsApi';
import type { Leave } from '@/features/hrms';
import ModalPortal from '@/components/ui/ModalPortal';

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

// ── Apply Leave Modal ─────────────────────────────────────────────────
function ApplyLeaveModal({ onClose, paidRemaining, holidays, leaves }: { onClose: () => void, paidRemaining: number, holidays: any[], leaves: Leave[] }) {
    const [createLeave, { isLoading }] = useCreateLeaveMutation();
    const [durationTab, setDurationTab] = useState<'single' | 'multiple'>('single');
    const [form, setForm] = useState({
        type: 'casual',
        startDate: '',
        endDate: '',
        startHalfDay: false,
        endHalfDay: false,
        reason: '',
        isPaid: paidRemaining > 0 ? true : false,
    });



    const computeWorkingDays = () => {
        if (!form.startDate) return { days: 0, excludedSundays: 0, excludedHolidays: 0 };
        const start = new Date(form.startDate);
        let end = start;
        if (durationTab === 'multiple' && form.endDate) {
            end = new Date(form.endDate);
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return { days: 0, excludedSundays: 0, excludedHolidays: 0 };

        let workingDays = 0;
        let excludedSundays = 0;
        let excludedHolidays = 0;
        const curr = new Date(start);
        
        while (curr <= end) {
            const dayOfWeek = curr.getUTCDay(); // 0 is Sunday
            if (dayOfWeek === 0) {
                excludedSundays++;
            } else {
                const isHoliday = holidays.some(h => {
                    const hDate = new Date(h.date);
                    return hDate.getUTCFullYear() === curr.getUTCFullYear() && 
                           hDate.getUTCMonth() === curr.getUTCMonth() && 
                           hDate.getUTCDate() === curr.getUTCDate();
                });
                if (isHoliday) {
                    excludedHolidays++;
                } else {
                    workingDays++;
                }
            }
            curr.setUTCDate(curr.getUTCDate() + 1);
        }

        if (workingDays === 0) return { days: 0, excludedSundays, excludedHolidays };

        if (durationTab === 'single') {
            return { days: form.startHalfDay ? 0.5 : 1, excludedSundays, excludedHolidays };
        } else {
            let deduct = 0;
            // only deduct if the start/end date itself is not a Sunday/Holiday
            const startIsWorking = new Date(form.startDate).getUTCDay() !== 0 && !holidays.some(h => h.date.startsWith(form.startDate));
            const endIsWorking = form.endDate && new Date(form.endDate).getUTCDay() !== 0 && !holidays.some(h => h.date.startsWith(form.endDate));
            
            if (form.startHalfDay && startIsWorking) deduct += 0.5;
            if (form.endHalfDay && endIsWorking && form.startDate !== form.endDate) deduct += 0.5;
            
            return { days: Math.max(0.5, workingDays - deduct), excludedSundays, excludedHolidays };
        }
    };

    const { days, excludedSundays, excludedHolidays } = computeWorkingDays();

    const checkOverlap = () => {
        if (!form.startDate) return false;
        const startStr = form.startDate;
        const endStr = durationTab === 'multiple' && form.endDate ? form.endDate : form.startDate;

        const sy = parseInt(startStr.slice(0, 4), 10);
        const sm = parseInt(startStr.slice(5, 7), 10);
        const sd = parseInt(startStr.slice(8, 10), 10);
        const ey = parseInt(endStr.slice(0, 4), 10);
        const em = parseInt(endStr.slice(5, 7), 10);
        const ed = parseInt(endStr.slice(8, 10), 10);

        if (isNaN(sy) || isNaN(ey)) return false;

        const startUtc = new Date(Date.UTC(sy, sm - 1, sd));
        const endUtc = new Date(Date.UTC(ey, em - 1, ed));

        return leaves.some(l => {
            if (l.status === 'rejected' || l.status === 'cancelled') return false;
            const lStart = new Date(l.startDate);
            const lEnd = new Date(l.endDate);
            return lStart <= endUtc && lEnd >= startUtc;
        });
    };
    
    const isOverlapping = checkOverlap();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                type: form.type,
                startDate: form.startDate,
                endDate: durationTab === 'multiple' ? (form.endDate || form.startDate) : form.startDate,
                days: days,
                reason: form.reason || 'Leave requested',
                isPaid: form.type === 'wfh' ? false : form.isPaid
            };
            await createLeave(payload).unwrap();
            onClose();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to apply leave');
        }
    };

    const TYPES = ['casual', 'sick', 'sabbatical', 'menstrual', 'wfh'];

    return (
        <ModalPortal className="items-center">
            <div className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b"
                    style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center gap-2">
                        <Calendar size={20} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Apply for Leave
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                        <X size={20} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2">
                    {/* Primary Column (Inputs) */}
                    <div className="p-6 space-y-6 border-r" style={{ borderColor: 'var(--color-border-default)' }}>
                        {/* 1. Leave Type */}
                        <div>
                            <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                Choose Leave Type
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {TYPES.map(t => {
                                    const cfg = TYPE_CFG[t];
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

                        {/* 2. Leave Duration Tabs */}
                        <div>
                            <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                Leave Duration
                            </label>
                            <div className="flex rounded-lg border overflow-hidden w-full mb-3" style={{ borderColor: 'var(--color-border-default)' }}>
                                <button type="button" onClick={() => setDurationTab('single')}
                                    className="flex-1 py-2 text-sm font-medium transition-all"
                                    style={{
                                        backgroundColor: durationTab === 'single' ? 'var(--color-bg-subtle)' : 'transparent',
                                        color: durationTab === 'single' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                                    }}>
                                    Single Day / Half Day
                                </button>
                                <button type="button" onClick={() => setDurationTab('multiple')}
                                    className="flex-1 py-2 text-sm font-medium transition-all"
                                    style={{
                                        backgroundColor: durationTab === 'multiple' ? 'var(--color-bg-subtle)' : 'transparent',
                                        color: durationTab === 'multiple' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
                                    }}>
                                    Multiple Days
                                </button>
                            </div>

                            {durationTab === 'single' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Date *</label>
                                        <input type="date" required value={form.startDate}
                                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer w-fit text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                        <input type="checkbox" checked={form.startHalfDay} onChange={e => setForm(f => ({ ...f, startHalfDay: e.target.checked }))} className="w-4 h-4" />
                                        Half Day
                                    </label>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>Start Date *</label>
                                            <input type="date" required value={form.startDate}
                                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer w-fit text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                            <input type="checkbox" checked={form.startHalfDay} onChange={e => setForm(f => ({ ...f, startHalfDay: e.target.checked }))} className="w-4 h-4" />
                                            Start as Half Day
                                        </label>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-text-secondary)' }}>End Date *</label>
                                            <input type="date" required value={form.endDate} min={form.startDate}
                                                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer w-fit text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                            <input type="checkbox" checked={form.endHalfDay} onChange={e => setForm(f => ({ ...f, endHalfDay: e.target.checked }))} className="w-4 h-4" />
                                            End as Half Day
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Leave Treatment */}
                        {form.type !== 'wfh' && (
                        <div>
                            <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                Leave Treatment
                            </label>
                            <div className="flex rounded-lg border overflow-hidden w-full"
                                style={{ borderColor: 'var(--color-border-default)' }}>
                                {([true, false] as const).map((paid) => {
                                    const disabled = paid && paidRemaining <= 0;
                                    return (
                                        <button
                                            key={String(paid)}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => setForm(f => ({ ...f, isPaid: paid }))}
                                            className={`flex-1 px-4 py-2 text-sm font-medium transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                                            style={{
                                                backgroundColor: form.isPaid === paid
                                                    ? (paid ? '#15803D' : '#EF4444')
                                                    : 'var(--color-bg-subtle)',
                                                color: form.isPaid === paid ? 'white' : 'var(--color-text-muted)',
                                            }}
                                        >
                                            {paid ? '💰 Paid Leave' : '⛔ Unpaid Leave'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        )}

                        {/* Reason */}
                        <div>
                            <label className="text-sm font-semibold block mb-2" style={{ color: 'var(--color-text-primary)' }}>
                                Reason (Optional)
                            </label>
                            <textarea value={form.reason}
                                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                rows={2} placeholder="Briefly describe your reason..."
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                            />
                        </div>
                    </div>

                    {/* Secondary Column (Preview) */}
                    <div className="p-6 flex flex-col justify-between" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                        <div>
                            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <FileText size={16} /> Summary Preview
                            </h3>
                            
                            {form.startDate ? (
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl border bg-white shadow-sm" style={{ borderColor: 'var(--color-border-default)' }}>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Leave Type</span>
                                            <span className="text-sm font-bold capitalize" style={{ color: 'var(--color-text-primary)' }}>{form.type}</span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Dates</span>
                                            <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                {formatDateRange(form.startDate, durationTab === 'multiple' ? form.endDate : form.startDate, false)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Treatment</span>
                                            <span className="text-sm font-bold" style={{ color: form.isPaid ? '#15803D' : '#EF4444' }}>
                                                {form.isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pt-3 border-t mt-3" style={{ borderColor: 'var(--color-border-default)' }}>
                                            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Total Working Days</span>
                                            <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{days}</span>
                                        </div>
                                        <p className="text-xs text-right mt-1 opacity-70 italic">
                                            Excludes {excludedSundays} Sunday(s) & {excludedHolidays} Holiday(s)
                                        </p>
                                    </div>
                                    
                                    {isOverlapping && (
                                        <div className="p-3 rounded-lg border text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}>
                                            <strong className="block mb-1">Error:</strong>
                                            You already have a pending or approved leave application for the selected dates.
                                        </div>
                                    )}

                                    {form.type !== 'wfh' && (
                                        <div className="p-3 rounded-lg border text-sm" style={{ backgroundColor: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E' }}>
                                            <strong className="block mb-1">Note:</strong>
                                            You currently have <strong>{paidRemaining}</strong> paid leave days remaining.
                                            {days > paidRemaining && form.isPaid && (
                                                <span className="block mt-1 text-red-600">
                                                    Warning: You are requesting {days - paidRemaining} more paid day(s) than you have left! These extra days will be treated as unpaid leaves.
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm italic opacity-60 text-center mt-10">
                                    Fill in the form to see a live preview of your leave application.
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-6">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-colors"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)', backgroundColor: 'white' }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={isLoading || days === 0 || isOverlapping}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                                style={{ backgroundColor: 'var(--color-primary)' }}>
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                                Apply Leave
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </ModalPortal>
    );
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
    const { data: leavesData, isLoading } = useGetMyLeavesQuery({}, { refetchOnMountOrArgChange: true, pollingInterval: 30000 });
    const { data: balanceData } = useGetLeaveBalanceQuery(undefined, { refetchOnMountOrArgChange: true, pollingInterval: 30000 });
    const { data: holidaysData } = useGetHolidaysQuery({}, { refetchOnMountOrArgChange: true });
    const [updateLeaveStatus, { isLoading: isCancelling }] = useUpdateLeaveStatusMutation();

    const leaves: Leave[] = (leavesData?.data as any)?.leaves || [];
    const balanceArr: any[] = (balanceData?.data as any)?.balance || [];
    const holidays = (holidaysData?.data as any)?.holidays || [];

    // Build quick lookup map: type → { quota, used, pending }
    const balanceMap: Record<string, { quota: number; used: number; pending: number }> = {};
    balanceArr.forEach((b: any) => { balanceMap[b.type] = b; });

    // Stats
    const currentYear = new Date().getFullYear();
    const approvedThisYear = leaves.filter(l =>
        l.status === 'approved' && new Date(l.startDate).getFullYear() === currentYear
    );
    
    // Calculate new metrics
    const earnedBal = balanceMap['earned'] || { quota: 0, used: 0, pending: 0 };
    const paidQuota = earnedBal.quota;
    const paidUsed = earnedBal.used;
    const paidRemaining = Math.max(0, paidQuota - paidUsed);

    const unpaidLeavesTaken = approvedThisYear.filter((l: any) => l.isPaid === false && l.type !== 'wfh').reduce((sum, l: any) => sum + ((l as any).days || 1), 0);
    const wfhTaken = approvedThisYear.filter((l: any) => l.type === 'wfh').reduce((sum, l: any) => sum + ((l as any).days || 1), 0);

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
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>My Leaves</h1>
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
                            You haven't requested any leaves yet. Click below to apply!
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

            {showModal && (
                <ApplyLeaveModal
                    onClose={() => setShowModal(false)}
                    paidRemaining={paidRemaining}
                    holidays={holidays}
                    leaves={leaves}
                />
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
