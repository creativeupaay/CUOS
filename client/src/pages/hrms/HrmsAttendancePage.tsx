import { useState, useCallback, memo } from 'react';
import {
    useGetMonthlyAttendanceQuery,
    useGetDailyOverviewQuery,
    useBulkMarkAttendanceMutation,
    useOverrideAttendanceMutation,
} from '@/features/hrms/hrmsApi';
import {
    ChevronLeft, ChevronRight, Save, Calendar,
    Users, Loader2, LayoutGrid, Eye,
    CheckCircle2, Home, Clock3, XCircle, Plane, Sunset,
    Sliders, X, AlertCircle, Sparkles, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ModalPortal from '@/components/ui/ModalPortal';

// ── Status Config ────────────────────────────────────────────────────
const STATUS_CYCLE = [null, 'present', 'wfh', 'half-day', 'absent', 'on-leave'] as const;
type AttendanceStatus = typeof STATUS_CYCLE[number];

const STATUS_CFG: Record<string, {
    label: string;
    short: string;
    bg: string;
    color: string;
    border: string;
    icon: React.ElementType;
}> = {
    present: {
        label: 'Present', short: 'P',
        bg: '#DCFCE7', color: '#15803D', border: '#86EFAC',
        icon: CheckCircle2,
    },
    wfh: {
        label: 'Work From Home', short: 'WFH',
        bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD',
        icon: Home,
    },
    'half-day': {
        label: 'Half Day', short: 'H',
        bg: '#FEF9C3', color: '#854D0E', border: '#FDE047',
        icon: Sunset,
    },
    absent: {
        label: 'Absent', short: 'A',
        bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5',
        icon: XCircle,
    },
    unmarked: {
        label: 'Unmarked', short: '—',
        bg: '#F8FAFC', color: '#64748B', border: '#CBD5E1',
        icon: Clock3,
    },
    'on-leave': {
        label: 'On Leave', short: 'L',
        bg: '#F3E8FF', color: '#6B21A8', border: '#C084FC',
        icon: Plane,
    },
    holiday: {
        label: 'Holiday', short: 'HOL',
        bg: '#FFEDD5', color: '#9A3412', border: '#FDBA74',
        icon: Calendar,
    },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ── Helpers ──────────────────────────────────────────────────────────
function getDeptColor(d: string) {
    const m: Record<string, string> = {
        engineering: '#3B82F6', design: '#8B5CF6',
        marketing: '#F59E0B', finance: '#10B981', hr: '#EC4899', admin: '#6B7280'
    };
    return m[d] || '#6B7280';
}

function StatusCell({ status, onClick }: { status: AttendanceStatus; onClick: () => void }) {
    if (!status) {
        return (
            <button
                onClick={onClick}
                className="w-8 h-8 rounded-md border-2 border-dashed cursor-pointer hover:bg-gray-100 transition-colors"
                style={{ borderColor: 'var(--color-border-default)' }}
                title="Click to mark"
            />
        );
    }
    const cfg = STATUS_CFG[status];
    return (
        <button
            onClick={onClick}
            className="w-8 h-8 rounded-md text-[10px] font-bold cursor-pointer transition-all hover:scale-110 flex items-center justify-center border"
            style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}
            title={`${cfg.label} — click to change`}
        >
            {cfg.short}
        </button>
    );
}

// ── Legend ────────────────────────────────────────────────────────────
function Legend() {
    return (
        <div className="flex flex-wrap items-center gap-3">
            {Object.entries(STATUS_CFG).filter(([k]) => k !== 'holiday').map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                    <div
                        className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center border"
                        style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                    >
                        {cfg.short}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {cfg.label}
                    </span>
                </div>
            ))}
            <div className="flex items-center gap-1.5">
                <div
                    className="w-5 h-5 rounded-md border-2 border-dashed"
                    style={{ borderColor: 'var(--color-border-default)' }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Unmarked</span>
            </div>
        </div>
    );
}

