import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    Calendar,
    Clock3,
    Filter,
    FolderKanban,
    Loader2,
    Receipt,
    Search,
    Wallet,
} from 'lucide-react';
import { useGetRevenuesQuery } from '@/features/finance/api/financeApi';
import { useGetProjectsQuery } from '@/features/project/projectApi';

type ReceivableSource = 'finance-revenue' | 'phase-payment';
type ReceivableStatus = 'pending' | 'partial' | 'overdue';

type ReceivableItem = {
    id: string;
    source: ReceivableSource;
    sourceLabel: string;
    party: string;
    title: string;
    status: ReceivableStatus;
    dueDate: Date | null;
    outstanding: number;
    expected: number;
    received: number;
};

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(value);

const formatCompactCurrency = (value: number) => {
    if (Math.abs(value) >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (Math.abs(value) >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (Math.abs(value) >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
    return formatCurrency(value);
};

const formatDate = (date: Date | null) => {
    if (!date) return 'No due date';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysDiff = (from: Date, to: Date) => Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));

const getPhaseExpectedAmount = (phase: any, project: any) => {
    if (Number(phase?.paymentAmount || 0) > 0) return Number(phase.paymentAmount || 0);
    if (Number(phase?.paymentPercentage || 0) > 0 && Number(project?.budget || 0) > 0) {
        return (Number(project.budget || 0) * Number(phase.paymentPercentage || 0)) / 100;
    }
    return 0;
};

export default function FinanceReceivablesPage() {
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | ReceivableSource>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'overdue'>('all');

    const { data: revenuesData, isLoading: revenuesLoading } = useGetRevenuesQuery({
        page: 1,
        limit: 1000,
    });
    const { data: projectsData, isLoading: projectsLoading } = useGetProjectsQuery({});

    const receivables = useMemo(() => {
        const today = getStartOfDay(new Date());
        const openRevenues = (revenuesData?.data?.revenues || [])
            .filter((item: any) => ['pending', 'partial', 'overdue'].includes(String(item?.status || '').toLowerCase()))
            .map((item: any): ReceivableItem | null => {
                const expected = Number(item?.totalAmount || item?.amountINR || item?.amount || 0);
                const received = Number(item?.receivedAmount || 0);
                const outstanding = Math.max(0, expected - received);
                if (outstanding <= 0) return null;

                const dueDate = item?.dueDate ? getStartOfDay(new Date(item.dueDate)) : null;
                const status: ReceivableStatus = dueDate && dueDate < today
                    ? 'overdue'
                    : (String(item?.status || 'pending').toLowerCase() === 'partial' ? 'partial' : 'pending');

                return {
                    id: String(item?._id || ''),
                    source: 'finance-revenue',
                    sourceLabel: 'Finance Revenue',
                    party: String(item?.client || 'Unknown client'),
                    title: String(item?.description || item?.invoiceNumber || 'Receivable'),
                    status,
                    dueDate,
                    outstanding,
                    expected,
                    received,
                };
            })
            .filter((item: ReceivableItem | null): item is ReceivableItem => Boolean(item));

        const phaseReceivables = (projectsData?.data || []).flatMap((project: any) => {
            const phases = project?.phases || [];
            return phases
                .filter((phase: any) => phase?.hasPayment)
                .map((phase: any, index: number): ReceivableItem | null => {
                    const expected = getPhaseExpectedAmount(phase, project);
                    const received = Number(phase?.paymentReceivedAmount || 0);
                    const outstanding = Math.max(0, expected - received);
                    const statusRaw = String(phase?.paymentStatus || 'pending').toLowerCase();

                    if (outstanding <= 0 || !['pending', 'partial'].includes(statusRaw)) {
                        return null;
                    }

                    const dueDateRaw = phase?.paymentDueDate || phase?.endDate || null;
                    const dueDate = dueDateRaw ? getStartOfDay(new Date(dueDateRaw)) : null;
                    const status: ReceivableStatus = dueDate && dueDate < today
                        ? 'overdue'
                        : (statusRaw === 'partial' ? 'partial' : 'pending');

                    return {
                        id: `${String(project?._id || 'project')}-${String(phase?._id || index)}`,
                        source: 'phase-payment',
                        sourceLabel: 'Project Phase',
                        party: String(project?.name || 'Project'),
                        title: `Phase: ${String(phase?.name || 'Unnamed')}`,
                        status,
                        dueDate,
                        outstanding,
                        expected,
                        received,
                    };
                })
                .filter((item: ReceivableItem | null): item is ReceivableItem => Boolean(item));
        });

        return [...openRevenues, ...phaseReceivables].sort((a, b) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.getTime() - b.dueDate.getTime();
        });
    }, [projectsData, revenuesData]);

    const filteredItems = useMemo(() => {
        const today = getStartOfDay(new Date());

        return receivables.filter((item) => {
            if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
            if (statusFilter === 'overdue' && !(item.dueDate && item.dueDate < today)) return false;
            if (statusFilter === 'due' && item.dueDate && item.dueDate < today) return false;

            const q = search.trim().toLowerCase();
            if (!q) return true;
            return [item.party, item.title, item.sourceLabel]
                .join(' ')
                .toLowerCase()
                .includes(q);
        });
    }, [receivables, search, sourceFilter, statusFilter]);

    const stats = useMemo(() => {
        const today = getStartOfDay(new Date());
        const totalOpen = receivables.reduce((acc, item) => acc + item.outstanding, 0);
        const overdueAmount = receivables
            .filter((item) => item.dueDate && item.dueDate < today)
            .reduce((acc, item) => acc + item.outstanding, 0);
        const dueSoonAmount = receivables
            .filter((item) => {
                if (!item.dueDate) return false;
                const d = daysDiff(today, item.dueDate);
                return d >= 0 && d <= 7;
            })
            .reduce((acc, item) => acc + item.outstanding, 0);
        const phaseAmount = receivables
            .filter((item) => item.source === 'phase-payment')
            .reduce((acc, item) => acc + item.outstanding, 0);

        return { totalOpen, overdueAmount, dueSoonAmount, phaseAmount };
    }, [receivables]);

    const isLoading = revenuesLoading || projectsLoading;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <Link to="/finance" className="transition-colors hover:underline" style={{ color: 'var(--color-text-muted)' }}>
                    Finance Dashboard
                </Link>
                <span>{'>'}</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>Receivables</span>
            </div>

            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Receivables Audit</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    Unified view of pending finance invoices and project phase-wise due pipeline.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Total Open Receivables', value: stats.totalOpen, icon: Wallet, color: '#0EA5E9', bg: '#F0F9FF' },
                    { label: 'Overdue Amount', value: stats.overdueAmount, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
                    { label: 'Due in 7 Days', value: stats.dueSoonAmount, icon: Clock3, color: '#F59E0B', bg: '#FFFBEB' },
                    { label: 'Phase-wise Pipeline', value: stats.phaseAmount, icon: FolderKanban, color: '#16A34A', bg: '#F0FDF4' },
                ].map((card) => (
                    <div key={card.label} className="rounded-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: card.bg }}>
                                <card.icon size={20} style={{ color: card.color }} />
                            </div>
                        </div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>{card.label}</p>
                        <p className="mt-2 text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatCompactCurrency(card.value)}</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(card.value)}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <div className="relative lg:col-span-2">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by project, client, or title"
                            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                        />
                    </div>
                    <div className="relative">
                        <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <select
                            value={sourceFilter}
                            onChange={(e) => setSourceFilter(e.target.value as 'all' | ReceivableSource)}
                            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                        >
                            <option value="all">All Sources</option>
                            <option value="finance-revenue">Finance Revenue</option>
                            <option value="phase-payment">Project Phase</option>
                        </select>
                    </div>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'due' | 'overdue')}
                            className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"
                            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
                        >
                            <option value="all">All Dates</option>
                            <option value="due">Not Overdue</option>
                            <option value="overdue">Overdue Only</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Pending Receivables Detail ({filteredItems.length})
                    </h2>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Receipt size={48} className="mb-3" style={{ color: 'var(--color-text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No receivables found for selected filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px]">
                            <thead>
                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Source</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Party</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Item</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Due Date</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Expected</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Received</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Outstanding</th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, index) => {
                                    const overdue = item.status === 'overdue';
                                    const dueSoon = item.dueDate ? daysDiff(getStartOfDay(new Date()), item.dueDate) <= 7 && daysDiff(getStartOfDay(new Date()), item.dueDate) >= 0 : false;
                                    return (
                                        <tr
                                            key={item.id}
                                            className="transition-colors hover:bg-gray-50"
                                            style={{ borderTop: index > 0 ? '1px solid #E5E7EB' : undefined }}
                                        >
                                            <td className="px-5 py-3 text-sm" style={{ color: '#111827' }}>
                                                <span
                                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                                    style={{
                                                        backgroundColor: item.source === 'phase-payment' ? '#ECFDF5' : '#EEF2FF',
                                                        color: item.source === 'phase-payment' ? '#166534' : '#3730A3',
                                                    }}
                                                >
                                                    {item.sourceLabel}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-sm font-medium" style={{ color: '#111827' }}>{item.party}</td>
                                            <td className="px-5 py-3 text-sm" style={{ color: '#374151' }}>{item.title}</td>
                                            <td className="px-5 py-3 text-sm" style={{ color: '#374151' }}>{formatDate(item.dueDate)}</td>
                                            <td className="px-5 py-3 text-sm text-right" style={{ color: '#6B7280' }}>{formatCurrency(item.expected)}</td>
                                            <td className="px-5 py-3 text-sm text-right" style={{ color: '#6B7280' }}>{formatCurrency(item.received)}</td>
                                            <td className="px-5 py-3 text-sm text-right font-semibold" style={{ color: overdue ? '#DC2626' : '#111827' }}>{formatCurrency(item.outstanding)}</td>
                                            <td className="px-5 py-3 text-sm text-center">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                                    style={{
                                                        backgroundColor: overdue ? '#FEF2F2' : (dueSoon ? '#FFFBEB' : '#F0FDF4'),
                                                        color: overdue ? '#B91C1C' : (dueSoon ? '#B45309' : '#166534'),
                                                    }}
                                                >
                                                    {overdue ? 'Overdue' : dueSoon ? 'Due Soon' : item.status === 'partial' ? 'Partial' : 'Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
