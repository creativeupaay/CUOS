import { useState } from 'react';
import {
    Receipt, Building2, FolderKanban, TrendingDown, Plus, X,
    Search, Calendar, Edit2, Trash2, Loader2,
    Wallet, Calculator,
} from 'lucide-react';
import {
    useGetExpensesQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
} from '@/features/finance/api/financeApi';
import ModalPortal from '@/components/ui/ModalPortal';

// ── Types ─────────────────────────────────────────────────────────────────
type ExpenseLevel = 'company' | 'project';
type ExpenseType = 'fixed' | 'variable';

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
    notes?: string;
    isRecurring: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
}

// ── Categories ────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
    'Salaries',
    'Rent',
    'Utilities',
    'Cloud Services',
    'Software Licenses',
    'Marketing',
    'HR & Culture',
    'Infrastructure',
    'Travel',
    'Office Supplies',
    'Professional Services',
    'Internet & Communication',
    'Insurance',
    'Legal & Compliance',
    'Other',
];

// ── Format Currency ───────────────────────────────────────────────────────
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value);
};

const formatShortCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)} K`;
    return formatCurrency(value);
};

// ── Type Badge Component ──────────────────────────────────────────────────
const TypeBadge = ({ type }: { type: ExpenseType }) => {
    const config = {
        fixed: { label: 'Fixed', color: '#6366F1', bg: '#EEF2FF' },
        variable: { label: 'Variable', color: '#F59E0B', bg: '#FFFBEB' },
    };
    const { label, color, bg } = config[type];
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ background: bg, color }}>{label}</span>;
};

// ── Level Badge Component ─────────────────────────────────────────────────
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

// ── Empty State ───────────────────────────────────────────────────────────
const EmptyState = () => (
    <div className="text-center py-12">
        <Receipt size={48} className="mx-auto mb-3" style={{ color: '#9CA3AF' }} />
        <p className="text-sm" style={{ color: '#6B7280' }}>No expenses found</p>
        <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>Add your first expense entry to get started</p>
    </div>
);

export default function FinanceExpensesPage() {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<ExpenseType | 'all'>('all');
    const [filterCategory, setFilterCategory] = useState('all');
    const [activeTab, setActiveTab] = useState<'all' | 'company' | 'project'>('all');

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
        notes: '',
        isRecurring: false,
        recurringFrequency: 'monthly',
    };

    const [formData, setFormData] = useState<ExpenseFormData>(initialFormData);

    // API Hooks
    const { data: expensesData, isLoading } = useGetExpensesQuery({
        level: activeTab !== 'all' ? activeTab : undefined,
        type: filterType !== 'all' ? filterType : undefined,
        category: filterCategory !== 'all' ? filterCategory : undefined,
        search: searchQuery || undefined,
    });
    const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
    const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation();
    const [deleteExpense] = useDeleteExpenseMutation();

    const expenses = expensesData?.data?.expenses || [];

    // Calculate metrics from actual data
    const allExpenses = expenses;
    const metrics = {
        totalExpenses: allExpenses.reduce((acc: number, e: any) => acc + (e.amount || 0), 0),
        projectExpenses: allExpenses.filter((e: any) => e.level === 'project').reduce((acc: number, e: any) => acc + (e.amount || 0), 0),
        fixedCosts: allExpenses.filter((e: any) => e.type === 'fixed').reduce((acc: number, e: any) => acc + (e.amount || 0), 0),
        variableCosts: allExpenses.filter((e: any) => e.type === 'variable').reduce((acc: number, e: any) => acc + (e.amount || 0), 0),
    };

    const metricCards = [
        { label: 'Total Expenses', value: formatShortCurrency(metrics.totalExpenses), fullValue: formatCurrency(metrics.totalExpenses), icon: TrendingDown, color: '#EF4444', bg: '#FEF2F2' },
        { label: 'Project Level', value: formatShortCurrency(metrics.projectExpenses), fullValue: formatCurrency(metrics.projectExpenses), icon: FolderKanban, color: '#10B981', bg: '#ECFDF5' },
        { label: 'Fixed Costs', value: formatShortCurrency(metrics.fixedCosts), fullValue: formatCurrency(metrics.fixedCosts), icon: Wallet, color: '#6366F1', bg: '#EEF2FF' },
        { label: 'Variable Costs', value: formatShortCurrency(metrics.variableCosts), fullValue: formatCurrency(metrics.variableCosts), icon: Calculator, color: '#F59E0B', bg: '#FFFBEB' },
    ];

    const handleSubmit = async () => {
        try {
            if (editingId) {
                await updateExpense({ id: editingId, ...formData }).unwrap();
            } else {
                await createExpense(formData).unwrap();
            }
            setShowAddModal(false);
            setEditingId(null);
            setFormData(initialFormData);
        } catch (error) {
            console.error('Failed to save expense:', error);
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
                console.error('Failed to delete expense:', error);
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
                <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Expenses</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Track company and project level expenses</p>
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

            {/* ── Tabs & Filters ──────────────────────────────────────────── */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                {/* Tabs */}
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

                {/* Filters */}
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

            {/* ── Company Level Summary (when on company tab) ─────────────── */}
            {activeTab === 'company' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
                                <Wallet size={16} style={{ color: '#6366F1' }} />
                            </div>
                            <h3 className="font-semibold" style={{ color: '#111827' }}>Fixed Expenses</h3>
                        </div>
                        <p className="text-2xl font-bold mb-2" style={{ color: '#6366F1' }}>{formatCurrency(metrics.fixedCosts)}</p>
                        <p className="text-xs" style={{ color: '#6B7280' }}>Recurring monthly/annual costs like rent, salaries, utilities</p>
                    </div>
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

            {/* ── Expenses Table ──────────────────────────────────────────── */}
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
                                                <p className="text-sm font-medium" style={{ color: '#111827' }}>{expense.description}</p>
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

            {/* ── Add/Edit Expense Modal ──────────────────────────────────── */}
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
                                        onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as any })}
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

            {/* ── Fixed Add Expense Button ─────────────────────────────────── */}
            <button
                onClick={openAddModal}
                className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-medium transition-all hover:shadow-lg transform hover:scale-105 z-40"
                style={{ background: 'var(--color-primary)', color: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            >
                <Plus size={18} />
                Add Expense
            </button>
        </div>
    );
}
