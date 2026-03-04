import { useState, useCallback } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useGetHolidaysQuery, type Holiday } from '@/features/hrms/hrmsApi';

const TYPE_CFG: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
    holiday: { label: 'Holiday', bg: '#FEE2E2', color: '#991B1B', emoji: '🎉' },
    'half-day': { label: 'Half Day', bg: '#FEF9C3', color: '#854D0E', emoji: '🌓' },
    wfh: { label: 'Work From Home', bg: '#DBEAFE', color: '#1D4ED8', emoji: '🏠' },
};

function TypeBadge({ type }: { type: string }) {
    const cfg = TYPE_CFG[type] || TYPE_CFG.holiday;
    return (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {cfg.emoji} {cfg.label}
        </span>
    );
}

export default function EmployeeHolidaysPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [previewHoliday, setPreviewHoliday] = useState<Holiday | null>(null);
    const [view, setView] = useState<'calendar' | 'list'>('calendar');

    const { data, isLoading } = useGetHolidaysQuery({ year, month });
    const holidays: Holiday[] = data?.data?.holidays || [];

    const prevMonth = useCallback(() => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
    }, [month]);
    const nextMonth = useCallback(() => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
    }, [month]);

    const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

    // Build holiday map: UTC day → holidays
    const holidayMap: Record<number, Holiday[]> = {};
    holidays.forEach(h => {
        const day = parseInt(h.date.slice(8, 10), 10);
        if (!holidayMap[day]) holidayMap[day] = [];
        holidayMap[day].push(h);
    });

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <CalendarDays size={21} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Holidays</h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>View company holidays and WFH days</p>
                    </div>
                </div>
                {/* View toggle */}
                <div className="flex rounded-xl border overflow-hidden"
                    style={{ borderColor: 'var(--color-border-default)' }}>
                    {(['calendar', 'list'] as const).map(v => (
                        <button key={v} onClick={() => setView(v)}
                            className="px-4 py-2 text-sm font-medium cursor-pointer transition-colors capitalize"
                            style={{
                                backgroundColor: view === v ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                color: view === v ? '#fff' : 'var(--color-text-secondary)',
                            }}>
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex gap-5 mb-5">
                {Object.entries(TYPE_CFG).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span>{v.emoji}</span> {v.label}
                    </div>
                ))}
                <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    🔴 Sunday (Weekly Off)
                </div>
            </div>

            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <ChevronLeft size={18} style={{ color: 'var(--color-text-muted)' }} />
                </button>
                <span className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
                    {monthName} · {holidays.length} {holidays.length === 1 ? 'event' : 'events'}
                </span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <ChevronRight size={18} style={{ color: 'var(--color-text-muted)' }} />
                </button>
            </div>

            {/* Calendar view */}
            {view === 'calendar' && (
                <div className="rounded-xl border p-5"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    <div className="grid grid-cols-7 mb-1">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="text-center text-xs font-medium py-2"
                                style={{ color: d === 'Sun' ? '#EF4444' : 'var(--color-text-muted)' }}>{d}</div>
                        ))}
                    </div>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
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
                                const hols = holidayMap[dayNum] || [];
                                return (
                                    <div key={i} className="rounded-lg p-1 min-h-[64px] relative"
                                        style={{
                                            backgroundColor: hols.length > 0 ? TYPE_CFG[hols[0].type].bg + '60' : (isSunday ? '#FFF5F5' : 'var(--color-bg-subtle)'),
                                            border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                                        }}>
                                        <div className="text-xs font-semibold mb-1"
                                            style={{ color: isToday ? 'var(--color-primary)' : isSunday ? '#EF4444' : 'var(--color-text-secondary)' }}>
                                            {dayNum}
                                        </div>
                                        {hols.map((h, hi) => (
                                            <button key={hi} onClick={() => setPreviewHoliday(h)}
                                                className="text-xs rounded px-1 py-0.5 mb-0.5 truncate font-medium w-full text-left cursor-pointer hover:opacity-90 transition-opacity"
                                                style={{ backgroundColor: TYPE_CFG[h.type].bg, color: TYPE_CFG[h.type].color }}
                                                title={h.name}>
                                                {TYPE_CFG[h.type].emoji} {h.name}
                                            </button>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* List view */}
            {view === 'list' && (
                <div className="rounded-xl border overflow-hidden"
                    style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                                style={{ borderColor: 'var(--color-primary)' }} />
                        </div>
                    ) : holidays.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="text-4xl mb-3">🗓️</div>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No holidays this month.</p>
                        </div>
                    ) : (
                        <div className="divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                            {holidays.map((h, i) => {
                                const [hy, hm, hd] = h.date.slice(0, 10).split('-').map(Number);
                                const d = new Date(hy, hm - 1, hd);
                                return (
                                    <div key={i} className="flex items-center justify-between px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                                                style={{ backgroundColor: TYPE_CFG[h.type].bg }}>
                                                {TYPE_CFG[h.type].emoji}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{h.name}</div>
                                                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    {d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <TypeBadge type={h.type} />
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: h.isPaid ? '#DCFCE7' : '#FEE2E2', color: h.isPaid ? '#15803D' : '#991B1B' }}>
                                                {h.isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Read-only preview modal */}
            {previewHoliday && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <div className="w-full max-w-sm rounded-xl border p-5 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>{previewHoliday.name}</h3>
                                <div className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    {new Date(previewHoliday.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                                </div>
                            </div>
                            <button onClick={() => setPreviewHoliday(null)} className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>
                        <div className="flex gap-2 mb-3">
                            <TypeBadge type={previewHoliday.type} />
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: previewHoliday.isPaid ? '#DCFCE7' : '#FEE2E2', color: previewHoliday.isPaid ? '#15803D' : '#991B1B' }}>
                                {previewHoliday.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                        </div>
                        {previewHoliday.description && (
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{previewHoliday.description}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
