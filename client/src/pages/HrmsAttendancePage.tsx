import { useState, useCallback, memo } from 'react';
import {
    useGetMonthlyAttendanceQuery,
    useGetDailyOverviewQuery,
    useBulkMarkAttendanceMutation,
} from '@/features/hrms/hrmsApi';
import {
    ChevronLeft, ChevronRight, Save, Calendar,
    Users, Loader2, LayoutGrid, Eye,
    CheckCircle2, Home, Clock3, XCircle, Plane, Sunset,
} from 'lucide-react';

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
    days: Array<{ date: string; status: string | null }>;
}

const AttendanceRow = memo(function AttendanceRow({
    emp,
    rowIdx,
    firstDayDow,
    empLocalEdits,
    onCycle,
}: {
    emp: GridEmployee;
    rowIdx: number;
    firstDayDow: number;
    empLocalEdits: Record<number, AttendanceStatus> | undefined;
    onCycle: (empId: string, dayIdx: number, current: AttendanceStatus) => void;
}) {
    return (
        <tr
            className="border-t"
            style={{
                borderColor: 'var(--color-border-default)',
                backgroundColor: rowIdx % 2 === 0 ? 'var(--color-bg-surface)' : 'rgba(0,0,0,0.012)',
            }}
        >
            {/* Employee name cell */}
            <td
                className="px-4 py-2.5 sticky left-0"
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
    const todayIST = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const [overviewDate, setOverviewDate] = useState(todayIST);
    const { data: overviewData, isLoading: overviewLoading } =
        useGetDailyOverviewQuery({ date: overviewDate });

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
    const overview = overviewData?.data;

    // Day-of-week for day 1 of the month
    const firstDayDow = new Date(gridYear, gridMonth - 1, 1).getDay();

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <Clock3 size={21} style={{ color: 'var(--color-primary)' }} />
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Attendance
                        </h1>
                    </div>
                    <p className="text-sm ml-8" style={{ color: 'var(--color-text-secondary)' }}>
                        Mark and review employee attendance
                    </p>
                </div>

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
                                            const isWeekend = dow === 0; // Only Sunday is off (6-day work week)
                                            const isToday = gridYear === today.getFullYear() &&
                                                gridMonth === today.getMonth() + 1 &&
                                                dayNum === today.getDate();
                                            return (
                                                <th
                                                    key={i}
                                                    className="text-center"
                                                    style={{
                                                        width: '40px',
                                                        minWidth: '40px',
                                                        backgroundColor: isWeekend
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
                                                        style={{ color: isWeekend ? '#EF4444' : 'var(--color-text-muted)' }}
                                                    >
                                                        {DAY_LABELS[dow]}
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
                            <div className="grid grid-cols-6 gap-4 mb-6">
                                <SummaryCard label="Present" value={overview.summary.present} color="#16A34A" icon={CheckCircle2} />
                                <SummaryCard label="Work From Home" value={overview.summary.wfh} color="#1D4ED8" icon={Home} />
                                <SummaryCard label="Half Day" value={overview.summary.halfDay} color="#854D0E" icon={Sunset} />
                                <SummaryCard label="On Leave" value={overview.summary.onLeave} color="#6B21A8" icon={Plane} />
                                <SummaryCard label="Absent" value={overview.summary.absent} color="#991B1B" icon={XCircle} />
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
                                            {['Employee', 'Department', 'Status', 'Check In', 'Check Out', 'Hours', 'Notes'].map(h => (
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
                                                    <td className="px-4 py-3 text-sm max-w-[180px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                        {emp.notes || '—'}
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
        </div>
    );
}
