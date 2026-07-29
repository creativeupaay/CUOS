import { useState } from 'react';
import {
    X, CheckCircle, XCircle, Clock, AlertTriangle, Download,
    FileText, Image, Loader2, RotateCcw, DollarSign
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import {
    useGetReimbursementByIdQuery,
    useUpdateReimbursementStatusMutation,
    useSubmitReimbursementMutation,
} from '@/features/hrms/hrmsApi';
import type { Reimbursement, ReimbursementApprovalStep } from '@/features/hrms/types/types';
import { hasModuleAdminAccess } from '@/utils/modulePermissions';
import { useAppSelector } from '@/app/hooks';

// ── Helpers ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
    travel: '✈️ Travel', meals: '🍽️ Meals', hotel: '🏨 Hotel',
    fuel: '⛽ Fuel', medical: '🏥 Medical', office: '🗂️ Office Supplies',
    software: '💻 Software', other: '📦 Other',
};

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; icon: React.FC<any> }> = {
    draft: { label: 'Draft', bg: '#F3F4F6', color: '#6B7280', icon: Clock },
    pending: { label: 'Pending Review', bg: '#FEF3C7', color: '#B45309', icon: Clock },
    approved: { label: 'Approved', bg: '#DCFCE7', color: '#15803D', icon: CheckCircle },
    changes_requested: { label: 'Changes Requested', bg: '#FEF3C7', color: '#D97706', icon: AlertTriangle },
    paid: { label: 'Paid', bg: '#DBEAFE', color: '#1D4ED8', icon: DollarSign },
    rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#B91C1C', icon: XCircle },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    bank_transfer: 'Bank Transfer', upi: 'UPI', cash: 'Cash', cheque: 'Cheque',
};

function formatAmount(n: number) {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso?: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    const Icon = cfg.icon;
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            <Icon size={12} /> {cfg.label}
        </span>
    );
}

// ── Approval Timeline ─────────────────────────────────────────────────

