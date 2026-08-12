import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Receipt, Building2, FolderKanban, TrendingDown, Plus, X,
    Search, Calendar, Edit2, Trash2, Loader2,
    Wallet, Calculator, ChevronRight, ShieldCheck, Clock3, CheckCircle2, CircleX, ChevronDown, ChevronUp, ArrowRightLeft, Percent,
} from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import {
    useGetExpensesQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
    useGetFixedExpensesQuery,
    useCreateFixedExpenseMutation,
    useUpdateFixedExpenseMutation,
    useDeleteFixedExpenseMutation,
    useGetFixedExpenseApprovalsQuery,
    useGetFixedExpenseTransactionsQuery,
    useApproveFixedExpenseMutation,
    useRejectFixedExpenseMutation,
} from '@/features/finance/api/financeApi';

import ModalPortal from '@/components/ui/ModalPortal';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';
import { logger } from '@/utils/logger';
import { formatCurrency } from '@/features/finance/utils/currency';
import { DateRangeFilter, type DateRange } from '@/components/organisms/finance';
import { getCurrentFiscalYearRange, toDateInputValue } from '@/lib/utils/date';

type ExpenseLevel = 'company' | 'project';
type ExpenseType = 'fixed' | 'variable';
type FixedExpenseFrequency = 'monthly' | 'quarterly' | 'yearly';
type FixedDrawerTab = 'manage' | 'transactions' | 'approval';
type ExpenseSourceAccount = 'hdfc_gst' | 'sbi_non_gst' | 'cash';

interface ExpenseFormData {
    date: string;
    description: string;
    category: string;
    level: ExpenseLevel;
    type: ExpenseType;
    amount: number;
    projectId?: string;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: ExpenseSourceAccount | '';
    notes?: string;
    isRecurring: boolean;
    recurringFrequency?: FixedExpenseFrequency;
    gstClaimable: boolean;
}

interface FixedExpenseFormData {
    title: string;
    description: string;
    category: string;
    level: ExpenseLevel;
    amount: number;
    expenseDate: string;
    frequency: FixedExpenseFrequency;
    projectId?: string;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: ExpenseSourceAccount | '';
    notes?: string;
    isActive: boolean;
}

interface ApprovalDraft {
    amount: number;
    paidDate: string;
    description: string;
    vendor: string;
    paidBy: string;
    sourceAccountKey: ExpenseSourceAccount | '';
    notes: string;
    responseNotes: string;
}

const EXPENSE_SOURCE_OPTIONS: Array<{ value: ExpenseSourceAccount; label: string }> = [
    { value: 'hdfc_gst', label: 'HDFC (GST)' },
    { value: 'sbi_non_gst', label: 'SBI (non GST)' },
    { value: 'cash', label: 'Cash in Company' },
];

const EXPENSE_CATEGORIES = [
    'Salaries',
    'Rent',
    'Utilities & Bills',
    'Cloud Services',
    'Software Licenses',
    'Marketing',
    'HR & Culture',
    'Food & Party',
    'Travel',
    'Office Expense & Supplies',
    'Professional Services',
    'Legal & Compliance',
    'GST Payment',
    'Tax Payment',
    'Reimbursements',
    'Other',
];

// Format Currency imported from @/features/finance/utils/currency
const formatDueLabel = (day: number, frequency: FixedExpenseFrequency) => {
    const suffix =
        day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
    return `${day}${suffix} of every ${frequency === 'monthly' ? 'month' : frequency === 'quarterly' ? 'quarter' : 'year'}`;
};

const TypeBadge = ({ type }: { type: ExpenseType }) => {
    const config = {
        fixed: { label: 'Fixed', color: '#6366F1', bg: '#EEF2FF' },
        variable: { label: 'Variable', color: '#F59E0B', bg: '#FFFBEB' },
    };
    const { label, color, bg } = config[type];
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: bg, color }}>{label}</span>;
};

const LevelBadge = ({ level }: { level: ExpenseLevel }) => {
    const config = {
        company: { label: 'Company', color: '#0EA5E9', bg: '#F0F9FF', icon: Building2 },
        project: { label: 'Project', color: '#10B981', bg: '#ECFDF5', icon: FolderKanban },
    };
    const { label, color, bg, icon: Icon } = config[level];
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ background: bg, color }}>
            <Icon size={12} />
            {label}
        </span>
    );
};

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center mb-4">
            <Receipt className="w-6 h-6" style={{ color: '#9CA3AF' }} />
        </div>
        <p className="text-sm" style={{ color: '#6B7280' }}>No expenses found</p>
        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Add your first expense entry to get started</p>
    </div>
);

const getRoleName = (role: any) => {
    if (!role) return '';
    if (typeof role === 'string') return role.toLowerCase();
    if (typeof role === 'object') return String(role.name || '').toLowerCase();
    return '';
};

