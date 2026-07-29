import { useState, useEffect, useRef } from 'react';
import {
    Search, Filter, Clock, CheckCircle, Download,
    RotateCcw, AlertTriangle, User, RefreshCcw, FileText, Plus, Receipt, Edit2, Trash2
} from 'lucide-react';
import { useGetReimbursementsQuery, useGetReimbursementSummaryQuery, useGetMyReimbursementsQuery, useGetMyReimbursementSummaryQuery, useDeleteReimbursementMutation } from '@/features/hrms/hrmsApi';
import ReimbursementDetailDrawer from '@/components/organisms/hrms/ReimbursementDetailDrawer';
import NewReimbursementDrawer from '@/components/organisms/hrms/NewReimbursementDrawer';
import { useLocation } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { hasModuleAdminAccess, getRoleName } from '@/utils/modulePermissions';

// ── Hooks ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// ── Components ────────────────────────────────────────────────────────

const Card = ({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <div
        className={`rounded-xl border shadow-sm ${className}`}
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-default)', ...style }}
    >
        {children}
    </div>
);

function SummaryCard({ title, amount, count, icon: Icon, colorClass, bgClass, isAmount = true }: any) {
    return (
        <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{title}</span>
                <div className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
                    <Icon size={18} />
                </div>
            </div>
            <div>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {isAmount ? `₹${Number(amount || 0).toLocaleString('en-IN')}` : (amount || 0)}
                </div>
                {count !== undefined && (
                    <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {count} claim{Number(count) !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </Card>
    );
}

const CATEGORY_LABELS: Record<string, string> = {
    travel: '✈️ Travel', meals: '🍽️ Meals', hotel: '🏨 Hotel',
    fuel: '⛽ Fuel', medical: '🏥 Medical', office: '🗂️ Office',
    software: '💻 Software', other: '📦 Other',
};

function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { bg: string; color: string; label: string }> = {
        draft:             { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
        pending:           { bg: '#FEF3C7', color: '#B45309', label: 'Pending Review' },
        approved:          { bg: '#DCFCE7', color: '#15803D', label: 'Approved' },
        changes_requested: { bg: '#FFF7ED', color: '#C2410C', label: 'Changes Requested' },
        paid:              { bg: '#DBEAFE', color: '#1D4ED8', label: 'Paid' },
        rejected:          { bg: '#FEE2E2', color: '#B91C1C', label: 'Rejected' },
    };
    const c = cfg[status] || cfg.draft;
    return (
        <span
            className="px-2.5 py-1 text-xs font-semibold rounded-full capitalize whitespace-nowrap"
            style={{ backgroundColor: c.bg, color: c.color }}
        >
            {c.label}
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function HrmsReimbursementsPage() {
    const user = useAppSelector((state) => state.auth.user);
    const isAdmin = hasModuleAdminAccess(user, 'hrms');
    const roleName = getRoleName(user?.role);
    const isSuperAdmin = ['super-admin', 'super_admin'].includes(roleName);
    const location = useLocation();

    // Derive view from URL: /hrms/... → org view, /my-hrms/... → my claims view
    const isOrgView = !location.pathname.startsWith('/my-hrms');

    const [isNewOpen, setIsNewOpen] = useState(false);
    const [editClaimData, setEditClaimData] = useState<any>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 400);
    const [policyFilter, setPolicyFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('created_desc');

    // Reset filters when view changes
    const prevPath = useRef(location.pathname);
    useEffect(() => {
        if (prevPath.current !== location.pathname) {
            setStatusFilter('all');
            setSearchQuery('');
            setPolicyFilter('all');
            setSortOrder('created_desc');
            prevPath.current = location.pathname;
        }
    }, [location.pathname]);

    // Data fetching: Org view
    const { data: orgSummaryData, refetch: refetchOrgSummary } = useGetReimbursementSummaryQuery(undefined, {
        skip: !isOrgView,
    });
    const { data: orgClaimsData, isLoading: isLoadingOrg, isFetching: isFetchingOrg, refetch: refetchOrgClaims } = useGetReimbursementsQuery({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: debouncedSearch || undefined,
        policy: policyFilter !== 'all' ? policyFilter : undefined,
        sort: sortOrder,
    }, { skip: !isOrgView });

    // Data fetching: My Claims view
    const { data: mySummaryData, refetch: refetchMySummary } = useGetMyReimbursementSummaryQuery(undefined, {
        skip: isOrgView,
    });
    const { data: myClaimsData, isLoading: isLoadingMy, isFetching: isFetchingMy, refetch: refetchMyClaims } = useGetMyReimbursementsQuery({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sort: sortOrder,
    }, { skip: isOrgView });

    const handleRefresh = () => {
        if (isOrgView) { refetchOrgSummary(); refetchOrgClaims(); }
        else { refetchMySummary(); refetchMyClaims(); }
    };

    const handleCreatedOrUpdated = () => {
        if (isOrgView) {
            refetchOrgSummary();
            refetchOrgClaims();
        } else {
            refetchMySummary();
            refetchMyClaims();
        }
    };

    const [deleteReimbursement] = useDeleteReimbursementMutation();

    const handleDeleteClaim = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this claim?')) {
            try {
                await deleteReimbursement(id).unwrap();
                handleCreatedOrUpdated();
            } catch (error) {
                console.error('Failed to delete claim', error);
            }
        }
    };

    // Derived
    const isLoading = isOrgView ? isLoadingOrg : isLoadingMy;
    const isFetching = isOrgView ? isFetchingOrg : isFetchingMy;
    const summary = isOrgView ? orgSummaryData?.data?.summary : mySummaryData?.data?.summary;
    const reimbursements: any[] = isOrgView
        ? (orgClaimsData?.data?.reimbursements || [])
        : (myClaimsData?.data?.reimbursements || []);

    // Status filter options per view
    const orgFilters = ['all', 'pending', 'approved', 'paid', 'changes_requested', 'rejected'];
    const myFilters  = ['all', 'draft', 'pending', 'approved', 'paid', 'changes_requested', 'rejected'];

    const filterLabels: Record<string, string> = {
        all: 'All', draft: 'Draft', pending: 'Pending',
        approved: 'Approved', paid: 'Paid',
        changes_requested: 'Changes Req.', rejected: 'Rejected',
    };

    // Header title / subtitle
    const pageTitle = isOrgView ? 'Org Reimbursements' : 'My Expenses & Reimbursements';
    const pageSubtitle = isOrgView
        ? 'Review and process employee expense claims'
        : 'Manage and track your personal expense claims';

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{pageTitle}</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{pageSubtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-colors"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                        title="Refresh"
                    >
                        <RefreshCcw size={17} className={isFetching ? 'animate-spin' : ''} />
                    </button>
                    {isOrgView && isAdmin && (
                        <button
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors cursor-pointer"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                color: 'var(--color-text-primary)',
                                backgroundColor: 'var(--color-bg-surface)',
                            }}
                        >
                            <FileText size={15} /> Export CSV
                        </button>
                    )}
                    {/* Hide "New Reimbursement" for Super Admins on Org view (they don't create claims) */}
                    {!(isSuperAdmin && isOrgView) && (
                        <button
                            onClick={() => { setEditClaimData(null); setIsNewOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            <Plus size={16} /> New Claim
                        </button>
                    )}
                </div>
            </div>

            {/* ── Summary Cards ──────────────────────────────────────── */}
            {isOrgView ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard
                        title="Action Required"
                        amount={summary?.pending?.amount}
                        count={summary?.pending?.count}
                        icon={Clock}
                        colorClass="text-amber-600" bgClass="bg-amber-50"
                    />
                    <SummaryCard
                        title="Approved (Awaiting Payout)"
                        amount={summary?.approved?.amount}
                        count={summary?.approved?.count}
                        icon={CheckCircle}
                        colorClass="text-emerald-600" bgClass="bg-emerald-50"
                    />
                    <SummaryCard
                        title="Paid This Month"
                        amount={summary?.paidThisMonth?.amount}
                        count={summary?.paidThisMonth?.count}
                        icon={Download}
                        colorClass="text-blue-600" bgClass="bg-blue-50"
                    />
                    <SummaryCard
                        title="Changes Requested"
                        amount={summary?.changesRequested?.count}
                        isAmount={false}
                        icon={RotateCcw}
                        colorClass="text-orange-600" bgClass="bg-orange-50"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard
                        title="Pending Approval"
                        amount={summary?.pending?.amount}
                        count={summary?.pending?.count}
                        icon={Clock}
                        colorClass="text-amber-600" bgClass="bg-amber-50"
                    />
                    <SummaryCard
                        title="Approved (Unpaid)"
                        amount={summary?.approved?.amount}
                        count={summary?.approved?.count}
                        icon={CheckCircle}
                        colorClass="text-emerald-600" bgClass="bg-emerald-50"
                    />
                    <SummaryCard
                        title="Paid This Month"
                        amount={summary?.paidThisMonth?.amount}
                        count={summary?.paidThisMonth?.count}
                        icon={Download}
                        colorClass="text-blue-600" bgClass="bg-blue-50"
                    />
                    <SummaryCard
                        title="Saved Drafts"
                        amount={summary?.drafts?.count}
                        isAmount={false}
                        icon={Receipt}
                        colorClass="text-gray-500" bgClass="bg-gray-100"
                    />
                </div>
            )}

            {/* ── Main Table Card ────────────────────────────────────── */}
            <Card className="flex flex-col" style={{ minHeight: '480px' }}>
                {/* Toolbar */}
                <div
                    className="flex flex-wrap items-center justify-between p-4 gap-4 border-b"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    {/* Status filters */}
                    <div
                        className="flex gap-1 p-1 rounded-lg overflow-x-auto"
                        style={{ backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        {(isOrgView ? orgFilters : myFilters).map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all whitespace-nowrap"
                                style={
                                    statusFilter === s
                                        ? {
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-primary)',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                          }
                                        : { color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }
                                }
                            >
                                {filterLabels[s] || s}
                            </button>
                        ))}
                    </div>

                    {/* Search — org view only */}
                    {isOrgView && (
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search
                                    size={15}
                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--color-text-muted)' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Search by name, claim ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 text-sm rounded-lg border w-56"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            </div>
                            <select
                                value={policyFilter}
                                onChange={(e) => setPolicyFilter(e.target.value)}
                                className="px-3 py-2 text-sm rounded-lg border bg-transparent"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                            >
                                <option value="all">All Policies</option>
                                <option value="clean">Clean</option>
                                <option value="flagged">Flagged</option>
                            </select>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="px-3 py-2 text-sm rounded-lg border bg-transparent"
                                style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                            >
                                <option value="created_desc">Recently Added</option>
                                <option value="date_desc">Newest Expense Date</option>
                                <option value="date_asc">Oldest Expense Date</option>
                                <option value="amount_desc">Amount: High to Low</option>
                                <option value="amount_asc">Amount: Low to High</option>
                            </select>
                            <button
                                className="p-2 border rounded-lg flex items-center justify-center cursor-pointer"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-secondary)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                }}
                            >
                                <Filter size={15} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead
                            className="sticky top-0 z-10 text-xs uppercase tracking-wider"
                            style={{ backgroundColor: 'var(--color-bg-surface)' }}
                        >
                            <tr className="border-b" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}>
                                {/* Employee column only in Org view */}
                                {isOrgView && <th className="px-4 py-3 font-semibold">Employee</th>}
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Expense Details</th>
                                <th className="px-4 py-3 font-semibold text-right">Amount</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                {/* Policy column only in Org view */}
                                {isOrgView && <th className="px-4 py-3 font-semibold">Policy</th>}
                                {/* Actions column only in My Claims view */}
                                {!isOrgView && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        colSpan={isOrgView ? 6 : 5}
                                        className="py-20 text-center text-sm"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        <RefreshCcw size={20} className="animate-spin mx-auto mb-2" />
                                        Loading claims...
                                    </td>
                                </tr>
                            ) : reimbursements.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={isOrgView ? 6 : 5}
                                        className="py-20 text-center"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        {isOrgView
                                            ? <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
                                            : <Receipt size={32} className="mx-auto mb-3 opacity-40" />}
                                        <p className="text-sm font-medium">No claims found</p>
                                        <p className="text-xs mt-1 opacity-70">
                                            {isOrgView
                                                ? 'Try adjusting your filters or search query'
                                                : 'Click "+ New Claim" to submit your first expense'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                reimbursements.map((item: any) => (
                                    <tr
                                        key={item._id}
                                        onClick={() => setSelectedId(item._id)}
                                        className="border-b cursor-pointer transition-colors"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                        {/* Employee — Org view only */}
                                        {isOrgView && (
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                                    >
                                                        {item.user?.name?.charAt(0) || <User size={13} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                            {item.user?.name || 'Unknown'}
                                                        </p>
                                                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                            {item.employee?.department || item.user?.email || '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                        )}

                                        {/* Date & Claim ID */}
                                        <td className="px-4 py-3">
                                            <p
                                                className="text-sm font-medium"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {new Date(item.expenseDate || item.createdAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                })}
                                            </p>
                                        </td>

                                        {/* Expense Details */}
                                        <td className="px-4 py-3">
                                            <p
                                                className="text-sm font-medium truncate max-w-[180px]"
                                                style={{ color: 'var(--color-text-primary)' }}
                                            >
                                                {item.title}
                                            </p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                {CATEGORY_LABELS[item.category] || item.category}
                                                {item.merchant ? ` · ${item.merchant}` : ''}
                                            </p>
                                        </td>



                                        {/* Amount */}
                                        <td className="px-4 py-3 text-right">
                                            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </p>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            <StatusBadge status={item.status} />
                                        </td>

                                        {/* Policy — Org view only */}
                                        {isOrgView && (
                                            <td className="px-4 py-3">
                                                {item.policyFlags?.some((f: any) => f.status === 'fail' || f.status === 'warn') ? (
                                                    <div
                                                        className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md w-max"
                                                        style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                                                    >
                                                        <AlertTriangle size={11} /> Flagged
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md w-max"
                                                        style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}
                                                    >
                                                        <CheckCircle size={11} /> Clean
                                                    </div>
                                                )}
                                            </td>
                                        )}

                                        {/* Actions — My Claims view only */}
                                        {!isOrgView && (
                                            <td className="px-4 py-3 text-right">
                                                {['draft', 'changes_requested', 'pending'].includes(item.status) ? (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditClaimData(item);
                                                                setIsNewOpen(true);
                                                            }}
                                                            className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                                            style={{ color: 'var(--color-text-secondary)', backgroundColor: 'transparent' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            title="Edit Claim"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteClaim(e, item._id)}
                                                            className="p-1.5 rounded-lg transition-colors cursor-pointer"
                                                            style={{ color: '#DC2626', backgroundColor: 'transparent' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            title="Delete Claim"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── Drawers ────────────────────────────────────────────── */}
            {isNewOpen && (
                <NewReimbursementDrawer
                    onClose={() => { setIsNewOpen(false); setEditClaimData(null); }}
                    onCreated={handleCreatedOrUpdated}
                    initialData={editClaimData}
                />
            )}
            {selectedId && (
                <ReimbursementDetailDrawer
                    reimbursementId={selectedId}
                    onClose={() => setSelectedId(null)}
                    onUpdated={handleCreatedOrUpdated}
                />
            )}
        </div>
    );
}
