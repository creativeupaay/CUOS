import { useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/store';
import { useGetIndividualTasksQuery } from '@/features/project';
import { useGetTimerStatusesQuery } from '@/features/project/projectApi';
import { useGetUsersQuery } from '@/features/auth/authApi';
import { useGetLeavesQuery } from '@/features/hrms';
import { hasModuleAdminAccess, hasModuleViewAccess, getRoleName } from '@/utils/modulePermissions';
import { Search, Calendar, CheckCircle2, Circle, Clock, ChevronDown, Pause, Video, Bell, Timer, Eye, EyeOff, X, SlidersHorizontal } from 'lucide-react';
import type { Task } from '@/features/project';
import { useGlobalMeetings, type GlobalMeeting } from '@/hooks/useGlobalMeetings';
import { usePingUserMutation } from '@/features/notification/api/notificationApi';
import toast from 'react-hot-toast';
import ModalPortal from '@/components/ui/ModalPortal';

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

function formatDateTime(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${datePart}, ${timePart}`;
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

type EmployeeCardProps = {
    user: UserInfo;
    tasks: Task[];
    meetings: GlobalMeeting[];
    index: number;
    isWorking: boolean;
    isEnded: boolean;
    onPing: (userId: string, type: 'todo' | 'timer') => void;
    isPinging: boolean;
    isHidden?: boolean;
    onToggleHide?: () => void;
};

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

function EmployeeCard({
    user,
    tasks,
    meetings,
    index,
    isWorking,
    isEnded,
    onPing,
    isPinging,
    isHidden,
    onToggleHide,
}: EmployeeCardProps) {
    const aColor = avatarColor(user.name);
    const cardBgColor = CARD_COLORS[index % CARD_COLORS.length];

    const latestUpdated = tasks.reduce<string | null>((acc, t) => {
        if (!acc || new Date(t.updatedAt) > new Date(acc)) return t.updatedAt;
        return acc;
    }, null);

    const now = new Date();

    return (
        <div
            className="relative flex flex-col folded-corner-card transition-all"
            style={{
                ...getFoldedCornerStyle(cardBgColor),
                opacity: isHidden ? 0.6 : 1,
                border: isHidden ? '2px dashed #FDA4AF' : undefined,
            }}
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
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
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
                                ) : isEnded ? (
                                    <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                                        style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                                        Checked out
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

                    {/* Hide / Unhide card button */}
                    {onToggleHide && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleHide();
                            }}
                            title={isHidden ? `Unhide ${user.name}` : `Hide ${user.name}'s card`}
                            className="p-1.5 rounded-lg transition-all cursor-pointer shrink-0 ml-1 hover:scale-105"
                            style={{
                                backgroundColor: isHidden ? '#FFE4E6' : 'transparent',
                                color: isHidden ? '#E11D48' : '#9CA3AF',
                            }}
                            onMouseEnter={(e) => {
                                if (!isHidden) {
                                    e.currentTarget.style.backgroundColor = '#F3F4F6';
                                    e.currentTarget.style.color = '#374151';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isHidden) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#9CA3AF';
                                }
                            }}
                        >
                            {isHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                        </button>
                    )}
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
                                {meetings.reduce((acc, m) => {
                                    const p = m.participants?.find((p: any) => p.userId && (p.userId === user._id || p.userId._id === user._id));
                                    return acc + (p?.actualDuration ?? (m as any).actualDuration ?? m.duration ?? 0);
                                }, 0)} mins total
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
                                                    {(() => {
                                                        const p = meeting.participants?.find((p: any) => p.userId && (p.userId === user._id || p.userId._id === user._id));
                                                        return p?.actualDuration ?? (meeting as any).actualDuration ?? meeting.duration ?? 0;
                                                    })()}m
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

            {/* Footer - Last updated chip */}
            {latestUpdated && (
                <div className="mt-auto px-4 pb-3 pt-2">
                    <div
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                        style={{
                            backgroundColor: '#F8FAFC',
                            color: '#475569',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                        }}
                    >
                        <Clock size={11} className="text-slate-400 shrink-0" />
                        <span>Updated {formatDateTime(latestUpdated)}</span>
                    </div>
                </div>
            )}

            {/* Admin Ping Buttons */}
            <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
                {tasks.length === 0 && (
                    <button
                        disabled={isPinging}
                        onClick={() => onPing(user._id, 'todo')}
                        title="Ping employee to add their daily tasks"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}
                    >
                        <Bell size={11} />
                        Ping: Add todos
                    </button>
                )}
                {!isWorking && (
                    <button
                        disabled={isPinging}
                        onClick={() => onPing(user._id, 'timer')}
                        title="Ping employee to start their timer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#DBEAFE', color: '#1E3A8A', border: '1px solid #3B82F6' }}
                    >
                        <Timer size={11} />
                        Ping: Start timer
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Filter Tab ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'todo' | 'in-progress' | 'paused' | 'completed';

// ─── Main Component ──────────────────────────────────────────────────────────────────────

export default function DailyOverviewPage() {
    const user = useSelector((s: RootState) => s.auth.user);
    // Allow both Project Management admins AND HR admins to see the daily overview
    const isPmAdmin = hasModuleAdminAccess(user, 'projectManagement');
    const isHrAdmin = hasModuleAdminAccess(user, 'hrms') || hasModuleViewAccess(user, 'hrms');
    const isAdmin = isPmAdmin || isHrAdmin;

    if (!isAdmin) return <Navigate to="/tasks" replace />;

    const today = toLocalDateString(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const [statusFilter, setStatusFilter] = useState<Filter>('all');
    const [search, setSearch] = useState('');
    const dateInputRef = useRef<HTMLInputElement>(null);

    // ─── Hidden Employee Cards State (Stored in localStorage) ───
    const STORAGE_KEY = 'cuos_daily_overview_hidden_users';
    const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const arr = JSON.parse(stored);
                if (Array.isArray(arr)) return new Set(arr);
            }
        } catch {
            // ignore parse errors
        }
        return new Set<string>();
    });
    const [showHiddenInGrid, setShowHiddenInGrid] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [manageSearch, setManageSearch] = useState('');

    const saveHiddenUserIds = (next: Set<string>) => {
        setHiddenUserIds(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
        } catch {
            // ignore storage errors
        }
    };

    const handleToggleHide = (targetUserId: string, targetName?: string) => {
        const next = new Set(hiddenUserIds);
        if (next.has(targetUserId)) {
            next.delete(targetUserId);
            saveHiddenUserIds(next);
            toast.success(`Unhid ${targetName || 'employee'}`);
        } else {
            next.add(targetUserId);
            saveHiddenUserIds(next);
            toast.success(`Hidden ${targetName || 'employee'}. Manage anytime from "Manage Cards"`);
        }
    };

    const handleUnhideAll = () => {
        saveHiddenUserIds(new Set());
        toast.success('All employee cards unhidden');
    };

    const handleHideAll = (allIds: string[]) => {
        saveHiddenUserIds(new Set(allIds));
        toast.success('All employee cards hidden');
    };

    const { data: tasksRes, isLoading } = useGetIndividualTasksQuery(
        { date: selectedDate },
        { pollingInterval: 30000 } // 30s — reduced from 5s to limit bandwidth
    );
    const allTasks = useMemo(() => (tasksRes?.data ?? []) as Task[], [tasksRes]);

    // Separate query without date filter — needed to detect activeTimers across ALL tasks
    // (a timer may be running on an overdue task from a previous day)
    const { data: timerStatusRes } = useGetTimerStatusesQuery(undefined, { pollingInterval: 30000 }); // 30s — reduced from 5s
    const timerStatuses = timerStatusRes?.data ?? {};
    const runningUserIds = useMemo(() => new Set(Object.entries(timerStatuses).filter(([_, s]) => s.status === 'running').map(([k]) => k)), [timerStatuses]);
    const endedUserIds = useMemo(() => new Set(Object.entries(timerStatuses).filter(([_, s]) => s.isEnded).map(([k]) => k)), [timerStatuses]);

    const { allMeetings } = useGlobalMeetings({ pollingInterval: 30000 }); // 30s — reduced from 5s

    const { data: usersData } = useGetUsersQuery();
    const allUsers = useMemo(() => ((usersData?.data as any)?.users ?? []) as any[], [usersData]);

    // Fetch approved leaves — used to hide employees who are on leave for the selected date
    const { data: leavesData } = useGetLeavesQuery({ status: 'approved', limit: 500 });
    const allLeaves = useMemo(() => (leavesData?.data?.leaves ?? []) as any[], [leavesData]);

    // Build a Set of userId strings for employees on leave on the selected date
    const onLeaveUserIds = useMemo(() => {
        const ids = new Set<string>();
        const selDate = new Date(selectedDate + 'T12:00:00');
        if (selDate.getDay() === 0) return ids; // Sunday is weekly off, not a leave day
        allLeaves.forEach(leave => {
            if (leave.status !== 'approved') return;
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            if (selDate >= start && selDate <= end) {
                // employeeId may be a populated Employee object with userId
                const emp = leave.employeeId;
                if (emp && typeof emp === 'object' && emp.userId) {
                    const uid = typeof emp.userId === 'object' ? emp.userId._id : emp.userId;
                    if (uid) ids.add(String(uid));
                }
            }
        });
        return ids;
    }, [allLeaves, selectedDate]);

    // Build a Set of user IDs that are partners (role name = 'partner')
    const partnerUserIds = useMemo(() => {
        const ids = new Set<string>();
        allUsers.forEach(u => {
            if (getRoleName(u.role) === 'partner') {
                ids.add(String(u._id));
            }
        });
        return ids;
    }, [allUsers]);

    // Admin ping
    const [pingUser] = usePingUserMutation();
    const [pingingUserId, setPingingUserId] = useState<string | null>(null);

    const handlePing = async (targetUserId: string, pingType: 'todo' | 'timer') => {
        setPingingUserId(targetUserId);
        try {
            await pingUser({ targetUserId, pingType }).unwrap();
            toast.success(`Ping sent! ${pingType === 'todo' ? '📋' : '⏱️'}`);
        } catch {
            toast.error('Failed to send ping. Please try again.');
        } finally {
            setPingingUserId(null);
        }
    };

    // Group by assignees (fallback to creator if no assignees)
    const groupedAll = useMemo(() => {
        const map = new Map<string, { user: UserInfo; tasks: Task[]; meetings: GlobalMeeting[] }>();
        allTasks.forEach(task => {
            if (task.title?.trim().toLowerCase() === 'unallocated time') return;

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
                    const isStrictSync = meeting.source === 'google_meet' && meeting.conferenceStatus === 'ended' && time > new Date('2026-08-18').getTime();
                    const usersToGroup: UserInfo[] = [];

                    meeting.participants?.forEach(p => {
                        const participant = resolveUser(p.userId as any);
                        if (participant && !usersToGroup.some(u => u._id === participant._id)) {
                            if (isStrictSync) {
                                if (p.actualDuration && p.actualDuration > 0) {
                                    usersToGroup.push(participant);
                                }
                            } else {
                                usersToGroup.push(participant);
                            }
                        }
                    });

                    if (meeting.createdBy) {
                        const creator = resolveUser(meeting.createdBy as any);
                        if (creator && !usersToGroup.some(u => u._id === creator._id)) {
                            if (!isStrictSync) {
                                usersToGroup.push(creator);
                            }
                        }
                    }

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

        // Add all active, non-partner users so admins can ping them even if they have no tasks/meetings
        allUsers.forEach(user => {
            const roleNameStr = getRoleName(user.role);
            const isPartner = roleNameStr === 'partner';
            if (user.isActive && !isPartner && !map.has(user._id)) {
                map.set(user._id, { user, tasks: [], meetings: [] });
            }
        });

        // Remove entries for inactive users, partners, or users on leave
        for (const [id, _] of map) {
            // Check against the full allUsers list for isActive / role
            const fullUser = allUsers.find(u => String(u._id) === id);
            if (fullUser) {
                const roleStr = getRoleName(fullUser.role);
                if (!fullUser.isActive || roleStr === 'partner') {
                    map.delete(id);
                    continue;
                }
            }
            // Remove users on approved leave for the selected date
            if (onLeaveUserIds.has(id)) {
                map.delete(id);
            }
        }

        return Array.from(map.values());
    }, [allTasks, allMeetings, selectedDate, allUsers, onLeaveUserIds, partnerUserIds]);

    // Apply status filter on tasks within each card
    const grouped = useMemo(() => {
        if (statusFilter === 'all') return groupedAll;
        return groupedAll
            .map(g => ({ ...g, tasks: g.tasks.filter(t => t.status === statusFilter) }))
            .filter(g => g.tasks.length > 0 || g.meetings.length > 0 || runningUserIds.has(g.user._id));
    }, [groupedAll, statusFilter, runningUserIds]);

    // Apply hide filter (unless showHiddenInGrid is true)
    const visibleGrouped = useMemo(() => {
        if (showHiddenInGrid) return grouped;
        return grouped.filter(g => !hiddenUserIds.has(g.user._id));
    }, [grouped, hiddenUserIds, showHiddenInGrid]);

    // Search filter
    const filtered = useMemo(() => {
        if (!search.trim()) return visibleGrouped;
        const q = search.toLowerCase();
        return visibleGrouped.filter(g => g.user.name.toLowerCase().includes(q) || g.user.email.toLowerCase().includes(q));
    }, [visibleGrouped, search]);

    // All unique card users for the management modal
    const allCardUsers = useMemo(() => {
        const map = new Map<string, UserInfo>();
        groupedAll.forEach(g => {
            if (!map.has(g.user._id)) {
                map.set(g.user._id, g.user);
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [groupedAll]);

    // Filtered manage users in modal
    const filteredManageUsers = useMemo(() => {
        if (!manageSearch.trim()) return allCardUsers;
        const q = manageSearch.toLowerCase();
        return allCardUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }, [allCardUsers, manageSearch]);

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

                        {/* Manage Cards Button */}
                        <button
                            type="button"
                            onClick={() => setShowManageModal(true)}
                            className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer hover:bg-gray-50 active:scale-95"
                            style={{
                                borderColor: hiddenUserIds.size > 0 ? '#FECDD3' : '#D1D5DB',
                                backgroundColor: hiddenUserIds.size > 0 ? '#FFF1F2' : '#FFFFFF',
                                color: hiddenUserIds.size > 0 ? '#BE123C' : '#374151',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                            title="Manage visible and hidden employee cards"
                        >
                            {hiddenUserIds.size > 0 ? (
                                <>
                                    <EyeOff size={15} style={{ color: '#E11D48' }} />
                                    <span>{hiddenUserIds.size} Hidden</span>
                                </>
                            ) : (
                                <>
                                    <SlidersHorizontal size={15} style={{ color: 'var(--color-primary)' }} />
                                    <span>Manage Cards</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Filters & Hidden Cards Bar */}
                <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 overflow-x-auto pb-1 hide-scrollbar">
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
                                    className="px-5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer"
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

                    {/* Hidden cards indicator */}
                    {hiddenUserIds.size > 0 && (
                        <div
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border shrink-0 transition-all"
                            style={{ backgroundColor: '#FFF1F2', borderColor: '#FECDD3', color: '#BE123C' }}
                        >
                            <EyeOff size={13} />
                            <span>{hiddenUserIds.size} employee{hiddenUserIds.size !== 1 ? 's' : ''} hidden</span>
                            <span className="text-gray-300">•</span>
                            <button
                                type="button"
                                onClick={handleUnhideAll}
                                className="font-semibold underline hover:text-rose-900 cursor-pointer"
                            >
                                Unhide All
                            </button>
                        </div>
                    )}
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
                            {hiddenUserIds.size > 0 && grouped.length > 0 && !search ? (
                                <EyeOff size={28} style={{ color: '#E11D48' }} />
                            ) : (
                                <Calendar size={28} style={{ color: '#9CA3AF' }} />
                            )}
                        </div>
                        <div className="text-center">
                            {hiddenUserIds.size > 0 && grouped.length > 0 && !search ? (
                                <>
                                    <p className="text-base font-semibold" style={{ color: '#374151' }}>
                                        All cards are currently hidden
                                    </p>
                                    <p className="text-sm mt-1 mb-3" style={{ color: '#9CA3AF' }}>
                                        You have hidden {hiddenUserIds.size} employee card{hiddenUserIds.size !== 1 ? 's' : ''}.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleUnhideAll}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-sm hover:opacity-90"
                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                    >
                                        Unhide All Cards
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p className="text-base font-semibold" style={{ color: '#374151' }}>No todos found</p>
                                    <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>
                                        {search ? 'No employees match your search.' : 'No tasks were created on this day.'}
                                    </p>
                                </>
                            )}
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
                                isEnded={endedUserIds.has(u._id)}
                                onPing={handlePing}
                                isPinging={pingingUserId === u._id}
                                isHidden={hiddenUserIds.has(u._id)}
                                onToggleHide={() => handleToggleHide(u._id, u.name)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Manage Cards Modal ── */}
            {showManageModal && (
                <ModalPortal onClick={() => setShowManageModal(false)}>
                    <div
                        className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative"
                        style={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E5E7EB',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between pb-4 border-b" style={{ borderColor: '#F3F4F6' }}>
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
                                        <SlidersHorizontal size={17} />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                        Manage Employee Cards
                                    </h2>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Show or hide employee cards to customize your Daily Overview.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowManageModal(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Quick action bar */}
                        <div className="py-3 flex items-center justify-between gap-3 border-b" style={{ borderColor: '#F3F4F6' }}>
                            <div className="text-xs font-medium text-gray-600">
                                <span className="font-bold text-gray-900">
                                    {Math.max(0, allCardUsers.length - hiddenUserIds.size)}
                                </span> of {allCardUsers.length} cards visible
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleUnhideAll}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
                                >
                                    <Eye size={12} />
                                    Unhide All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleHideAll(allCardUsers.map(u => u._id))}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer border border-rose-200"
                                >
                                    <EyeOff size={12} />
                                    Hide All
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="pt-3 pb-2">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search employee..."
                                    value={manageSearch}
                                    onChange={(e) => setManageSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition-all"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                                />
                            </div>
                        </div>

                        {/* Scrollable employee list */}
                        <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1 hide-scrollbar" style={{ minHeight: '220px', maxHeight: '340px' }}>
                            {filteredManageUsers.length === 0 ? (
                                <div className="text-center py-8 text-xs text-gray-400">
                                    No employees found matching &quot;{manageSearch}&quot;
                                </div>
                            ) : (
                                filteredManageUsers.map((u) => {
                                    const isHidden = hiddenUserIds.has(u._id);
                                    const aColor = avatarColor(u.name);
                                    return (
                                        <div
                                            key={u._id}
                                            onClick={() => handleToggleHide(u._id, u.name)}
                                            className="flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer hover:border-gray-300"
                                            style={{
                                                backgroundColor: isHidden ? '#FFF1F2' : '#F9FAFB',
                                                borderColor: isHidden ? '#FECDD3' : '#F3F4F6',
                                                opacity: isHidden ? 0.75 : 1,
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                {u.profilePhoto ? (
                                                    <img src={u.profilePhoto} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                                ) : (
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                                        style={{ backgroundColor: aColor }}
                                                    >
                                                        {getInitials(u.name)}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-xs font-semibold text-gray-900 truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>
                                                        {u.name}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 truncate">
                                                        {u.email}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleHide(u._id, u.name);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                                                style={{
                                                    backgroundColor: isHidden ? '#FFE4E6' : '#DCFCE7',
                                                    color: isHidden ? '#BE123C' : '#15803D',
                                                    border: `1px solid ${isHidden ? '#FDA4AF' : '#86EFAC'}`,
                                                }}
                                            >
                                                {isHidden ? (
                                                    <>
                                                        <EyeOff size={13} />
                                                        <span>Hidden</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye size={13} />
                                                        <span>Visible</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t mt-2 flex items-center justify-between" style={{ borderColor: '#F3F4F6' }}>
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={showHiddenInGrid}
                                    onChange={(e) => setShowHiddenInGrid(e.target.checked)}
                                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span>Show hidden cards dimmed in grid</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowManageModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-sm hover:opacity-95"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}