export default function FinanceExpensesPage() {
    const currentUser = useAppSelector((state) => state.auth.user);
    const roleName = getRoleName(currentUser?.role);
    const isSuperAdmin = ['super-admin', 'super_admin', 'admin'].includes(roleName);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<ExpenseType | 'all'>('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [activeTab, setActiveTab] = useState<'all' | 'company' | 'project'>('all');
    
    // Default to current fiscal year
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const fy = getCurrentFiscalYearRange();
        return {
            startDate: toDateInputValue(fy.startDate),
            endDate: toDateInputValue(fy.endDate)
        };
    });

    const [showFixedDrawer, setShowFixedDrawer] = useState(false);
    const [renderFixedDrawer, setRenderFixedDrawer] = useState(false);
    const [isFixedDrawerVisible, setIsFixedDrawerVisible] = useState(false);
    const [fixedDrawerTab, setFixedDrawerTab] = useState<FixedDrawerTab>('manage');
    const [fixedEditingId, setFixedEditingId] = useState<string | null>(null);
    const [showFixedExpenseForm, setShowFixedExpenseForm] = useState(false);
    const [approvalDrafts, setApprovalDrafts] = useState<Record<string, ApprovalDraft>>({});
    const [expandedApprovalId, setExpandedApprovalId] = useState<string | null>(null);
    const fixedExpenseFormRef = useRef<HTMLDivElement | null>(null);

    useBodyScrollLock(showAddModal || showFixedDrawer);

    const initialFormData: ExpenseFormData = {
        date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'Salaries',
        level: 'company',
        type: 'fixed',
        amount: 0,
        projectId: '',
        projectName: '',
        vendor: '',
        paidBy: '',
        sourceAccountKey: '',
        notes: '',
        isRecurring: false,
        recurringFrequency: 'monthly',
        gstClaimable: false,
    };

    const initialFixedFormData: FixedExpenseFormData = {
        title: '',
        description: '',
        category: 'Rent',
        level: 'company',
        amount: 0,
        expenseDate: new Date().toISOString().split('T')[0],
        frequency: 'monthly',
        projectId: '',
        projectName: '',
        vendor: '',
        paidBy: '',
        sourceAccountKey: '',
        notes: '',
        isActive: true,
    };

    const [formData, setFormData] = useState<ExpenseFormData>(initialFormData);
    const [fixedFormData, setFixedFormData] = useState<FixedExpenseFormData>(initialFixedFormData);

    const { data: expensesData, isLoading } = useGetExpensesQuery({
        level: activeTab !== 'all' ? activeTab : undefined,
        type: filterType !== 'all' ? filterType : undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined,
        search: searchQuery || undefined,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
    });
    const { data: fixedExpensesData, isLoading: isLoadingFixedExpenses } = useGetFixedExpensesQuery();
    const { data: approvalsData, isLoading: isLoadingApprovals } = useGetFixedExpenseApprovalsQuery();
    const { data: fixedTransactionsData, isLoading: isLoadingFixedTransactions } = useGetFixedExpenseTransactionsQuery();

    // Query synced salary expenses directly (single source of truth from Expense collection)
    const { data: salaryExpensesData } = useGetExpensesQuery({ category: 'Salaries', limit: 9999 });
    const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
    const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
    const [deleteExpense] = useDeleteExpenseMutation();
    const [createFixedExpense, { isLoading: isCreatingFixedExpense }] = useCreateFixedExpenseMutation();
    const [updateFixedExpense, { isLoading: isUpdatingFixedExpense }] = useUpdateFixedExpenseMutation();
    const [deleteFixedExpense] = useDeleteFixedExpenseMutation();
    const [approveFixedExpense, { isLoading: isApprovingFixedExpense }] = useApproveFixedExpenseMutation();
    const [rejectFixedExpense, { isLoading: isRejectingFixedExpense }] = useRejectFixedExpenseMutation();

    const expenses = expensesData?.data?.expenses || [];
    const fixedExpenses = fixedExpensesData?.data || [];
    const approvalItems = useMemo(() => {
        const raw = approvalsData?.data?.approvals || [];
        return raw.filter((item: any) => item.status !== 'approved');
    }, [approvalsData]);
    const fixedTransactions = fixedTransactionsData?.data || [];
    const pendingApprovalCount = approvalsData?.data?.pendingCount || 0;

    const totalSalaries = useMemo(() => {
        // Use actual synced Expense records as source of truth, not HRMS Salary definitions
        const salaryExpenses = salaryExpensesData?.data?.expenses || [];
        return salaryExpenses
            .filter((e) => !e.isAllocated)
            .reduce((sum, e) => sum + (e.amount || 0), 0);
    }, [salaryExpensesData]);

    useEffect(() => {
        if (!approvalItems.length) return;
        setApprovalDrafts((prev) => {
            const next = { ...prev };
            for (const approval of approvalItems) {
                if (!next[approval._id]) {
                    next[approval._id] = {
                        amount: approval.amount || 0,
                        paidDate: approval.paidDate?.split('T')[0] || approval.dueDate.split('T')[0],
                        description: approval.description || '',
                        vendor: approval.vendor || '',
                        paidBy: approval.paidBy || '',
                        sourceAccountKey: approval.sourceAccountKey || '',
                        notes: approval.notes || '',
                        responseNotes: approval.responseNotes || '',
                    };
                }
            }
            return next;
        });
    }, [approvalItems]);

    const metrics = useMemo(() => {
        const nonAllocated = expenses.filter((e: any) => !e.isAllocated);
        const totalExpenses = nonAllocated.reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
        const projectExpenses = nonAllocated.filter((e: any) => e.level === 'project').reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
        const rawFixedCosts = nonAllocated.filter((e: any) => e.type === 'fixed').reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
        const variableCosts = nonAllocated.filter((e: any) => e.type === 'variable').reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
        const gstPaid = nonAllocated.filter((e: any) => (e.category || '').toLowerCase() === 'gst payment').reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
        const fixedCosts = rawFixedCosts - gstPaid;

        return {
            totalExpenses,
            projectExpenses,
            fixedCosts,
            variableCosts,
            gstPaid,
        };
    }, [expenses]);

    const metricCards = [
        { label: 'Total Expenses', value: formatCurrency(metrics.totalExpenses), fullValue: formatCurrency(metrics.totalExpenses), icon: TrendingDown, color: '#EF4444', bg: '#FEF2F2' },
        { label: 'Project Level', value: formatCurrency(metrics.projectExpenses), fullValue: formatCurrency(metrics.projectExpenses), icon: FolderKanban, color: '#10B981', bg: '#ECFDF5' },
        { label: 'Fixed Costs', value: formatCurrency(metrics.fixedCosts), fullValue: formatCurrency(metrics.fixedCosts), icon: Wallet, color: '#6366F1', bg: '#EEF2FF' },
        { label: 'Variable Costs', value: formatCurrency(metrics.variableCosts), fullValue: formatCurrency(metrics.variableCosts), icon: Calculator, color: '#F59E0B', bg: '#FFFBEB' },
        { label: 'GST Paid', value: formatCurrency(metrics.gstPaid), fullValue: formatCurrency(metrics.gstPaid), icon: Percent, color: '#8B5CF6', bg: '#F3E8FF' },
    ];

    const handleSubmit = async () => {
        try {
            const payload = {
                ...formData,
                sourceAccountKey: formData.sourceAccountKey || undefined,
            };

            if (editingId) {
                await updateExpense({ id: editingId, ...payload }).unwrap();
            } else {
                await createExpense(payload).unwrap();
            }
            setShowAddModal(false);
            setEditingId(null);
            setFormData(initialFormData);
        } catch (error) {
            logger.error('Failed to save expense:', error);
        }
    };

    const handleEdit = (entry: any) => {
        setFormData({
            ...initialFormData,
            ...entry,
            date: entry.date?.split('T')[0] || new Date().toISOString().split('T')[0],
        });
        setEditingId(entry._id);
        setShowAddModal(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await deleteExpense(id).unwrap();
            } catch (error) {
                logger.error('Failed to delete expense:', error);
            }
        }
    };

    const openAddModal = () => {
        setFormData(initialFormData);
        setEditingId(null);
        setShowAddModal(true);
    };

    const openFixedDrawer = (tab: FixedDrawerTab = 'manage') => {
        setFixedDrawerTab(tab);
        setRenderFixedDrawer(true);
        setShowFixedDrawer(true);
    };

    useEffect(() => {
        if (showFixedDrawer) {
            const id = window.setTimeout(() => setIsFixedDrawerVisible(true), 10);
            return () => window.clearTimeout(id);
        }

        setIsFixedDrawerVisible(false);

        if (!renderFixedDrawer) {
            return;
        }

        const id = window.setTimeout(() => setRenderFixedDrawer(false), 280);
        return () => window.clearTimeout(id);
    }, [showFixedDrawer, renderFixedDrawer]);

    const closeFixedDrawer = () => {
        setShowFixedDrawer(false);
    };

    const resetFixedForm = () => {
        setFixedFormData(initialFixedFormData);
        setFixedEditingId(null);
    };

    const openFixedExpenseForm = (mode: 'new' | 'edit' = 'new') => {
        if (mode === 'new') {
            resetFixedForm();
        }

        setShowFixedExpenseForm(true);

        window.setTimeout(() => {
            fixedExpenseFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    };

    const handleEditFixedExpense = (fixedExpense: any) => {
        setFixedEditingId(fixedExpense._id);
        setFixedFormData({
            title: fixedExpense.title || '',
            description: fixedExpense.description || '',
            category: fixedExpense.category || 'Rent',
            level: fixedExpense.level || 'company',
            amount: fixedExpense.amount || 0,
            expenseDate: (fixedExpense.expenseDate || fixedExpense.startDate || new Date().toISOString()).split('T')[0],
            frequency: fixedExpense.frequency || 'monthly',
            projectId: fixedExpense.projectId || '',
            projectName: fixedExpense.projectName || '',
            vendor: fixedExpense.vendor || '',
            paidBy: fixedExpense.paidBy || '',
            sourceAccountKey: fixedExpense.sourceAccountKey || '',
            notes: fixedExpense.notes || '',
            isActive: fixedExpense.isActive !== false,
        });
        setFixedDrawerTab('manage');
        setRenderFixedDrawer(true);
        setShowFixedDrawer(true);
        setShowFixedExpenseForm(true);
        window.setTimeout(() => {
            fixedExpenseFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    };

    const handleSaveFixedExpense = async () => {
        try {
            const payload = {
                ...fixedFormData,
                amount: Number(fixedFormData.amount) || 0,
                sourceAccountKey: fixedFormData.sourceAccountKey || undefined,
            };

            if (fixedEditingId) {
                await updateFixedExpense({ id: fixedEditingId, ...payload }).unwrap();
            } else {
                await createFixedExpense(payload).unwrap();
            }

            resetFixedForm();
            setShowFixedExpenseForm(false);
        } catch (error) {
            logger.error('Failed to save fixed expense:', error);
        }
    };

    const handleDeleteFixedExpense = async (id: string) => {
        if (!window.confirm('Delete this fixed expense schedule? Pending approvals for it will also be removed.')) {
            return;
        }

        try {
            await deleteFixedExpense(id).unwrap();
            if (fixedEditingId === id) resetFixedForm();
        } catch (error) {
            logger.error('Failed to delete fixed expense:', error);
        }
    };

    const handleToggleFixedExpense = async (fixedExpense: any) => {
        try {
            await updateFixedExpense({
                id: fixedExpense._id,
                isActive: !fixedExpense.isActive,
            }).unwrap();
        } catch (error) {
            logger.error('Failed to toggle fixed expense:', error);
        }
    };

    const updateApprovalDraft = (id: string, patch: Partial<ApprovalDraft>) => {
        setApprovalDrafts((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                ...patch,
            },
        }));
    };

    const handleApprovalAction = async (approvalId: string, action: 'approve' | 'reject') => {
        const draft = approvalDrafts[approvalId];
        if (!draft) return;

        const payload = {
            id: approvalId,
            amount: Number(draft.amount) || 0,
            paidDate: draft.paidDate,
            description: draft.description,
            vendor: draft.vendor,
            paidBy: draft.paidBy,
            sourceAccountKey: draft.sourceAccountKey || undefined,
            notes: draft.notes,
            responseNotes: draft.responseNotes,
        };

        try {
            if (action === 'approve') {
                await approveFixedExpense(payload).unwrap();
            } else {
                await rejectFixedExpense(payload).unwrap();
            }
        } catch (error) {
            logger.error(`Failed to ${action} fixed expense:`, error);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Track company and project level expenses</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

            <div className="rounded-xl border p-4 shadow-sm" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                <div className="-mx-4 -mt-4 mb-4 border-b border-gray-100 rounded-t-xl overflow-hidden">
                    <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
                </div>
                
                <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: '#F3F4F6', width: 'fit-content' }}>
                    {(['all', 'company', 'project'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                            style={{
                                backgroundColor: activeTab === tab ? 'white' : 'transparent',
                                color: activeTab === tab ? '#111827' : '#6B7280',
                                boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                            }}
                        >
                            {tab === 'all' && <Receipt size={16} />}
                            {tab === 'company' && <Building2 size={16} />}
                            {tab === 'project' && <FolderKanban size={16} />}
                            {tab === 'all' ? 'All Expenses' : tab === 'company' ? 'Company Level' : 'Project Level'}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                        />
                    </div>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as ExpenseType | 'all')}
                        className="px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                    >
                        <option value="all">All Types</option>
                        <option value="fixed">Fixed</option>
                        <option value="variable">Variable</option>
                    </select>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                    >
                        <option value="all">All Categories</option>
                        {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
            </div>

            {activeTab === 'company' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => openFixedDrawer('manage')}
                        className="rounded-xl border p-4 text-left transition-all hover:shadow-md"
                        style={{ backgroundColor: 'white', borderColor: '#C7D2FE' }}
                    >
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
                                    <Wallet size={16} style={{ color: '#6366F1' }} />
                                </div>
                                <div>
                                    <h3 className="font-semibold" style={{ color: '#111827' }}>Recurring Expenses</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Manage recurring company costs</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {pendingApprovalCount > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                        <Clock3 size={12} />
                                        {pendingApprovalCount} pending
                                    </span>
                                )}
                                <ChevronRight size={16} style={{ color: '#6366F1' }} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold mb-2" style={{ color: '#6366F1' }}>{formatCurrency(metrics.fixedCosts)}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>
                            Clicking here opens a right-side panel to manage recurring expenses and approve due payments.
                        </p>
                        {isSuperAdmin && pendingApprovalCount > 0 && (
                            <p className="text-xs mt-3" style={{ color: '#92400E' }}>
                                Super admin visibility is active for pending approval requests.
                            </p>
                        )}
                    </button>

                    <div className="rounded-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
                                <Calculator size={16} style={{ color: '#F59E0B' }} />
                            </div>
                            <h3 className="font-semibold" style={{ color: '#111827' }}>Variable Expenses</h3>
                        </div>
                        <p className="text-2xl font-bold mb-2" style={{ color: '#F59E0B' }}>{formatCurrency(metrics.variableCosts)}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>Fluctuating costs like cloud services, marketing, events</p>
                    </div>
                </div>
            )}

            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                ) : expenses.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Date</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Description</th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Category</th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Level</th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Type</th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Amount</th>
                                    <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((expense: any, index: number) => (
                                    <tr
                                        key={expense._id}
                                        className="transition-colors hover:bg-gray-50"
                                        style={{ borderTop: index > 0 ? '1px solid #E5E7EB' : undefined }}
                                    >
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} style={{ color: '#9CA3AF' }} />
                                                <span className="text-sm" style={{ color: '#6B7280' }}>
                                                    {new Date(expense.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div>
                                                <p className="text-sm font-medium flex items-center gap-2" style={{ color: '#111827' }}>
                                                    {expense.description}
                                                </p>
                                                {expense.projectName && (
                                                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                                                        <FolderKanban size={11} />
                                                        {expense.projectName}
                                                    </p>
                                                )}
                                                {expense.vendor && <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Vendor: {expense.vendor}</p>}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-sm" style={{ color: '#6B7280' }}>{expense.category}</span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <LevelBadge level={expense.level} />
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <TypeBadge type={expense.type} />
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right font-semibold" style={{ color: '#EF4444' }}>
                                            {formatCurrency(expense.amount)}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleEdit(expense)}
                                                    className="p-1.5 rounded-md transition-colors hover:bg-gray-100"
                                                    style={{ color: '#9CA3AF' }}
                                                    title="Edit"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(expense._id)}
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

            {showAddModal && (
                <ModalPortal>
                    <div className="w-full max-w-lg rounded-xl shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'white' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10" style={{ borderColor: '#E5E7EB', backgroundColor: 'white' }}>
                            <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
                                {editingId ? 'Edit Expense' : 'Add Expense'}
                            </h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-md hover:bg-gray-100" style={{ color: '#6B7280' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
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
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Expense Level *</label>
                                    <select
                                        value={formData.level}
                                        onChange={(e) => setFormData({ ...formData, level: e.target.value as ExpenseLevel })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    >
                                        <option value="company">Company Level</option>
                                        <option value="project">Project Level</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Expense Type *</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as ExpenseType })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    >
                                        <option value="fixed">Fixed</option>
                                        <option value="variable">Variable</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Category *</label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                >
                                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Amount (INR) *</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={formData.amount || ''}
                                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                />
                            </div>

                            {formData.level === 'project' && (
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Project Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter project name"
                                        value={formData.projectName}
                                        onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Vendor (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="Enter vendor name"
                                    value={formData.vendor}
                                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                />
                                {formData.vendor && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.gstClaimable}
                                            onChange={(e) => setFormData({ ...formData, gstClaimable: e.target.checked })}
                                            className="rounded border-gray-300"
                                        />
                                        <label className="text-sm text-gray-700">Vendor bill has claimable GST (18%)</label>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Source of Expense</label>
                                <select
                                    value={formData.sourceAccountKey}
                                    onChange={(e) => setFormData({ ...formData, sourceAccountKey: e.target.value as ExpenseSourceAccount | '' })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm"
                                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                >
                                    <option value="">Select source</option>
                                    {EXPENSE_SOURCE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#374151' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isRecurring}
                                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                                        className="rounded"
                                    />
                                    This is a recurring expense
                                </label>
                                {formData.isRecurring && (
                                    <select
                                        value={formData.recurringFrequency}
                                        onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as FixedExpenseFrequency })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm mt-2"
                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                    >
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Notes (Optional)</label>
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
                                disabled={isCreating || isUpdating || !formData.description || !formData.amount}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                                style={{ background: 'var(--color-primary)', color: 'white' }}
                            >
                                {(isCreating || isUpdating) && <Loader2 size={16} className="animate-spin" />}
                                {editingId ? 'Update Expense' : 'Add Expense'}
                            </button>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {renderFixedDrawer && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isFixedDrawerVisible ? 'opacity-100' : 'opacity-0'}`}
                        style={{ backgroundColor: 'rgba(15, 23, 42, 0.16)' }}
                        onClick={closeFixedDrawer}
                    />
                    <div
                        className={`fixed top-0 right-0 h-full z-[61] w-full max-w-[720px] border-l shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isFixedDrawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
                        style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}
                    >
                        <div className="px-5 py-4 border-b" style={{ borderColor: '#E5E7EB' }}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#6366F1' }}>Recurring Expenses</p>
                                    <h2 className="text-lg font-semibold mt-1" style={{ color: '#111827' }}>Manage recurring expenses and approvals</h2>
                                </div>
                                <button onClick={closeFixedDrawer} className="p-2 rounded-lg hover:bg-gray-100" style={{ color: '#6B7280' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="mt-4 flex items-center gap-2 rounded-xl p-1" style={{ backgroundColor: '#F3F4F6', width: 'fit-content' }}>
                                {([
                                    { key: 'manage', label: 'Manage', count: fixedExpenses.length },
                                    { key: 'transactions', label: 'Transactions', count: fixedTransactions.length },
                                    { key: 'approval', label: 'Approval', count: pendingApprovalCount },
                                ] as const).map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setFixedDrawerTab(tab.key)}
                                        className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                                        style={{
                                            backgroundColor: fixedDrawerTab === tab.key ? 'white' : 'transparent',
                                            color: fixedDrawerTab === tab.key ? '#111827' : '#6B7280',
                                            boxShadow: fixedDrawerTab === tab.key ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                        }}
                                    >
                                        {tab.label}
                                        <span
                                            className="inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1.5 text-[11px] font-semibold"
                                            style={{
                                                backgroundColor: tab.key === 'approval' && tab.count > 0 ? '#FEF3C7' : '#E5E7EB',
                                                color: tab.key === 'approval' && tab.count > 0 ? '#92400E' : '#4B5563',
                                            }}
                                        >
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {fixedDrawerTab === 'manage' ? (
                                <>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-base font-semibold" style={{ color: '#111827' }}>Existing recurring expenses</h3>
                                                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                                                    These schedules create approval requests on their due date.
                                                </p>
                                            </div>
                                        </div>

                                        {isLoadingFixedExpenses ? (
                                            <div className="rounded-2xl border p-8 flex items-center justify-center" style={{ borderColor: '#E5E7EB' }}>
                                                <Loader2 size={20} className="animate-spin" style={{ color: '#4F46E5' }} />
                                            </div>
                                        ) : (
                                            <>
                                                {/* Salaries Virtual Row */}
                                                <div className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-sm font-semibold" style={{ color: '#111827' }}>Salaries</h4>
                                                                <span
                                                                    className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold"
                                                                    style={{
                                                                        backgroundColor: '#DCFCE7',
                                                                        color: '#166534',
                                                                    }}
                                                                >
                                                                    Active
                                                                </span>
                                                                <LevelBadge level="company" />
                                                            </div>
                                                            <p className="text-sm mt-1" style={{ color: '#4B5563' }}>Aggregated total gross salaries of all employees</p>
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2" style={{ color: '#6B7280' }}>
                                                                <span>{formatCurrency(totalSalaries)}</span>
                                                                <span>Monthly recurring</span>
                                                                <span>Salaries</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-3 py-2 text-sm font-medium italic text-gray-500 rounded-lg bg-gray-50">
                                                                Managed in Salaries page
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {fixedExpenses.map((fixedExpense: any) => (
                                                    <div key={fixedExpense._id} className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="text-sm font-semibold" style={{ color: '#111827' }}>{fixedExpense.title}</h4>
                                                                    <span
                                                                        className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold"
                                                                        style={{
                                                                            backgroundColor: fixedExpense.isActive ? '#DCFCE7' : '#F3F4F6',
                                                                            color: fixedExpense.isActive ? '#166534' : '#6B7280',
                                                                        }}
                                                                    >
                                                                        {fixedExpense.isActive ? 'Active' : 'Cancelled'}
                                                                    </span>
                                                                    <LevelBadge level={fixedExpense.level} />
                                                                </div>
                                                                <p className="text-sm mt-1" style={{ color: '#4B5563' }}>{fixedExpense.description}</p>
                                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2" style={{ color: '#6B7280' }}>
                                                                    <span>{formatCurrency(fixedExpense.amount)}</span>
                                                                    <span>
                                                                        Starts on {new Date(fixedExpense.expenseDate || fixedExpense.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </span>
                                                                    <span>{formatDueLabel(fixedExpense.dueDay, fixedExpense.frequency)}</span>
                                                                    <span>{fixedExpense.category}</span>
                                                                    {fixedExpense.vendor && <span>Vendor: {fixedExpense.vendor}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleToggleFixedExpense(fixedExpense)}
                                                                    className="px-3 py-2 rounded-lg text-sm font-medium"
                                                                    style={{
                                                                        backgroundColor: fixedExpense.isActive ? '#FFFBEB' : '#DCFCE7',
                                                                        color: fixedExpense.isActive ? '#92400E' : '#166534',
                                                                    }}
                                                                >
                                                                    {fixedExpense.isActive ? 'Cancel' : 'Resume'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleEditFixedExpense(fixedExpense)}
                                                                    className="px-3 py-2 rounded-lg text-sm font-medium"
                                                                    style={{ backgroundColor: '#EEF2FF', color: '#4338CA' }}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteFixedExpense(fixedExpense._id)}
                                                                    className="px-3 py-2 rounded-lg text-sm font-medium"
                                                                    style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    {showFixedExpenseForm && (
                                        <div
                                            ref={fixedExpenseFormRef}
                                            className="rounded-2xl border p-5"
                                            style={{ borderColor: '#E5E7EB', background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <div>
                                                    <h3 className="text-base font-semibold" style={{ color: '#111827' }}>
                                                        {fixedEditingId ? 'Edit recurring expense' : 'Add recurring expense'}
                                                    </h3>
                                                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                                                        Set the recurring schedule once. On each due date, the payment moves to approval instead of auto-recording.
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {fixedEditingId && (
                                                        <button
                                                            onClick={resetFixedForm}
                                                            className="px-3 py-2 rounded-lg text-sm font-medium"
                                                            style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                                                        >
                                                            Reset form
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setShowFixedExpenseForm(false)}
                                                        className="px-3 py-2 rounded-lg text-sm font-medium"
                                                        style={{ border: '1px solid #E5E7EB', color: '#6B7280' }}
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Title *</label>
                                                    <input
                                                        type="text"
                                                        value={fixedFormData.title}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, title: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                        placeholder="e.g. Office Rent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Amount (INR) *</label>
                                                    <input
                                                        type="number"
                                                        value={fixedFormData.amount || ''}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, amount: parseFloat(e.target.value) || 0 })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Description *</label>
                                                    <input
                                                        type="text"
                                                        value={fixedFormData.description}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, description: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                        placeholder="What should be recorded when this gets approved?"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Category *</label>
                                                    <select
                                                        value={fixedFormData.category}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, category: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    >
                                                        {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Level *</label>
                                                    <select
                                                        value={fixedFormData.level}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, level: e.target.value as ExpenseLevel })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    >
                                                        <option value="company">Company Level</option>
                                                        <option value="project">Project Level</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Frequency *</label>
                                                    <select
                                                        value={fixedFormData.frequency}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, frequency: e.target.value as FixedExpenseFrequency })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    >
                                                        <option value="monthly">Monthly</option>
                                                        <option value="quarterly">Quarterly</option>
                                                        <option value="yearly">Yearly</option>
                                                    </select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Date of Expense *</label>
                                                    <input
                                                        type="date"
                                                        value={fixedFormData.expenseDate}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, expenseDate: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    />
                                                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                                                        On this date the expense becomes due, an approval request is created, and superadmins can see the pending notification. For recurring entries, the same date pattern repeats based on frequency.
                                                    </p>
                                                </div>
                                                {fixedFormData.level === 'project' && (
                                                    <div className="md:col-span-2">
                                                        <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Project Name</label>
                                                        <input
                                                            type="text"
                                                            value={fixedFormData.projectName}
                                                            onChange={(e) => setFixedFormData({ ...fixedFormData, projectName: e.target.value })}
                                                            className="w-full px-3 py-2 rounded-lg border text-sm"
                                                            style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                        />
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Vendor</label>
                                                    <input
                                                        type="text"
                                                        value={fixedFormData.vendor}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, vendor: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Paid By</label>
                                                    <input
                                                        type="text"
                                                        value={fixedFormData.paidBy}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, paidBy: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Source of Expense</label>
                                                    <select
                                                        value={fixedFormData.sourceAccountKey}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, sourceAccountKey: e.target.value as ExpenseSourceAccount | '' })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    >
                                                        <option value="">Select source</option>
                                                        {EXPENSE_SOURCE_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Notes</label>
                                                    <textarea
                                                        rows={3}
                                                        value={fixedFormData.notes}
                                                        onChange={(e) => setFixedFormData({ ...fixedFormData, notes: e.target.value })}
                                                        className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                                                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="flex items-center gap-2 text-sm font-medium" style={{ color: '#374151' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={fixedFormData.isActive}
                                                            onChange={(e) => setFixedFormData({ ...fixedFormData, isActive: e.target.checked })}
                                                            className="rounded"
                                                        />
                                                        Keep this recurring expense active
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-end gap-3 mt-5">
                                                <button
                                                    onClick={resetFixedForm}
                                                    className="px-4 py-2 rounded-lg text-sm font-medium"
                                                    style={{ border: '1px solid #E5E7EB', color: '#6B7280' }}
                                                >
                                                    Reset
                                                </button>
                                                <button
                                                    onClick={handleSaveFixedExpense}
                                                    disabled={isCreatingFixedExpense || isUpdatingFixedExpense || !fixedFormData.title || !fixedFormData.description || !fixedFormData.amount}
                                                    className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2"
                                                    style={{ background: '#4F46E5' }}
                                                >
                                                    {(isCreatingFixedExpense || isUpdatingFixedExpense) && <Loader2 size={16} className="animate-spin" />}
                                                    {fixedEditingId ? 'Update recurring expense' : 'Save recurring expense'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : fixedDrawerTab === 'transactions' ? (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', background: 'linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 100%)' }}>
                                        <div className="flex items-center gap-2">
                                            <ArrowRightLeft size={18} style={{ color: '#4338CA' }} />
                                            <h3 className="text-base font-semibold" style={{ color: '#111827' }}>Recurring expense transactions</h3>
                                        </div>
                                        <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                                            This shows only recorded transactions created from approved recurring expenses.
                                        </p>
                                    </div>

                                    {isLoadingFixedTransactions ? (
                                        <div className="rounded-2xl border p-8 flex items-center justify-center" style={{ borderColor: '#E5E7EB' }}>
                                            <Loader2 size={20} className="animate-spin" style={{ color: '#4F46E5' }} />
                                        </div>
                                    ) : fixedTransactions.length === 0 ? (
                                        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: '#E5E7EB' }}>
                                            <ArrowRightLeft size={28} className="mx-auto mb-3" style={{ color: '#A5B4FC' }} />
                                            <p className="text-sm font-medium" style={{ color: '#374151' }}>No recurring expense transactions yet</p>
                                            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Approved recurring expenses will appear here automatically.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {fixedTransactions.map((transaction: any) => (
                                                <div key={transaction._id} className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-sm font-semibold" style={{ color: '#111827' }}>{transaction.description}</h4>
                                                                <LevelBadge level={transaction.level} />
                                                                <TypeBadge type={transaction.type} />
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2" style={{ color: '#6B7280' }}>
                                                                <span>{new Date(transaction.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                <span>{transaction.category}</span>
                                                                {transaction.sourceAccountKey && (
                                                                    <span>
                                                                        {EXPENSE_SOURCE_OPTIONS.find((option) => option.value === transaction.sourceAccountKey)?.label || transaction.sourceAccountKey}
                                                                    </span>
                                                                )}
                                                                {transaction.vendor && <span>Vendor: {transaction.vendor}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-semibold" style={{ color: '#111827' }}>{formatCurrency(transaction.amount)}</div>
                                                            <div className="text-xs mt-1" style={{ color: '#6B7280' }}>
                                                                Synced to Cash in Bank
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', background: 'linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)' }}>
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={18} style={{ color: '#B45309' }} />
                                            <h3 className="text-base font-semibold" style={{ color: '#111827' }}>Approval queue</h3>
                                        </div>
                                        <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                                            Due recurring expenses appear here on their scheduled date. Approving creates the expense entry, and rejecting keeps a clear decision trail.
                                        </p>
                                    </div>

                                    {isLoadingApprovals ? (
                                        <div className="rounded-2xl border p-8 flex items-center justify-center" style={{ borderColor: '#E5E7EB' }}>
                                            <Loader2 size={20} className="animate-spin" style={{ color: '#4F46E5' }} />
                                        </div>
                                    ) : approvalItems.length === 0 ? (
                                        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: '#E5E7EB' }}>
                                            <ShieldCheck size={28} className="mx-auto mb-3" style={{ color: '#A5B4FC' }} />
                                            <p className="text-sm font-medium" style={{ color: '#374151' }}>No approval requests yet</p>
                                            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Once a recurring expense reaches its due date, the request will show up here.</p>
                                        </div>
                                    ) : (
                                        approvalItems.map((approval: any) => {
                                            const draft = approvalDrafts[approval._id];
                                            const isExpanded = expandedApprovalId === approval._id;
                                            const statusConfig = approval.status === 'approved'
                                                ? { icon: CheckCircle2, bg: '#DCFCE7', color: '#166534', label: 'Approved' }
                                                : approval.status === 'rejected'
                                                    ? { icon: CircleX, bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' }
                                                    : { icon: Clock3, bg: '#FEF3C7', color: '#92400E', label: 'Pending Approval' };
                                            const StatusIcon = statusConfig.icon;

                                            return (
                                                <div key={approval._id} className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-sm font-semibold" style={{ color: '#111827' }}>{approval.title}</h4>
                                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}>
                                                                    <StatusIcon size={12} />
                                                                    {statusConfig.label}
                                                                </span>
                                                                <LevelBadge level={approval.level} />
                                                            </div>
                                                            <p className="text-sm mt-1" style={{ color: '#4B5563' }}>{approval.description}</p>
                                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2" style={{ color: '#6B7280' }}>
                                                                <span>Due: {new Date(approval.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                <span>{approval.category}</span>
                                                                <span>{approval.frequency}</span>
                                                                <span>{formatCurrency(approval.amount)}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setExpandedApprovalId((current) => current === approval._id ? null : approval._id)}
                                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                                                            style={{ backgroundColor: '#F8FAFC', color: '#374151' }}
                                                        >
                                                            {approval.status === 'pending' ? 'Review' : 'View'}
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    </div>

                                                    {isExpanded && draft && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t" style={{ borderColor: '#E5E7EB' }}>
                                                            <div>
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Paid Date</label>
                                                                <input
                                                                    type="date"
                                                                    value={draft.paidDate}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { paidDate: e.target.value })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Amount</label>
                                                                <input
                                                                    type="number"
                                                                    value={draft.amount || ''}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { amount: parseFloat(e.target.value) || 0 })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                />
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Description</label>
                                                                <input
                                                                    type="text"
                                                                    value={draft.description}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { description: e.target.value })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Vendor</label>
                                                                <input
                                                                    type="text"
                                                                    value={draft.vendor}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { vendor: e.target.value })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Paid By</label>
                                                                <input
                                                                    type="text"
                                                                    value={draft.paidBy}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { paidBy: e.target.value })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Source</label>
                                                                <select
                                                                    value={draft.sourceAccountKey}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { sourceAccountKey: e.target.value as ExpenseSourceAccount | '' })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                >
                                                                    <option value="">Select source</option>
                                                                    {EXPENSE_SOURCE_OPTIONS.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>Expense Notes</label>
                                                                <textarea
                                                                    rows={2}
                                                                    value={draft.notes}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { notes: e.target.value })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                />
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#374151' }}>
                                                                    {approval.status === 'pending' ? 'Approval / Rejection Notes' : 'Decision Notes'}
                                                                </label>
                                                                <textarea
                                                                    rows={2}
                                                                    value={draft.responseNotes}
                                                                    onChange={(e) => updateApprovalDraft(approval._id, { responseNotes: e.target.value })}
                                                                    disabled={approval.status !== 'pending'}
                                                                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none disabled:bg-gray-50"
                                                                    style={{ borderColor: '#E5E7EB', color: '#374151' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isExpanded && approval.status !== 'pending' ? (
                                                        <div className="mt-4 text-xs" style={{ color: '#6B7280' }}>
                                                            {approval.actedAt
                                                                ? `Decision recorded on ${new Date(approval.actedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`
                                                                : 'Decision recorded.'}
                                                        </div>
                                                    ) : isExpanded ? (
                                                        <div className="flex flex-wrap items-center justify-end gap-3 mt-4">
                                                            <button
                                                                onClick={() => handleApprovalAction(approval._id, 'reject')}
                                                                disabled={isRejectingFixedExpense || isApprovingFixedExpense}
                                                                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                                                                style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}
                                                            >
                                                                Reject
                                                            </button>
                                                            <button
                                                                onClick={() => handleApprovalAction(approval._id, 'approve')}
                                                                disabled={isApprovingFixedExpense || isRejectingFixedExpense}
                                                                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                                                                style={{ backgroundColor: '#16A34A' }}
                                                            >
                                                                Approve and record expense
                                                            </button>
                                                        </div>
                                                    ) : approval.status === 'pending' ? (
                                                        <div className="mt-3 text-xs" style={{ color: '#6B7280' }}>
                                                            Paid date can be edited when you expand this request.
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                        {fixedDrawerTab === 'manage' && (
                            <div className="px-5 py-4 border-t" style={{ borderColor: '#E5E7EB', backgroundColor: 'white' }}>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => openFixedExpenseForm('new')}
                                        className="inline-flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium shadow-lg"
                                        style={{ backgroundColor: '#4F46E5', color: '#FFFFFF' }}
                                    >
                                        <Plus size={16} />
                                        Add recurring expense
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>,
                document.body
            )}

            {typeof document !== 'undefined' && createPortal(
                <button
                    onClick={openAddModal}
                    className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium transition-all hover:shadow-lg transform hover:scale-105 z-50"
                    style={{ background: 'var(--color-primary)', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                >
                    <Plus size={18} />
                    Add Expense
                </button>,
                document.body
            )}
        </div>
    );
}
