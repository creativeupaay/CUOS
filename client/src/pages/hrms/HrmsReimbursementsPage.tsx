import { useState, useEffect, useRef } from 'react';
import {
    Search, Clock, CheckCircle, Download,
    RotateCcw, AlertTriangle, User, Plus, Receipt, Edit2, Trash2, Users, RefreshCcw, ExternalLink,
    DollarSign, Check
} from 'lucide-react';
import { useGetReimbursementsQuery, useGetReimbursementSummaryQuery, useGetMyReimbursementsQuery, useGetMyReimbursementSummaryQuery, useDeleteReimbursementMutation } from '@/features/hrms/hrmsApi';
import ReimbursementDetailDrawer from '@/components/organisms/hrms/ReimbursementDetailDrawer';
import NewReimbursementDrawer from '@/components/organisms/hrms/NewReimbursementDrawer';
import ReimbursementBatchModal from '@/components/organisms/hrms/ReimbursementBatchModal';
import { useLocation, useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();

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
    const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
    const [batchModalState, setBatchModalState] = useState<{
        isOpen: boolean;
        action: 'approve' | 'paid';
        claimIds: string[];
        totalAmount: number;
        title?: string;
        subtitle?: string;
        claims?: any[];
    }>({
        isOpen: false,
        action: 'approve',
        claimIds: [],
        totalAmount: 0,
        claims: [],
    });

    // Reset filters and selection when view changes
    const prevPath = useRef(location.pathname);
    useEffect(() => {
        if (prevPath.current !== location.pathname) {
            setStatusFilter('all');
            setSearchQuery('');
            setPolicyFilter('all');
            setSortOrder('created_desc');
            setSelectedClaimIds([]);
            prevPath.current = location.pathname;
        }
    }, [location.pathname]);

    // Data fetching: Org view
    const { data: orgSummaryData, refetch: refetchOrgSummary } = useGetReimbursementSummaryQuery(undefined, {
        skip: !isOrgView,
    });
    const { data: orgClaimsData, isLoading: isLoadingOrg, refetch: refetchOrgClaims } = useGetReimbursementsQuery({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: debouncedSearch || undefined,
        policy: policyFilter !== 'all' ? policyFilter : undefined,
        sort: sortOrder,
    }, { skip: !isOrgView });

    // Data fetching: My Claims view
    const { data: mySummaryData, refetch: refetchMySummary } = useGetMyReimbursementSummaryQuery(undefined, {
        skip: isOrgView,
    });
    const { data: myClaimsData, isLoading: isLoadingMy, refetch: refetchMyClaims } = useGetMyReimbursementsQuery({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sort: sortOrder,
    }, { skip: isOrgView });

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
    const summary = isOrgView ? orgSummaryData?.data?.summary : mySummaryData?.data?.summary;
    const reimbursements: any[] = isOrgView
        ? (orgClaimsData?.data?.reimbursements || [])
        : (myClaimsData?.data?.reimbursements || []);

    const selectedClaims = reimbursements.filter((r: any) => selectedClaimIds.includes(r._id));
    const selectedTotalAmount = selectedClaims.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const selectedPendingClaims = selectedClaims.filter((r: any) => r.status === 'pending');
    const selectedApprovedClaims = selectedClaims.filter((r: any) => r.status === 'approved');

    const visiblePendingClaims = reimbursements.filter((r: any) => r.status === 'pending');
    const visibleApprovedClaims = reimbursements.filter((r: any) => r.status === 'approved');

    const handleQuickApprove = (claim: any) => {
        setBatchModalState({
            isOpen: true,
            action: 'approve',
            claimIds: [claim._id],
            totalAmount: claim.amount || 0,
            title: `Approve Claim ${claim.claimId}`,
            subtitle: `For ${claim.user?.name || 'employee'} · ₹${(claim.amount || 0).toLocaleString('en-IN')}`,
            claims: [claim],
        });
    };

    const handleQuickPay = (claim: any) => {
        setBatchModalState({
            isOpen: true,
            action: 'paid',
            claimIds: [claim._id],
            totalAmount: claim.amount || 0,
            title: `Mark Claim ${claim.claimId} as Paid`,
            subtitle: `For ${claim.user?.name || 'employee'} · ₹${(claim.amount || 0).toLocaleString('en-IN')}`,
            claims: [claim],
        });
    };

    const handleApproveAllPending = () => {
        if (visiblePendingClaims.length === 0) return;
        const total = visiblePendingClaims.reduce((s: number, r: any) => s + (r.amount || 0), 0);
        setBatchModalState({
            isOpen: true,
            action: 'approve',
            claimIds: visiblePendingClaims.map((r: any) => r._id),
            totalAmount: total,
            title: `Approve All Pending Claims (${visiblePendingClaims.length})`,
            subtitle: `Approve all ${visiblePendingClaims.length} pending claims currently shown in table`,
            claims: visiblePendingClaims,
        });
    };

    const handlePayAllApproved = () => {
        if (visibleApprovedClaims.length === 0) return;
        const total = visibleApprovedClaims.reduce((s: number, r: any) => s + (r.amount || 0), 0);
        setBatchModalState({
            isOpen: true,
            action: 'paid',
            claimIds: visibleApprovedClaims.map((r: any) => r._id),
            totalAmount: total,
            title: `Mark All Approved Claims as Paid (${visibleApprovedClaims.length})`,
            subtitle: `Payout for ${visibleApprovedClaims.length} approved claims currently shown in table`,
            claims: visibleApprovedClaims,
        });
    };

    const handleOpenBatchModal = (action: 'approve' | 'paid', claims: any[]) => {
        const total = claims.reduce((s: number, r: any) => s + (r.amount || 0), 0);
        setBatchModalState({
            isOpen: true,
            action,
            claimIds: claims.map((r: any) => r._id),
            totalAmount: total,
            title: action === 'approve'
                ? `Approve ${claims.length} Selected Claim${claims.length > 1 ? 's' : ''}`
                : `Mark ${claims.length} Selected Claim${claims.length > 1 ? 's' : ''} as Paid`,
            subtitle: `Total: ₹${total.toLocaleString('en-IN')}`,
            claims,
        });
    };

    // Status filter options per view
    const orgFilters = ['all', 'pending', 'approved', 'paid', 'changes_requested', 'rejected'];
    const myFilters  = ['all', 'draft', 'pending', 'approved', 'paid', 'changes_requested', 'rejected'];

    const filterLabels: Record<string, string> = {
        all: 'All', draft: 'Draft', pending: 'Pending',
        approved: 'Approved', paid: 'Paid',
        changes_requested: 'Changes Req.', rejected: 'Rejected',
    };

    const pageSubtitle = isOrgView
        ? 'Review and process employee expense claims'
        : 'Manage and track your personal expense claims';

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Reimbursements</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{pageSubtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Employee View button — Org admin only */}
                    {isOrgView && isAdmin && (
                        <button
                            onClick={() => navigate('/hrms/reimbursements/employees')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer"
                            style={{
                                borderColor: 'var(--color-primary)',
                                color: 'var(--color-primary)',
                                backgroundColor: 'transparent',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--color-primary)';
                            }}
                        >
                            <Users size={15} /> Employee View
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
                {/* View Switcher Tabs (Org View only) */}
                {isOrgView && isAdmin && (
                    <div className="flex items-center px-4 pt-3 gap-6 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                        <button
                            className="flex items-center gap-2 pb-3 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer"
                            style={{
                                borderColor: 'var(--color-primary)',
                                color: 'var(--color-primary)',
                            }}
                        >
                            <Receipt size={16} /> All Claims
                        </button>
                        <button
                            onClick={() => navigate('/hrms/reimbursements/employees')}
                            className="flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 border-transparent transition-all cursor-pointer hover:opacity-80"
                            style={{
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            <Users size={16} /> By Employee
                        </button>
                    </div>
                )}

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

                            {/* Quick Batch Actions for currently shown claims */}
                            {visiblePendingClaims.length > 0 && (
                                <button
                                    onClick={handleApproveAllPending}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs hover:opacity-90 whitespace-nowrap"
                                    style={{
                                        backgroundColor: '#16A34A',
                                        color: '#fff',
                                    }}
                                    title={`Approve all ${visiblePendingClaims.length} pending claims currently shown`}
                                >
                                    <CheckCircle size={14} /> Approve All ({visiblePendingClaims.length})
                                </button>
                            )}
                            {visibleApprovedClaims.length > 0 && (
                                <button
                                    onClick={handlePayAllApproved}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs hover:opacity-90 whitespace-nowrap"
                                    style={{
                                        backgroundColor: '#2563EB',
                                        color: '#fff',
                                    }}
                                    title={`Mark all ${visibleApprovedClaims.length} approved claims currently shown as paid`}
                                >
                                    <DollarSign size={14} /> Mark All as Paid ({visibleApprovedClaims.length})
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Multi-select Batch Action Bar */}
                {isOrgView && isAdmin && selectedClaimIds.length > 0 && (
                    <div
                        className="flex flex-wrap items-center justify-between px-4 py-2.5 border-b gap-3 animate-in fade-in"
                        style={{
                            backgroundColor: 'var(--color-bg-subtle)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                {selectedClaimIds.length} Selected
                            </span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                                Total: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedPendingClaims.length > 0 && (
                                <button
                                    onClick={() => handleOpenBatchModal('approve', selectedPendingClaims)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
                                    style={{ backgroundColor: '#16A34A' }}
                                >
                                    <CheckCircle size={13} /> Approve Selected ({selectedPendingClaims.length})
                                </button>
                            )}
                            {selectedApprovedClaims.length > 0 && (
                                <button
                                    onClick={() => handleOpenBatchModal('paid', selectedApprovedClaims)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
                                    style={{ backgroundColor: '#2563EB' }}
                                >
                                    <DollarSign size={13} /> Mark Selected Paid ({selectedApprovedClaims.length})
                                </button>
                            )}
                            <button
                                onClick={() => setSelectedClaimIds([])}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                                style={{
                                    borderColor: 'var(--color-border-default)',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                Deselect
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead
                            className="sticky top-0 z-10 text-xs uppercase tracking-wider"
                            style={{ backgroundColor: 'var(--color-bg-surface)' }}
                        >
                            <tr className="border-b" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}>
                                {/* Checkbox column for Org view */}
                                {isOrgView && isAdmin && (
                                    <th className="px-4 py-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={reimbursements.length > 0 && selectedClaimIds.length === reimbursements.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedClaimIds(reimbursements.map((r: any) => r._id));
                                                } else {
                                                    setSelectedClaimIds([]);
                                                }
                                            }}
                                            className="w-4 h-4 rounded cursor-pointer"
                                            style={{ accentColor: 'var(--color-primary)' }}
                                            title="Select / Deselect all visible claims"
                                        />
                                    </th>
                                )}
                                {/* Employee column only in Org view */}
                                {isOrgView && <th className="px-4 py-3 font-semibold">Employee</th>}
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Expense Details</th>
                                <th className="px-4 py-3 font-semibold text-right">Amount</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                {/* Policy column only in Org view */}
                                {isOrgView && <th className="px-4 py-3 font-semibold">Policy</th>}
                                <th className="px-4 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td
                                        colSpan={isOrgView ? (isAdmin ? 8 : 7) : 6}
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
                                        colSpan={isOrgView ? (isAdmin ? 8 : 7) : 6}
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
                                        {/* Checkbox — Org view only */}
                                        {isOrgView && isAdmin && (
                                            <td className="px-4 py-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedClaimIds.includes(item._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedClaimIds((prev) => [...prev, item._id]);
                                                        } else {
                                                            setSelectedClaimIds((prev) => prev.filter((id) => id !== item._id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded cursor-pointer"
                                                    style={{ accentColor: 'var(--color-primary)' }}
                                                />
                                            </td>
                                        )}

                                        {/* Employee — Org view only */}
                                        {isOrgView && (
                                            <td className="px-4 py-3">
                                                <div
                                                    className="flex items-center gap-3 group/emp cursor-pointer"
                                                    onClick={(e) => {
                                                        const empId = item.employee?._id || (typeof item.employeeId === 'object' ? item.employeeId?._id : item.employeeId);
                                                        if (empId) {
                                                            e.stopPropagation();
                                                            navigate(`/hrms/reimbursements/employees/${empId}`, {
                                                                state: {
                                                                    emp: {
                                                                        _id: empId,
                                                                        employee: item.employee || (typeof item.employeeId === 'object' ? item.employeeId : {}),
                                                                        user: item.user || (typeof item.employeeId === 'object' ? item.employeeId?.userId : {}),
                                                                    },
                                                                },
                                                            });
                                                        }
                                                    }}
                                                    title={`View combined summary & history for ${item.user?.name || 'this employee'}`}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 transition-transform group-hover/emp:scale-105"
                                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                                    >
                                                        {item.user?.name?.charAt(0) || <User size={13} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold truncate group-hover/emp:underline flex items-center gap-1.5" style={{ color: 'var(--color-text-primary)' }}>
                                                            {item.user?.name || 'Unknown'}
                                                            <ExternalLink size={12} className="opacity-0 group-hover/emp:opacity-70 transition-opacity" style={{ color: 'var(--color-primary)' }} />
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

                                        {/* Actions */}
                                        <td className="px-4 py-3 text-right">
                                            {isOrgView && isAdmin ? (
                                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                    {item.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleQuickApprove(item)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white rounded-lg transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
                                                            style={{ backgroundColor: '#16A34A' }}
                                                            title="Quick Approve claim"
                                                        >
                                                            <Check size={13} /> Approve
                                                        </button>
                                                    )}
                                                    {item.status === 'approved' && (
                                                        <button
                                                            onClick={() => handleQuickPay(item)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white rounded-lg transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
                                                            style={{ backgroundColor: '#2563EB' }}
                                                            title="Mark claim as paid"
                                                        >
                                                            <DollarSign size={13} /> Mark Paid
                                                        </button>
                                                    )}
                                                    {item.status === 'paid' && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 px-2 py-0.5 rounded-md bg-blue-50">
                                                            <CheckCircle size={12} /> Paid
                                                        </span>
                                                    )}
                                                    {['rejected', 'changes_requested'].includes(item.status) && (
                                                        <button
                                                            onClick={() => setSelectedId(item._id)}
                                                            className="text-xs font-semibold hover:underline cursor-pointer"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            Details
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                ['draft', 'changes_requested', 'pending'].includes(item.status) ? (
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
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── Drawers & Modals ────────────────────────────────────── */}
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
            {batchModalState.isOpen && (
                <ReimbursementBatchModal
                    isOpen={batchModalState.isOpen}
                    onClose={() => setBatchModalState((prev) => ({ ...prev, isOpen: false }))}
                    action={batchModalState.action}
                    claimIds={batchModalState.claimIds}
                    totalAmount={batchModalState.totalAmount}
                    title={batchModalState.title}
                    subtitle={batchModalState.subtitle}
                    claims={batchModalState.claims}
                    onSuccess={() => {
                        setSelectedClaimIds([]);
                        handleCreatedOrUpdated();
                    }}
                />
            )}
        </div>
    );
}
