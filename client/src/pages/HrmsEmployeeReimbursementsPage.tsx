import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Search, Clock, CheckCircle, DollarSign,
    Users, ChevronRight, AlertTriangle, User,
    BarChart2,
} from 'lucide-react';
import { useGetEmployeesReimbursementOverviewQuery } from '@/features/hrms/hrmsApi';

// ── Types ──────────────────────────────────────────────────────────────

type EmployeeRow = {
    _id: string;
    employee: { _id: string; employeeId: string; department: string; designation: string };
    user: { _id: string; name: string; email: string };
    pendingAmount: number;
    pendingCount: number;
    approvedAmount: number;
    approvedCount: number;
    paidAmount: number;
    paidCount: number;
    paidThisMonthAmount: number;
    paidThisMonthCount: number;
    rejectedCount: number;
    totalAmount: number;
    totalCount: number;
};

// ── Helpers ────────────────────────────────────────────────────────────

function fmt(n: number) {
    return `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getInitials(name: string) {
    return name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('');
}

// Avatar colours cycle
const AVATAR_COLORS = [
    '#4F46E5', '#0891B2', '#059669', '#D97706',
    '#DC2626', '#7C3AED', '#DB2777', '#2563EB',
];
function avatarColor(name: string) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Org-wide summary card ──────────────────────────────────────────────

function OrgStatCard({
    label, value, sub, icon: Icon, bg, color,
}: {
    label: string; value: string; sub?: string;
    icon: React.FC<any>; bg: string; color: string;
}) {
    return (
        <div
            className="rounded-2xl border p-5 flex items-center gap-4"
            style={{
                borderColor: 'var(--color-border-default)',
                backgroundColor: 'var(--color-bg-surface)',
            }}
        >
            <div className="p-3 rounded-xl shrink-0" style={{ backgroundColor: bg }}>
                <Icon size={20} style={{ color }} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    {label}
                </p>
                <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                    {value}
                </p>
                {sub && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Employee List Row ──────────────────────────────────────────────────

function EmployeeListRow({ emp, onClick }: { emp: EmployeeRow; onClick: () => void }) {
    const outstanding = emp.pendingAmount + emp.approvedAmount;
    const color = avatarColor(emp.user.name);

    return (
        <tr
            onClick={onClick}
            className="border-b transition-colors cursor-pointer group hover:bg-gray-50"
            style={{ borderColor: 'var(--color-border-default)' }}
        >
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: color }}
                    >
                        {getInitials(emp.user.name) || <User size={15} />}
                    </div>
                    <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {emp.user.name}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {emp.employee.designation || '—'}
                            {emp.employee.department ? ` · ${emp.employee.department}` : ''}
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-4">
                <p className="text-sm font-bold" style={{ color: '#B45309' }}>{fmt(emp.pendingAmount)}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.pendingCount} claim{emp.pendingCount !== 1 ? 's' : ''}</p>
            </td>
            <td className="px-4 py-4">
                <p className="text-sm font-bold" style={{ color: '#15803D' }}>{fmt(emp.approvedAmount)}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.approvedCount} claim{emp.approvedCount !== 1 ? 's' : ''}</p>
            </td>
            <td className="px-4 py-4">
                <p className="text-sm font-bold" style={{ color: '#1D4ED8' }}>{fmt(emp.paidThisMonthAmount)}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.paidThisMonthCount} this month</p>
            </td>
            <td className="px-4 py-4">
                {outstanding > 0 ? (
                    <div>
                        <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#C2410C' }}>
                            <AlertTriangle size={13} /> {fmt(outstanding)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.pendingCount + emp.approvedCount} claims</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <CheckCircle size={13} style={{ color: '#15803D' }} />
                        <span className="text-sm font-semibold" style={{ color: '#15803D' }}>Clear</span>
                    </div>
                )}
            </td>
            <td className="px-4 py-4 text-right">
                <ChevronRight size={18} className="inline-block transition-colors" style={{ color: 'var(--color-text-muted)' }} />
            </td>
        </tr>
    );
}

// ── Skeleton Row ──────────────────────────────────────────────────────

function SkeletonRow() {
    return (
        <tr className="border-b animate-pulse" style={{ borderColor: 'var(--color-border-default)' }}>
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200" />
                    <div>
                        <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
                        <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                </div>
            </td>
            <td className="px-4 py-4"><div className="h-4 w-16 bg-gray-100 rounded mb-1" /><div className="h-3 w-10 bg-gray-50 rounded" /></td>
            <td className="px-4 py-4"><div className="h-4 w-16 bg-gray-100 rounded mb-1" /><div className="h-3 w-10 bg-gray-50 rounded" /></td>
            <td className="px-4 py-4"><div className="h-4 w-16 bg-gray-100 rounded mb-1" /><div className="h-3 w-10 bg-gray-50 rounded" /></td>
            <td className="px-4 py-4"><div className="h-4 w-20 bg-gray-100 rounded" /></td>
            <td className="px-4 py-4"></td>
        </tr>
    );
}

// ── Sort options ───────────────────────────────────────────────────────

type SortKey = 'outstanding' | 'pending' | 'total' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'outstanding', label: 'Most Outstanding' },
    { key: 'pending', label: 'Most Pending' },
    { key: 'total', label: 'Highest Total' },
    { key: 'name', label: 'Name A–Z' },
];

function sortEmployees(list: EmployeeRow[], key: SortKey): EmployeeRow[] {
    return [...list].sort((a, b) => {
        if (key === 'outstanding') return (b.pendingAmount + b.approvedAmount) - (a.pendingAmount + a.approvedAmount);
        if (key === 'pending') return b.pendingAmount - a.pendingAmount;
        if (key === 'total') return b.totalAmount - a.totalAmount;
        return a.user.name.localeCompare(b.user.name);
    });
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function HrmsEmployeeReimbursementsPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortKey>('outstanding');

    const { data, isLoading } = useGetEmployeesReimbursementOverviewQuery();
    const allEmployees: EmployeeRow[] = data?.data?.employees || [];

    // Filter
    const filtered = allEmployees.filter((e) => {
        const q = search.toLowerCase();
        return (
            e.user.name.toLowerCase().includes(q) ||
            e.user.email.toLowerCase().includes(q) ||
            (e.employee.department || '').toLowerCase().includes(q) ||
            (e.employee.designation || '').toLowerCase().includes(q) ||
            (e.employee.employeeId || '').toLowerCase().includes(q)
        );
    });

    const sorted = sortEmployees(filtered, sort);

    // Org-wide totals
    const totals = allEmployees.reduce(
        (acc, e) => ({
            pending: acc.pending + e.pendingAmount,
            pendingCount: acc.pendingCount + e.pendingCount,
            approved: acc.approved + e.approvedAmount,
            approvedCount: acc.approvedCount + e.approvedCount,
            paidThisMonth: acc.paidThisMonth + e.paidThisMonthAmount,
            paidThisMonthCount: acc.paidThisMonthCount + e.paidThisMonthCount,
            total: acc.total + e.totalAmount,
            totalCount: acc.totalCount + e.totalCount,
        }),
        { pending: 0, pendingCount: 0, approved: 0, approvedCount: 0, paidThisMonth: 0, paidThisMonthCount: 0, total: 0, totalCount: 0 }
    );

    const outstanding = totals.pending + totals.approved;

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/hrms/reimbursements')}
                        className="p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-colors"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                        title="Back to Org Reimbursements"
                    >
                        <ArrowLeft size={17} />
                    </button>
                    <div>
                        
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            Combined totals and claim history per team member
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Org-wide summary cards ─────────────────────────── */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-24 rounded-2xl border animate-pulse" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }} />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <OrgStatCard
                        label="Total Pending Review"
                        value={fmt(totals.pending)}
                        sub={`${totals.pendingCount} claim${totals.pendingCount !== 1 ? 's' : ''} awaiting action`}
                        icon={Clock}
                        bg="#FEF3C7"
                        color="#B45309"
                    />
                    <OrgStatCard
                        label="Approved (Awaiting Payout)"
                        value={fmt(totals.approved)}
                        sub={`${totals.approvedCount} claim${totals.approvedCount !== 1 ? 's' : ''} to disburse`}
                        icon={CheckCircle}
                        bg="#DCFCE7"
                        color="#15803D"
                    />
                    <OrgStatCard
                        label="Paid This Month"
                        value={fmt(totals.paidThisMonth)}
                        sub={`${totals.paidThisMonthCount} claim${totals.paidThisMonthCount !== 1 ? 's' : ''} paid`}
                        icon={DollarSign}
                        bg="#DBEAFE"
                        color="#1D4ED8"
                    />
                    <OrgStatCard
                        label="Total Outstanding"
                        value={fmt(outstanding)}
                        sub={`Pending + Approved · ${totals.pendingCount + totals.approvedCount} claims`}
                        icon={AlertTriangle}
                        bg="#FFF7ED"
                        color="#C2410C"
                    />
                </div>
            )}

            {/* ── Search + Sort toolbar ──────────────────────────── */}
            <div
                className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >
                {/* Search */}
                <div className="relative flex-1 min-w-[220px]">
                    <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, department..."
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-subtle)',
                            color: 'var(--color-text-primary)',
                        }}
                    />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <BarChart2 size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <div
                        className="flex gap-1 p-1 rounded-xl"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        {SORT_OPTIONS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setSort(key)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-all whitespace-nowrap"
                                style={
                                    sort === key
                                        ? {
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-primary)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                          }
                                        : { color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <span className="text-sm ml-auto shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                    {sorted.length} employee{sorted.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* ── Employee List ──────────────────────────────────── */}
            <div
                className="overflow-hidden rounded-2xl border"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead
                            className="text-xs uppercase tracking-wider"
                            style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                        >
                            <tr className="border-b" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}>
                                <th className="px-4 py-3 font-semibold">Employee</th>
                                <th className="px-4 py-3 font-semibold">Pending</th>
                                <th className="px-4 py-3 font-semibold">Approved</th>
                                <th className="px-4 py-3 font-semibold">Paid (This Month)</th>
                                <th className="px-4 py-3 font-semibold">Outstanding</th>
                                <th className="px-4 py-3 font-semibold text-right"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)
                            ) : sorted.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-24 text-center">
                                        <Users size={48} className="mx-auto mb-4" style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                                        <p className="text-base font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                                            {search ? 'No employees match your search' : 'No reimbursement data found'}
                                        </p>
                                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
                                            {search ? 'Try a different search term' : 'Employees who submit claims will appear here'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                sorted.map((emp) => (
                                    <EmployeeListRow
                                        key={emp._id}
                                        emp={emp}
                                        onClick={() => navigate(`/hrms/reimbursements/employees/${emp.employee._id}`, { state: { emp } })}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
