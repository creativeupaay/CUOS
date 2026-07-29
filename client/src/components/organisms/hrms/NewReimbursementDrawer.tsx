import { useState, useRef, useCallback } from 'react';
import {
    X, Upload, FileText, AlertTriangle, CheckCircle,
    Loader2, Receipt
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import {
    useCreateReimbursementMutation,
    useUploadReimbursementReceiptMutation,
    useUpdateReimbursementMutation,
    useSubmitReimbursementMutation,
} from '@/features/hrms/hrmsApi';
import { useGetProjectsQuery } from '@/features/project/projectApi';
import type { ReimbursementPolicyFlag, Reimbursement } from '@/features/hrms/types/types';

// ── Constants ─────────────────────────────────────────────────────────

const CATEGORIES = [
    { value: 'travel', label: '✈️ Travel', description: 'Flights, trains, taxis' },
    { value: 'meals', label: '🍽️ Meals', description: 'Food & beverages' },
    { value: 'hotel', label: '🏨 Hotel', description: 'Accommodation' },
    { value: 'fuel', label: '⛽ Fuel', description: 'Vehicle fuel' },
    { value: 'medical', label: '🏥 Medical', description: 'Medical expenses' },
    { value: 'office', label: '🗂️ Office Supplies', description: 'Stationery, supplies' },
    { value: 'software', label: '💻 Software', description: 'Tools & subscriptions' },
    { value: 'other', label: '📦 Other', description: 'Miscellaneous' },
] as const;



function getLocalPolicyFlags(params: { category: string; amount: number; expenseDate: string; hasReceipt: boolean }): ReimbursementPolicyFlag[] {
    const { expenseDate, hasReceipt } = params;
    const flags: ReimbursementPolicyFlag[] = [];

    flags.push({
        rule: 'receipt_required',
        status: hasReceipt ? 'pass' : 'warn',
        message: hasReceipt ? 'Receipt attached' : 'Receipt not attached — required for approval',
    });

    if (expenseDate) {
        const daysSince = Math.floor((Date.now() - new Date(expenseDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince > 30) {
            flags.push({
                rule: 'expense_age',
                status: 'warn',
                message: `Expense is ${daysSince} days old — claims older than 30 days may require justification`,
            });
        } else if (daysSince >= 0) {
            flags.push({ rule: 'expense_age', status: 'pass', message: 'Expense submitted within 30 days' });
        }
    }



    return flags;
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Policy Flag component ─────────────────────────────────────────────

function PolicyFlagItem({ flag }: { flag: ReimbursementPolicyFlag }) {
    const cfg = {
        pass: { icon: CheckCircle, color: '#16A34A', bg: '#DCFCE7' },
        warn: { icon: AlertTriangle, color: '#D97706', bg: '#FEF3C7' },
        fail: { icon: X, color: '#DC2626', bg: '#FEE2E2' },
    }[flag.status];
    const Icon = cfg.icon;

    return (
        <div
            className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
            <Icon size={13} className="shrink-0 mt-0.5" />
            <span>{flag.message}</span>
        </div>
    );
}

// ── Main Drawer ───────────────────────────────────────────────────────

interface Props {
    onClose: () => void;
    onCreated?: () => void;
    initialData?: Reimbursement;
}

export default function NewReimbursementDrawer({ onClose, onCreated, initialData }: Props) {
    const [form, setForm] = useState({
        title: initialData?.title || '',
        category: initialData?.category || '',
        expenseDate: initialData?.expenseDate ? new Date(initialData.expenseDate).toISOString().split('T')[0] : '',
        amount: initialData?.amount?.toString() || '',
        merchant: initialData?.merchant || '',
        businessPurpose: initialData?.businessPurpose || '',
        level: (initialData as any)?.level || 'company',
        projectId: (initialData as any)?.projectId || '',
    });
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(initialData?.receipt?.url || null);
    const [isDragging, setIsDragging] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [createReimbursement, { isLoading: isCreating }] = useCreateReimbursementMutation();
    const [updateReimbursement, { isLoading: isUpdating }] = useUpdateReimbursementMutation();
    const [uploadReceipt, { isLoading: isUploading }] = useUploadReimbursementReceiptMutation();
    const [submitReimbursement, { isLoading: isSubmitting }] = useSubmitReimbursementMutation();

    const isWorking = isCreating || isUpdating || isUploading || isSubmitting;
    
    const { data: projectsData } = useGetProjectsQuery({}, { skip: form.level !== 'project' });
    const projects = projectsData?.data || [];

    // Live policy flags
    const policyFlags = getLocalPolicyFlags({
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        expenseDate: form.expenseDate,
        hasReceipt: !!receiptFile || !!receiptPreview,
    });

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.title.trim()) errs.title = 'Required';
        if (!form.category) errs.category = 'Required';
        if (!form.expenseDate) errs.expenseDate = 'Required';
        if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) errs.amount = 'Enter a valid amount';
        if (form.level === 'project' && !form.projectId) errs.projectId = 'Select a project';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleFile = (file: File) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowed.includes(file.type)) {
            setErrors((e) => ({ ...e, receipt: 'Only JPG, PNG, WEBP, and PDF files allowed' }));
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setErrors((e) => ({ ...e, receipt: 'File must be under 10 MB' }));
            return;
        }
        setReceiptFile(file);
        setErrors((e) => { const n = { ...e }; delete n.receipt; return n; });
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setReceiptPreview(null);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, []);

    const handleSubmitAction = async (submitAfterCreate: boolean) => {
        if (!validate()) return;

        try {
            let reimbId = initialData?._id;

            if (reimbId) {
                // Update
                await updateReimbursement({
                    id: reimbId,
                    data: {
                        title: form.title,
                        category: form.category,
                        expenseDate: form.expenseDate,
                        amount: parseFloat(form.amount),
                        businessPurpose: form.businessPurpose || undefined,
                        merchant: form.merchant || undefined,
                        level: form.level,
                        projectId: form.level === 'project' ? form.projectId : undefined,
                    }
                }).unwrap();
            } else {
                // Step 1: Create draft
                const createResult = await createReimbursement({
                    title: form.title,
                    category: form.category,
                    expenseDate: form.expenseDate,
                    amount: parseFloat(form.amount),
                    businessPurpose: form.businessPurpose || undefined,
                    merchant: form.merchant || undefined,
                    level: form.level as any,
                    projectId: form.level === 'project' ? form.projectId : undefined,
                }).unwrap();

                reimbId = createResult.data.reimbursement._id;
            }

            // Step 2: Upload receipt if attached
            if (receiptFile && reimbId) {
                const fd = new FormData();
                fd.append('receipt', receiptFile);
                await uploadReceipt({ id: reimbId, formData: fd }).unwrap();
            }

            // Step 3: Submit if requested
            if (submitAfterCreate && reimbId) {
                await submitReimbursement(reimbId).unwrap();
            }

            onCreated?.();
            onClose();
        } catch (err: any) {
            console.error('Submission error:', err);
            const msg = err?.data?.message || err?.error || err?.message || JSON.stringify(err) || 'Something went wrong. Please try again.';
            setErrors((e) => ({ ...e, _general: msg }));
        }
    };

    const showPolicyPanel = form.category || form.amount || form.expenseDate;

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-50 flex items-center justify-end"
                style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                onClick={onClose}
            >
                <div
                    className="relative h-full w-full max-w-xl flex flex-col shadow-2xl"
                    style={{ backgroundColor: 'var(--color-bg-surface)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                                <Receipt size={18} style={{ color: 'var(--color-primary)' }} />
                            </div>
                            <div>
                                <h2 className="font-bold text-base" style={{ color: 'var(--color-text-primary)' }}>{initialData ? 'Edit Reimbursement' : 'New Reimbursement'}</h2>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{initialData ? 'Update your expense claim' : 'Submit an expense claim'}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-lg cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                        {errors._general && (
                            <div className="px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                                <AlertTriangle size={14} /> {errors._general}
                            </div>
                        )}

                        {/* Title */}
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Expense Title <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                placeholder="e.g. Client meeting taxi"
                                className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                style={{
                                    borderColor: errors.title ? '#EF4444' : 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                            {errors.title && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.title}</p>}
                        </div>

                        {/* Level and Project */}
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Expense Level <span style={{ color: '#EF4444' }}>*</span>
                                </label>
                                <select
                                    value={form.level}
                                    onChange={(e) => setForm(f => ({ ...f, level: e.target.value, projectId: '' }))}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                    style={{
                                        borderColor: 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                >
                                    <option value="company">Company Level</option>
                                    <option value="project">Project Level</option>
                                </select>
                            </div>
                            
                            {form.level === 'project' && (
                                <div className="flex-1">
                                    <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                        Project <span style={{ color: '#EF4444' }}>*</span>
                                    </label>
                                    <select
                                        value={form.projectId}
                                        onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))}
                                        className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                        style={{
                                            borderColor: errors.projectId ? '#EF4444' : 'var(--color-border-default)',
                                            backgroundColor: 'var(--color-bg-surface)',
                                            color: 'var(--color-text-primary)',
                                        }}
                                    >
                                        <option value="">Select Project...</option>
                                        {projects.map((p: any) => (
                                            <option key={p._id} value={p._id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {errors.projectId && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.projectId}</p>}
                                </div>
                            )}
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Category <span style={{ color: '#EF4444' }}>*</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => setForm((f) => ({ ...f, category: cat.value }))}
                                        className="p-2.5 rounded-xl border text-center cursor-pointer transition-all"
                                        style={{
                                            borderColor: form.category === cat.value ? 'var(--color-primary)' : 'var(--color-border-default)',
                                            backgroundColor: form.category === cat.value ? 'var(--color-primary-soft)' : 'var(--color-bg-surface)',
                                        }}
                                    >
                                        <div className="text-lg mb-0.5">{cat.label.split(' ')[0]}</div>
                                        <div className="text-[10px] font-semibold truncate" style={{ color: form.category === cat.value ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)' }}>
                                            {cat.label.split(' ').slice(1).join(' ')}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {errors.category && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.category}</p>}
                        </div>

                        {/* Date & Amount */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Expense Date <span style={{ color: '#EF4444' }}>*</span>
                                </label>
                                <input
                                    type="date"
                                    value={form.expenseDate}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                    style={{
                                        borderColor: errors.expenseDate ? '#EF4444' : 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                                {errors.expenseDate && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.expenseDate}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                                </label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                    style={{
                                        borderColor: errors.amount ? '#EF4444' : 'var(--color-border-default)',
                                        backgroundColor: 'var(--color-bg-surface)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                                {errors.amount && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.amount}</p>}
                            </div>
                        </div>

                        {/* Merchant */}
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Merchant / Vendor
                            </label>
                            <input
                                type="text"
                                value={form.merchant}
                                onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
                                placeholder="e.g. Uber, Swiggy, Amazon"
                                className="w-full px-3 py-2.5 text-sm rounded-lg border"
                                style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                            />
                        </div>

                        {/* Business Purpose */}
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Business Purpose
                            </label>
                            <textarea
                                value={form.businessPurpose}
                                onChange={(e) => setForm((f) => ({ ...f, businessPurpose: e.target.value }))}
                                rows={2}
                                placeholder="Why was this expense incurred?"
                                className="w-full px-3 py-2.5 text-sm rounded-lg border resize-none"
                                style={{
                                    borderColor: errors.businessPurpose ? '#EF4444' : 'var(--color-border-default)',
                                    backgroundColor: 'var(--color-bg-surface)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                            {errors.businessPurpose && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.businessPurpose}</p>}
                        </div>



                        {/* Receipt Upload */}
                        <div>
                            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                Receipt / Invoice
                            </label>
                            {receiptFile || receiptPreview ? (
                                <div
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                                    style={{ borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-soft)' }}
                                >
                                    {receiptPreview ? (
                                        <img src={receiptPreview} alt="Receipt" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                                            <FileText size={20} style={{ color: 'var(--color-primary)' }} />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{receiptFile?.name || initialData?.receipt?.originalName || 'Receipt'}</p>
                                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{receiptFile ? formatFileSize(receiptFile.size) : (initialData?.receipt ? formatFileSize(initialData.receipt.size) : '')}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                                        className="p-1.5 rounded-lg cursor-pointer"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all"
                                    style={{
                                        borderColor: isDragging ? 'var(--color-primary)' : 'var(--color-border-default)',
                                        backgroundColor: isDragging ? 'var(--color-primary-soft)' : 'var(--color-bg-subtle)',
                                    }}
                                >
                                    <Upload size={20} style={{ color: 'var(--color-text-muted)' }} />
                                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>Click to upload</span> or drag & drop
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>JPG, PNG, WEBP, PDF · Max 10 MB</p>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,.pdf"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                            />
                            {errors.receipt && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{errors.receipt}</p>}
                        </div>



                        {/* Policy Flags */}
                        {showPolicyPanel && policyFlags.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                                    Policy Check
                                </p>
                                {policyFlags.map((f) => (
                                    <PolicyFlagItem key={f.rule} flag={f} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        className="px-6 py-4 border-t flex gap-3 shrink-0"
                        style={{ borderColor: 'var(--color-border-default)' }}
                    >
                        <button
                            type="button"
                            onClick={() => handleSubmitAction(false)}
                            disabled={isWorking}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border cursor-pointer disabled:opacity-50 transition-all"
                            style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-bg-surface)' }}
                        >
                            {isCreating && !isSubmitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Save Draft'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmitAction(true)}
                            disabled={isWorking}
                            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl cursor-pointer disabled:opacity-50 transition-all"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                            {isWorking && isSubmitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : '→ Submit Claim'}
                        </button>
                    </div>
                </div>
            </div>
        </ModalPortal>
    );
}
