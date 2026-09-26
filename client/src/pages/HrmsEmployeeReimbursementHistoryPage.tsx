import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Clock, CheckCircle, DollarSign, XCircle, AlertTriangle,
    Loader2, Receipt, TrendingUp, Filter, Check
} from 'lucide-react';
import { useGetEmployeeReimbursementsQuery } from '@/features/hrms/hrmsApi';
import ReimbursementDetailDrawer from '@/components/organisms/hrms/ReimbursementDetailDrawer';
import ReimbursementBatchModal from '@/components/organisms/hrms/ReimbursementBatchModal';
import type { Reimbursement } from '@/features/hrms/types/types';

// ── Helpers ────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
    travel: '✈️ Travel', meals: '🍽️ Meals', hotel: '🏨 Hotel',
    fuel: '⛽ Fuel', medical: '🏥 Medical', office: '🗂️ Office',
    software: '💻 Software', other: '📦 Other',
};

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; icon: React.FC<any> }> = {
    draft:              { label: 'Draft',              bg: '#F3F4F6', color: '#6B7280', icon: Receipt },
    pending:            { label: 'Pending Review',     bg: '#FEF3C7', color: '#B45309', icon: Clock },
    approved:           { label: 'Approved',           bg: '#DCFCE7', color: '#15803D', icon: CheckCircle },
    changes_requested:  { label: 'Changes Requested',  bg: '#FFF7ED', color: '#C2410C', icon: AlertTriangle },
    paid:               { label: 'Paid',               bg: '#DBEAFE', color: '#1D4ED8', icon: DollarSign },
    rejected:           { label: 'Rejected',           bg: '#FEE2E2', color: '#B91C1C', icon: XCircle },
};

