import { useState, useMemo } from 'react';
import {
    DollarSign,
    Plus,
    X,
    Filter,
    Edit,
    Trash2,
    Search,
    TrendingUp,
    Calendar,
    Building2,
    FolderKanban,
    CheckCircle,
    Clock,
    ArrowUpRight,
    CreditCard,
    FileText,
} from 'lucide-react';
import {
    useGetRevenuesQuery,
    useCreateRevenueMutation,
    useUpdateRevenueMutation,
    useDeleteRevenueMutation,
} from '@/features/finance/api/financeApi';
import { useGetProjectsQuery } from '@/features/project/projectApi';
import { useGetClientsQuery } from '@/features/client/clientApi';
import type { RevenueSource, RevenueStatus, CreateRevenuePayload, Revenue } from '@/features/finance/types/finance.types';

function formatCurrency(amount: number, currency = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

const SOURCES: { value: RevenueSource; label: string; color: string; bg: string }[] = [
    { value: 'project', label: 'Project Payment', color: '#10B981', bg: '#ECFDF5' },
    { value: 'manual', label: 'Manual Entry', color: '#3B82F6', bg: '#EFF6FF' },
    { value: 'interest', label: 'Interest Income', color: '#8B5CF6', bg: '#F5F3FF' },
    { value: 'refund', label: 'Refund', color: '#F59E0B', bg: '#FFFBEB' },
    { value: 'other', label: 'Other', color: '#6B7280', bg: '#F3F4F6' },
];

const STATUSES: { value: RevenueStatus; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
    { value: 'received', label: 'Received', color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle size={12} /> },
    { value: 'pending', label: 'Pending', color: '#F59E0B', bg: '#FFFBEB', icon: <Clock size={12} /> },
    { value: 'partially_received', label: 'Partial', color: '#3B82F6', bg: '#EFF6FF', icon: <ArrowUpRight size={12} /> },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function FinanceRevenuePage() {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<CreateRevenuePayload>({
        title: '',
        amount: 0,
        source: 'project',
        accrualMonth: currentMonth,
        accrualYear: currentYear,
    });

    const { data, isLoading, error } = useGetRevenuesQuery({
        page,
        limit: 15,
        ...(sourceFilter ? { source: sourceFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
    });

    const { data: projectsData } = useGetProjectsQuery({});
    const { data: clientsData } = useGetClientsQuery({ page: 1, limit: 500 });

    const [createRevenue, { isLoading: creating }] = useCreateRevenueMutation();
    const [updateRevenue] = useUpdateRevenueMutation();
    const [deleteRevenue] = useDeleteRevenueMutation();

    const revenues = data?.revenues || [];
    const pagination = data?.pagination;
    const projects = projectsData?.data || [];
    const clients = clientsData?.data?.clients || [];

    // Calculate summary stats
    const summaryStats = useMemo(() => {
        const totalAmount = revenues.reduce((sum, r) => sum + r.amountInBaseCurrency, 0);
        const receivedAmount = revenues.filter(r => r.status === 'received').reduce((sum, r) => sum + r.amountInBaseCurrency, 0);
        const pendingAmount = revenues.filter(r => r.status === 'pending' || r.status === 'partially_received').reduce((sum, r) => sum + (r.amountInBaseCurrency - r.amountReceived), 0);
        const gstAmount = revenues.reduce((sum, r) => sum + (r.gstAmount || 0), 0);
        const withoutGst = revenues.reduce((sum, r) => sum + (r.amountWithoutGst || 0), 0);

        return { totalAmount, receivedAmount, pendingAmount, gstAmount, withoutGst };
    }, [revenues]);

    const openCreate = () => {
        setEditingId(null);
        setForm({
            title: '',
            amount: 0,
            source: 'project',
            accrualMonth: currentMonth,
            accrualYear: currentYear,
        });
        setShowModal(true);
    };

    const openEdit = (rev: Revenue) => {
        setEditingId(rev._id);
        setForm({
            title: rev.title,
            description: rev.description || '',
            amount: rev.amount,
            currency: rev.currency,
            exchangeRate: rev.exchangeRate,
            source: rev.source,
            projectId: typeof rev.projectId === 'object' ? rev.projectId?._id : rev.projectId,
            clientId: typeof rev.clientId === 'object' ? rev.clientId?._id : rev.clientId,
            accrualMonth: rev.accrualMonth,
            accrualYear: rev.accrualYear,
            gstApplicable: rev.gstApplicable,
            gstRate: rev.gstRate,
            tdsApplicable: rev.tdsApplicable,
            tdsRate: rev.tdsRate,
            notes: rev.notes || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (editingId) {
            await updateRevenue({ id: editingId, data: form });
        } else {
            await createRevenue(form);
        }
        setShowModal(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this revenue entry?')) {
            await deleteRevenue(id);
        }
    };

    const getSourceInfo = (source: RevenueSource) => SOURCES.find(s => s.value === source) || SOURCES[4];
    const getStatusInfo = (status: RevenueStatus) => STATUSES.find(s => s.value === status) || STATUSES[1];

    // Handle API errors gracefully
    const hasApiError = error && 'status' in error;

    return (
        <div className="finance-revenue">
            {/* Header */}
            <div className="page-header">
                <div className="header-left">
                    <div className="header-icon">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Revenue</h1>
                        <p className="page-subtitle">Track and manage all company revenue</p>
                    </div>
                </div>
                <button className="btn-primary" onClick={openCreate}>
                    <Plus size={16} />
                    Add Revenue
                </button>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="summary-card">
                    <div className="summary-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                        <DollarSign size={20} />
                    </div>
                    <div className="summary-info">
                        <span className="summary-label">Total Revenue</span>
                        <span className="summary-value">{formatCurrency(summaryStats.totalAmount)}</span>
                    </div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div className="summary-info">
                        <span className="summary-label">Received</span>
                        <span className="summary-value">{formatCurrency(summaryStats.receivedAmount)}</span>
                    </div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}>
                        <Clock size={20} />
                    </div>
                    <div className="summary-info">
                        <span className="summary-label">Pending</span>
                        <span className="summary-value">{formatCurrency(summaryStats.pendingAmount)}</span>
                    </div>
                </div>
                <div className="summary-card">
                    <div className="summary-icon" style={{ background: '#F5F3FF', color: '#8B5CF6' }}>
                        <CreditCard size={20} />
                    </div>
                    <div className="summary-info">
                        <span className="summary-label">GST Collected</span>
                        <span className="summary-value">{formatCurrency(summaryStats.gstAmount)}</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search revenue..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    />
                </div>
                <div className="filter-group">
                    <Filter size={16} />
                    <select
                        value={sourceFilter}
                        onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
                        className="filter-select"
                    >
                        <option value="">All Sources</option>
                        {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="filter-select"
                    >
                        <option value="">All Status</option>
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="loading-state">
                    <div className="loading-spinner" />
                    <span>Loading revenue data...</span>
                </div>
            ) : hasApiError ? (
                <div className="empty-state">
                    <TrendingUp size={48} strokeWidth={1.5} />
                    <h3>Revenue module not configured</h3>
                    <p>The backend API for revenue management needs to be set up. Please contact your administrator.</p>
                </div>
            ) : revenues.length === 0 ? (
                <div className="empty-state">
                    <TrendingUp size={48} strokeWidth={1.5} />
                    <h3>No revenue entries found</h3>
                    <p>Start adding revenue entries to track your company income.</p>
                    <button className="btn-primary" onClick={openCreate}>
                        <Plus size={16} />
                        Add First Revenue
                    </button>
                </div>
            ) : (
                <>
                    {/* Revenue List */}
                    <div className="revenue-list">
                        {revenues.map((rev, index) => {
                            const sourceInfo = getSourceInfo(rev.source);
                            const statusInfo = getStatusInfo(rev.status);
                            const clientName = typeof rev.clientId === 'object' ? rev.clientId?.name || rev.clientId?.companyName : '';
                            const projectName = typeof rev.projectId === 'object' ? rev.projectId?.name : '';
                            const invoiceNumber = typeof rev.invoiceId === 'object' ? rev.invoiceId?.invoiceNumber : '';

                            return (
                                <div key={rev._id} className="revenue-item" style={{ animationDelay: `${index * 30}ms` }}>
                                    <div className="revenue-main">
                                        <div className="revenue-icon" style={{ background: sourceInfo.bg, color: sourceInfo.color }}>
                                            <DollarSign size={18} />
                                        </div>
                                        <div className="revenue-details">
                                            <h4 className="revenue-title">{rev.title}</h4>
                                            <div className="revenue-meta">
                                                {projectName && (
                                                    <span className="meta-item">
                                                        <FolderKanban size={12} />
                                                        {projectName}
                                                    </span>
                                                )}
                                                {clientName && (
                                                    <span className="meta-item">
                                                        <Building2 size={12} />
                                                        {clientName}
                                                    </span>
                                                )}
                                                {invoiceNumber && (
                                                    <span className="meta-item">
                                                        <FileText size={12} />
                                                        {invoiceNumber}
                                                    </span>
                                                )}
                                                <span className="meta-item">
                                                    <Calendar size={12} />
                                                    {MONTH_NAMES[rev.accrualMonth - 1]} {rev.accrualYear}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="revenue-right">
                                        <div className="revenue-amount-section">
                                            <span className="revenue-amount">{formatCurrency(rev.amountInBaseCurrency)}</span>
                                            {rev.gstApplicable && rev.gstAmount > 0 && (
                                                <span className="revenue-gst">incl. GST {formatCurrency(rev.gstAmount)}</span>
                                            )}
                                        </div>
                                        <div className="revenue-badges">
                                            <span className="badge source-badge" style={{ background: sourceInfo.bg, color: sourceInfo.color }}>
                                                {sourceInfo.label}
                                            </span>
                                            <span className="badge status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                                                {statusInfo.icon}
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        <div className="revenue-actions">
                                            <button className="action-btn" title="Edit" onClick={() => openEdit(rev)}>
                                                <Edit size={14} />
                                            </button>
                                            <button className="action-btn danger" title="Delete" onClick={() => handleDelete(rev._id)}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                        <div className="pagination">
                            <button
                                className="page-btn"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </button>
                            <div className="page-numbers">
                                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === pagination.pages || Math.abs(p - page) <= 1)
                                    .map((p, idx, arr) => (
                                        <span key={`page-${p}`}>
                                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="page-ellipsis">...</span>}
                                            <button
                                                className={`page-btn ${page === p ? 'active' : ''}`}
                                                onClick={() => setPage(p)}
                                            >
                                                {p}
                                            </button>
                                        </span>
                                    ))}
                            </div>
                            <button
                                className="page-btn"
                                disabled={page === pagination.pages}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Edit Revenue' : 'Add Revenue'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-field full">
                                    <label>Title *</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Revenue title"
                                    />
                                </div>

                                <div className="form-field">
                                    <label>Amount *</label>
                                    <input
                                        type="number"
                                        value={form.amount}
                                        onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>

                                <div className="form-field">
                                    <label>Source *</label>
                                    <select
                                        value={form.source}
                                        onChange={(e) => setForm({ ...form, source: e.target.value as RevenueSource })}
                                    >
                                        {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Accrual Month *</label>
                                    <select
                                        value={form.accrualMonth}
                                        onChange={(e) => setForm({ ...form, accrualMonth: Number(e.target.value) })}
                                    >
                                        {MONTH_NAMES.map((m, i) => (
                                            <option key={i} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Accrual Year *</label>
                                    <select
                                        value={form.accrualYear}
                                        onChange={(e) => setForm({ ...form, accrualYear: Number(e.target.value) })}
                                    >
                                        {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Project</label>
                                    <select
                                        value={form.projectId || ''}
                                        onChange={(e) => setForm({ ...form, projectId: e.target.value || undefined })}
                                    >
                                        <option value="">Select Project</option>
                                        {projects.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Client</label>
                                    <select
                                        value={form.clientId || ''}
                                        onChange={(e) => setForm({ ...form, clientId: e.target.value || undefined })}
                                    >
                                        <option value="">Select Client</option>
                                        {clients.map((c: any) => <option key={c._id} value={c._id}>{c.name || c.companyName}</option>)}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Currency</label>
                                    <input
                                        type="text"
                                        value={form.currency || 'INR'}
                                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                                    />
                                </div>

                                <div className="form-field">
                                    <label>Exchange Rate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.exchangeRate || 1}
                                        onChange={(e) => setForm({ ...form, exchangeRate: Number(e.target.value) })}
                                    />
                                </div>

                                <div className="form-field checkbox-field">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={form.gstApplicable || false}
                                            onChange={(e) => setForm({ ...form, gstApplicable: e.target.checked })}
                                        />
                                        GST Applicable
                                    </label>
                                    {form.gstApplicable && (
                                        <div className="inline-fields">
                                            <input
                                                type="number"
                                                placeholder="GST Rate %"
                                                value={form.gstRate || 18}
                                                onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="form-field checkbox-field">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={form.tdsApplicable || false}
                                            onChange={(e) => setForm({ ...form, tdsApplicable: e.target.checked })}
                                        />
                                        TDS Applicable
                                    </label>
                                    {form.tdsApplicable && (
                                        <div className="inline-fields">
                                            <input
                                                type="number"
                                                placeholder="TDS Rate %"
                                                value={form.tdsRate || 10}
                                                onChange={(e) => setForm({ ...form, tdsRate: Number(e.target.value) })}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="form-field full">
                                    <label>Description</label>
                                    <textarea
                                        rows={2}
                                        value={form.description || ''}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Optional description"
                                    />
                                </div>

                                <div className="form-field full">
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={form.notes || ''}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Internal notes"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleSubmit}
                                disabled={creating || !form.title || !form.amount}
                            >
                                {creating ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .finance-revenue {
                    padding: 1.5rem 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                    animation: fadeIn 0.4s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Header */
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #10B98120, #10B98110);
                    color: #10B981;
                    border: 1px solid #10B98125;
                }

                .page-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--color-text-primary, #111);
                    margin: 0;
                    font-family: 'Outfit', sans-serif;
                }

                .page-subtitle {
                    color: var(--color-text-muted, #666);
                    margin: 0.25rem 0 0 0;
                    font-size: 0.9rem;
                }

                .btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.65rem 1.25rem;
                    border: none;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #10B981, #059669);
                    color: white;
                    font-weight: 600;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
                }

                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
                }

                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .btn-secondary {
                    padding: 0.65rem 1.25rem;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 10px;
                    background: transparent;
                    color: var(--color-text-primary, #111);
                    font-weight: 500;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-secondary:hover {
                    background: var(--color-bg-subtle, #f3f4f6);
                }

                /* Summary Cards */
                .summary-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .summary-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.25rem;
                    background: var(--color-bg-surface, #fff);
                    border-radius: 14px;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    animation: slideUp 0.4s ease-out backwards;
                }

                .summary-card:nth-child(1) { animation-delay: 0ms; }
                .summary-card:nth-child(2) { animation-delay: 50ms; }
                .summary-card:nth-child(3) { animation-delay: 100ms; }
                .summary-card:nth-child(4) { animation-delay: 150ms; }

                .summary-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .summary-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .summary-label {
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--color-text-muted, #666);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .summary-value {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--color-text-primary, #111);
                    font-family: 'Outfit', sans-serif;
                }

                /* Filters */
                .filters-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: var(--color-bg-surface, #fff);
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 10px;
                    min-width: 280px;
                    color: var(--color-text-muted, #999);
                }

                .search-box input {
                    border: none;
                    background: transparent;
                    outline: none;
                    flex: 1;
                    font-size: 0.875rem;
                    color: var(--color-text-primary, #111);
                }

                .search-box input::placeholder {
                    color: var(--color-text-muted, #999);
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: var(--color-text-muted, #666);
                }

                .filter-select {
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 8px;
                    background: var(--color-bg-surface, #fff);
                    color: var(--color-text-primary, #111);
                    font-size: 0.85rem;
                    cursor: pointer;
                }

                /* Revenue List */
                .revenue-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .revenue-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem;
                    background: var(--color-bg-surface, #fff);
                    border-radius: 14px;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    animation: slideUp 0.3s ease-out backwards;
                    transition: all 0.2s;
                }

                .revenue-item:hover {
                    border-color: var(--color-primary, #3b82f6);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
                }

                .revenue-main {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .revenue-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .revenue-details {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .revenue-title {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--color-text-primary, #111);
                    margin: 0;
                }

                .revenue-meta {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.75rem;
                    color: var(--color-text-muted, #666);
                }

                .revenue-right {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .revenue-amount-section {
                    text-align: right;
                }

                .revenue-amount {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--color-text-primary, #111);
                    font-family: 'Outfit', sans-serif;
                }

                .revenue-gst {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--color-text-muted, #999);
                }

                .revenue-badges {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    align-items: flex-end;
                }

                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }

                .revenue-actions {
                    display: flex;
                    gap: 4px;
                }

                .action-btn {
                    width: 32px;
                    height: 32px;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 8px;
                    background: transparent;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-text-muted, #666);
                    transition: all 0.15s;
                }

                .action-btn:hover {
                    background: var(--color-bg-subtle, #f3f4f6);
                    color: var(--color-text-primary, #111);
                }

                .action-btn.danger:hover {
                    background: #FEF2F2;
                    color: #EF4444;
                    border-color: #FECACA;
                }

                /* Pagination */
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 0.5rem;
                    margin-top: 2rem;
                }

                .page-numbers {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .page-btn {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 8px;
                    background: var(--color-bg-surface, #fff);
                    color: var(--color-text-primary, #111);
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .page-btn:hover:not(:disabled) {
                    background: var(--color-bg-subtle, #f3f4f6);
                }

                .page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-btn.active {
                    background: var(--color-primary, #3b82f6);
                    color: white;
                    border-color: transparent;
                }

                .page-ellipsis {
                    padding: 0 0.5rem;
                    color: var(--color-text-muted, #999);
                }

                /* Empty & Loading States */
                .empty-state, .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 2rem;
                    background: var(--color-bg-surface, #fff);
                    border-radius: 16px;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    text-align: center;
                    gap: 1rem;
                }

                .empty-state h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--color-text-primary, #111);
                    margin: 0;
                }

                .empty-state p {
                    color: var(--color-text-muted, #666);
                    margin: 0;
                    font-size: 0.9rem;
                }

                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid var(--color-border-default, #e5e7eb);
                    border-top-color: var(--color-primary, #3b82f6);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 1rem;
                    animation: fadeIn 0.2s ease-out;
                }

                .modal {
                    background: var(--color-bg-surface, #fff);
                    border-radius: 20px;
                    width: 100%;
                    max-width: 640px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
                    animation: slideUp 0.3s ease-out;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    border-bottom: 1px solid var(--color-border-default, #e5e7eb);
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 1.15rem;
                    font-weight: 600;
                    color: var(--color-text-primary, #111);
                }

                .modal-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-text-muted, #666);
                    padding: 4px;
                    border-radius: 6px;
                    transition: all 0.15s;
                }

                .modal-close:hover {
                    background: var(--color-bg-subtle, #f3f4f6);
                    color: var(--color-text-primary, #111);
                }

                .modal-body {
                    padding: 1.5rem;
                }

                .modal-footer {
                    display: flex;
                    gap: 0.75rem;
                    justify-content: flex-end;
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--color-border-default, #e5e7eb);
                }

                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .form-field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .form-field.full {
                    grid-column: 1 / -1;
                }

                .form-field label {
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: var(--color-text-secondary, #666);
                }

                .form-field input,
                .form-field select,
                .form-field textarea {
                    padding: 0.6rem 0.875rem;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 10px;
                    font-size: 0.875rem;
                    background: var(--color-bg-surface, #fff);
                    color: var(--color-text-primary, #111);
                    transition: border-color 0.15s;
                }

                .form-field input:focus,
                .form-field select:focus,
                .form-field textarea:focus {
                    outline: none;
                    border-color: var(--color-primary, #3b82f6);
                }

                .form-field textarea {
                    resize: vertical;
                }

                .checkbox-field label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                }

                .checkbox-field input[type="checkbox"] {
                    width: auto;
                    cursor: pointer;
                }

                .inline-fields {
                    display: flex;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }

                .inline-fields input {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 8px;
                    font-size: 0.85rem;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .finance-revenue {
                        padding: 1rem;
                    }

                    .page-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }

                    .filters-bar {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .search-box {
                        min-width: 100%;
                    }

                    .filter-group {
                        flex-wrap: wrap;
                    }

                    .revenue-item {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }

                    .revenue-right {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}