// ── Override Modal ───────────────────────────────────────────────────
interface OverrideTarget {
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    currentStatus: string;
    currentSource?: string;
    currentReason?: string;
    date: string; // YYYY-MM-DD
}

function OverrideAttendanceModal({
    target,
    onClose,
    onSuccess,
}: {
    target: OverrideTarget;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [overrideAttendance, { isLoading }] = useOverrideAttendanceMutation();
    const [selectedStatus, setSelectedStatus] = useState<string>(
        ['present', 'wfh', 'half-day', 'absent', 'on-leave', 'holiday'].includes(target.currentStatus)
            ? target.currentStatus
            : 'present'
    );
    const [reason, setReason] = useState<string>(target.currentReason || '');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            await overrideAttendance({
                employeeId: target.employeeId,
                date: target.date,
                status: selectedStatus,
                reason: reason.trim() || undefined,
            }).unwrap();
            toast.success(`Attendance updated for ${target.employeeName}`);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err?.data?.message || err?.message || 'Failed to update attendance');
        }
    };

    const statusOptions = [
        { id: 'present', label: 'Present', desc: 'Full day (≥ 6 hours)', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC', icon: CheckCircle2 },
        { id: 'wfh', label: 'Work From Home', desc: 'Remote work approved', color: '#1D4ED8', bg: '#DBEAFE', border: '#93C5FD', icon: Home },
        { id: 'half-day', label: 'Half Day', desc: '4 to 6 hours', color: '#854D0E', bg: '#FEF9C3', border: '#FDE047', icon: Sunset },
        { id: 'absent', label: 'Absent', desc: 'Less than 4 hours / Unexcused', color: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5', icon: XCircle },
        { id: 'on-leave', label: 'On Leave', desc: 'Approved leave request', color: '#6B21A8', bg: '#F3E8FF', border: '#C084FC', icon: Plane },
        { id: 'holiday', label: 'Holiday', desc: 'Official holiday / weekly off', color: '#9A3412', bg: '#FFEDD5', border: '#FDBA74', icon: Calendar },
    ];

    return (
        <ModalPortal>
            <div
                className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-primary bg-primary/10 border border-primary/20"
                        >
                            <Sliders size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                Edit Attendance
                            </h2>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Set attendance status for <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{target.employeeName}</span> ({target.employeeCode})
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-gray-400 hover:text-gray-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {/* Date info */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gray-50 border text-xs" style={{ borderColor: 'var(--color-border-default)' }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Selected Date:</span>
                        <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {new Date(target.date + 'T00:00:00').toLocaleDateString('en-IN', {
                                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                            })}
                        </span>
                    </div>

                    {/* Status selection grid */}
                    <div>
                        <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                            Select Attendance Status *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {statusOptions.map((opt) => {
                                const Icon = opt.icon;
                                const isSelected = selectedStatus === opt.id;
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setSelectedStatus(opt.id)}
                                        className="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 relative"
                                        style={{
                                            borderColor: isSelected ? opt.color : 'var(--color-border-default)',
                                            backgroundColor: isSelected ? opt.bg : 'var(--color-bg-surface)',
                                            boxShadow: isSelected ? `0 0 0 1px ${opt.color}` : 'none',
                                        }}
                                    >
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: opt.bg, color: opt.color, border: `1px solid ${opt.border}` }}
                                        >
                                            <Icon size={14} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold" style={{ color: opt.color }}>
                                                {opt.label}
                                            </div>
                                            <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                {opt.desc}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div
                                                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] flex-shrink-0"
                                                style={{ backgroundColor: opt.color }}
                                            >
                                                <Check size={10} strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Reason input */}
                    <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                            Note / Reason <span className="text-[11px] font-normal" style={{ color: 'var(--color-text-muted)' }}>(Optional)</span>
                        </label>
                        <textarea
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Offline work, approved half day, adjustment..."
                            className="w-full px-3 py-2 text-xs rounded-xl border resize-none focus:outline-none focus:ring-1"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'var(--color-bg-surface)',
                                color: 'var(--color-text-primary)',
                            }}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                            <AlertCircle size={14} className="flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium rounded-xl border hover:bg-gray-50 transition-colors cursor-pointer"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white rounded-xl cursor-pointer disabled:opacity-50 transition-all shadow-sm"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" /> Saving…
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} /> Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </ModalPortal>
    );
}

