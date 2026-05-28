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
import { useGetFinanceReceivablesQuery } from '@/features/finance/api/financeApi';
import ResolveFxRatesModal, { type FxRateRequiredWarning } from '@/components/ResolveFxRatesModal';

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

export default function FinanceReceivablesPage() {
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | ReceivableSource>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'overdue'>('all');

    const [showResolveFxModal, setShowResolveFxModal] = useState(false);

    const { data: receivablesData, isLoading } = useGetFinanceReceivablesQuery();
    const fxRateRequiredWarnings = useMemo<FxRateRequiredWarning[]>(
        () =>
            (receivablesData?.data?.warnings ?? []).filter(
                (w): w is FxRateRequiredWarning =>
                    w.code === 'FX_RATE_REQUIRED' &&
                    Boolean(w.projectId) &&
                    Boolean(w.phaseId) &&
                    Boolean(w.currency) &&
                    Boolean(w.date)
            ),
        [receivablesData]
    );

    const receivables = useMemo(() => {
        return (receivablesData?.data?.items || []).map((item: any): ReceivableItem => ({
            id: String(item.id || ''),
            source: item.source,
            sourceLabel: String(item.sourceLabel || ''),
            party: String(item.party || ''),
            title: String(item.title || ''),
            status: item.status,
            dueDate: item.dueDate ? getStartOfDay(new Date(item.dueDate)) : null,
            outstanding: Number(item.outstanding || 0),
            expected: Number(item.expected || 0),
            received: Number(item.received || 0),
        }));
    }, [receivablesData]);

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
        return receivablesData?.data?.summary || {
            totalOpen: 0,
            overdueAmount: 0,
            dueSoonAmount: 0,
            phaseAmount: 0,
            financeAmount: 0,
        };
    }, [receivablesData]);

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

            {fxRateRequiredWarnings.length > 0 && (
                <div
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                    style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}
                >
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold">Some receivables need FX review.</p>
                            <p className="text-xs mt-1">
                                {fxRateRequiredWarnings.length} receivable{fxRateRequiredWarnings.length === 1 ? '' : 's'} need a manual INR rate before they can be counted.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        id="resolve-fx-rates-receivables-btn"
                        onClick={() => setShowResolveFxModal(true)}
                        className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-yellow-100"
                        style={{ borderColor: '#F59E0B', color: '#92400E', whiteSpace: 'nowrap' }}
                    >
                        Fix now
                    </button>
                </div>
            )}


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

            {showResolveFxModal && fxRateRequiredWarnings.length > 0 && (
                <ResolveFxRatesModal
                    warnings={fxRateRequiredWarnings}
                    onClose={() => setShowResolveFxModal(false)}
                    onResolved={() => setShowResolveFxModal(false)}
                />
            )}
        </div>
    );
}
