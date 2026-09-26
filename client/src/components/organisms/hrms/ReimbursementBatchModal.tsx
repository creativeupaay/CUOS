import { useState, useMemo, useEffect } from 'react';
import { X, CheckCircle, DollarSign, Loader2, AlertCircle, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useBulkUpdateReimbursementStatusMutation } from '@/features/hrms/hrmsApi';
import ModalPortal from '@/components/ui/ModalPortal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    action: 'approve' | 'paid';
    claimIds: string[];
    totalAmount: number;
    title?: string;
    subtitle?: string;
    claims?: any[];
    onSuccess?: () => void;
}

interface EmployeePayoutGroup {
    key: string;
    employeeName: string;
    employeeEmail?: string;
    employeeDept?: string;
    totalAmount: number;
    claims: any[];
}

interface EmployeePaymentState {
    paymentMethod: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
    paymentReference: string;
    syncToFinance: boolean;
    comment: string;
}

const CATEGORY_ICONS: Record<string, string> = {
    travel: '✈️ Travel',
    meals: '🍽️ Meals',
    hotel: '🏨 Hotel',
    fuel: '⛽ Fuel',
    medical: '🏥 Medical',
    office: '🗂️ Office',
    software: '💻 Software',
    other: '📦 Other',
};

export default function ReimbursementBatchModal({
    isOpen,
    onClose,
    action,
    claimIds,
    totalAmount,
    title,
    subtitle,
    claims = [],
    onSuccess,
}: Props) {
    const [bulkUpdate, { isLoading }] = useBulkUpdateReimbursementStatusMutation();

    // General note for approvals
    const [approvalComment, setApprovalComment] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const isPaidAction = action === 'paid';
    const count = claimIds.length;

    // Group claims by employee
    const employeeGroups = useMemo<EmployeePayoutGroup[]>(() => {
        if (!claims || claims.length === 0) {
            return [{
                key: 'default',
                employeeName: 'All Selected Employees',
                totalAmount: totalAmount || 0,
                claims: claimIds.map((id) => ({ _id: id, amount: 0 })),
            }];
        }

        const map = new Map<string, EmployeePayoutGroup>();

        claims.forEach((claim: any) => {
            const empUser = claim.user || (typeof claim.employeeId === 'object' ? claim.employeeId?.userId : null);
            const emp = claim.employee || (typeof claim.employeeId === 'object' ? claim.employeeId : null);

            const key = String(
                empUser?._id ||
                emp?._id ||
                (typeof claim.employeeId === 'string' ? claim.employeeId : '') ||
                empUser?.name ||
                'default'
            );

            const name = empUser?.name || emp?.name || (typeof claim.employeeId === 'object' ? claim.employeeId?.userId?.name : '') || 'Employee';
            const email = empUser?.email || emp?.email || '';
            const dept = emp?.department || emp?.workDetails?.department || '';

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    employeeName: name,
                    employeeEmail: email,
                    employeeDept: dept,
                    totalAmount: 0,
                    claims: [],
                });
            }

            const group = map.get(key)!;
            group.totalAmount += (claim.amount || 0);
            group.claims.push(claim);
        });

        return Array.from(map.values());
    }, [claims, claimIds, totalAmount]);

    // Track which employee cards are expanded (first employee expanded by default)
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
        return new Set(employeeGroups.length > 0 ? [employeeGroups[0].key] : []);
    });

    // Keep expandedKeys synced when groups change
    useEffect(() => {
        if (employeeGroups.length > 0) {
            setExpandedKeys(new Set([employeeGroups[0].key]));
        }
    }, [employeeGroups.length]);

    // Per-employee payment state map (paymentMethod, paymentReference, syncToFinance, comment)
    const [payoutStateMap, setPayoutStateMap] = useState<Record<string, EmployeePaymentState>>({});

    const getEmployeePaymentState = (key: string): EmployeePaymentState => {
        return payoutStateMap[key] || {
            paymentMethod: 'hdfc_gst',
            paymentReference: '',
            syncToFinance: true,
            comment: '',
        };
    };

    const updateEmployeePaymentState = (key: string, updates: Partial<EmployeePaymentState>) => {
        setPayoutStateMap((prev) => {
            const current = prev[key] || {
                paymentMethod: 'hdfc_gst',
                paymentReference: '',
                syncToFinance: true,
                comment: '',
            };
            return {
                ...prev,
                [key]: { ...current, ...updates },
            };
        });
    };

    const toggleExpand = (key: string) => {
        setExpandedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Copy payment details from the first employee to all other employees
    const handleCopyDetailsToAll = () => {
        if (employeeGroups.length === 0) return;
        const sourceState = getEmployeePaymentState(employeeGroups[0].key);
        const updated: Record<string, EmployeePaymentState> = {};
        employeeGroups.forEach((g) => {
            updated[g.key] = { ...sourceState };
        });
        setPayoutStateMap(updated);
    };

    if (!isOpen) return null;

    const formattedAmount = `₹${(totalAmount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;

    const defaultTitle = isPaidAction
        ? count === 1
            ? 'Mark Claim as Paid'
            : `Mark ${count} Claims as Paid`
        : count === 1
            ? 'Approve Claim'
            : `Approve ${count} Claims`;

    const handleConfirm = async () => {
        if (!claimIds.length) return;
        setErrorMsg('');

        try {
            if (isPaidAction) {
                const promises = employeeGroups.map((group) => {
                    const state = getEmployeePaymentState(group.key);
                    return bulkUpdate({
                        ids: group.claims.map((c: any) => c._id),
                        status: 'paid',
                        paymentMethod: state.paymentMethod,
                        paymentReference: state.paymentReference.trim() || undefined,
                        comment: state.comment.trim() || undefined,
                        syncToFinance: state.syncToFinance,
                    }).unwrap();
                });

                const results = await Promise.all(promises);
                const totalErrors = results.reduce((acc: number, r: any) => acc + (r?.data?.errorCount || 0), 0);
                const totalSuccess = results.reduce((acc: number, r: any) => acc + (r?.data?.successCount || 0), 0);

                if (totalErrors > 0 && totalSuccess === 0) {
                    setErrorMsg(results[0]?.data?.errors?.[0]?.error || 'Failed to update claims');
                    return;
                }
            } else {
                const res = await bulkUpdate({
                    ids: claimIds,
                    status: 'approved',
                    comment: approvalComment.trim() || undefined,
                }).unwrap();

                if (res.data?.errorCount && res.data.errorCount > 0 && res.data.successCount === 0) {
                    setErrorMsg(res.data.errors?.[0]?.error || 'Failed to update claims');
                    return;
                }
            }

            onSuccess?.();
            onClose();
        } catch (err: any) {
            setErrorMsg(err?.data?.message || err?.message || 'An error occurred while updating claims');
        }
    };

    return (
        <ModalPortal
            high
            onClick={(e) => {
                if (e.target === e.currentTarget && !isLoading) onClose();
            }}
        >
            <div
                className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
                style={{
                    backgroundColor: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border-default)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                    style={{ borderColor: 'var(--color-border-default)' }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                backgroundColor: isPaidAction ? '#EFF6FF' : 'var(--color-primary-soft)',
                                color: isPaidAction ? '#2563EB' : 'var(--color-primary-dark)',
                            }}
                        >
                            {isPaidAction ? <DollarSign size={20} /> : <CheckCircle size={20} />}
                        </div>
                        <div>
                            <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                {title || defaultTitle}
                            </h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                {subtitle || (isPaidAction ? 'Review & confirm payout per employee' : 'Review & confirm approval')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1.5 rounded-lg border transition-colors cursor-pointer hover:bg-black/5"
                        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-muted)' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto">
                    {/* 1. Whole Amount Card */}
                    <div
                        className="p-4 rounded-xl border flex items-center justify-between shadow-xs"
                        style={{
                            backgroundColor: 'var(--color-bg-subtle)',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                {isPaidAction ? 'Total Payout Amount' : 'Total Approval Amount'}
                            </p>
                            <p className="text-2xl font-black mt-0.5 tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                                {formattedAmount}
                            </p>
                        </div>
                        <div className="text-right">
                            <span
                                className="px-3 py-1.5 text-xs font-semibold rounded-full border inline-flex items-center gap-1.5"
                                style={{
                                    backgroundColor: isPaidAction ? '#EFF6FF' : 'var(--color-primary-soft)',
                                    color: isPaidAction ? '#1D4ED8' : 'var(--color-primary-darker)',
                                    borderColor: isPaidAction ? '#BFDBFE' : 'rgba(16, 185, 129, 0.25)',
                                }}
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: isPaidAction ? '#2563EB' : 'var(--color-primary)' }}
                                />
                                {count} {count === 1 ? 'Claim' : 'Claims'} · {employeeGroups.length} {employeeGroups.length === 1 ? 'Employee' : 'Employees'}
                            </span>
                        </div>
                    </div>

                    {/* 2. Paid Action: Employee-Grouped Workflow */}
                    {isPaidAction ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                    Employees to Pay ({employeeGroups.length})
                                </p>
                                {employeeGroups.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleCopyDetailsToAll}
                                        className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-80"
                                        style={{ color: '#2563EB' }}
                                        title="Copy payment method and note from the first employee to all other employees"
                                    >
                                        <Copy size={13} /> Apply 1st details to all
                                    </button>
                                )}
                            </div>

                            {employeeGroups.map((group) => {
                                const isExpanded = expandedKeys.has(group.key);
                                const state = getEmployeePaymentState(group.key);
                                const formattedGroupAmount = `₹${(group.totalAmount || 0).toLocaleString('en-IN', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                })}`;

                                return (
                                    <div
                                        key={group.key}
                                        className="rounded-xl border transition-all overflow-hidden shadow-xs"
                                        style={{
                                            borderColor: isExpanded ? '#3B82F6' : 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                        }}
                                    >
                                        {/* Employee Header Row */}
                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(group.key)}
                                            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none hover:bg-black/2"
                                            style={{
                                                backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.04)' : 'var(--color-bg-surface)',
                                            }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
                                                    style={{
                                                        backgroundColor: '#EFF6FF',
                                                        color: '#1D4ED8',
                                                        borderColor: '#BFDBFE',
                                                    }}
                                                >
                                                    {group.employeeName.charAt(0).toUpperCase() || 'E'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                        {group.employeeName}
                                                    </p>
                                                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                                        {[
                                                            group.employeeDept || group.employeeEmail,
                                                            `${group.claims.length} ${group.claims.length === 1 ? 'claim' : 'claims'}`,
                                                        ].filter(Boolean).join(' · ')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5 shrink-0">
                                                <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                    {formattedGroupAmount}
                                                </span>
                                                <div className="p-1 rounded-md transition-transform" style={{ color: 'var(--color-text-muted)' }}>
                                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </div>
                                            </div>
                                        </button>

                                        {/* Expanded Employee Claims & Payment Details */}
                                        {isExpanded && (
                                            <div
                                                className="p-4 border-t space-y-4"
                                                style={{
                                                    borderColor: 'var(--color-border-default)',
                                                    backgroundColor: 'var(--color-bg-surface)',
                                                }}
                                            >
                                                {/* Claims List for this employee */}
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                                        Reimbursement Claims ({group.claims.length})
                                                    </p>
                                                    <div
                                                        className="rounded-lg border divide-y overflow-hidden max-h-48 overflow-y-auto"
                                                        style={{
                                                            borderColor: 'var(--color-border-default)',
                                                            backgroundColor: 'var(--color-bg-subtle)',
                                                        }}
                                                    >
                                                        {group.claims.map((claim: any, cIdx: number) => {
                                                            const claimTitle = claim.title || claim.claimId || `Claim #${cIdx + 1}`;
                                                            const dateStr = claim.expenseDate || claim.createdAt
                                                                ? new Date(claim.expenseDate || claim.createdAt).toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric',
                                                                })
                                                                : '';
                                                            const categoryLabel = CATEGORY_ICONS[claim.category] || claim.category;
                                                            const metaParts = [
                                                                claim.claimId && claim.claimId !== claimTitle ? claim.claimId : null,
                                                                categoryLabel,
                                                                dateStr,
                                                            ].filter(Boolean);

                                                            return (
                                                                <div
                                                                    key={claim._id || cIdx}
                                                                    className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-semibold truncate text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                                            {claimTitle}
                                                                        </p>
                                                                        {metaParts.length > 0 && (
                                                                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                                                {metaParts.join(' · ')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <span className="font-bold shrink-0 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                                                        ₹{(claim.amount || 0).toLocaleString('en-IN', {
                                                                            minimumFractionDigits: 0,
                                                                            maximumFractionDigits: 2,
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Payment Form Fields (Aligned with ReimbursementDetailDrawer) */}
                                                <div className="pt-3 border-t space-y-3" style={{ borderColor: 'var(--color-border-default)' }}>
                                                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                                                        Payment Details for {group.employeeName}
                                                    </p>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                                Payment Method
                                                            </label>
                                                            <select
                                                                value={state.paymentMethod}
                                                                onChange={(e) => updateEmployeePaymentState(group.key, { paymentMethod: e.target.value as any })}
                                                                className="w-full px-3 py-2 text-sm rounded-lg border outline-none cursor-pointer transition-colors focus:border-blue-500"
                                                                style={{
                                                                    borderColor: 'var(--color-border-default)',
                                                                    backgroundColor: 'var(--color-bg-surface)',
                                                                    color: 'var(--color-text-primary)',
                                                                }}
                                                            >
                                                                <option value="hdfc_gst">HDFC (GST)</option>
                                                                <option value="sbi_non_gst">SBI (Non-GST)</option>
                                                                <option value="cash">Cash</option>
                                                            </select>
                                                        </div>

                                                        {state.paymentMethod !== 'cash' && (
                                                            <div>
                                                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                                    Reference No.
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={state.paymentReference}
                                                                    onChange={(e) => updateEmployeePaymentState(group.key, { paymentReference: e.target.value })}
                                                                    placeholder="UTR / Ref no."
                                                                    className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors focus:border-blue-500"
                                                                    style={{
                                                                        borderColor: 'var(--color-border-default)',
                                                                        backgroundColor: 'var(--color-bg-surface)',
                                                                        color: 'var(--color-text-primary)',
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                            Note / Comment (Optional)
                                                        </label>
                                                        <textarea
                                                            value={state.comment}
                                                            onChange={(e) => updateEmployeePaymentState(group.key, { comment: e.target.value })}
                                                            rows={2}
                                                            placeholder="Add a comment (optional)..."
                                                            className="w-full px-3 py-2 text-sm rounded-lg border resize-none outline-none transition-colors focus:border-blue-500"
                                                            style={{
                                                                borderColor: 'var(--color-border-default)',
                                                                backgroundColor: 'var(--color-bg-surface)',
                                                                color: 'var(--color-text-primary)',
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="flex items-center gap-2 pt-0.5">
                                                        <input
                                                            type="checkbox"
                                                            id={`syncFinance-${group.key}`}
                                                            checked={state.syncToFinance}
                                                            onChange={(e) => updateEmployeePaymentState(group.key, { syncToFinance: e.target.checked })}
                                                            className="w-4 h-4 rounded border cursor-pointer"
                                                            style={{
                                                                borderColor: 'var(--color-border-default)',
                                                                accentColor: '#2563EB',
                                                            }}
                                                        />
                                                        <label
                                                            htmlFor={`syncFinance-${group.key}`}
                                                            className="text-sm font-medium cursor-pointer select-none"
                                                            style={{ color: 'var(--color-text-primary)' }}
                                                        >
                                                            Save to Finance Expenses
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* 3. Approval Action: Individual Claims List */
                        <div className="space-y-4">
                            {claims && claims.length > 0 ? (
                                <div
                                    className="rounded-xl border overflow-hidden shadow-xs"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-subtle)',
                                    }}
                                >
                                    <div
                                        className="px-4 py-2.5 border-b flex items-center justify-between"
                                        style={{
                                            borderColor: 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                        }}
                                    >
                                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                            Claims to Approve ({count})
                                        </span>
                                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                            Amount
                                        </span>
                                    </div>
                                    <div className="max-h-56 overflow-y-auto divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                                        {claims.map((claim: any, idx: number) => {
                                            const empName =
                                                claim.user?.name ||
                                                (typeof claim.employeeId === 'object' && claim.employeeId?.userId?.name) ||
                                                claim.employee?.name ||
                                                '';
                                            const claimTitle = claim.title || claim.claimId || `Claim #${idx + 1}`;
                                            const categoryLabel = CATEGORY_ICONS[claim.category] || claim.category;
                                            const metaParts = [
                                                claim.claimId && claim.claimId !== claimTitle ? claim.claimId : null,
                                                categoryLabel,
                                            ].filter(Boolean);

                                            return (
                                                <div
                                                    key={claim._id || idx}
                                                    className="px-4 py-2.5 flex items-center justify-between gap-3 transition-colors hover:bg-black/2"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                                                            {empName ? `${empName} · ${claimTitle}` : claimTitle}
                                                        </p>
                                                        {metaParts.length > 0 && (
                                                            <p className="text-xs truncate capitalize mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                                {metaParts.join(' · ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                                            ₹{(claim.amount || 0).toLocaleString('en-IN', {
                                                                minimumFractionDigits: 0,
                                                                maximumFractionDigits: 2,
                                                            })}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            {/* Note / Comment for Approvals */}
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Note / Comment (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Add a comment (optional)..."
                                    value={approvalComment}
                                    onChange={(e) => setApprovalComment(e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border resize-none outline-none transition-colors focus:border-[var(--color-primary)]"
                                    style={{
                                        backgroundColor: 'var(--color-bg-surface)',
                                        borderColor: 'var(--color-border-default)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {errorMsg && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                            <AlertCircle size={14} className="shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    className="flex items-center justify-end gap-3 px-6 py-4 border-t shrink-0"
                    style={{
                        backgroundColor: 'var(--color-bg-subtle)',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-semibold rounded-xl border transition-colors cursor-pointer hover:bg-black/5"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-secondary)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        style={{
                            backgroundColor: isPaidAction ? '#2563EB' : 'var(--color-primary)',
                            boxShadow: isPaidAction ? '0 1px 3px rgba(37, 99, 235, 0.3)' : 'var(--shadow-brand)',
                        }}
                    >
                        {isLoading && <Loader2 size={15} className="animate-spin" />}
                        {isPaidAction
                            ? count === 1 ? `Confirm Payment (${formattedAmount})` : `Confirm Payout (${formattedAmount})`
                            : count === 1 ? 'Approve Claim' : `Approve All (${count})`}
                    </button>
                </div>
            </div>
        </ModalPortal>
    );
}