function ApprovalTimeline({ steps }: { steps: ReimbursementApprovalStep[] }) {
    return (
        <div className="space-y-0">
            {steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                const cfg = {
                    approved: { color: '#16A34A', bg: '#DCFCE7', icon: CheckCircle },
                    rejected: { color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
                    changes_requested: { color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle },
                    pending: { color: '#9CA3AF', bg: '#F9FAFB', icon: Clock },
                }[step.status] || { color: '#9CA3AF', bg: '#F9FAFB', icon: Clock };
                const Icon = cfg.icon;

                return (
                    <div key={step._id || i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.bg }}>
                                <Icon size={14} style={{ color: cfg.color }} />
                            </div>
                            {!isLast && <div className="w-0.5 flex-1 my-1" style={{ backgroundColor: 'var(--color-border-default)' }} />}
                        </div>
                        <div className="pb-4 pt-1">
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{step.stage}</p>
                            {step.actorName && (
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    by {step.actorName}{step.timestamp ? ` · ${formatDateTime(step.timestamp)}` : ''}
                                </p>
                            )}
                            {step.comment && (
                                <div className="mt-1.5 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)' }}>
                                    "{step.comment}"
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Main Drawer ───────────────────────────────────────────────────────

interface Props {
    reimbursementId: string;
    onClose: () => void;
    onUpdated?: () => void;
}

type Tab = 'overview' | 'receipt' | 'approval' | 'activity';

export default function ReimbursementDetailDrawer({ reimbursementId, onClose, onUpdated }: Props) {
    const user = useAppSelector((state) => state.auth.user);
    const isAdmin = hasModuleAdminAccess(user, 'hrms');

    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [actionMode, setActionMode] = useState<'approve' | 'reject' | 'changes_requested' | 'paid' | 'submit' | null>(null);
    const [comment, setComment] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('hdfc_gst');
    const [paymentReference, setPaymentReference] = useState('');
    const [syncToFinance, setSyncToFinance] = useState(true);
    const [actionError, setActionError] = useState('');

    const { data, isLoading, refetch } = useGetReimbursementByIdQuery(reimbursementId);
    const [updateStatus, { isLoading: isUpdating }] = useUpdateReimbursementStatusMutation();
    const [submitDraft, { isLoading: isSubmitting }] = useSubmitReimbursementMutation();

    const claim: Reimbursement | undefined = data?.data?.reimbursement;

    const handleStatusAction = async () => {
        if (!actionMode || !claim) return;
        setActionError('');
        try {
            const finalStatus = actionMode === 'approve' ? 'approved' : actionMode === 'reject' ? 'rejected' : actionMode;
            await updateStatus({
                id: claim._id,
                data: {
                    status: finalStatus,
                    comment: comment || undefined,
                    paymentMethod: actionMode === 'paid' ? paymentMethod : undefined,
                    paymentReference: actionMode === 'paid' && paymentReference ? paymentReference : undefined,
                    syncToFinance: actionMode === 'paid' ? syncToFinance : undefined,
                },
            }).unwrap();
            setActionMode(null);
            setComment('');
            refetch();
            onUpdated?.();
            refetch();
            onUpdated?.();
        } catch (err: any) {
            setActionError(err?.data?.message || 'Action failed');
        }
    };

    const handleEmployeeSubmit = async () => {
        if (!claim) return;
        setActionError('');
        try {
            await submitDraft(claim._id).unwrap();
            refetch();
            onUpdated?.();
        } catch (err: any) {
            setActionError(err?.data?.message || 'Failed to submit claim');
        }
    };

    const tabs: { key: Tab; label: string }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'receipt', label: 'Receipt' },
        { key: 'approval', label: 'Approval' },
        { key: 'activity', label: 'Activity' },
    ];

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-50 flex items-center justify-end"
                style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                onClick={onClose}
            >
                <div
                    className="relative h-full flex flex-col shadow-2xl"
                    style={{ width: '520px', backgroundColor: 'var(--color-bg-surface)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div
                        className="px-6 py-4 border-b shrink-0"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
                            </div>
                        ) : claim ? (
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <StatusBadge status={claim.status} />
                                    </div>
                                    <h2 className="font-bold text-base truncate" style={{ color: 'var(--color-text-primary)' }}>{claim.title}</h2>
                                    <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                        {CATEGORY_LABELS[claim.category] || claim.category} · {formatDate(claim.expenseDate)}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatAmount(claim.amount)}</div>
                                    {claim.merchant && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{claim.merchant}</div>}
                                </div>
                            </div>
                        ) : null}
                        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div
                        className="flex px-6 border-b shrink-0"
                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}
                    >
                        {tabs.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setActiveTab(key)}
                                className="px-4 py-3 text-sm font-medium cursor-pointer transition-all border-b-2 -mb-px"
                                style={{
                                    borderColor: activeTab === key ? 'var(--color-primary)' : 'transparent',
                                    color: activeTab === key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                            </div>
                        ) : !claim ? (
                            <div className="py-20 text-center" style={{ color: 'var(--color-text-muted)' }}>Claim not found</div>
                        ) : (
                            <>
                                {/* ─ Overview Tab ─ */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-5">
                                        {/* Changes requested banner */}
                                        {claim.status === 'changes_requested' && (
                                            <div className="px-4 py-3 rounded-xl flex items-start gap-2.5" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D' }}>
                                                <AlertTriangle size={16} style={{ color: '#D97706' }} className="shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: '#92400E' }}>Changes Requested</p>
                                                    {claim.approvalTimeline[1]?.comment && (
                                                        <p className="text-xs mt-0.5" style={{ color: '#B45309' }}>"{claim.approvalTimeline[1].comment}"</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Payment info banner */}
                                        {claim.status === 'paid' && claim.paymentInfo && (
                                            <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: '#DBEAFE', border: '1px solid #BFDBFE' }}>
                                                <p className="text-sm font-semibold" style={{ color: '#1E40AF' }}>✅ Payment Processed</p>
                                                <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
                                                    {formatAmount(claim.amount)} via {PAYMENT_METHOD_LABELS[claim.paymentInfo.method] || claim.paymentInfo.method}
                                                    {claim.paymentInfo.reference ? ` · Ref: ${claim.paymentInfo.reference}` : ''} · {formatDate(claim.paymentInfo.paidAt)}
                                                </p>
                                            </div>
                                        )}

                                        {/* Employee info (admin view) */}
                                        {isAdmin && claim.user && (
                                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                                <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Employee</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                                                        {claim.user.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{claim.user.name}</p>
                                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{claim.user.email}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Details grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { label: 'Category', value: CATEGORY_LABELS[claim.category] || claim.category },
                                                { label: 'Expense Date', value: formatDate(claim.expenseDate) },
                                                { label: 'Amount', value: formatAmount(claim.amount) },
                                                { label: 'Merchant', value: claim.merchant || '—' },
                                                { label: 'Submitted', value: claim.submittedAt ? formatDate(claim.submittedAt) : '—' },
                                            ].map(({ label, value }) => (
                                                <div key={label}>
                                                    <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Business Purpose */}
                                        <div>
                                            <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Business Purpose</p>
                                            <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)' }}>
                                                {claim.businessPurpose}
                                            </div>
                                        </div>


                                        {/* Policy flags */}
                                        {claim.policyFlags.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Policy Check</p>
                                                <div className="space-y-1.5">
                                                    {claim.policyFlags.map((f) => {
                                                        const cfg = { pass: { color: '#16A34A', bg: '#DCFCE7' }, warn: { color: '#D97706', bg: '#FEF3C7' }, fail: { color: '#DC2626', bg: '#FEE2E2' } }[f.status];
                                                        return (
                                                            <div key={f.rule} className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                                                                {f.status === 'pass' ? '✓' : '⚠'} {f.message}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ─ Receipt Tab ─ */}
                                {activeTab === 'receipt' && (
                                    <div>
                                        {claim.receipt ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        {claim.receipt.originalName || 'Receipt'}
                                                    </p>
                                                    <a
                                                        href={claim.receipt.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
                                                        style={{ backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-darker)' }}
                                                    >
                                                        <Download size={12} /> Download
                                                    </a>
                                                </div>
                                                {claim.receipt.format === 'pdf' || claim.receipt.originalName?.endsWith('.pdf') ? (
                                                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border py-16" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                                                        <FileText size={40} style={{ color: 'var(--color-text-muted)' }} />
                                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>PDF Document</p>
                                                        <a href={claim.receipt.url} target="_blank" rel="noreferrer"
                                                            className="px-4 py-2 text-sm font-semibold rounded-xl text-white"
                                                            style={{ backgroundColor: 'var(--color-primary)' }}>
                                                            View PDF
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <img
                                                        src={claim.receipt.url}
                                                        alt="Receipt"
                                                        className="w-full rounded-2xl border object-contain"
                                                        style={{ maxHeight: '420px', borderColor: 'var(--color-border-default)' }}
                                                    />
                                                )}
                                                <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                                                    {(claim.receipt.size / 1024).toFixed(1)} KB · {claim.receipt.format?.toUpperCase()}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                                <Image size={36} style={{ color: 'var(--color-text-muted)' }} />
                                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No receipt attached</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ─ Approval Timeline Tab ─ */}
                                {activeTab === 'approval' && (
                                    <div>
                                        <ApprovalTimeline steps={claim.approvalTimeline} />
                                    </div>
                                )}

                                {/* ─ Activity Tab ─ */}
                                {activeTab === 'activity' && (
                                    <div className="space-y-3">
                                        {claim.activityLog.length === 0 ? (
                                            <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>No activity yet</p>
                                        ) : (
                                            [...claim.activityLog].reverse().map((entry) => (
                                                <div key={entry._id} className="flex gap-3">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                                                        {entry.actorName.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 rounded-xl px-3 py-2.5" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>
                                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                                            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{entry.actorName}</span>
                                                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatDateTime(entry.timestamp)}</span>
                                                        </div>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{entry.action}</p>
                                                        {entry.comment && (
                                                            <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-muted)' }}>"{entry.comment}"</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Admin Action Bar */}
                    {isAdmin && claim && ['pending', 'approved'].includes(claim.status) && (
                        <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--color-border-default)' }}>
                            {actionMode ? (
                                <div className="space-y-3">
                                    <p className="text-sm font-semibold capitalize" style={{ color: 'var(--color-text-primary)' }}>
                                        {actionMode === 'changes_requested' ? 'Request Changes' : actionMode === 'paid' ? 'Mark as Paid' : actionMode.charAt(0).toUpperCase() + actionMode.slice(1)} Claim
                                    </p>

                                    {actionMode === 'paid' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Payment Method</label>
                                                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm rounded-lg border"
                                                    style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                                                    <option value="hdfc_gst">HDFC (GST)</option>
                                                    <option value="sbi_non_gst">SBI (Non-GST)</option>
                                                    <option value="cash">Cash</option>
                                                </select>
                                            </div>
                                            {paymentMethod !== 'cash' && (
                                                <div>
                                                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>Reference No.</label>
                                                    <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)}
                                                        placeholder="UTR / Ref no."
                                                        className="w-full px-3 py-2 text-sm rounded-lg border"
                                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <textarea
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        rows={2}
                                        placeholder={actionMode === 'reject' ? 'Reason for rejection (required)...' : 'Add a comment (optional)...'}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none"
                                        style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                                    />

                                    {actionError && (
                                        <p className="text-xs" style={{ color: '#DC2626' }}>{actionError}</p>
                                    )}

                                    {actionMode === 'paid' && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <input
                                                type="checkbox"
                                                id="syncFinance"
                                                checked={syncToFinance}
                                                onChange={(e) => setSyncToFinance(e.target.checked)}
                                                className="w-4 h-4 rounded border"
                                                style={{ borderColor: 'var(--color-border-default)', accentColor: 'var(--color-primary)' }}
                                            />
                                            <label htmlFor="syncFinance" className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
                                                Save to Finance Expenses
                                            </label>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleStatusAction}
                                            disabled={isUpdating}
                                            className="flex-1 py-2 text-sm font-bold text-white rounded-xl cursor-pointer disabled:opacity-60"
                                            style={{ backgroundColor: actionMode === 'reject' ? '#DC2626' : actionMode === 'paid' ? '#2563EB' : 'var(--color-primary)' }}
                                        >
                                            {isUpdating ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm'}
                                        </button>
                                        <button
                                            onClick={() => { setActionMode(null); setComment(''); setActionError(''); }}
                                            className="px-4 py-2 text-sm rounded-xl border cursor-pointer"
                                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2 flex-wrap">
                                    {claim.status === 'pending' && (
                                        <>
                                            <button onClick={() => setActionMode('approve')}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-white rounded-xl cursor-pointer"
                                                style={{ backgroundColor: '#16A34A' }}>
                                                <CheckCircle size={14} /> Approve
                                            </button>
                                            <button onClick={() => setActionMode('changes_requested')}
                                                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl border cursor-pointer"
                                                style={{ borderColor: '#FCD34D', backgroundColor: '#FEF3C7', color: '#D97706' }}>
                                                <RotateCcw size={14} /> Request Changes
                                            </button>
                                            <button onClick={() => setActionMode('reject')}
                                                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl border cursor-pointer"
                                                style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                                                <XCircle size={14} /> Reject
                                            </button>
                                        </>
                                    )}
                                    {claim.status === 'approved' && (
                                        <button onClick={() => setActionMode('paid')}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-white rounded-xl cursor-pointer"
                                            style={{ backgroundColor: '#2563EB' }}>
                                            <DollarSign size={14} /> Mark as Paid
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Employee Action Bar (Submit Draft/Changes Requested/Pending Edit) */}
                    {!isAdmin && claim && ['draft', 'changes_requested', 'pending'].includes(claim.status) && (
                        <div className="px-6 py-4 border-t shrink-0 bg-gray-50 flex flex-col gap-2" style={{ borderColor: 'var(--color-border-default)' }}>
                            {actionError && (
                                <p className="text-xs text-center" style={{ color: '#DC2626' }}>{actionError}</p>
                            )}

                            {['draft', 'changes_requested'].includes(claim.status) && (
                                <>
                                    <button
                                        onClick={handleEmployeeSubmit}
                                        disabled={isSubmitting}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-white rounded-xl cursor-pointer disabled:opacity-60 transition-all"
                                        style={{ backgroundColor: 'var(--color-primary)' }}
                                    >
                                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : '→ Submit Claim'}
                                    </button>
                                    <p className="text-xs text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        Submitting will send this claim for review.
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </ModalPortal>
    );
}
