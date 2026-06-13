import { useState } from 'react';
import { X, Calendar, FileText, Loader2 } from 'lucide-react';
import {
    useCreateLeaveMutation,
    useGetHolidaysQuery,
    useGetLeaveBalanceQuery,
    useGetMyLeavesQuery,
} from '@/features/hrms/hrmsApi';
import type { Leave } from '@/features/hrms';
import ModalPortal from '@/components/ui/ModalPortal';

// ── Leave type display config ─────────────────────────────────────────
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

const APPLY_TYPES = ['casual', 'sick', 'sabbatical', 'menstrual', 'wfh'] as const;

// ── Helpers ───────────────────────────────────────────────────────────
function formatShortDate(iso: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', timeZone: 'UTC',
    });
}

function formatDateRange(startDate: string, endDate: string) {
    if (!startDate) return '';
    const sameDay = startDate === endDate || startDate.slice(0, 10) === endDate?.slice(0, 10);
    if (sameDay) return formatShortDate(startDate);
    return `${formatShortDate(startDate)} → ${formatShortDate(endDate)}`;
}

// ── Props ─────────────────────────────────────────────────────────────
export interface ApplyLeaveModalProps {
    onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────
export default function ApplyLeaveModal({ onClose }: ApplyLeaveModalProps) {
    const [createLeave, { isLoading }] = useCreateLeaveMutation();
    const [durationTab, setDurationTab] = useState<'single' | 'multiple'>('single');
    const [form, setForm] = useState({
        type: 'casual',
        startDate: '',
        endDate: '',
        startHalfDay: false,
        endHalfDay: false,
        reason: '',
        isPaid: true,
    });

    // Fetch balance, holidays, and existing leaves from the API
    const { data: balanceData } = useGetLeaveBalanceQuery(undefined, { refetchOnMountOrArgChange: true });
    const { data: holidaysData } = useGetHolidaysQuery({}, { refetchOnMountOrArgChange: true });
    const { data: leavesData } = useGetMyLeavesQuery({}, { refetchOnMountOrArgChange: true });

    const balanceArr: any[] = (balanceData?.data as any)?.balance || [];
    const holidays: any[] = (holidaysData?.data as any)?.holidays || [];
    const leaves: Leave[] = (leavesData?.data as any)?.leaves || [];

    // Calculate paid leave balance
    const earnedBal = balanceArr.find((b: any) => b.type === 'earned') || { quota: 0, used: 0 };
    const paidRemaining = Math.max(0, earnedBal.quota - earnedBal.used);

    // Initialise isPaid based on balance on first render via memo effect is not needed
    // We let paidRemaining drive the disabled state of the Paid button instead.

    const computeWorkingDays = () => {
        if (!form.startDate) return { days: 0, excludedSundays: 0, excludedHolidays: 0 };
        const start = new Date(form.startDate);
        let end = start;
        if (durationTab === 'multiple' && form.endDate) {
            end = new Date(form.endDate);
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
            return { days: 0, excludedSundays: 0, excludedHolidays: 0 };
        }

        let workingDays = 0;
        let excludedSundays = 0;
        let excludedHolidays = 0;
        const curr = new Date(start);

        while (curr <= end) {
            const dayOfWeek = curr.getUTCDay();
            if (dayOfWeek === 0) {
                excludedSundays++;
            } else {
                const isHoliday = holidays.some((h) => {
                    const hDate = new Date(h.date);
                    return (
                        hDate.getUTCFullYear() === curr.getUTCFullYear() &&
                        hDate.getUTCMonth() === curr.getUTCMonth() &&
                        hDate.getUTCDate() === curr.getUTCDate()
                    );
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
        }

        let deduct = 0;
        const startIsWorking =
            new Date(form.startDate).getUTCDay() !== 0 &&
            !holidays.some((h) => h.date.startsWith(form.startDate));
        const endIsWorking =
            form.endDate &&
            new Date(form.endDate).getUTCDay() !== 0 &&
            !holidays.some((h) => h.date.startsWith(form.endDate));

        if (form.startHalfDay && startIsWorking) deduct += 0.5;
        if (form.endHalfDay && endIsWorking && form.startDate !== form.endDate) deduct += 0.5;

        return { days: Math.max(0.5, workingDays - deduct), excludedSundays, excludedHolidays };
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

        return leaves.some((l) => {
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
                days,
                reason: form.reason || 'Leave requested',
                // WFH is treated as a separate category — not paid, not unpaid
                isPaid: form.type === 'wfh' ? false : form.isPaid,
            };
            await createLeave(payload).unwrap();
            onClose();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to apply leave');
        }
    };

    return (
        <ModalPortal className="items-center">
            <div
                className="w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-5 border-b"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
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
                    {/* ── Left column: Inputs ── */}
                    <div className="p-6 space-y-6 border-r" style={{ borderColor: 'var(--color-border-default)' }}>
                        {/* 1. Leave Type */}
                        <div>
                            <label
                                className="text-sm font-semibold block mb-2"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Choose Leave Type
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {APPLY_TYPES.map((t) => {
                                    const cfg = TYPE_CFG[t];
                                    const sel = form.type === t;
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setForm((f) => ({ ...f, type: t }))}
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
                            <label
                                className="text-sm font-semibold block mb-2"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Leave Duration
                            </label>
                            <div
                                className="flex rounded-lg border overflow-hidden w-full mb-3"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setDurationTab('single')}
                                    className="flex-1 py-2 text-sm font-medium transition-all"
                                    style={{
                                        backgroundColor:
                                            durationTab === 'single' ? 'var(--color-bg-subtle)' : 'transparent',
                                        color:
                                            durationTab === 'single'
                                                ? 'var(--color-text-primary)'
                                                : 'var(--color-text-muted)',
                                    }}
                                >
                                    Single Day / Half Day
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDurationTab('multiple')}
                                    className="flex-1 py-2 text-sm font-medium transition-all"
                                    style={{
                                        backgroundColor:
                                            durationTab === 'multiple' ? 'var(--color-bg-subtle)' : 'transparent',
                                        color:
                                            durationTab === 'multiple'
                                                ? 'var(--color-text-primary)'
                                                : 'var(--color-text-muted)',
                                    }}
                                >
                                    Multiple Days
                                </button>
                            </div>

                            {durationTab === 'single' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label
                                            className="text-xs font-medium block mb-1"
                                            style={{ color: 'var(--color-text-secondary)' }}
                                        >
                                            Date *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={form.startDate}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, startDate: e.target.value }))
                                            }
                                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                            style={{
                                                borderColor: 'var(--color-border-default)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                                color: 'var(--color-text-primary)',
                                            }}
                                        />
                                    </div>
                                    <label
                                        className="flex items-center gap-2 cursor-pointer w-fit text-sm"
                                        style={{ color: 'var(--color-text-primary)' }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={form.startHalfDay}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, startHalfDay: e.target.checked }))
                                            }
                                            className="w-4 h-4"
                                        />
                                        Half Day
                                    </label>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                        <div>
                                            <label
                                                className="text-xs font-medium block mb-1"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                Start Date *
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={form.startDate}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, startDate: e.target.value }))
                                                }
                                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                                style={{
                                                    borderColor: 'var(--color-border-default)',
                                                    backgroundColor: 'var(--color-bg-surface)',
                                                    color: 'var(--color-text-primary)',
                                                }}
                                            />
                                        </div>
                                        <label
                                            className="flex items-center gap-2 cursor-pointer w-fit text-sm"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.startHalfDay}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, startHalfDay: e.target.checked }))
                                                }
                                                className="w-4 h-4"
                                            />
                                            Start as Half Day
                                        </label>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label
                                                className="text-xs font-medium block mb-1"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                End Date *
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={form.endDate}
                                                min={form.startDate}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, endDate: e.target.value }))
                                                }
                                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                                                style={{
                                                    borderColor: 'var(--color-border-default)',
                                                    backgroundColor: 'var(--color-bg-surface)',
                                                    color: 'var(--color-text-primary)',
                                                }}
                                            />
                                        </div>
                                        <label
                                            className="flex items-center gap-2 cursor-pointer w-fit text-sm"
                                            style={{ color: 'var(--color-text-primary)' }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.endHalfDay}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, endHalfDay: e.target.checked }))
                                                }
                                                className="w-4 h-4"
                                            />
                                            End as Half Day
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. Leave Treatment (hidden for WFH) */}
                        {form.type !== 'wfh' && (
                            <div>
                                <label
                                    className="text-sm font-semibold block mb-2"
                                    style={{ color: 'var(--color-text-primary)' }}
                                >
                                    Leave Treatment
                                </label>
                                <div
                                    className="flex rounded-lg border overflow-hidden w-full"
                                    style={{ borderColor: 'var(--color-border-default)' }}
                                >
                                    {([true, false] as const).map((paid) => {
                                        const disabled = paid && paidRemaining <= 0;
                                        return (
                                            <button
                                                key={String(paid)}
                                                type="button"
                                                disabled={disabled}
                                                onClick={() => setForm((f) => ({ ...f, isPaid: paid }))}
                                                className={`flex-1 px-4 py-2 text-sm font-medium transition-all ${
                                                    disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                                                }`}
                                                style={{
                                                    backgroundColor:
                                                        form.isPaid === paid
                                                            ? paid
                                                                ? '#15803D'
                                                                : '#EF4444'
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

                        {/* 4. Reason */}
                        <div>
                            <label
                                className="text-sm font-semibold block mb-2"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                Reason (Optional)
                            </label>
                            <textarea
                                value={form.reason}
                                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                                rows={2}
                                placeholder="Briefly describe your reason..."
                                className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        </div>
                    </div>

                    {/* ── Right column: Live Preview ── */}
                    <div
                        className="p-6 flex flex-col justify-between"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        <div>
                            <h3
                                className="font-semibold mb-4 flex items-center gap-2"
                                style={{ color: 'var(--color-text-primary)' }}
                            >
                                <FileText size={16} /> Summary Preview
                            </h3>

                            {form.startDate ? (
                                <div className="space-y-4">
                                    {/* Summary card */}
                                    <div
                                        className="p-4 rounded-xl border bg-white shadow-sm"
                                        style={{ borderColor: 'var(--color-border-default)' }}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <span
                                                className="text-sm"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                Leave Type
                                            </span>
                                            <span
                                                className="text-sm font-bold capitalize"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {TYPE_CFG[form.type]?.label ?? form.type}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span
                                                className="text-sm"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                Dates
                                            </span>
                                            <span
                                                className="text-sm font-medium"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {formatDateRange(
                                                    form.startDate,
                                                    durationTab === 'multiple' ? form.endDate : form.startDate,
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3">
                                            <span
                                                className="text-sm"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                Treatment
                                            </span>
                                            <span
                                                className="text-sm font-bold"
                                                style={{
                                                    color:
                                                        form.type === 'wfh'
                                                            ? '#B45309'
                                                            : form.isPaid
                                                              ? '#15803D'
                                                              : '#EF4444',
                                                }}
                                            >
                                                {form.type === 'wfh' ? 'WFH (not a leave)' : form.isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </div>
                                        <div
                                            className="flex justify-between items-center pt-3 border-t mt-3"
                                            style={{ borderColor: 'var(--color-border-default)' }}
                                        >
                                            <span
                                                className="text-sm font-semibold"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                Total Working Days
                                            </span>
                                            <span
                                                className="text-lg font-bold"
                                                style={{ color: 'var(--color-primary)' }}
                                            >
                                                {days}
                                            </span>
                                        </div>
                                        <p className="text-xs text-right mt-1 opacity-70 italic">
                                            Excludes {excludedSundays} Sunday(s) &amp; {excludedHolidays} Holiday(s)
                                        </p>
                                    </div>

                                    {/* Overlap warning */}
                                    {isOverlapping && (
                                        <div
                                            className="p-3 rounded-lg border text-sm"
                                            style={{
                                                backgroundColor: '#FEF2F2',
                                                borderColor: '#FECACA',
                                                color: '#991B1B',
                                            }}
                                        >
                                            <strong className="block mb-1">Error:</strong>
                                            You already have a pending or approved leave application for the selected
                                            dates.
                                        </div>
                                    )}

                                    {/* Paid balance note (hidden for WFH) */}
                                    {form.type !== 'wfh' && (
                                        <div
                                            className="p-3 rounded-lg border text-sm"
                                            style={{
                                                backgroundColor: '#FEF3C7',
                                                borderColor: '#FDE68A',
                                                color: '#92400E',
                                            }}
                                        >
                                            <strong className="block mb-1">Note:</strong>
                                            You currently have <strong>{paidRemaining}</strong> paid leave days
                                            remaining.
                                            {days > paidRemaining && form.isPaid && (
                                                <span className="block mt-1 text-red-600">
                                                    Warning: You are requesting {days - paidRemaining} more paid day(s)
                                                    than you have left! These extra days will be treated as unpaid
                                                    leaves.
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

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl border text-sm font-semibold cursor-pointer transition-colors"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-primary)',
                                    backgroundColor: 'white',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || days === 0 || isOverlapping}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
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
