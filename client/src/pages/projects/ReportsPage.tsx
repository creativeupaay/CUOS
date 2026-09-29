import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useGetUsersQuery } from '@/features/auth/authApi';
import { projectApi } from '@/features/project/projectApi';
import { 
    Area, AreaChart, Cell, Pie, PieChart, 
    ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis 
} from 'recharts';
import { 
    CheckCircle2, Clock, Calendar, ChevronRight, ChevronDown, Home, Briefcase, Video, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { AiWorkReportModal } from './components/AiWorkReportModal';

export default function ReportsPage() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    const roleName = user?.role
        ? typeof user.role === 'object'
            ? (user.role as any).name?.toLowerCase()
            : String(user.role).toLowerCase()
        : '';
    const isAdmin = ['super-admin', 'super_admin', 'admin'].includes(roleName);

    const [viewBy, setViewBy] = useState<string>('me');
    const [timeRange, setTimeRange] = useState<'this-week' | 'last-week' | 'last-month' | 'custom'>('this-week');
    const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [generateAiReport, { data: aiReportResponse, isLoading: isGeneratingAiReport, error: aiReportError }] = 
        projectApi.useGenerateAiReportMutation();

    const toggleDateExpand = (dateKey: string) => {
        setExpandedDates(prev => ({
            ...prev,
            [dateKey]: !prev[dateKey]
        }));
    };

    const handleOpenAiReport = async () => {
        if (viewBy === 'everyone') {
            toast.error('AI Report requires an individual employee. Please select a specific team member from the dropdown.', {
                duration: 4000,
                icon: '💡'
            });
            return;
        }

        const targetUserId = viewBy === 'me' ? user?._id : viewBy;
        if (!targetUserId) {
            toast.error('User information is not available. Please try again.');
            return;
        }

        setIsAiModalOpen(true);
        try {
            await generateAiReport({
                targetUserId,
                startDate,
                endDate
            }).unwrap();
        } catch (err: any) {
            console.error('Failed to generate AI report:', err);
        }
    };

    const handleRetryAiReport = () => {
        const targetUserId = viewBy === 'me' ? user?._id : viewBy;
        if (targetUserId) {
            generateAiReport({
                targetUserId,
                startDate,
                endDate
            });
        }
    };

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
                setShowDatePicker(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate dates based on timeRange
    const { startDate, endDate } = useMemo(() => {
        const end = new Date();
        const start = new Date();
        if (timeRange === 'this-week') {
            start.setDate(end.getDate() - 6);
        } else if (timeRange === 'last-week') {
            end.setDate(end.getDate() - 7);
            start.setDate(end.getDate() - 6);
        } else if (timeRange === 'last-month') {
            start.setDate(end.getDate() - 29); // Enforce exactly 30 days inclusive
        } else if (timeRange === 'custom') {
            return {
                startDate: new Date(customStartDate).toISOString(),
                endDate: new Date(customEndDate).toISOString()
            };
        }
        return { 
            startDate: start.toISOString(), 
            endDate: end.toISOString() 
        };
    }, [timeRange, customStartDate, customEndDate]);

    const { data: usersResponse } = useGetUsersQuery(undefined, { skip: !isAdmin });
    const users = Array.isArray(usersResponse?.data)
        ? usersResponse.data
        : (usersResponse?.data?.users || []);
    
    const displayUsers = users.filter((u: any) => {
        const uRoleName = u?.role
            ? typeof u.role === 'object'
                ? (u.role as any).name?.toLowerCase()
                : String(u.role).toLowerCase()
            : '';
        // Exclude: super admins, current user, partners, and inactive (removed) users
        if (['super-admin', 'super_admin'].includes(uRoleName)) return false;
        if (u._id === user?._id) return false;
        if (uRoleName === 'partner') return false;
        if (u.isActive === false) return false;
        return true;
    });

    const { data: response, isLoading } = projectApi.useGetReportsDashboardQuery({
        viewBy,
        startDate,
        endDate
    });

    const data = response?.data;

    const displayDailyLogs = useMemo(() => {
        return (data?.dailyTimeLog || []).filter((log: any) => {
            const totalMins = Number(log.workMinutes || log.minutes || 0) + Number(log.meetingMinutes || 0);
            // Do not show Sunday if no work was logged
            if (log.day === 'Sun' && totalMins === 0) return false;
            // Do not show declared company holidays if no work was logged
            if (log.attendanceStatus === 'holiday' && totalMins === 0) return false;
            return true;
        });
    }, [data?.dailyTimeLog]);

    // Helper functions for formatting
    const formatTime = (mins: number) => {
        if (!mins || isNaN(mins)) return '0h 0m';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    const formatSafeDateTime = (dateVal: any) => {
        if (!dateVal) return 'N/A';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return 'N/A';
        try {
            return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } catch {
            return 'N/A';
        }
    };


    const formatSafeShortDate = (dateVal: any) => {
        if (!dateVal) return '';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
    };

    const safeFormatRangeDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? dateStr : format(d, 'dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    const formatTableDate = (dateVal: any) => {
        if (!dateVal) return '—';
        try {
            const d = new Date(typeof dateVal === 'string' && !dateVal.includes('T') ? `${dateVal}T00:00:00` : dateVal);
            if (isNaN(d.getTime())) return String(dateVal);
            return format(d, 'dd MMM yyyy');
        } catch {
            return String(dateVal);
        }
    };

    const formatDurationDisplay = (mins: number | undefined | null) => {
        if (!mins || isNaN(mins) || mins <= 0) return '—';
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    const renderAttendanceBadge = (status: string | undefined, day: string, workMins: number, holidayName?: string | null) => {
        const s = (status || '').toLowerCase();
        if (s === 'present') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    Present
                </span>
            );
        }
        if (s === 'wfh') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 shadow-xs">
                    <Home size={13} className="text-blue-600 shrink-0" />
                    WFH
                </span>
            );
        }
        if (s === 'weekend' || day === 'Sun' || (day === 'Sat' && workMins === 0)) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shadow-xs">
                    <Home size={13} className="text-slate-400 shrink-0" />
                    Weekend
                </span>
            );
        }
        if (s === 'half-day' || s === 'half_day') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-xs">
                    <Clock size={13} className="text-amber-600 shrink-0" />
                    Half Day
                </span>
            );
        }
        if (s === 'absent') {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200/60 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    Absent
                </span>
            );
        }
        if (s === 'leave' || s === 'on-leave' || s === 'on_leave') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60 shadow-xs">
                    <Calendar size={13} className="text-purple-600 shrink-0" />
                    On Leave
                </span>
            );
        }
        if (s === 'holiday') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs" title={holidayName ? `Holiday: ${holidayName}` : 'Company Holiday'}>
                    <Calendar size={13} className="text-indigo-600 shrink-0" />
                    {holidayName ? `Holiday: ${holidayName}` : 'Holiday'}
                </span>
            );
        }
        if (workMins > 0) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-xs">
                    <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    Present
                </span>
            );
        }
        return <span className="text-gray-400 font-normal text-sm">—</span>;
    };

    const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#6B7280']; // Green, Blue, Amber, Purple, Gray

    const CATEGORY_COLORS: Record<string, string> = {
        'Time on Tasks': '#10B981',
        'Time in Meetings': '#3B82F6',
        'Break Time': '#F59E0B',
        'Others': '#8B5CF6',
    };

    return (
        <div className="flex flex-col min-h-full print:h-auto print:overflow-visible bg-[var(--color-bg-app)]">

            <div className="flex-1 p-6 space-y-6 print:p-0">
                {/* Filters Row */}
                <div className="flex items-center justify-between print:hidden">
                    <div className="flex items-center gap-4">
                        {isAdmin && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-600">View by</span>
                                <select 
                                    value={viewBy}
                                    onChange={(e) => setViewBy(e.target.value as any)}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                                >
                                    <option value="me">Me</option>
                                    <option value="everyone">All</option>
                                    {displayUsers.map((u: any) => (
                                        <option key={u._id} value={u._id}>{u.name || u.email}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Time Range</span>
                            <select 
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value as any)}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                            >
                                <option value="this-week">This Week</option>
                                <option value="last-week">Last Week</option>
                                <option value="last-month">Last Month</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div className="relative print:hidden" ref={datePickerRef}>
                            <button
                                onClick={() => setShowDatePicker(!showDatePicker)}
                                className="flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                            >
                                {safeFormatRangeDate(startDate)} - {safeFormatRangeDate(endDate)}
                                <Calendar size={16} className="text-gray-400" />
                            </button>
                            
                            {showDatePicker && (
                                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50 flex flex-col gap-3 min-w-[280px]">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex flex-col gap-1 flex-1">
                                            <span className="text-xs text-gray-500 font-medium">Start Date</span>
                                            <input 
                                                type="date" 
                                                value={customStartDate}
                                                onChange={e => {
                                                    setCustomStartDate(e.target.value);
                                                    setTimeRange('custom');
                                                }}
                                                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                                            />
                                        </div>
                                        <span className="text-gray-400 pt-5">-</span>
                                        <div className="flex flex-col gap-1 flex-1">
                                            <span className="text-xs text-gray-500 font-medium">End Date</span>
                                            <input 
                                                type="date" 
                                                value={customEndDate}
                                                onChange={e => {
                                                    setCustomEndDate(e.target.value);
                                                    setTimeRange('custom');
                                                }}
                                                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleOpenAiReport} 
                        disabled={isGeneratingAiReport}
                        className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-[0.98] transition-colors disabled:opacity-60"
                    >
                        <Sparkles size={15} className={isGeneratingAiReport ? "animate-spin" : ""} />
                        <span>AI Report</span>
                    </button>
                </div>

                {isLoading || !data ? (
                    <div className="flex justify-center py-20 text-gray-400">Loading reports...</div>
                ) : (
                    <>
                        {/* Metrics Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Total Tasks */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm print:break-inside-avoid md:col-span-2 flex flex-col" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="text-sm font-medium text-gray-500 mb-1">Total Tasks</div>
                                        <div className="text-3xl font-bold text-gray-800">{data.totalTasks?.total || 0}</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                        <CheckCircle2 size={24} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-auto">
                                    <div className="flex justify-between items-center bg-gray-50/80 px-3 py-2.5 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2.5 text-gray-600">
                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm" /> 
                                            <span className="font-medium">Completed</span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{data.totalTasks?.completed || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-50/80 px-3 py-2.5 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2.5 text-gray-600">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" /> 
                                            <span className="font-medium">In Progress</span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{data.totalTasks?.inProgress || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-50/80 px-3 py-2.5 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2.5 text-gray-600">
                                            <div className="w-2 h-2 rounded-full bg-gray-400 shadow-sm" /> 
                                            <span className="font-medium">To Do</span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{data.totalTasks?.toDo || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-50/80 px-3 py-2.5 rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-2.5 text-gray-600">
                                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm" /> 
                                            <span className="font-medium">Overdue</span>
                                        </div>
                                        <span className="font-semibold text-gray-800">{data.overdueTasks?.overdue || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Time Tracked */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm print:break-inside-avoid flex flex-col" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-sm font-medium text-gray-500 mb-1">Time Tracked</div>
                                        <div className="text-3xl font-bold text-gray-800">{formatTime(data.timeTracked?.thisPeriodMinutes || 0)}</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                        <Clock size={24} />
                                    </div>
                                </div>
                                <div className="space-y-2.5 mt-auto">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">This Period</span>
                                        <span className="font-medium text-gray-800">{formatTime(data.timeTracked?.thisPeriodMinutes || 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Last Period</span>
                                        <span className="font-medium text-gray-800">{formatTime(data.timeTracked?.lastPeriodMinutes || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Work Consistency */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm print:break-inside-avoid flex flex-col" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-sm font-medium text-gray-500 mb-1">Work Consistency</div>
                                        <div className="text-3xl font-bold text-gray-800">{data.workConsistency?.activeDays || 0} / {data.workConsistency?.totalDays || 6}</div>
                                    </div>
                                    <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                                        <Calendar size={24} />
                                    </div>
                                </div>
                                <div className="space-y-3 mt-auto">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Active Days</span>
                                        <span className="font-medium text-gray-800">{data.workConsistency?.activeDays || 0} / {data.workConsistency?.totalDays || 6}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Daily Avg. Time</span>
                                        <span className="font-medium text-gray-800">{formatTime(data.workConsistency?.dailyAvgMinutes || 0)}</span>
                                    </div>
                                    {(data.workConsistency?.activeDays || 0) > 4 && (
                                        <div className="text-xs text-green-500 font-medium pt-1">Excellent</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Time Spent Trend */}
                            <div className="bg-white rounded-xl border p-4 shadow-sm col-span-1 print:break-inside-avoid" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-bold text-gray-800">Time Spent Trend</h3>
                                </div>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.timeSpentTrend || []} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis 
                                                dataKey="date" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tickFormatter={formatSafeShortDate}
                                                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                                dy={10}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false}
                                                tickFormatter={(val) => `${Math.floor((Number(val) || 0)/60)}h`}
                                                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                                            />
                                            <RechartsTooltip 
                                                formatter={(val: any) => formatTime(Number(val) || 0)}
                                                labelFormatter={(lbl) => {
                                                    if (!lbl) return '';
                                                    const d = new Date(lbl);
                                                    return isNaN(d.getTime()) ? String(lbl) : d.toLocaleDateString();
                                                }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                            />
                                            <Area type="linear" dataKey="minutes" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorMinutes)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Top Projects */}
                            <div className="bg-white rounded-xl border p-5 shadow-sm col-span-1 flex flex-col print:break-inside-avoid" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-bold text-gray-800">Top Projects</h3>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time Spent</span>
                                </div>
                                <div className="flex-1 flex flex-col gap-5 justify-center overflow-y-auto pr-1">
                                    {(!data.topProjects || data.topProjects.length === 0) ? (
                                        <div className="flex items-center justify-center h-full text-sm text-gray-400">No data available</div>
                                    ) : (
                                        data.topProjects.map((project: any, index: number) => {
                                            const maxMinutes = Math.max(...data.topProjects.map((p: any) => Number(p.minutes) || 0), 1);
                                            const projMins = Number(project.minutes) || 0;
                                            const percentage = Math.min(100, Math.max(0, (projMins / maxMinutes) * 100));
                                            const color = COLORS[index % COLORS.length];
                                            return (
                                                <div key={index} className="flex flex-col gap-2 group">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="font-semibold text-gray-700 truncate pr-4 group-hover:text-gray-900 transition-colors">{project.projectName || 'General / Other'}</span>
                                                        <span className="text-xs font-bold text-gray-500 whitespace-nowrap">{formatTime(projMins)}</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                        <div 
                                                            className="h-full rounded-full transition-all duration-1000 ease-out" 
                                                            style={{ 
                                                                width: `${percentage}%`, 
                                                                backgroundColor: color,
                                                                boxShadow: `0 0 10px ${color}60`,
                                                                WebkitPrintColorAdjust: 'exact',
                                                                printColorAdjust: 'exact'
                                                            }} 
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Time Distribution */}
                            <div className="bg-white rounded-xl border p-4 shadow-sm col-span-1 print:break-inside-avoid" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-bold text-gray-800">Time Distribution</h3>
                                </div>
                                {(() => {
                                    const totalDistMinutes = (data.timeDistribution || []).reduce((acc: number, cur: any) => acc + (Number(cur?.minutes) || 0), 0);
                                    const activeDistribution = (data.timeDistribution || []).filter((entry: any) => (Number(entry?.minutes) || 0) > 0);

                                    return (
                                        <div className="h-48 flex items-center">
                                            <div className="w-1/2 h-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        {totalDistMinutes === 0 ? (
                                                            <Pie
                                                                data={[{ category: 'No time logged', minutes: 1 }]}
                                                                innerRadius={45}
                                                                outerRadius={65}
                                                                dataKey="minutes"
                                                                stroke="none"
                                                                isAnimationActive={false}
                                                            >
                                                                <Cell fill="#E2E8F0" />
                                                            </Pie>
                                                        ) : (
                                                            <Pie
                                                                data={activeDistribution}
                                                                innerRadius={45}
                                                                outerRadius={65}
                                                                paddingAngle={activeDistribution.length > 1 ? 2 : 0}
                                                                dataKey="minutes"
                                                                stroke="none"
                                                            >
                                                                {activeDistribution.map((entry: any, index: number) => (
                                                                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || COLORS[index % COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                        )}
                                                        {totalDistMinutes > 0 && (
                                                            <RechartsTooltip 
                                                                formatter={(val: any) => formatTime(Number(val))}
                                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                                            />
                                                        )}
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="w-1/2 space-y-2.5 pl-2">
                                                {(data.timeDistribution || []).map((entry: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs gap-1.5">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[entry.category] || COLORS[idx % COLORS.length] }} />
                                                            <span className="text-gray-600 truncate font-medium" title={entry.category}>{entry.category}</span>
                                                        </div>
                                                        <span className="font-semibold text-gray-800 shrink-0 tabular-nums">{formatTime(Number(entry.minutes) || 0)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Tables Section - Stacked Vertically */}
                        <div className="space-y-6">
                            {/* 1. Daily Time Log (Full Width) */}
                            <div className="bg-white rounded-xl border shadow-sm print:break-inside-avoid overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-800">Daily Time Log</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">Daily breakdown of attendance, working hours, meetings, and completed tasks</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 font-medium">{displayDailyLogs.length} Days</span>
                                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                                            <Calendar size={16} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-500">
                                                <th className="py-3.5 px-6 font-bold text-gray-700">Date</th>
                                                <th className="py-3.5 px-4 font-semibold">Day</th>
                                                <th className="py-3.5 px-4 font-semibold">Attendance</th>
                                                <th className="py-3.5 px-4 font-semibold">Work Time</th>
                                                <th className="py-3.5 px-4 font-semibold">Meetings</th>
                                                <th className="py-3.5 px-4 font-semibold text-center">Tasks Worked</th>
                                                <th className="py-3.5 px-4 font-semibold text-center">Completed</th>
                                                <th className="py-3.5 px-6 text-right w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {displayDailyLogs.map((log: any, idx: number) => {
                                                const hasDetails = (log.tasks && log.tasks.length > 0) || (log.meetings && log.meetings.length > 0) || (Number(log.workMinutes || log.minutes) > 0);
                                                const isExpanded = !!expandedDates[log.date];
                                                return (
                                                    <Fragment key={log.date || idx}>
                                                        <tr 
                                                            onClick={() => hasDetails && toggleDateExpand(log.date)}
                                                            className={`transition-colors ${hasDetails ? 'cursor-pointer hover:bg-gray-50/80' : 'hover:bg-gray-50/40'} ${isExpanded ? 'bg-gray-50/60' : ''}`}
                                                        >
                                                            <td className="py-4 px-6 font-semibold text-gray-800 whitespace-nowrap">
                                                                {formatTableDate(log.date)}
                                                            </td>
                                                            <td className="py-4 px-4 font-medium text-gray-600 whitespace-nowrap">
                                                                {log.day || (log.date ? format(new Date(log.date), 'EEE') : '—')}
                                                            </td>
                                                            <td className="py-4 px-4 whitespace-nowrap">
                                                                {renderAttendanceBadge(log.attendanceStatus, log.day, Number(log.workMinutes || log.minutes) || 0, log.holidayName)}
                                                            </td>
                                                            <td className="py-4 px-4 font-medium text-gray-800 whitespace-nowrap">
                                                                {Number(log.workMinutes) > 0 ? (
                                                                    formatDurationDisplay(Number(log.workMinutes))
                                                                ) : (
                                                                    <span className="text-gray-400 font-normal">—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-4 px-4 font-medium text-gray-800 whitespace-nowrap">
                                                                {Number(log.meetingMinutes) > 0 ? (
                                                                    formatDurationDisplay(Number(log.meetingMinutes))
                                                                ) : (
                                                                    <span className="text-gray-400 font-normal">—</span>
                                                                )}
                                                            </td>
                                                            <td className="py-4 px-4 font-bold text-gray-800 text-center whitespace-nowrap">
                                                                {log.tasksWorkedCount ?? log.tasksCount ?? 0}
                                                            </td>
                                                            <td className="py-4 px-4 font-bold text-gray-800 text-center whitespace-nowrap">
                                                                {log.completedCount ?? 0}
                                                            </td>
                                                            <td className="py-4 px-6 text-right whitespace-nowrap">
                                                                {hasDetails ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleDateExpand(log.date);
                                                                        }}
                                                                        className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors"
                                                                        title={isExpanded ? "Collapse details" : "Expand details"}
                                                                    >
                                                                        <ChevronDown size={18} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-gray-700' : ''}`} />
                                                                    </button>
                                                                ) : (
                                                                    <span className="w-5 inline-block" />
                                                                )}
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr className="bg-slate-50/70 border-b border-gray-100">
                                                                <td colSpan={8} className="p-4 sm:px-8">
                                                                    <div className="bg-white rounded-xl border border-gray-200/90 p-5 shadow-xs space-y-4">
                                                                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                                                    Activity Breakdown for {formatTableDate(log.date)}
                                                                                </span>
                                                                                <span className="text-xs text-gray-400">({log.day})</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                                                <span>Work Time: <strong className="text-gray-800">{formatDurationDisplay(log.workMinutes)}</strong></span>
                                                                                <span>•</span>
                                                                                <span>Meetings: <strong className="text-gray-800">{formatDurationDisplay(log.meetingMinutes)}</strong></span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Tasks List */}
                                                                        {log.tasks && log.tasks.length > 0 ? (
                                                                            <div>
                                                                                <div className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                                                                                    <Briefcase size={14} className="text-gray-500" />
                                                                                    Tasks Worked ({log.tasks.length})
                                                                                </div>
                                                                                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/30">
                                                                                    {log.tasks.map((taskItem: any, tIdx: number) => (
                                                                                        <div key={tIdx} className="flex items-center justify-between p-3 text-xs hover:bg-white transition-colors">
                                                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                                                                                    taskItem.priority === 'high' || taskItem.priority === 'critical' ? 'bg-red-500' :
                                                                                                    taskItem.priority === 'medium' ? 'bg-orange-400' : 'bg-green-500'
                                                                                                }`} />
                                                                                                <span className="font-semibold text-gray-800 truncate max-w-[280px] sm:max-w-md" title={taskItem.title}>
                                                                                                    {taskItem.title}
                                                                                                </span>
                                                                                                <span className="px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600 border border-gray-200/60 shrink-0 font-medium">
                                                                                                    {taskItem.project}
                                                                                                </span>
                                                                                                {taskItem.status === 'completed' && (
                                                                                                    <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0 font-semibold flex items-center gap-1">
                                                                                                        <CheckCircle2 size={11} /> Completed
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="font-semibold text-gray-700 shrink-0 ml-4 tabular-nums text-sm">
                                                                                                {formatDurationDisplay(Number(taskItem.minutes) || 0)}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}

                                                                        {/* Meetings List */}
                                                                        {log.meetings && log.meetings.length > 0 ? (
                                                                            <div>
                                                                                <div className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                                                                                    <Video size={14} className="text-gray-500" />
                                                                                    Meetings Attended ({log.meetings.length})
                                                                                </div>
                                                                                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden bg-gray-50/30">
                                                                                    {log.meetings.map((meetItem: any, mIdx: number) => (
                                                                                        <div key={mIdx} className="flex items-center justify-between p-3 text-xs hover:bg-white transition-colors">
                                                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                                                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                                                                                <span className="font-medium text-gray-800 truncate">{meetItem.title}</span>
                                                                                            </div>
                                                                                            <div className="font-semibold text-gray-700 shrink-0 ml-4 tabular-nums text-sm">
                                                                                                {formatDurationDisplay(Number(meetItem.durationMinutes) || 0)}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        ) : null}

                                                                        {(!log.tasks || log.tasks.length === 0) && (!log.meetings || log.meetings.length === 0) && (
                                                                            <div className="text-xs text-gray-400 py-3 text-center italic">
                                                                                No individual task or meeting logs recorded for this day.
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                            {(!displayDailyLogs || displayDailyLogs.length === 0) && (
                                                <tr>
                                                    <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                                                        No daily time logs recorded in this period.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* 2. All Tasks Completed (Full Width) */}
                            <div className="bg-white rounded-xl border shadow-sm print:break-inside-avoid overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-800">All Tasks Completed</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">Tasks completed during the selected time period</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (viewBy === 'me') {
                                                navigate('/tasks?activeTab=my');
                                            } else {
                                                navigate(`/tasks?activeTab=all&userId=${viewBy}`);
                                            }
                                        }}
                                        className="text-xs text-[var(--color-primary)] font-semibold flex items-center gap-1 hover:underline transition-all">
                                        View all <ChevronRight size={14} />
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-100 bg-gray-50/50 text-xs font-semibold text-gray-400">
                                                <th className="py-3 px-6 font-medium">TASK NAME</th>
                                                <th className="py-3 px-4 font-medium">PROJECT</th>
                                                <th className="py-3 px-4 font-medium">COMPLETED ON</th>
                                                <th className="py-3 px-4 font-medium">TIME TAKEN</th>
                                                <th className="py-3 px-6 font-medium">PRIORITY</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(data.completedTasks || []).map((task: any) => (
                                                <tr key={task.id || task._id} className="hover:bg-gray-50/70 transition-colors">
                                                    <td className="py-3.5 px-6">
                                                        <div className="flex items-center gap-2.5">
                                                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                            <span className="font-semibold text-gray-800 truncate max-w-sm" title={task.name}>{task.name || 'Untitled Task'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-gray-600 font-medium">{task.project || 'General'}</td>
                                                    <td className="py-3.5 px-4 text-gray-500">
                                                        {formatSafeDateTime(task.completedOn)}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-gray-700 font-semibold">{formatTime(Number(task.timeTakenMinutes) || 0)}</td>
                                                    <td className="py-3.5 px-6">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-2 h-2 rounded-full ${task.priority === 'high' || task.priority === 'critical' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-orange-400' : 'bg-emerald-500'}`} />
                                                            <span className="capitalize text-gray-700 text-xs font-medium">{task.priority || 'normal'}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!data.completedTasks || data.completedTasks.length === 0) && (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                                                        No completed tasks found in this period.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* AI Weekly Work Report Modal */}
            <AiWorkReportModal
                isOpen={isAiModalOpen}
                onClose={() => setIsAiModalOpen(false)}
                report={aiReportResponse?.data || null}
                isLoading={isGeneratingAiReport}
                error={
                    aiReportError 
                        ? (typeof aiReportError === 'object' && 'data' in aiReportError && (aiReportError as any).data?.message)
                            ? (aiReportError as any).data.message
                            : 'Failed to generate AI report. Please try again.'
                        : null
                }
                onRetry={handleRetryAiReport}
            />
        </div>
    );
}
