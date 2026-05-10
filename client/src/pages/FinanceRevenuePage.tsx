import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    TrendingUp, IndianRupee, Clock, Receipt, Plus, X,
    Search, Calendar, Building2, Edit2, Trash2,
    Check, AlertCircle, Loader2, Globe,
} from 'lucide-react';
import {
    useGetRevenuesQuery,
    useCreateRevenueMutation,
    useUpdateRevenueMutation,
    useDeleteRevenueMutation,
} from '@/features/finance/api/financeApi';
import ModalPortal from '@/components/ui/ModalPortal';
import { logger } from '@/utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────
type RevenueSource = 'manual' | 'invoice' | 'project';
type RevenueStatus = 'received' | 'pending' | 'partial' | 'overdue';
type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

interface RevenueFormData {
    date: string;
    description: string;
    client: string;
    project?: string;
    amount: number;
    currency: Currency;
    exchangeRate: number;
    exchangeRateDate?: string;
    exchangeRateProvider?: string;
    amountINR: number;
    gstApplicable: boolean;
    gstRate: number;
    gst: number;
    tdsDeducted: number;
    totalAmount: number;
    receivedAmount: number;
    source: RevenueSource;
    status: RevenueStatus;
    invoiceNumber?: string;
    dueDate?: string;
    notes?: string;
}

// ── Currency Config ───────────────────────────────────────────────────────
const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

// ── Format Currency ───────────────────────────────────────────────────────
const formatCurrency = (value: number, currency: Currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatShortCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
    return formatCurrency(value);
};

// ── Status Badge Component ────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: RevenueStatus }) => {
    const config = {
        received: { label: 'Received', color: '#22C55E', bg: '#F0FDF4', icon: Check },
        pending: { label: 'Pending', color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
        partial: { label: 'Partial', color: '#6366F1', bg: '#EEF2FF', icon: AlertCircle },
        overdue: { label: 'Overdue', color: '#EF4444', bg: '#FEF2F2', icon: AlertCircle },
    };
    const { label, color, bg, icon: Icon } = config[status];

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: bg, color }}>
            <Icon size={12} />
            {label}
        </span>
    );
};

// ── Source Badge Component ────────────────────────────────────────────────
const SourceBadge = ({ source }: { source: RevenueSource }) => {
    const config = {
        manual: { label: 'Manual', color: '#8B5CF6', bg: '#F5F3FF' },
        invoice: { label: 'Invoice', color: '#0EA5E9', bg: '#F0F9FF' },
        project: { label: 'Project', color: '#10B981', bg: '#ECFDF5' },
    };
    const { label, color, bg } = config[source];

    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: bg, color }}>
            {label}
        </span>
    );
};

// ── Empty State Component ─────────────────────────────────────────────────
const EmptyState = () => (
    <div className="text-center py-12">
        <Receipt size={48} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
        <p className="text-sm" style={{ color: '#6B7280' }}>No revenue entries found</p>
        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Add your first revenue entry to get started</p>
    </div>
);

