import { useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { useGetIndividualTasksQuery } from '@/features/project';
import { useGetTimerStatusesQuery } from '@/features/project/projectApi';
import { hasModuleAdminAccess } from '@/utils/modulePermissions';
import { Search, Calendar, CheckCircle2, Circle, Clock, ChevronDown, Pause, Video } from 'lucide-react';
import type { Task } from '@/features/project';
import { useGlobalMeetings, type GlobalMeeting } from '@/hooks/useGlobalMeetings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

type UserInfo = { _id: string; name: string; email: string; profilePhoto?: string };

function resolveUser(raw: string | UserInfo | undefined): UserInfo | null {
    if (!raw) return null;
    if (typeof raw === 'string') return { _id: raw, name: 'Unknown', email: '' };
    return raw as UserInfo;
}

const AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
    '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84cc16',
];

function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Employee Card ─────────────────────────────────────────────────────────────

type EmployeeCardProps = { user: UserInfo; tasks: Task[]; meetings: GlobalMeeting[]; index: number; isWorking: boolean };

const STATUS_CFG: Record<string, { icon: React.ReactNode; color: string }> = {
    todo:          { icon: <Circle size={14} />,       color: '#3B82F6' },
    'in-progress': { icon: <Circle size={14} />,       color: '#F59E0B' },
    paused:        { icon: <Pause size={14} />,        color: '#6B7280' },
    completed:     { icon: <CheckCircle2 size={14} />, color: '#10B981' },
};

// Pastel card backgrounds matching the reference design
const CARD_COLORS = [
    '#FFFFFF', // clean white
];

// Folded corner style generator
const getFoldedCornerStyle = (color: string) => ({
    background: `linear-gradient(-45deg, transparent 16px, ${color} 0)`,
    position: 'relative' as const,
    boxShadow: '0 4px 14px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)',
    border: 'none',
    minHeight: '220px',
    borderTopLeftRadius: '12px',
    borderTopRightRadius: '12px',
    borderBottomLeftRadius: '12px',
    borderBottomRightRadius: '0px',
});