function formatAmount(n: number) {
    return `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Status Badge ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    const Icon = cfg.icon;
    return (
        <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
            <Icon size={11} /> {cfg.label}
        </span>
    );
}

// ── Stat Card ──────────────────────────────────────────────────────────

function StatCard({
    title, amount, count, icon: Icon, iconBg, iconColor, isCount = false,
}: {
    title: string;
    amount: number;
    count: number;
    icon: React.FC<any>;
    iconBg: string;
    iconColor: string;
    isCount?: boolean;
}) {
    return (
        <div
            className="rounded-2xl border p-5 flex flex-col gap-2"
            style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {title}
                </span>
                <div className="p-2 rounded-xl" style={{ backgroundColor: iconBg }}>
                    <Icon size={16} style={{ color: iconColor }} />
                </div>
            </div>
            <div className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>
                {isCount ? count : formatAmount(amount)}
            </div>
            {!isCount && (
                <div className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    {count} claim{count !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'approved' | 'paid' | 'changes_requested' | 'rejected' | 'draft';

const FILTER_OPTIONS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'paid', label: 'Paid' },
    { key: 'changes_requested', label: 'Changes Req.' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'draft', label: 'Draft' },
];

export default function HrmsEmployeeReimbursementHistoryPage() {
    const { id: employeeId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    // The previous page passes the `emp` object in state so we don't have to fetch user details again
    const empData = location.state?.emp;
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
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

    const { data, isLoading, refetch } = useGetEmployeeReimbursementsQuery(employeeId!);

    const allReimbursements: Reimbursement[] = data?.data?.reimbursements || [];
    const summary = data?.data?.summary;
    const fetchedEmployee = (data as any)?.data?.employee;

    const employeeName = empData?.user?.name || fetchedEmployee?.user?.name || allReimbursements[0]?.user?.name || 'Employee Reimbursements';
    const employeeEmail = empData?.user?.email || fetchedEmployee?.user?.email || '';
    const employeeDept = empData?.employee?.department || fetchedEmployee?.department || '';
    const employeeDesig = empData?.employee?.designation || fetchedEmployee?.designation || '';

    const filtered = statusFilter === 'all'
        ? allReimbursements
        : allReimbursements.filter((r) => r.status === statusFilter);

    const selectedClaims = allReimbursements.filter((r) => selectedClaimIds.includes(r._id));
    const selectedTotalAmount = selectedClaims.reduce((sum, r) => sum + (r.amount || 0), 0);
    const selectedPendingClaims = selectedClaims.filter((r) => r.status === 'pending');
    const selectedApprovedClaims = selectedClaims.filter((r) => r.status === 'approved');

    const visiblePendingClaims = filtered.filter((r) => r.status === 'pending');
    const visibleApprovedClaims = filtered.filter((r) => r.status === 'approved');

    const handleQuickApprove = (claim: any) => {
        setBatchModalState({
            isOpen: true,
            action: 'approve',
            claimIds: [claim._id],
            totalAmount: claim.amount || 0,
            title: `Approve Claim ${claim.claimId}`,
            subtitle: `For ${employeeName} · ₹${(claim.amount || 0).toLocaleString('en-IN')}`,
            claims: [{ ...claim, user: claim.user || { name: employeeName } }],
        });
    };

    const handleQuickPay = (claim: any) => {
        setBatchModalState({
            isOpen: true,
            action: 'paid',
            claimIds: [claim._id],
            totalAmount: claim.amount || 0,
            title: `Mark Claim ${claim.claimId} as Paid`,
            subtitle: `For ${employeeName} · ₹${(claim.amount || 0).toLocaleString('en-IN')}`,
            claims: [{ ...claim, user: claim.user || { name: employeeName } }],
        });
    };

    const handleOpenBatchModal = (action: 'approve' | 'paid', claims: any[]) => {
        const total = claims.reduce((s, r) => s + (r.amount || 0), 0);
        setBatchModalState({
            isOpen: true,
            action,
            claimIds: claims.map((r) => r._id),
            totalAmount: total,
            title: action === 'approve'
                ? `Approve ${claims.length} Selected Claim${claims.length > 1 ? 's' : ''}`
                : `Mark ${claims.length} Selected Claim${claims.length > 1 ? 's' : ''} as Paid`,
            subtitle: `Total: ₹${total.toLocaleString('en-IN')}`,
            claims: claims.map((c) => ({ ...c, user: c.user || { name: employeeName } })),
        });
    };

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/hrms/reimbursements/employees')}
                        className="p-2 rounded-xl border flex items-center justify-center cursor-pointer transition-colors hover:opacity-80"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            color: 'var(--color-text-muted)',
                            backgroundColor: 'var(--color-bg-surface)',
                        }}
                        title="Back to Employee Overview"
                    >
                        <ArrowLeft size={17} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {employeeName}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                            {employeeDesig || employeeEmail}
                            {employeeDept ? ` · ${employeeDept}` : ''}
                        </p>
                    </div>
                </div>
                {!isLoading && summary && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="text-right">
                            <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>TOTAL OUTSTANDING</p>
                            <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                {formatAmount((summary.pending.amount ?? 0) + (summary.approved.amount ?? 0))}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Summary Stats ──────────────────────────────────── */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-32 rounded-2xl border animate-pulse" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }} />
                    ))}
                </div>
            ) : summary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Pending Review"
                        amount={summary.pending.amount}
                        count={summary.pending.count}
                        icon={Clock}
                        iconBg="#FEF3C7"
                        iconColor="#B45309"
                    />
                    <StatCard
                        title="Approved"
                        amount={summary.approved.amount}
                        count={summary.approved.count}
                        icon={CheckCircle}
                        iconBg="#DCFCE7"
                        iconColor="#15803D"
                    />
                    <StatCard
                        title="Paid This Month"
                        amount={summary.paidThisMonth.amount}
                        count={summary.paidThisMonth.count}
                        icon={DollarSign}
                        iconBg="#DBEAFE"
                        iconColor="#1D4ED8"
                    />
                    <StatCard
                        title="Total Claimed"
                        amount={summary.totalClaimed.amount}
                        count={summary.totalClaimed.count}
                        icon={TrendingUp}
                        iconBg="var(--color-primary-light)"
                        iconColor="var(--color-primary)"
                    />
                </div>
            ) : null}

            {/* ── Filter & List ──────────────────────────────────── */}
            <div
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)' }}
            >
                {/* Filter Bar */}
                <div
                    className="px-5 py-4 border-b flex items-center gap-3 overflow-x-auto"
                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                >
                    <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
                    <div className="flex gap-1.5">
                        {FILTER_OPTIONS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setStatusFilter(key)}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all whitespace-nowrap"
                                style={
                                    statusFilter === key
                                        ? {
                                            backgroundColor: 'var(--color-primary)',
                                            color: '#fff',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                          }
                                        : {
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-text-secondary)',
                                            border: '1px solid var(--color-border-default)',
                                          }
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <span className="ml-auto text-sm font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {filtered.length} claim{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Multi-select Batch Action Bar */}
                {selectedClaimIds.length > 0 && (
                    <div
                        className="flex flex-wrap items-center justify-between px-5 py-3 border-b gap-3 animate-in fade-in"
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
                                Total: {formatAmount(selectedTotalAmount)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedPendingClaims.length > 0 && (
                                <button
                                    onClick={() => handleOpenBatchModal('approve', selectedPendingClaims)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
                                    style={{ backgroundColor: '#16A34A' }}
                                >
                                    <Check size={13} /> Approve Selected ({selectedPendingClaims.length})
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

                {/* List */}
                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                            <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>Loading history...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Receipt size={48} style={{ color: 'var(--color-text-muted)', opacity: 0.3 }} />
                            <p className="text-base font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                                No claims found
                            </p>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
                                {statusFilter !== 'all' ? 'Try selecting a different filter' : 'This employee has no reimbursement claims yet'}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr
                                    className="border-b text-xs font-bold tracking-wider"
                                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
                                >
                                    <th className="px-5 py-4 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={filtered.length > 0 && selectedClaimIds.length === filtered.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedClaimIds(filtered.map((r) => r._id));
                                                } else {
                                                    setSelectedClaimIds([]);
                                                }
                                            }}
                                            className="w-4 h-4 rounded cursor-pointer"
                                            style={{ accentColor: 'var(--color-primary)' }}
                                            title="Select / Deselect all"
                                        />
                                    </th>
                                    <th className="px-5 py-4 w-12"></th>
                                    <th className="px-5 py-4">Claim Details</th>
                                    <th className="px-5 py-4 text-center">Status</th>
                                    <th className="px-5 py-4 text-right">Date</th>
                                    <th className="px-5 py-4 text-right">Amount</th>
                                    <th className="px-5 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                                {filtered.map((item) => {
                                    const statusCfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
                                    const Icon = statusCfg.icon;

                                    return (
                                        <tr
                                            key={item._id}
                                            onClick={() => setSelectedClaimId(item._id)}
                                            className="transition-colors cursor-pointer"
                                            style={{ backgroundColor: 'transparent' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                            <td className="px-5 py-4 w-10 text-center" onClick={(e) => e.stopPropagation()}>
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
                                            <td className="px-5 py-4 w-12">
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                    style={{ backgroundColor: statusCfg.bg }}
                                                >
                                                    <Icon size={18} style={{ color: statusCfg.color }} />
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                    {item.title}
                                                </p>
                                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                                    {CATEGORY_LABELS[item.category] || item.category}
                                                    {item.merchant ? ` · ${item.merchant}` : ''}
                                                    {' · '}
                                                    {item.claimId}
                                                </p>
                                                {item.policyFlags?.some((f) => f.status === 'warn' || f.status === 'fail') && (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase mt-1.5"
                                                        style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}
                                                    >
                                                        <AlertTriangle size={10} /> Flagged
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <StatusBadge status={item.status} />
                                                {item.status === 'paid' && item.paymentInfo && (
                                                    <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                                        Paid {formatDate(item.paymentInfo.paidAt)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                    {formatDate(item.expenseDate)}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                    {formatAmount(item.amount)}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {item.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleQuickApprove(item)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
                                                            style={{ backgroundColor: '#16A34A' }}
                                                            title="Approve this claim"
                                                        >
                                                            <Check size={13} /> Approve
                                                        </button>
                                                    )}
                                                    {item.status === 'approved' && (
                                                        <button
                                                            onClick={() => handleQuickPay(item)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white rounded-lg transition-opacity hover:opacity-90 cursor-pointer shadow-2xs"
                                                            style={{ backgroundColor: '#2563EB' }}
                                                            title="Mark as paid"
                                                        >
                                                            <DollarSign size={13} /> Mark Paid
                                                        </button>
                                                    )}
                                                    {item.status === 'paid' && (
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 px-2.5 py-1 rounded-md bg-blue-50">
                                                            <CheckCircle size={13} /> Paid
                                                        </span>
                                                    )}
                                                    {['rejected', 'changes_requested'].includes(item.status) && (
                                                        <button
                                                            onClick={() => setSelectedClaimId(item._id)}
                                                            className="text-xs font-semibold hover:underline cursor-pointer"
                                                            style={{ color: 'var(--color-primary)' }}
                                                        >
                                                            Details
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Nested detail drawer */}
            {selectedClaimId && (
                <ReimbursementDetailDrawer
                    reimbursementId={selectedClaimId}
                    onClose={() => setSelectedClaimId(null)}
                    onUpdated={refetch}
                />
            )}

            {/* Batch / Quick Action Modal */}
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
                        refetch();
                    }}
                />
            )}
        </div>
    );
}