export default function FinanceRevenuePage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<RevenueStatus | 'all'>('all');
    const [filterSource, setFilterSource] = useState<RevenueSource | 'all'>('all');

    const initialFormData: RevenueFormData = {
        date: new Date().toISOString().split('T')[0],
        description: '',
        client: '',
        project: '',
        amount: 0,
        currency: 'INR',
        exchangeRate: 1,
        amountINR: 0,
        gstApplicable: true,
        gstRate: 18,
        gst: 0,
        tdsDeducted: 0,
        totalAmount: 0,
        receivedAmount: 0,
        source: 'manual',
        status: 'pending',
        invoiceNumber: '',
        dueDate: '',
        notes: '',
    };

    const [formData, setFormData] = useState<RevenueFormData>(initialFormData);

    // API Hooks
    const { data: revenuesData, isLoading } = useGetRevenuesQuery({
        status: filterStatus !== 'all' ? filterStatus : undefined,
        source: filterSource !== 'all' ? filterSource : undefined,
        search: searchQuery || undefined,
    });
    const [createRevenue, { isLoading: isCreating }] = useCreateRevenueMutation();
    const [updateRevenue, { isLoading: isUpdating }] = useUpdateRevenueMutation();
    const [deleteRevenue] = useDeleteRevenueMutation();

    const revenues = revenuesData?.data?.revenues || [];

    // Calculate metrics from actual data
    const metrics = {
        totalRevenue: revenues.reduce((acc: number, e: any) => acc + (e.amountINR || e.amount || 0), 0),
        received: revenues.reduce((acc: number, e: any) => acc + (e.receivedAmount || 0), 0),
        pending: revenues.reduce((acc: number, e: any) => {
            const total = e.amountINR || e.amount || 0;
            const received = e.receivedAmount || 0;
            return acc + (total - received);
        }, 0),
        gstCollected: revenues
            .filter((e: any) => e.status === 'received')
            .reduce((acc: number, e: any) => acc + (e.gst || 0), 0),
    };

    const metricCards = [
        { label: 'Total Revenue', value: formatShortCurrency(metrics.totalRevenue), fullValue: formatCurrency(metrics.totalRevenue), icon: TrendingUp, color: '#22C55E', bg: '#F0FDF4' },
        { label: 'Received', value: formatShortCurrency(metrics.received), fullValue: formatCurrency(metrics.received), icon: IndianRupee, color: '#6366F1', bg: '#EEF2FF' },
        { label: 'Pending', value: formatShortCurrency(metrics.pending), fullValue: formatCurrency(metrics.pending), icon: Clock, color: '#F59E0B', bg: '#FFFBEB' },
        { label: 'GST Collected', value: formatShortCurrency(metrics.gstCollected), fullValue: formatCurrency(metrics.gstCollected), icon: Receipt, color: '#0EA5E9', bg: '#F0F9FF' },
    ];

    // Auto-calculate amounts when form data changes
    useEffect(() => {
        const amountINR = formData.currency === 'INR' ? formData.amount : formData.amount * formData.exchangeRate;
        const gst = formData.gstApplicable ? (amountINR * formData.gstRate) / 100 : 0;
        const totalAmount = amountINR + gst - formData.tdsDeducted;

        setFormData(prev => ({
            ...prev,
            amountINR,
            gst,
            totalAmount,
        }));
    }, [formData.amount, formData.currency, formData.exchangeRate, formData.gstApplicable, formData.gstRate, formData.tdsDeducted]);

    const handleSubmit = async () => {
        try {
            const payload = {
                date: formData.date,
                description: formData.description,
                client: formData.client,
                project: formData.project || undefined,
                amount: formData.amount,
                currency: formData.currency,
                gstApplicable: formData.gstApplicable,
                gstRate: formData.gstRate,
                tdsDeducted: formData.tdsDeducted,
                receivedAmount: formData.receivedAmount,
                source: formData.source,
                status: formData.status,
                invoiceNumber: formData.invoiceNumber || undefined,
                dueDate: formData.dueDate || undefined,
                notes: formData.notes || undefined,
            };

            if (editingId) {
                await updateRevenue({ id: editingId, ...payload }).unwrap();
            } else {
                await createRevenue(payload).unwrap();
            }
            setShowAddModal(false);
            setEditingId(null);
            setFormData(initialFormData);
        } catch (error) {
            logger.error('Failed to save revenue:', error);
        }
    };

    const handleEdit = (entry: any) => {
        setFormData({
            ...initialFormData,
            ...entry,
            date: entry.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            dueDate: entry.dueDate?.split('T')[0] || '',
        });
        setEditingId(entry._id);
        setShowAddModal(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this revenue entry?')) {
            try {
                await deleteRevenue(id).unwrap();
            } catch (error) {
                logger.error('Failed to delete revenue:', error);
            }
        }
    };

    const openAddModal = () => {
        setFormData(initialFormData);
        setEditingId(null);
        setShowAddModal(true);
    };

    return (
        <div className="space-y-6">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Revenue</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Track and manage company revenue</p>
            </div>

            {/* ── Metric Cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {metricCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-xl border p-4 transition-all hover:shadow-md"
                        style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                                <card.icon size={20} style={{ color: card.color }} />
                            </div>
                        </div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{card.label}</p>
                        <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }} title={card.fullValue}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Filters & Search ────────────────────────────────────────── */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                            type="text"
                            placeholder="Search by description, client, or invoice..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as RevenueStatus | 'all')}
                        className="px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                    >
                        <option value="all">All Status</option>
                        <option value="received">Received</option>
                        <option value="pending">Pending</option>
                        <option value="partial">Partial</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value as RevenueSource | 'all')}
                        className="px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                    >
                        <option value="all">All Sources</option>
                        <option value="manual">Manual</option>
                        <option value="invoice">Invoice</option>
                        <option value="project">Project</option>
                    </select>
                </div>
            </div>

            {/* ── Revenue Entries Table ───────────────────────────────────── */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : revenues.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Date</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Description</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Client</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Amount</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>GST</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Total (INR)</th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Source</th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Status</th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {revenues.map((entry: any, index: number) => (
                                    <tr
                                        key={entry._id}
                                        className="transition-colors hover:bg-gray-50"
                                        style={{ borderTop: index > 0 ? '1px solid #E5E7EB' : undefined }}
                                    >
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} style={{ color: '#9CA3AF' }} />
                                                <span className="text-sm" style={{ color: '#6B7280' }}>
                                                    {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div>
                                                <p className="text-sm font-medium" style={{ color: '#111827' }}>{entry.description}</p>
                                                {entry.invoiceNumber && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{entry.invoiceNumber}</p>}
                                                {entry.currency !== 'INR' && (
                                                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#6366F1' }}>
                                                        <Globe size={10} />
                                                        {formatCurrency(entry.amount, entry.currency)} @ {entry.exchangeRate}
                                                        {entry.exchangeRateDate ? ` on ${new Date(entry.exchangeRateDate).toLocaleDateString('en-IN')}` : ''}
                                                        {entry.exchangeRateProvider ? ` via ${entry.exchangeRateProvider}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 size={14} style={{ color: '#9CA3AF' }} />
                                                <div>
                                                    <p className="text-sm" style={{ color: '#111827' }}>{entry.client}</p>
                                                    {entry.project && <p className="text-xs" style={{ color: '#9CA3AF' }}>{entry.project}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right" style={{ color: '#111827' }}>
                                            {formatCurrency(entry.amountINR || entry.amount)}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right" style={{ color: '#9CA3AF' }}>
                                            {formatCurrency(entry.gst || 0)}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right font-semibold" style={{ color: '#22C55E' }}>
                                            {formatCurrency(entry.totalAmount || entry.amountINR || entry.amount)}
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <SourceBadge source={entry.source} />
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <StatusBadge status={entry.status} />
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleEdit(entry)}
                                                    className="p-1.5 rounded-md transition-colors hover:bg-gray-100"
                                                    style={{ color: '#9CA3AF' }}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry._id)}
                                                    className="p-1.5 rounded-md transition-colors hover:bg-red-50"
                                                    style={{ color: '#9CA3AF' }}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState />
                )}
            </div>

            {/* ── Add/Edit Revenue Modal ──────────────────────────────────── */}
            {showAddModal && (
                <ModalPortal>
                    <div className="w-full max-w-2xl rounded-xl shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'white' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10" style={{ borderColor: '#E5E7EB', backgroundColor: 'white' }}>
                            <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
                                {editingId ? 'Edit Revenue Entry' : 'Add Revenue Entry'}
                            </h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-md hover:bg-gray-100" style={{ color: '#6B7280' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Date *</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Invoice Number</label>
                                    <input
                                        type="text"
                                        placeholder="INV-2025-001"
                                        value={formData.invoiceNumber}
                                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Description *</label>
                                <input
                                    type="text"
                                    placeholder="Enter description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Client Name *</label>
                                    <input
                                        type="text"
                                        placeholder="Enter client name"
                                        value={formData.client}
                                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Project (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="Enter project name"
                                        value={formData.project}
                                        onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    />
                                </div>
                            </div>

                            {/* Currency & Amount Section */}
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                                <h3 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>Amount Details</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Currency</label>
                                        <select
                                            value={formData.currency}
                                            onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency, exchangeRate: e.target.value === 'INR' ? 1 : formData.exchangeRate })}
                                            className="w-full px-3 py-2 rounded-lg border text-sm"
                                            style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                        >
                                            {CURRENCIES.map(c => (
                                                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Amount</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={formData.amount || ''}
                                            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 rounded-lg border text-sm"
                                            style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                        />
                                    </div>
                                    {formData.currency !== 'INR' && (
                                        <div>
                                            <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Exchange Rate</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="1.00"
                                                value={formData.exchangeRate || ''}
                                                onChange={(e) => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 1 })}
                                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                                style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                            />
                                        </div>
                                    )}
                                </div>
                                {formData.currency !== 'INR' && (
                                    <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                                        Preview only. The server will save INR using the rate for the revenue date.
                                    </p>
                                )}
                            </div>

                            {/* GST & TDS Section */}
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#F9FAFB' }}>
                                <h3 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>Tax Details</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.gstApplicable}
                                                onChange={(e) => setFormData({ ...formData, gstApplicable: e.target.checked })}
                                                className="rounded"
                                            />
                                            GST Applicable
                                        </label>
                                        {formData.gstApplicable && (
                                            <select
                                                value={formData.gstRate}
                                                onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 rounded-lg border text-sm mt-1"
                                                style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                            >
                                                <option value={5}>5%</option>
                                                <option value={12}>12%</option>
                                                <option value={18}>18%</option>
                                                <option value={28}>28%</option>
                                            </select>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>GST Amount</label>
                                        <input
                                            type="text"
                                            value={formatCurrency(formData.gst)}
                                            disabled
                                            className="w-full px-3 py-2 rounded-lg border text-sm"
                                            style={{ borderColor: '#E5E7EB', backgroundColor: '#F3F4F6', color: '#6B7280' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>TDS Deducted</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={formData.tdsDeducted || ''}
                                            onChange={(e) => setFormData({ ...formData, tdsDeducted: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 rounded-lg border text-sm"
                                            style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#E5E7EB' }}>
                                    <div className="flex justify-between">
                                        <span className="text-sm font-semibold" style={{ color: '#374151' }}>Total Amount (INR)</span>
                                        <span className="text-lg font-bold" style={{ color: '#22C55E' }}>{formatCurrency(formData.totalAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as RevenueStatus })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="partial">Partial</option>
                                        <option value="received">Received</option>
                                        <option value="overdue">Overdue</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Received Amount</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formData.receivedAmount || ''}
                                        onChange={(e) => setFormData({ ...formData, receivedAmount: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Due Date</label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Notes</label>
                                <textarea
                                    rows={3}
                                    placeholder="Add any additional notes..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t sticky bottom-0" style={{ borderColor: '#E5E7EB', backgroundColor: 'white' }}>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50"
                                style={{ border: '1px solid #E5E7EB', color: '#6B7280' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isCreating || isUpdating || !formData.description || !formData.client || !formData.amount}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                {(isCreating || isUpdating) && <Loader2 size={16} className="animate-spin" />}
                                {editingId ? 'Update Entry' : 'Add Entry'}
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* ── Fixed Add Revenue Button ────────────────────────────────── */}
            {typeof document !== 'undefined' && createPortal(
                <button
                    onClick={openAddModal}
                    className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium transition-all hover:shadow-lg transform hover:scale-105 z-50"
                    style={{ background: 'var(--color-primary)', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                    <Plus size={18} />
                    Add Revenue Entry
                </button>,
                document.body
            )}
        </div>
    );
}
