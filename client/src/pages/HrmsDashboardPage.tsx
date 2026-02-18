import { useGetDashboardStatsQuery, useGetEmployeesQuery } from '@/features/hrms/hrmsApi';
import { useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, UserMinus, CalendarDays, Briefcase,
    ArrowRight, Building2, TrendingUp, Clock, Award,
} from 'lucide-react';

export default function HrmsDashboardPage() {
    const navigate = useNavigate();
    const { data, isLoading } = useGetDashboardStatsQuery();
    const { data: empData } = useGetEmployeesQuery({ limit: 5 });

    const stats = data?.data;
    const recentEmployees = empData?.data?.employees || [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <Clock size={40} className="mx-auto mb-3 animate-pulse" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const statCards = [
        { label: 'Total Employees', value: stats?.totalEmployees || 0, icon: Users, color: '#3B82F6', bg: '#EFF6FF' },
        { label: 'Active', value: stats?.activeEmployees || 0, icon: UserCheck, color: '#10B981', bg: '#ECFDF5' },
        { label: 'On Notice', value: stats?.onNotice || 0, icon: UserMinus, color: '#F59E0B', bg: '#FFFBEB' },
        { label: 'Pending Leaves', value: stats?.pendingLeaves || 0, icon: CalendarDays, color: '#EF4444', bg: '#FEF2F2' },
        { label: 'Onboarding', value: stats?.onboardingCount || 0, icon: Briefcase, color: '#8B5CF6', bg: '#F5F3FF' },
    ];

    const getDeptColor = (d: string) => {
        const colors: Record<string, string> = {
            engineering: '#3B82F6', design: '#8B5CF6', marketing: '#F59E0B',
            finance: '#10B981', hr: '#EC4899', admin: '#6B7280',
        };
        return colors[d] || '#6B7280';
    };

    const quickLinks = [
        { label: 'Manage Employees', desc: 'View, add, and edit employee profiles', path: '/hrms/employees', icon: Users, color: '#3B82F6' },
        { label: 'Leave Management', desc: 'Review and approve leave requests', path: '/hrms/leaves', icon: CalendarDays, color: '#10B981' },
        { label: 'Payroll', desc: 'Generate and manage salary payouts', path: '/hrms/payroll', icon: Award, color: '#8B5CF6' },
    ];

    return (
        <div className="mx-auto" style={{ maxWidth: '1200px' }}>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-1">
                    <TrendingUp size={24} style={{ color: 'var(--color-primary)' }} />
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>HR Dashboard</h1>
                </div>
                <p className="text-sm ml-9" style={{ color: 'var(--color-text-secondary)' }}>
                    Overview of your organization's workforce — {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-5 gap-4 mb-8">
                {statCards.map((card) => (
                    <div key={card.label} className="rounded-xl border p-5 transition-all hover:shadow-md"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.bg }}>
                                <card.icon size={22} style={{ color: card.color }} />
                            </div>
                        </div>
                        <div className="text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{card.value}</div>
                        <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{card.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Department Breakdown */}
                <div className="col-span-1 rounded-xl border p-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <div className="flex items-center gap-2 mb-5">
                        <Building2 size={18} style={{ color: 'var(--color-primary)' }} />
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Departments</h2>
                    </div>
                    <div className="space-y-4">
                        {(stats?.departments || []).map((dept) => {
                            const total = stats?.totalEmployees || 1;
                            const pct = Math.round((dept.count / total) * 100);
                            const color = getDeptColor(dept._id);
                            return (
                                <div key={dept._id}>
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <span className="capitalize font-medium" style={{ color: 'var(--color-text-primary)' }}>{dept._id}</span>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '15', color }}>{dept.count}</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                        <div className="h-2 rounded-full transition-all" style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
                                    </div>
                                </div>
                            );
                        })}
                        {(stats?.departments?.length || 0) === 0 && (
                            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>No department data yet</p>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="col-span-1 rounded-xl border p-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--color-text-primary)' }}>Quick Actions</h2>
                    <div className="space-y-3">
                        {quickLinks.map((link) => (
                            <button key={link.label}
                                onClick={() => navigate(link.path)}
                                className="w-full flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm"
                                style={{ borderColor: 'var(--color-border-default)' }}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: link.color + '15' }}>
                                    <link.icon size={20} style={{ color: link.color }} />
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{link.label}</div>
                                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{link.desc}</div>
                                </div>
                                <ArrowRight size={16} style={{ color: 'var(--color-text-muted)' }} />
                            </button>
                        ))}
                    </div>
                </div>

                {/* Recent Employees */}
                <div className="col-span-1 rounded-xl border p-6" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Recent Employees</h2>
                        <button onClick={() => navigate('/hrms/employees')} className="text-xs font-medium cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                            View All →
                        </button>
                    </div>
                    <div className="space-y-3">
                        {recentEmployees.length === 0 ? (
                            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>No employees yet</p>
                        ) : (
                            recentEmployees.map((emp) => (
                                <button key={emp._id}
                                    onClick={() => navigate(`/hrms/employees/${emp._id}`)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-gray-50"
                                    style={{ borderBottom: '1px solid var(--color-border-default)' }}>
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                        style={{ backgroundColor: getDeptColor(emp.department) }}>
                                        {(emp.userId as any)?.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {(emp.userId as any)?.name || 'Unknown'}
                                        </div>
                                        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {emp.designation} · {emp.department}
                                        </div>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                                        style={{
                                            backgroundColor: emp.status === 'active' ? '#ECFDF5' : '#FEF3C7',
                                            color: emp.status === 'active' ? '#059669' : '#92400E',
                                        }}>
                                        {emp.status}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
