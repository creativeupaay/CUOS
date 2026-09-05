import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useGetUsersQuery } from '@/features/auth/authApi';
import { projectApi } from '@/features/project/projectApi';
import { 
    Area, AreaChart, Cell, Pie, PieChart, 
    ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis 
} from 'recharts';
import { 
    CheckCircle2, Clock, Calendar, Download, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';

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

    const formatSafeDayDate = (dateVal: any) => {
        if (!dateVal) return 'N/A';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return 'N/A';
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[d.getDay()]}, ${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
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
                    
                    <button onClick={() => window.print()} className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors">
                        <Download size={16} />
                        Export Report
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

                        {/* Tables Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Daily Time Log */}
                            <div className="bg-white rounded-xl border p-4 shadow-sm col-span-1 print:break-inside-avoid" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-800">Daily Time Log</h3>
                                    <Calendar size={16} className="text-green-500" />
                                </div>
                                <div className="text-xs font-semibold text-gray-400 grid grid-cols-3 pb-2 border-b">
                                    <div>DATE</div>
                                    <div className="text-center">TASKS</div>
                                    <div className="text-right">TIME</div>
                                </div>
                                <div className="space-y-0 max-h-[300px] overflow-auto">
                                    {(data.dailyTimeLog || []).map((log: any, idx: number) => (
                                        <div key={idx} className="grid grid-cols-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors items-center text-sm">
                                            <div className="text-gray-700">
                                                {formatSafeDayDate(log.date)}
                                            </div>
                                            <div className="text-center text-gray-500">{Number(log.tasksCount) || 0} Tasks</div>
                                            <div className="text-right font-medium text-gray-700 flex items-center justify-end gap-1">
                                                {formatTime(Number(log.minutes) || 0)}
                                                <ChevronRight size={14} className="text-gray-400" />
                                            </div>
                                        </div>
                                    ))}
                                    {(!data.dailyTimeLog || data.dailyTimeLog.length === 0) && (
                                        <div className="py-8 text-center text-gray-400 text-sm">No time logs found.</div>
                                    )}
                                </div>
                            </div>

                            {/* All Tasks Completed */}
                            <div className="bg-white rounded-xl border p-4 shadow-sm col-span-2 print:break-inside-avoid" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-800">All Tasks Completed</h3>
                                    <button 
                                        onClick={() => {
                                            if (viewBy === 'me') {
                                                navigate('/tasks?activeTab=my');
                                            } else {
                                                navigate(`/tasks?activeTab=all&userId=${viewBy}`);
                                            }
                                        }}
                                        className="text-xs text-[var(--color-primary)] font-medium flex items-center gap-1 hover:underline">
                                        View all <ChevronRight size={14} />
                                    </button>
                                </div>
                                <div className="overflow-auto max-h-[300px]">
                                    <table className="w-full text-left text-sm">
                                        <thead className="text-xs text-gray-400 font-semibold bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="py-2.5 px-3 rounded-l-md font-medium">TASK NAME</th>
                                                <th className="py-2.5 px-3 font-medium">PROJECT</th>
                                                <th className="py-2.5 px-3 font-medium">COMPLETED ON</th>
                                                <th className="py-2.5 px-3 font-medium">TIME TAKEN</th>
                                                <th className="py-2.5 px-3 rounded-r-md font-medium">PRIORITY</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {(data.completedTasks || []).map((task: any) => (
                                                <tr key={task.id || task._id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                                            <span className="font-medium text-gray-700 truncate max-w-[150px]">{task.name || 'Untitled Task'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-500">{task.project || 'General'}</td>
                                                    <td className="py-3 px-3 text-gray-500">
                                                        {formatSafeDateTime(task.completedOn)}
                                                    </td>
                                                    <td className="py-3 px-3 text-gray-700 font-medium">{formatTime(Number(task.timeTakenMinutes) || 0)}</td>
                                                    <td className="py-3 px-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-2 h-2 rounded-full ${task.priority === 'high' || task.priority === 'critical' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-orange-400' : 'bg-green-500'}`} />
                                                            <span className="capitalize text-gray-600 text-xs font-medium">{task.priority || 'normal'}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!data.completedTasks || data.completedTasks.length === 0) && (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
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
        </div>
    );
}