// ── Summary Card ──────────────────────────────────────────────────────
function SummaryCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ElementType }) {
    return (
        <div
            className="rounded-xl border p-4 flex items-center gap-3"
            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
        >
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: color + '20' }}
            >
                <Icon size={18} style={{ color }} />
            </div>
            <div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    {value}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            </div>
        </div>
    );
}

// ── Memoized attendance grid row ─────────────────────────────────────
// Only re-renders when its own employee's local-edit slice changes —
// eliminates the "full grid re-render on every cell click" lag.
interface GridEmployee {
    employeeId: string;
    employeeCode: string;
    name: string;
    department: string;
    days: Array<{ date: string; status: string | null; source?: string | null }>;
}

const AttendanceRow = memo(function AttendanceRow({
    emp,
    rowIdx,
    firstDayDow,
    empLocalEdits,
    onCycle,
    holidaysMap,
    gridLength,
}: {
    emp: GridEmployee;
    rowIdx: number;
    firstDayDow: number;
    empLocalEdits: Record<number, AttendanceStatus> | undefined;
    onCycle: (empId: string, dayIdx: number, current: AttendanceStatus) => void;
    holidaysMap: Record<string, string>;
    gridLength: number;
}) {
    return (
        <tr
            className="border-t"
            style={{
                borderColor: 'var(--color-border-default)',
                backgroundColor: rowIdx % 2 === 0 ? 'var(--color-bg-surface)' : 'rgba(0,0,0,0.012)',
                position: 'relative'
            }}
        >
            {/* Employee name cell */}
            <td
                className="px-4 py-2.5 sticky left-0 z-[5]"
                style={{
                    backgroundColor: rowIdx % 2 === 0 ? 'var(--color-bg-surface)' : '#fafafa',
                    borderRight: '2px solid var(--color-border-default)',
                    width: '200px',
                    minWidth: '200px',
                }}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: getDeptColor(emp.department) }}
                    >
                        {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {emp.name}
                        </div>
                        <div className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                            {emp.employeeCode}
                        </div>
                    </div>
                </div>
            </td>

            {/* Day cells */}
            {emp.days.map((day, dayIdx) => {
                const dow = (firstDayDow + dayIdx) % 7;
                const isWeekend = dow === 0;
                const holidayName = holidaysMap[day.date];
                const isHoliday = !!holidayName;

                if (isHoliday) {
                    if (rowIdx === 0) {
                        return (
                            <td
                                key={dayIdx}
                                rowSpan={gridLength}
                                className="text-center align-middle"
                                style={{
                                    backgroundColor: '#FFEDD5',
                                    borderLeft: '1px solid #FDBA74',
                                    borderRight: '1px solid #FDBA74',
                                    padding: '0',
                                    width: '40px',
                                    minWidth: '40px',
                                    height: '100%',
                                }}
                            >
                                <div
                                    className="text-[11px] font-bold uppercase tracking-widest whitespace-nowrap"
                                    style={{
                                        writingMode: 'vertical-rl',
                                        transform: 'rotate(180deg)',
                                        margin: 'auto',
                                        color: '#9A3412',
                                        height: '200px', // Fallback
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {holidayName}
                                </div>
                            </td>
                        );
                    }
                    return null; // Merge with rowSpan above
                }

                const effectiveStatus: AttendanceStatus =
                    empLocalEdits && dayIdx in empLocalEdits
                        ? empLocalEdits[dayIdx]
                        : ((day.status as AttendanceStatus) || null);
                return (
                    <td
                        key={dayIdx}
                        className="text-center"
                        style={{
                            padding: '4px',
                            backgroundColor: isWeekend
                                ? `${rowIdx % 2 === 0 ? 'rgba(0,0,0,0.025)' : 'rgba(0,0,0,0.035)'}`
                                : 'transparent',
                        }}
                    >
                        {isWeekend ? (
                            <div
                                className="w-8 h-8 rounded-md flex items-center justify-center mx-auto text-[9px] font-medium"
                                style={{ color: '#CBD5E1' }}
                            >
                                —
                            </div>
                        ) : (
                            <div className="flex justify-center">
                                <StatusCell
                                    status={effectiveStatus}
                                    onClick={() => onCycle(emp.employeeId, dayIdx, effectiveStatus)}
                                />
                            </div>
                        )}
                    </td>
                );
            })}
        </tr>
    );
});

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════
export default function HrmsAttendancePage() {
    const today = new Date();
    const [tab, setTab] = useState<'grid' | 'overview'>('grid');

    // ── Grid tab state ───────────────────────────────────────────────
    const [gridMonth, setGridMonth] = useState(today.getMonth() + 1);
    const [gridYear, setGridYear] = useState(today.getFullYear());
    const todayIST = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // localEdits: employeeId → dayIndex → status
    const [localEdits, setLocalEdits] = useState<Record<string, Record<number, AttendanceStatus>>>({});
    const [saveSuccess, setSaveSuccess] = useState(false);

    const { data: monthlyData, isLoading: gridLoading, refetch: refetchGrid } =
        useGetMonthlyAttendanceQuery({ month: gridMonth, year: gridYear });
    const [bulkMark, { isLoading: isSaving }] = useBulkMarkAttendanceMutation();

    // ── Overview tab state ───────────────────────────────────────────
    // Use IST date string for the default so users in India see today's
    // date correctly even in the early-morning window where UTC is still
    // on the previous day.
    const [overviewDate, setOverviewDate] = useState(todayIST);
    const { data: overviewData, isLoading: overviewLoading, refetch: refetchOverview } =
        useGetDailyOverviewQuery(
            { date: overviewDate },
            { pollingInterval: 15000, refetchOnMountOrArgChange: true }
        );

    // ── Override Modal State ─────────────────────────────────────────
    const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null);

    // ── Grid helpers ─────────────────────────────────────────────────
    const prevMonth = () => {
        if (gridMonth === 1) { setGridMonth(12); setGridYear(y => y - 1); }
        else setGridMonth(m => m - 1);
        setLocalEdits({});
    };
    const nextMonth = () => {
        if (gridMonth === 12) { setGridMonth(1); setGridYear(y => y + 1); }
        else setGridMonth(m => m + 1);
        setLocalEdits({});
    };

    const cycleStatus = useCallback((empId: string, dayIdx: number, currentStatus: AttendanceStatus) => {
        const idx = STATUS_CYCLE.indexOf(currentStatus);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        setLocalEdits(prev => {
            const empEdits = { ...(prev[empId] || {}) };
            empEdits[dayIdx] = next;
            return { ...prev, [empId]: empEdits };
        });
    }, []);

    const handleSave = async () => {
        const grid = monthlyData?.data?.grid || [];
        const daysInMonth = monthlyData?.data?.daysInMonth || 31;

        // Group edited cells by date.
        // null local status → send 'clear' so the backend deletes the record.
        const byDate = new Map<string, Array<{ employeeId: string; status: string }>>();

        for (const emp of grid) {
            for (let d = 0; d < daysInMonth; d++) {
                const dayDate = emp.days[d]?.date;
                if (!dayDate) continue;
                const localStatus = localEdits[emp.employeeId]?.[d];
                if (localStatus === undefined) continue; // not edited
                const statusToSend = localStatus === null ? 'clear' : localStatus;
                if (!byDate.has(dayDate)) byDate.set(dayDate, []);
                byDate.get(dayDate)!.push({ employeeId: emp.employeeId, status: statusToSend });
            }
        }

        try {
            for (const [date, recs] of byDate.entries()) {
                await bulkMark({ date, records: recs }).unwrap();
            }
            setLocalEdits({});
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
            refetchGrid();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to save attendance');
        }
    };

    const pendingEditCount = Object.values(localEdits).reduce(
        (sum, emp) => sum + Object.keys(emp).length, 0
    );

    const grid = monthlyData?.data?.grid || [];
    const daysInMonth = monthlyData?.data?.daysInMonth || 31;
    const holidays = (monthlyData as any)?.data?.holidays || [];
    const overview = overviewData?.data;

    // Create holidays map: dateStr -> holidayName
    const holidaysMap: Record<string, string> = {};
    if (Array.isArray(holidays)) {
        holidays.forEach((h: any) => {
            const dateStr = h.date.split('T')[0];
            holidaysMap[dateStr] = h.name;
        });
    }

    // Unused bulk mark helper
    // const handleMarkAllPresent = async () => {
    //     const todayDayOfWeek = new Date().getDay();
    //     if (todayDayOfWeek === 0) {
    //         alert('Today is Sunday (Weekly Off). Attendance cannot be marked for Sunday.');
    //         return;
    //     }
    //     const employees = grid.map((emp) => ({
    //         employeeId: String(emp.employeeId),
    //         status: 'present',
    //     }));
    //     if (employees.length === 0) return;
    //     try {
    //         await bulkMark({ date: todayIST, records: employees, onlyUnmarked: true }).unwrap();
    //         await Promise.all([refetchGrid(), refetchOverview()]);
    //     } catch (err: any) {
    //         alert(err?.data?.message || 'Failed to mark everyone present');
    //     }
    // };

    // Day-of-week for day 1 of the month
    const firstDayDow = new Date(gridYear, gridMonth - 1, 1).getDay();

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-4 mb-7 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2.5">
                    <Clock3 size={20} style={{ color: 'var(--color-primary)' }} />
                    <p className="text-sm font-normal" style={{ color: 'var(--color-text-secondary)' }}>
                        Mark and review employee attendance
                    </p>
                </div>

                <div className="flex items-center gap-3 self-start lg:self-auto">

                    {/* Tab switcher */}
                    <div
                        className="flex rounded-xl p-1"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        {([
                            { key: 'grid', label: 'Mark Attendance', icon: LayoutGrid },
                            { key: 'overview', label: 'Today\'s Overview', icon: Eye },
                        ] as const).map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all"
                                style={{
                                    backgroundColor: tab === key ? 'var(--color-bg-surface)' : 'transparent',
                                    color: tab === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                }}
                            >
                                <Icon size={15} />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════
                TAB 1 — ATTENDANCE GRID
            ══════════════════════════════════════════════════════ */}
            {tab === 'grid' && (
                <div>
                    {/* Controls row */}
                    <div className="flex items-center justify-between mb-5">
                        {/* Month navigator */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={prevMonth}
                                className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                <ChevronLeft size={16} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                            <div
                                className="px-5 py-2 text-sm font-semibold rounded-lg"
                                style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)' }}
                            >
                                {MONTH_NAMES[gridMonth - 1]} {gridYear}
                            </div>
                            <button
                                onClick={nextMonth}
                                className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                                style={{ borderColor: 'var(--color-border-default)' }}
                            >
                                <ChevronRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <Legend />
                            <button
                                onClick={handleSave}
                                disabled={isSaving || pendingEditCount === 0}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-50 transition-all"
                                style={{ backgroundColor: saveSuccess ? '#16A34A' : 'var(--color-primary)' }}
                            >
                                {isSaving
                                    ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                                    : saveSuccess
                                        ? <><CheckCircle2 size={15} /> Saved!</>
                                        : <><Save size={15} /> Save{pendingEditCount > 0 ? ` (${pendingEditCount})` : ''}</>}
                            </button>
                        </div>
                    </div>

                    {/* Grid */}
                    <div
                        className="rounded-xl border overflow-auto"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            maxHeight: 'calc(100vh - 260px)',
                        }}
                    >
                        {gridLoading ? (
                            <div className="p-16 text-center">
                                <Loader2 size={32} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--color-primary)' }} />
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading attendance grid…</p>
                            </div>
                        ) : grid.length === 0 ? (
                            <div className="p-16 text-center">
                                <Users size={36} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No active employees found.</p>
                            </div>
                        ) : (
                            <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
                                <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                                    <tr>
                                        {/* Employee column header */}
                                        <th
                                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider sticky left-0 z-20"
                                            style={{
                                                color: 'var(--color-text-muted)',
                                                backgroundColor: 'var(--color-bg-subtle)',
                                                width: '200px',
                                                minWidth: '200px',
                                                borderRight: '2px solid var(--color-border-default)',
                                                borderBottom: '1px solid var(--color-border-default)',
                                            }}
                                        >
                                            Employee
                                        </th>
                                        {/* Day columns */}
                                        {Array.from({ length: daysInMonth }, (_, i) => {
                                             const dayNum = i + 1;
                                            const dow = (firstDayDow + i) % 7;
                                            const isWeekend = dow === 0;
                                            const isToday = gridYear === today.getFullYear() &&
                                                gridMonth === today.getMonth() + 1 &&
                                                dayNum === today.getDate();
                                            const dateStr = `${gridYear}-${String(gridMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                            const isHoliday = !!holidaysMap[dateStr];

                                            return (
                                                <th
                                                    key={i}
                                                    className="text-center"
                                                    style={{
                                                        width: '40px',
                                                        minWidth: '40px',
                                                        backgroundColor: isHoliday
                                                            ? '#FFEDD5'
                                                            : isWeekend
                                                                ? 'var(--color-bg-subtle)'
                                                                : 'var(--color-bg-surface)',
                                                        borderBottom: '1px solid var(--color-border-default)',
                                                        padding: '6px 4px',
                                                    }}
                                                >
                                                    <div
                                                        className="text-xs font-bold"
                                                        style={{
                                                            color: isToday ? 'var(--color-primary)' : isWeekend ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                                                        }}
                                                    >
                                                        {dayNum}
                                                    </div>
                                                    <div
                                                        className="text-[9px] font-medium"
                                                        style={{ color: isHoliday ? '#9A3412' : isWeekend ? '#EF4444' : 'var(--color-text-muted)' }}
                                                    >
                                                        {isHoliday ? 'HOL' : DAY_LABELS[dow]}
                                                    </div>
                                                    {isToday && (
                                                        <div
                                                            className="mt-0.5 w-1 h-1 rounded-full mx-auto"
                                                            style={{ backgroundColor: 'var(--color-primary)' }}
                                                        />
                                                    )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {grid.map((emp, rowIdx) => (
                                        <AttendanceRow
                                            key={emp.employeeId}
                                            emp={emp as GridEmployee}
                                            rowIdx={rowIdx}
                                            firstDayDow={firstDayDow}
                                            empLocalEdits={localEdits[emp.employeeId]}
                                            onCycle={cycleStatus}
                                            holidaysMap={holidaysMap}
                                            gridLength={grid.length}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB 2 — OVERVIEW
            ══════════════════════════════════════════════════════ */}
            {tab === 'overview' && (
                <div>
                    {/* Date picker */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} style={{ color: 'var(--color-text-muted)' }} />
                            <input
                                type="date"
                                value={overviewDate}
                                onChange={(e) => setOverviewDate(e.target.value)}
                                className="px-3 py-2 text-sm rounded-lg border"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            {new Date(overviewDate + 'T00:00:00').toLocaleDateString('en-IN', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                        </span>
                    </div>

                    {overviewLoading ? (
                        <div className="p-16 text-center">
                            <Loader2 size={32} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--color-primary)' }} />
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading overview…</p>
                        </div>
                    ) : overview ? (
                        <>
                            {/* Summary cards */}
                            <div className="grid grid-cols-7 gap-4 mb-6">
                                <SummaryCard label="Present" value={overview.summary.present} color="#16A34A" icon={CheckCircle2} />
                                <SummaryCard label="Work From Home" value={overview.summary.wfh} color="#1D4ED8" icon={Home} />
                                <SummaryCard label="Half Day" value={overview.summary.halfDay} color="#854D0E" icon={Sunset} />
                                <SummaryCard label="On Leave" value={overview.summary.onLeave} color="#6B21A8" icon={Plane} />
                                <SummaryCard label="Absent" value={overview.summary.absent} color="#991B1B" icon={XCircle} />
                                <SummaryCard label="Unmarked" value={overview.summary.unmarked} color="#64748B" icon={Clock3} />
                                <SummaryCard label="Total" value={overview.summary.total} color="#6B7280" icon={Users} />
                            </div>

                            {/* Employee table */}
                            <div
                                className="rounded-xl border overflow-hidden"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                            >
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                            {['Employee', 'Department', 'Status', 'Check In', 'Check Out', 'Worked Hours', 'Break Time', 'Notes', 'Action'].map(h => (
                                                <th
                                                    key={h}
                                                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                                                    style={{ color: 'var(--color-text-muted)' }}
                                                >
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {overview.employees.map((emp) => {
                                            const stCfg = STATUS_CFG[emp.status] || STATUS_CFG.absent;
                                            const StIcon = stCfg.icon;
                                            return (
                                                <tr
                                                    key={String(emp.employeeId)}
                                                    className="border-t"
                                                    style={{ borderColor: 'var(--color-border-default)' }}
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                                                                style={{ backgroundColor: getDeptColor(emp.department) }}
                                                            >
                                                                {emp.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                                    {emp.name}
                                                                </div>
                                                                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                                    {emp.employeeCode}
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
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                                                            style={{ backgroundColor: stCfg.bg, color: stCfg.color }}
                                                        >
                                                            <StIcon size={11} />
                                                            {stCfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {emp.checkIn
                                                            ? new Date(emp.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                                        {emp.checkOut
                                                            ? new Date(emp.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        {emp.totalHours > 0 ? `${emp.totalHours} h` : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium" style={{ color: (emp as any).breakMinutes && (emp as any).breakMinutes > 0 ? '#D97706' : 'var(--color-text-secondary)' }}>
                                                        {(emp as any).breakMinutes && (emp as any).breakMinutes > 0
                                                            ? `${Math.floor((emp as any).breakMinutes / 60) > 0 ? `${Math.floor((emp as any).breakMinutes / 60)}h ` : ''}${(emp as any).breakMinutes % 60}m`
                                                            : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm max-w-[180px]" style={{ color: 'var(--color-text-muted)' }}>
                                                        {emp.notes && <div className="truncate">{emp.notes}</div>}
                                                        {(emp as any).overrideReason && (
                                                            <div className="text-[11px] text-gray-600 font-medium truncate" title={`Note: ${(emp as any).overrideReason}`}>
                                                                Note: {(emp as any).overrideReason}
                                                            </div>
                                                        )}
                                                        {!emp.notes && !(emp as any).overrideReason && '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <button
                                                            type="button"
                                                            onClick={() => setOverrideTarget({
                                                                employeeId: String(emp.employeeId),
                                                                employeeName: emp.name,
                                                                employeeCode: emp.employeeCode,
                                                                currentStatus: emp.status,
                                                                currentSource: (emp as any).source,
                                                                currentReason: (emp as any).overrideReason,
                                                                date: overviewDate,
                                                            })}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                                                            style={{
                                                                borderColor: 'var(--color-border-default)',
                                                                color: 'var(--color-text-primary)',
                                                                backgroundColor: 'var(--color-bg-surface)',
                                                            }}
                                                            title="Edit attendance status"
                                                        >
                                                            <Sliders size={12} style={{ color: 'var(--color-primary)' }} />
                                                            <span>Edit</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="p-16 text-center">
                            <Calendar size={36} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No data available</p>
                        </div>
                    )}
                </div>
            )}

            {/* Override Attendance Modal */}
            {overrideTarget && (
                <OverrideAttendanceModal
                    target={overrideTarget}
                    onClose={() => setOverrideTarget(null)}
                    onSuccess={() => {
                        refetchOverview();
                        refetchGrid();
                    }}
                />
            )}
        </div>
    );
}
