import { useState } from 'react';
import {
    useGetHolidaysQuery,
    useCreateHolidayMutation,
    useDeleteHolidayMutation,
    type Holiday,
} from '@/features/hrms/hrmsApi';
import { Plus, X, Trash2, CalendarDays, Loader2 } from 'lucide-react';

const TYPE_CFG = {
    holiday: { label: 'Holiday', bg: '#FEE2E2', color: '#991B1B', emoji: '🎉' },
    'half-day': { label: 'Half Day', bg: '#FEF3C7', color: '#92400E', emoji: '🌓' },
    wfh: { label: 'Work From Home', bg: '#DBEAFE', color: '#1D4ED8', emoji: '🏠' },
} as const;

function TypeBadge({ type }: { type: Holiday['type'] }) {
    const c = TYPE_CFG[type];
    return (
        <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: c.bg, color: c.color }}
        >
            {c.emoji} {c.label}
        </span>
    );
}

function AddHolidayModal({ onClose }: { onClose: () => void }) {
    const [createHoliday, { isLoading }] = useCreateHolidayMutation();
    const [form, setForm] = useState({
        name: '',
        date: '',
        type: 'holiday' as Holiday['type'],
        description: '',
        isPaid: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createHoliday(form).unwrap();
            onClose();
        } catch (err: any) {
            alert(err?.data?.message || 'Failed to add holiday');
        }
    };

    const inputStyle = {
        borderColor: 'var(--color-border-default)',
        backgroundColor: 'var(--color-bg-surface)',
        color: 'var(--color-text-primary)',
    };

    return (
        <div
            className="modal-overlay"
        >

            <div
                className="w-full max-w-md rounded-xl border p-6 shadow-xl"
                style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
            >
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-2">
                        <CalendarDays size={18} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            Add Holiday / Event
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                        <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Name *</label>
                        <input
                            type="text" required placeholder="e.g. Holi, Republic Day, WFH Day…"
                            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border"
                            style={inputStyle}
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Date *</label>
                        <input
                            type="date" required value={form.date}
                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                            className="w-full px-3 py-2.5 text-sm rounded-lg border"
                            style={inputStyle}
                        />
                    </div>

                    {/* Type pills */}
                    <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Type</label>
                        <div className="flex gap-2 flex-wrap">
                            {(Object.entries(TYPE_CFG) as [Holiday['type'], typeof TYPE_CFG['holiday']][]).map(([key, cfg]) => (
                                <button
                                    key={key} type="button"
                                    onClick={() => setForm({ ...form, type: key })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-all"
                                    style={{
                                        backgroundColor: form.type === key ? cfg.bg : 'var(--color-bg-surface)',
                                        color: form.type === key ? cfg.color : 'var(--color-text-muted)',
                                        borderColor: form.type === key ? cfg.color + '50' : 'var(--color-border-default)',
                                        fontWeight: form.type === key ? 600 : 400,
                                    }}
                                >
                                    {cfg.emoji} {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Paid toggle */}
                    <div>
                        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Treatment</label>
                        <div className="flex rounded-lg border overflow-hidden w-fit" style={{ borderColor: 'var(--color-border-default)' }}>
                            {([true, false] as const).map((paid) => (
                                <button
                                    key={String(paid)} type="button"
                                    onClick={() => setForm({ ...form, isPaid: paid })}
                                    className="px-4 py-2 text-sm font-medium cursor-pointer transition-all"
                                    style={{
                                        backgroundColor: form.isPaid === paid ? (paid ? 'var(--color-primary)' : '#EF4444') : 'var(--color-bg-surface)',
                                        color: form.isPaid === paid ? 'white' : 'var(--color-text-muted)',
                                    }}
                                >
                                    {paid ? '💰 Paid' : '⛔ Unpaid'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Description (optional)</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={2} placeholder="Short note…"
                            className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none"
                            style={inputStyle}
                        />
                    </div>

                    {/* Info pill */}
                    <div
                        className="rounded-lg px-4 py-2.5 text-xs"
                        style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}
                    >
                        📌 Adding this {TYPE_CFG[form.type].label.toLowerCase()} will automatically apply{' '}
                        <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                            {form.type === 'holiday' ? '"On Leave"' : form.type === 'half-day' ? '"Half Day"' : '"WFH"'}
                        </span> attendance status to all active employees for that day.
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="submit" disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isLoading ? <><Loader2 size={15} className="animate-spin" /> Adding…</> : 'Add Holiday'}
                        </button>
                        <button
                            type="button" onClick={onClose}
                            className="px-4 py-2.5 text-sm rounded-lg border cursor-pointer"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Month calendar grid renderer ──────────────────────────────────────
function MonthCalendar({ year, month, holidays, onHolidayClick }: { year: number; month: number; holidays: Holiday[]; onHolidayClick: (h: Holiday) => void }) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

    const holidayMap: Record<number, Holiday[]> = {};
    holidays.forEach((h) => {
        // Use UTC date parts to avoid timezone shift (stored as UTC midnight)
        const utcDay = parseInt(h.date.slice(8, 10), 10);
        if (!holidayMap[utcDay]) holidayMap[utcDay] = [];
        holidayMap[utcDay].push(h);
    });

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

    return (
        <div>
            <div className="grid grid-cols-7 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="text-center text-xs font-medium py-2"
                        style={{ color: d === 'Sun' ? '#EF4444' : 'var(--color-text-muted)' }}>
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: totalCells }, (_, i) => {
                    const dayNum = i - firstDow + 1;
                    if (dayNum < 1 || dayNum > daysInMonth) {
                        return <div key={i} />;
                    }
                    const dow = i % 7;
                    const isSunday = dow === 0;
                    const isToday = isCurrentMonth && today.getDate() === dayNum;
                    const hols = holidayMap[dayNum] || [];

                    return (
                        <div
                            key={i}
                            className="rounded-lg p-1 min-h-[64px] relative"
                            style={{
                                backgroundColor: hols.length > 0 ? TYPE_CFG[hols[0].type].bg + '60' : (isSunday ? '#FFF5F5' : 'var(--color-bg-subtle)'),
                                border: isToday ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                            }}
                        >
                            <div
                                className="text-xs font-semibold mb-1"
                                style={{ color: isToday ? 'var(--color-primary)' : isSunday ? '#EF4444' : 'var(--color-text-secondary)' }}
                            >
                                {dayNum}
                            </div>
                            {hols.map((h, hi) => (
                                <button
                                    key={hi}
                                    onClick={() => onHolidayClick(h)}
                                    className="text-xs rounded px-1 py-0.5 mb-0.5 truncate font-medium w-full text-left cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{ backgroundColor: TYPE_CFG[h.type].bg, color: TYPE_CFG[h.type].color }}
                                    title={h.name}
                                >
                                    {TYPE_CFG[h.type].emoji} {h.name}
                                </button>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════
export default function HrmsHolidaysPage() {
    const [showModal, setShowModal] = useState(false);
    const [view, setView] = useState<'calendar' | 'list'>('calendar');
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);

    const { data, isLoading, refetch } = useGetHolidaysQuery({ year: viewYear, month: viewMonth });
    const [deleteHoliday, { isLoading: deleting }] = useDeleteHolidayMutation();

    const holidays = data?.data?.holidays || [];

    const prevMonth = () => {
        if (viewMonth === 1) { setViewMonth(12); setViewYear(viewYear - 1); }
        else setViewMonth(viewMonth - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 12) { setViewMonth(1); setViewYear(viewYear + 1); }
        else setViewMonth(viewMonth + 1);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteHoliday(id).unwrap();
            setDeleteId(null);
            setSelectedHoliday(null);
            refetch();
        } catch {/* noop */ }
    };

    const monthName = new Date(viewYear, viewMonth - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-2.5">
                    <CalendarDays size={21} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Holidays</h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            Declare company holidays, WFH days, and half-days for all employees
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {/* View Toggle */}
                    <div
                        className="flex rounded-xl p-1"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        {(['calendar', 'list'] as const).map((v) => (
                            <button
                                key={v} onClick={() => setView(v)}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg cursor-pointer capitalize transition-all"
                                style={{
                                    backgroundColor: view === v ? 'var(--color-bg-surface)' : 'transparent',
                                    color: view === v ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                }}
                            >
                                {v === 'calendar' ? '📅 Calendar' : '📋 List'}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        <Plus size={16} /> Add Holiday
                    </button>
                </div>
            </div>

            {/* Month Navigator */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={prevMonth}
                    className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    ‹
                </button>
                <h2 className="text-lg font-semibold min-w-[200px] text-center" style={{ color: 'var(--color-text-primary)' }}>
                    {monthName}
                </h2>
                <button
                    onClick={nextMonth}
                    className="p-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    ›
                </button>
                <span className="text-sm ml-4" style={{ color: 'var(--color-text-muted)' }}>
                    {holidays.length} event{holidays.length !== 1 ? 's' : ''} this month
                </span>
            </div>

            {/* Legend */}
            <div className="flex gap-4 mb-5 flex-wrap">
                {(Object.entries(TYPE_CFG) as [Holiday['type'], typeof TYPE_CFG['holiday']][]).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1">
                        <span className="text-sm">{cfg.emoji}</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{cfg.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1">
                    <span className="text-sm">🔴</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sunday (Weekly Off)</span>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="p-16 text-center">
                    <Loader2 size={28} className="mx-auto mb-2 animate-spin" style={{ color: 'var(--color-primary)' }} />
                </div>
            ) : view === 'calendar' ? (
                <div
                    className="rounded-xl border p-5"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                >
                    <MonthCalendar year={viewYear} month={viewMonth} holidays={holidays} onHolidayClick={setSelectedHoliday} />
                </div>
            ) : (
                /* List view */
                <div>
                    {holidays.length === 0 ? (
                        <div
                            className="rounded-xl border p-16 text-center"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
                        >
                            <CalendarDays size={40} className="mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
                            <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>No holidays this month</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                Click "Add Holiday" to declare one.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {holidays.map((h) => {
                                // slice date string to avoid UTC->local timezone shift
                                const [yyyy, mm, dd] = h.date.slice(0, 10).split('-').map(Number);
                                const dayNum = dd;
                                const monthStr = new Date(yyyy, mm - 1, dd).toLocaleString('en-IN', { month: 'short' });
                                const fullDateStr = new Date(yyyy, mm - 1, dd).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                const holDate = new Date(yyyy, mm - 1, dd);
                                const isPast = holDate < today;
                                return (
                                    <div
                                        key={h._id}
                                        className="rounded-xl border p-4 flex items-center justify-between gap-4"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                            opacity: isPast ? 0.7 : 1,
                                        }}
                                    >
                                        {/* Date block */}
                                        <div
                                            className="rounded-xl p-3 text-center flex-shrink-0 min-w-[56px]"
                                            style={{ backgroundColor: TYPE_CFG[h.type].bg }}
                                        >
                                            <div className="text-xl font-bold" style={{ color: TYPE_CFG[h.type].color }}>
                                                {dayNum}
                                            </div>
                                            <div className="text-xs font-medium" style={{ color: TYPE_CFG[h.type].color }}>
                                                {monthStr}
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                    {h.name}
                                                </span>
                                                <TypeBadge type={h.type} />
                                                <span
                                                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                                                    style={{
                                                        backgroundColor: h.isPaid ? '#DCFCE7' : '#FEE2E2',
                                                        color: h.isPaid ? '#15803D' : '#991B1B',
                                                    }}
                                                >
                                                    {h.isPaid ? 'Paid' : 'Unpaid'}
                                                </span>
                                            </div>
                                            {h.description && (
                                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{h.description}</p>
                                            )}
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                {fullDateStr}
                                            </p>
                                        </div>

                                        {/* Delete */}
                                        {deleteId === h._id ? (
                                            <div className="flex gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => handleDelete(h._id)}
                                                    disabled={deleting}
                                                    className="px-3 py-1.5 text-xs font-medium text-white rounded-lg cursor-pointer"
                                                    style={{ backgroundColor: '#EF4444' }}
                                                >
                                                    {deleting ? 'Deleting…' : 'Confirm'}
                                                </button>
                                                <button
                                                    onClick={() => setDeleteId(null)}
                                                    className="px-3 py-1.5 text-xs font-medium rounded-lg border cursor-pointer"
                                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setDeleteId(h._id)}
                                                className="p-2 rounded-lg border cursor-pointer hover:bg-red-50 flex-shrink-0"
                                                style={{ borderColor: 'var(--color-border-default)' }}
                                                title="Delete holiday"
                                            >
                                                <Trash2 size={15} style={{ color: '#EF4444' }} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && <AddHolidayModal onClose={() => { setShowModal(false); refetch(); }} />}

            {/* View/Delete Holiday Modal */}
            {selectedHoliday && (
                <div
                    className="modal-overlay"

                    style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                    <div
                        className="w-full max-w-sm rounded-xl border p-5 shadow-xl"
                        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                    {selectedHoliday.name}
                                </h3>
                                <div className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    {new Date(selectedHoliday.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                                </div>
                            </div>
                            <button onClick={() => { setSelectedHoliday(null); setDeleteId(null); }} className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                                <X size={18} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <TypeBadge type={selectedHoliday.type} />
                            <span
                                className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{
                                    backgroundColor: selectedHoliday.isPaid ? '#DCFCE7' : '#FEE2E2',
                                    color: selectedHoliday.isPaid ? '#15803D' : '#991B1B',
                                }}
                            >
                                {selectedHoliday.isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                        </div>

                        {selectedHoliday.description && (
                            <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                                {selectedHoliday.description}
                            </p>
                        )}

                        <div className="flex gap-3 pt-3 border-t" style={{ borderColor: 'var(--color-border-default)' }}>
                            {deleteId === selectedHoliday._id ? (
                                <>
                                    <button
                                        onClick={() => handleDelete(selectedHoliday._id)}
                                        disabled={deleting}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white rounded-lg cursor-pointer disabled:opacity-60 transition-colors hover:bg-red-600"
                                        style={{ backgroundColor: '#EF4444' }}
                                    >
                                        {deleting ? <Loader2 size={15} className="animate-spin" /> : 'Confirm Delete'}
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(null)}
                                        className="flex-1 py-2 text-sm font-medium rounded-lg border cursor-pointer hover:bg-gray-50"
                                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setDeleteId(selectedHoliday._id)}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg border cursor-pointer hover:bg-red-50 transition-colors"
                                    style={{ borderColor: '#FCA5A5', color: '#EF4444' }}
                                >
                                    <Trash2 size={15} /> Delete Holiday
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
