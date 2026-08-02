import { useGetDashboardStatsQuery, useGetUpcomingEventsQuery } from '@/features/hrms/hrmsApi';
import {
    Users, UserCheck, CalendarDays,
    Building2, TrendingUp, Gift, AlertCircle, CreditCard, Calendar,
} from 'lucide-react';

// ── Event type config ────────────────────────────────────────────────
const EVENT_CONFIG = {
    birthday: {
        icon: Gift,
        color: '#EC4899',
        bg: '#FDF2F8',
        border: '#FBCFE8',
        label: 'Birthday',
    },
    probation: {
        icon: AlertCircle,
        color: '#F59E0B',
        bg: '#FFFBEB',
        border: '#FDE68A',
        label: 'Probation',
    },
    salary: {
        icon: CreditCard,
        color: '#6366F1',
        bg: '#EEF2FF',
        border: '#C7D2FE',
        label: 'Payroll',
    },
} as const;

// ── Dept colour map ──────────────────────────────────────────────────
const DEPT_COLORS: Record<string, string> = {
    engineering: '#3B82F6',
    design: '#8B5CF6',
    marketing: '#F59E0B',
    finance: '#10B981',
    hr: '#EC4899',
    admin: '#6B7280',
};
const getDeptColor = (d: string) => DEPT_COLORS[d] || '#6B7280';

// ── Helper ───────────────────────────────────────────────────────────
function formatEventDate(date: string) {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
    });
}

export default function HrmsDashboardPage() {
    const { data, isLoading } = useGetDashboardStatsQuery();
    const { data: eventsData, isLoading: eventsLoading } = useGetUpcomingEventsQuery();

    const stats = data?.data;
    const events = eventsData?.data?.events || [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <TrendingUp
                        size={36}
                        className="mx-auto mb-3 animate-pulse"
                        style={{ color: 'var(--color-primary)' }}
                    />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        Loading dashboard…
                    </p>
                </div>
            </div>
        );
    }

    // 3 stat cards only
    const statCards = [
        {
            label: 'Total Employees',
            value: stats?.totalEmployees ?? 0,
            icon: Users,
            color: '#3B82F6',
            bg: '#EFF6FF',
        },
        {
            label: 'Active',
            value: stats?.activeEmployees ?? 0,
            icon: UserCheck,
            color: '#22C55E',
            bg: '#F0FDF4',
        },
        {
            label: 'Pending Leaves',
            value: stats?.pendingLeaves ?? 0,
            icon: CalendarDays,
            color: '#EF4444',
            bg: '#FEF2F2',
        },
    ];

    return (
        <div className="mx-auto page-enter" style={{ maxWidth: '1200px' }}>

            {/* ── Header ─────────────────────────────────────── */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#10B98120,#3B82F620)', border: '1px solid #10B98130' }}
                    >
                        <TrendingUp size={20} style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            HR Dashboard
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Stat Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-5 mb-8">
                {statCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-2xl border p-6 relative overflow-hidden"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            boxShadow: 'var(--shadow-xs)',
                        }}
                    >
                        {/* Left accent bar */}
                        <div className="absolute top-0 left-0 h-full" style={{ width: '3px', backgroundColor: card.color, borderRadius: '12px 0 0 12px' }} />
                        <div className="flex items-center justify-between mb-5">
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg,${card.color}20,${card.color}10)`, border: `1px solid ${card.color}25` }}
                            >
                                <card.icon size={22} style={{ color: card.color }} />
                            </div>
                            <span
                                className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
                                style={{ backgroundColor: card.color + '15', color: card.color }}
                            >
                                {card.label}
                            </span>
                        </div>
                        <div className="text-4xl font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', fontFamily: 'Outfit, sans-serif' }}>
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Bottom Row ─────────────────────────────────── */}
            <div className="grid grid-cols-5 gap-6">
                {/* Departments — 2 cols */}
                <div
                    className="col-span-2 rounded-2xl border p-6"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', boxShadow: 'var(--shadow-xs)' }}
                >
                    <div className="flex items-center gap-2 mb-6">
                        <Building2 size={17} style={{ color: 'var(--color-primary)' }} />
                        <h2
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Departments
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {(stats?.departments || []).length === 0 ? (
                            <p
                                className="text-sm text-center py-6"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                No department data yet
                            </p>
                        ) : (
                            (stats?.departments || []).map((dept) => {
                                const total = stats?.totalEmployees || 1;
                                const pct = Math.round((dept.count / total) * 100);
                                const color = getDeptColor(dept._id);
                                return (
                                    <div key={dept._id}>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span
                                                className="text-sm capitalize font-medium"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {dept._id}
                                            </span>
                                            <span
                                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: color + '15',
                                                    color,
                                                }}
                                            >
                                                {dept.count}
                                            </span>
                                        </div>
                                        <div
                                            className="w-full h-1.5 rounded-full"
                                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                                        >
                                            <div
                                                className="h-1.5 rounded-full"
                                                style={{
                                                    width: `${Math.max(pct, 3)}%`,
                                                    backgroundColor: color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Events — 3 cols */}
                <div
                    className="col-span-3 rounded-2xl border p-6 flex flex-col"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', boxShadow: 'var(--shadow-xs)' }}
                >
                    <div className="flex items-center gap-2 mb-6">
                        <Calendar size={17} style={{ color: 'var(--color-primary)' }} />
                        <h2
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                        >
                            Upcoming Events
                        </h2>
                        {events.length > 0 && (
                            <span
                                className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{
                                    backgroundColor: 'var(--color-primary-soft, #DCFCE7)',
                                    color: 'var(--color-primary)',
                                }}
                            >
                                {events.length}
                            </span>
                        )}
                    </div>

                    {eventsLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                Loading events…
                            </p>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
                            <Calendar size={32} style={{ color: 'var(--color-text-muted)' }} />
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                No upcoming events in the next 30 days
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '340px' }}>
                            {events.map((event, idx) => {
                                const cfg = EVENT_CONFIG[event.type];
                                const IconComponent = cfg.icon;
                                return (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-3 p-3 rounded-lg border"
                                        style={{
                                            borderColor: cfg.border,
                                            backgroundColor: cfg.bg,
                                        }}
                                    >
                                        {/* Icon */}
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ backgroundColor: cfg.color + '20' }}
                                        >
                                            <IconComponent size={16} style={{ color: cfg.color }} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p
                                                className="text-sm font-medium truncate"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {event.title}
                                            </p>
                                            <p
                                                className="text-xs mt-0.5"
                                                style={{ color: 'var(--color-text-secondary)' }}
                                            >
                                                {event.subtitle}
                                            </p>
                                        </div>

                                        {/* Date badge + type pill */}
                                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                            <span
                                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                                style={{
                                                    backgroundColor: cfg.color + '20',
                                                    color: cfg.color,
                                                }}
                                            >
                                                {cfg.label}
                                            </span>
                                            <span
                                                className="text-xs"
                                                style={{ color: 'var(--color-text-muted)' }}
                                            >
                                                {event.type !== 'salary'
                                                    ? formatEventDate(event.date)
                                                    : `${event.daysUntil}d left`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
