import { useState, useCallback } from 'react';
import { Clock3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGetMyAttendanceQuery } from '@/features/hrms/hrmsApi';

// ── Status config ─────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
    present: { label: 'Present', bg: '#DCFCE7', color: '#15803D', emoji: '✅' },
    wfh: { label: 'WFH', bg: '#DBEAFE', color: '#1D4ED8', emoji: '🏠' },
    'half-day': { label: 'Half Day', bg: '#FEF9C3', color: '#854D0E', emoji: '🌓' },
    'on-leave': { label: 'On Leave', bg: '#FFEDD5', color: '#C2410C', emoji: '🌴' },
    absent: { label: 'Absent', bg: '#FEE2E2', color: '#B91C1C', emoji: '❌' },
    holiday: { label: 'Holiday', bg: '#EDE9FE', color: '#6D28D9', emoji: '🎉' },
};

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function EmployeeAttendancePage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);

    // Fetch attendance for the current month range
    const startDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

    const { data, isLoading } = useGetMyAttendanceQuery({ startDate, endDate });

    const records: any[] = (data as any)?.data || [];

    // Build a map: dateStr (YYYY-MM-DD in IST) → status
    // Dates are stored as IST midnight in MongoDB (but come back as UTC ISO strings)
    // We must convert back to IST to get the correct calendar date
    const statusMap: Record<string, string> = {};
    records.forEach((r: any) => {
        const d = new Date(r.date);
        // Format in IST to get the correct local date
        const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // "YYYY-MM-DD"
        statusMap[key] = r.status;
    });


    const prevMonth = useCallback(() => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    }, [month]);
    const nextMonth = useCallback(() => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    }, [month]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

    // Count stats for the month
    const stats = { present: 0, wfh: 0, 'half-day': 0, 'on-leave': 0, absent: 0 };
    Object.values(statusMap).forEach(s => { if (s in stats) (stats as any)[s]++; });

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-6">
                <Clock3 size={21} style={{ color: 'var(--color-primary)' }} />
                <div>
                    <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>My Attendance</h1>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>View your attendance marked by HR</p>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-3 mb-6">
                {(['present', 'wfh', 'half-day', 'on-leave', 'absent'] as const).map(key => (
                    <div key={key} className="rounded-xl p-4 text-center border"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="text-2xl font-bold mb-1" style={{ color: STATUS_CFG[key].color }}>
                            {(stats as any)[key]}
                        </div>
                        <div className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            {STATUS_CFG[key].emoji} {STATUS_CFG[key].label}
                        </div>
                    </div>
                ))}
            </div>

            {/* Calendar card */}
            <div className="rounded-xl border p-5"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                        <ChevronLeft size={18} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                    <span className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>{monthName}</span>
                    <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-4">
                    {Object.entries(STATUS_CFG).filter(([k]) => k !== 'holiday').map(([k, v]) => (
                        <div key={k} className="flex items-center gap-1.5 text-xs">
                            <span>{v.emoji}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{v.label}</span>
                        </div>
                    ))}
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-xs font-medium py-2"
                            style={{ color: d === 'Sun' ? '#EF4444' : 'var(--color-text-muted)' }}>
                            {d}
                        </div>
                    ))}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                            style={{ borderColor: 'var(--color-primary)' }} />
                    </div>
                ) : (
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: totalCells }, (_, i) => {
                            const dayNum = i - firstDow + 1;
                            if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />;
                            const dow = i % 7;
                            const isSunday = dow === 0;
                            const isToday = isCurrentMonth && now.getDate() === dayNum;
                            const dateStr = `${year}-${pad(month)}-${pad(dayNum)}`;
                            const status = statusMap[dateStr];
                            const cfg = status ? STATUS_CFG[status] : null;
                            return (
                                <div key={i}
                                    className="rounded-lg p-1.5 min-h-[64px] flex flex-col"
                                    style={{
                                        backgroundColor: cfg ? cfg.bg + '80' : (isSunday ? '#FFF5F5' : 'var(--color-bg-subtle)'),
                                        border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                                    }}>
                                    <span className="text-xs font-semibold"
                                        style={{ color: isToday ? 'var(--color-primary)' : isSunday ? '#EF4444' : 'var(--color-text-secondary)' }}>
                                        {dayNum}
                                    </span>
                                    {cfg && (
                                        <span className="text-xs mt-auto font-medium" style={{ color: cfg.color }}>
                                            {cfg.emoji}
                                        </span>
                                    )}
                                    {isSunday && !cfg && (
                                        <span className="text-xs mt-auto" style={{ color: '#EF4444' }}>🔴</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