function EmployeeCard({ user, tasks, meetings, index, isWorking }: EmployeeCardProps) {
    const aColor = avatarColor(user.name);
    const cardBgColor = CARD_COLORS[index % CARD_COLORS.length];

    const latestUpdated = tasks.reduce<string | null>((acc, t) => {
        if (!acc || new Date(t.updatedAt) > new Date(acc)) return t.updatedAt;
        return acc;
    }, null);

    const now = new Date();

    return (
        <div
            className="relative flex flex-col folded-corner-card"
            style={getFoldedCornerStyle(cardBgColor)}
        >
            {/* The folded corner fold effect */}
            <div 
                className="absolute bottom-0 right-0 w-[22px] h-[22px]" 
                style={{
                    background: `linear-gradient(to top left, transparent 50%, rgba(0,0,0,0.04) 50%, rgba(0,0,0,0.1) 100%)`,
                    borderTopLeftRadius: '4px',
                    boxShadow: '-2px -2px 4px rgba(0,0,0,0.06)'
                }}
            />


            {/* Card content */}
            <div className="pt-5 px-4 pb-2">
                {/* Employee header */}
                <div className="flex items-center gap-3 mb-3">
                    {user.profilePhoto ? (
                        <img src={user.profilePhoto} alt={user.name} className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm" />
                    ) : (
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-white shadow-sm"
                            style={{ backgroundColor: aColor }}
                        >
                            {getInitials(user.name)}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-bold truncate" style={{ color: '#1a1a2e', fontFamily: 'Outfit, sans-serif' }}>
                                {user.name}
                            </div>
                            {/* Timer-only status chip */}
                            {isWorking ? (
                                <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                                    Working
                                </span>
                            ) : (
                                <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                    style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                    Away
                                </span>
                            )}
                        </div>
                        <div className="text-xs truncate" style={{ color: '#6B7280' }}>
                            {user.email}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px w-full mb-3" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />

                {/* Tasks */}
                <div className="flex flex-col gap-2">
                    {tasks.length === 0 ? (
                        <p className="text-xs text-center py-2" style={{ color: '#9CA3AF' }}>No tasks for this day</p>
                    ) : (
                        tasks.map(task => {
                            const sc = STATUS_CFG[task.status] ?? STATUS_CFG['todo'];
                            const isDone = task.status === 'completed';
                            return (
                                <div key={task._id} className="flex items-start gap-2">
                                    <span className="mt-0.5 shrink-0" style={{ color: sc.color }}>
                                        {sc.icon}
                                    </span>
                                    <span
                                        className="text-[13px] leading-snug"
                                        style={{
                                            color: isDone ? '#9CA3AF' : '#374151',
                                            textDecoration: isDone ? 'line-through' : 'none',
                                            fontWeight: isDone ? 400 : 500,
                                        }}
                                    >
                                        {task.title}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Meetings */}
                {meetings && meetings.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-dashed" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Meetings</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded">
                                {meetings.reduce((acc, m) => acc + (m.duration || 0), 0)} mins total
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {meetings.map(meeting => {
                                const end = new Date(meeting.scheduledAt);
                                end.setMinutes(end.getMinutes() + (meeting.duration || 0));
                                const isDone = end < now;
                                
                                // Format participants
                                const parts = meeting.participants?.map((p: any) => {
                                    if (p.userId && typeof p.userId === 'object' && p.userId.name) return p.userId.name;
                                    return p.name || p.externalEmail;
                                }).filter(Boolean) || [];
                                const participantsText = parts.length > 0 ? parts.join(', ') : '';

                                return (
                                    <div key={meeting._id} className="flex items-start gap-2">
                                        <span className="mt-0.5 shrink-0" style={{ color: isDone ? '#9CA3AF' : '#8b5cf6' }}>
                                            <Video size={14} />
                                        </span>
                                        <span
                                            className="text-[13px] leading-snug w-full"
                                            style={{
                                                color: isDone ? '#9CA3AF' : '#374151',
                                                textDecoration: isDone ? 'line-through' : 'none',
                                                fontWeight: isDone ? 400 : 500,
                                            }}
                                            title={meeting.title}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <span>{meeting.title}</span>
                                                <span className="text-[10px] opacity-70 whitespace-nowrap bg-gray-50 px-1 py-0.5 rounded border border-gray-100">
                                                    {meeting.duration || 0}m
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] opacity-70">
                                                    {formatTime(meeting.scheduledAt)}
                                                </span>
                                                {participantsText && (
                                                    <>
                                                        <span className="text-[10px] opacity-40">•</span>
                                                        <span className="text-[10px] opacity-70 truncate max-w-[120px]" title={participantsText}>
                                                            {participantsText}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            {latestUpdated && (
                <div className="mt-auto px-4 pb-3 pt-2 flex items-center gap-1">
                    <Clock size={11} style={{ color: '#9CA3AF' }} />
                    <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                        Updated {formatTime(latestUpdated)}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── Filter Tab ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'todo' | 'in-progress' | 'paused' | 'completed';

// ─── Main Component ──────────────────────────────────────────────────────────────────────

export default function DailyOverviewPage() {
    const user = useSelector((s: RootState) => s.auth.user);
    const isAdmin = hasModuleAdminAccess(user, 'projectManagement');

    if (!isAdmin) return <Navigate to="/tasks" replace />;

    const today = toLocalDateString(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const [statusFilter, setStatusFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const dateInputRef = useRef<HTMLInputElement>(null);

    const { data: tasksRes, isLoading } = useGetIndividualTasksQuery(
        { date: selectedDate },
        { pollingInterval: 5000 }
    );
    const allTasks = useMemo(() => (tasksRes?.data ?? []) as Task[], [tasksRes]);

    // Separate query without date filter — needed to detect activeTimers across ALL tasks
    // (a timer may be running on an overdue task from a previous day)
    const { data: timerStatusRes } = useGetTimerStatusesQuery(undefined, { pollingInterval: 5000 });
    const runningUserIds = useMemo(() => new Set(Object.keys(timerStatusRes?.data ?? {})), [timerStatusRes]);

    const { allMeetings } = useGlobalMeetings({ pollingInterval: 5000 });

    // Group by assignees (fallback to creator if no assignees)
    const groupedAll = useMemo(() => {
        const map = new Map<string, { user: UserInfo; tasks: Task[]; meetings: GlobalMeeting[] }>();
        allTasks.forEach(task => {
            // Check if task belongs to the selected day
            if (selectedDate) {
                const createdDate = task.createdAt ? toLocalDateString(new Date(task.createdAt)) : '';
                const completedDate = task.completedAt ? toLocalDateString(new Date(task.completedAt)) : (task.updatedAt ? toLocalDateString(new Date(task.updatedAt)) : '');
                
                const isCreatedThatDay = createdDate === selectedDate;
                const isInProgress = task.status === 'in-progress';
                const isCompletedThatDay = task.status === 'completed' && completedDate === selectedDate;
                
                if (!isCreatedThatDay && !isInProgress && !isCompletedThatDay) {
                    return; // skip this task
                }
            }

            const assignees = Array.isArray(task.assignees) ? task.assignees : [];
            const usersToGroup = assignees.length > 0 
                ? assignees.map(a => resolveUser(a as any)).filter(Boolean)
                : [resolveUser(task.createdBy as any)].filter(Boolean);

            usersToGroup.forEach(user => {
                if (!user) return;
                if (!map.has(user._id)) map.set(user._id, { user, tasks: [], meetings: [] });
                const userTasks = map.get(user._id)!.tasks;
                if (!userTasks.some(t => t._id === task._id)) {
                    userTasks.push(task);
                }
            });
        });

        // Filter and add meetings for the selected date
        if (selectedDate) {
            const [y, m, d] = selectedDate.split('-');
            const selStart = new Date(Number(y), Number(m) - 1, Number(d));
            selStart.setHours(0, 0, 0, 0);
            const selEnd = new Date(selStart);
            selEnd.setHours(23, 59, 59, 999);

            allMeetings.forEach(meeting => {
                if (!meeting.scheduledAt) return;
                const time = new Date(meeting.scheduledAt).getTime();
                if (time >= selStart.getTime() && time <= selEnd.getTime()) {
                    const usersToGroup: UserInfo[] = [];
                    if (meeting.createdBy) {
                        const creator = resolveUser(meeting.createdBy as any);
                        if (creator) usersToGroup.push(creator);
                    }
                    meeting.participants?.forEach(p => {
                        const participant = resolveUser(p.userId as any);
                        if (participant && !usersToGroup.some(u => u._id === participant._id)) {
                            usersToGroup.push(participant);
                        }
                    });

                    usersToGroup.forEach(user => {
                        if (!map.has(user._id)) map.set(user._id, { user, tasks: [], meetings: [] });
                        const userMeetings = map.get(user._id)!.meetings;
                        if (!userMeetings.some(m => m._id === meeting._id)) {
                            userMeetings.push(meeting);
                        }
                    });
                }
            });
        }

        return Array.from(map.values());
    }, [allTasks, allMeetings, selectedDate]);

    // Apply status filter on tasks within each card
    const grouped = useMemo(() => {
        if (statusFilter === 'all') return groupedAll;
        return groupedAll
            .map(g => ({ ...g, tasks: g.tasks.filter(t => t.status === statusFilter) }))
            .filter(g => g.tasks.length > 0 || g.meetings.length > 0);
    }, [groupedAll, statusFilter]);

    // Search filter
    const filtered = useMemo(() => {
        if (!search.trim()) return grouped;
        const q = search.toLowerCase();
        return grouped.filter(g => g.user.name.toLowerCase().includes(q) || g.user.email.toLowerCase().includes(q));
    }, [grouped, search]);

    // Status counts (across all tasks, not per-person)
    const counts = useMemo(() => {
        const c: Record<string, number> = { all: allTasks.length, todo: 0, 'in-progress': 0, paused: 0, completed: 0 };
        allTasks.forEach(t => { if (c[t.status] !== undefined) c[t.status]++; });
        return c;
    }, [allTasks]);

    // Timer status: use dedicated server-side endpoint for accurate real-time status
    // runningUserIds is built from the server's in-memory map (updated on start/pause)
    // Nothing else needed

    const isToday = selectedDate === today;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-transparent">

            {/* ── Header ── */}
            <div className="flex-none px-6 pt-2 pb-4">
                <div className="flex flex-wrap items-start gap-4 justify-between">
                    <div>
                        <h1
                            className="text-2xl font-bold"
                            style={{ color: '#111827', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}
                        >
                            Daily To-Do Overview
                        </h1>
                        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                            See what everyone is working on{isToday ? ' today' : ` on ${formatDisplayDate(selectedDate)}`}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Date picker */}
                        <label
                            className="relative flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all"
                            style={{ borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                            onClick={() => {
                                try {
                                    dateInputRef.current?.showPicker();
                                } catch (e) {
                                    // Ignore if showPicker is not supported in the browser
                                }
                            }}
                        >
                            <Calendar size={15} style={{ color: 'var(--color-primary)' }} />
                            <span>{formatDisplayDate(selectedDate)}</span>
                            <ChevronDown size={13} style={{ color: '#9CA3AF' }} />
                            <input
                                ref={dateInputRef}
                                type="date"
                                value={selectedDate}
                                max={today}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </label>

                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9CA3AF' }} />
                            <input
                                type="text"
                                placeholder="Search by employee..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10 pr-4 py-2.5 text-sm rounded-lg border outline-none transition-all"
                                style={{
                                    borderColor: '#D1D5DB',
                                    backgroundColor: '#FFFFFF',
                                    color: '#111827',
                                    width: '210px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                }}
                                onFocus={e => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
                            />
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="mt-5 flex items-center gap-3 overflow-x-auto pb-1 hide-scrollbar">
                    {[
                        { value: 'all', label: `All (${counts.all})`, activeColor: '#10B981', activeBg: '#F0FDF4' },
                        { value: 'todo', label: `To Do (${counts.todo})`, activeColor: '#3B82F6', activeBg: '#EFF6FF' },
                        { value: 'in-progress', label: `In Progress (${counts['in-progress']})`, activeColor: '#F59E0B', activeBg: '#FFFBEB' },
                        { value: 'completed', label: `Completed (${counts.completed})`, activeColor: '#10B981', activeBg: '#F0FDF4' },
                    ].map(f => {
                        const isActive = statusFilter === f.value;
                        return (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value as Filter)}
                                className="px-5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border"
                                style={{
                                    backgroundColor: f.activeBg,
                                    color: f.activeColor,
                                    borderColor: isActive ? f.activeColor : `${f.activeColor}40`,
                                    opacity: isActive ? 1 : 0.6,
                                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                                }}
                            >
                                {f.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-8 pt-10 pb-8">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="flex flex-col items-center gap-3">
                            <div
                                className="w-8 h-8 border-2 rounded-full animate-spin"
                                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                            />
                            <p className="text-sm" style={{ color: '#9CA3AF' }}>Loading todos…</p>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
                            <Calendar size={28} style={{ color: '#9CA3AF' }} />
                        </div>
                        <div className="text-center">
                            <p className="text-base font-semibold" style={{ color: '#374151' }}>No todos found</p>
                            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                                {search ? 'No employees match your search.' : 'No tasks were created on this day.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="grid gap-x-5 gap-y-10"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}
                    >
                        {filtered.map(({ user: u, tasks, meetings }, i) => (
                            <EmployeeCard 
                                key={u._id} 
                                user={u} 
                                tasks={tasks} 
                                meetings={meetings} 
                                index={i} 
                                isWorking={runningUserIds.has(u._id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
