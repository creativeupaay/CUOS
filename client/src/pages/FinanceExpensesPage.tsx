import { useState, useMemo } from 'react';
import {
    Receipt,
    Plus,
    X,
    Search,
    Edit,
    Trash2,
    Check,
    Building2,
    FolderKanban,
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    Pause,
    ArrowRight,
    ChevronDown,
} from 'lucide-react';
import {
    useGetExpensesQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
    useApproveExpenseMutation,
} from '@/features/finance/api/financeApi';
import { useGetProjectsQuery } from '@/features/project/projectApi';
import type { ExpenseCategory, ExpenseStatus, ExpenseLevel, CostType, CreateExpensePayload, Expense } from '@/features/finance/types/finance.types';

function formatCurrency(amount: number, currency = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

type ExpenseViewTab = 'all' | 'company' | 'project';
type CompanyExpenseType = 'fixed' | 'variable';

const COMPANY_CATEGORIES: { value: ExpenseCategory; label: string; type: CostType }[] = [
    { value: 'salary', label: 'Salaries & Wages', type: 'fixed' },
    { value: 'fixed', label: 'Rent & Utilities', type: 'fixed' },
    { value: 'overhead', label: 'Administrative Overhead', type: 'fixed' },
    { value: 'cac', label: 'Marketing & Acquisition', type: 'variable' },
    { value: 'tax', label: 'Taxes & Compliance', type: 'variable' },
    { value: 'transaction-fee', label: 'Transaction Fees', type: 'variable' },
    { value: 'currency-loss', label: 'Currency Loss/Gain', type: 'variable' },
];

const PROJECT_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
    { value: 'project', label: 'Direct Project Cost' },
    { value: 'overhead', label: 'Project Overhead' },
    { value: 'transaction-fee', label: 'Transaction Fee' },
];

const STATUSES: { value: ExpenseStatus; label: string; color: string; bg: string; icon: React.ReactNode }[] = [
    { value: 'pending', label: 'Pending', color: '#F59E0B', bg: '#FFFBEB', icon: <Clock size={12} /> },
    { value: 'approved', label: 'Approved', color: '#10B981', bg: '#ECFDF5', icon: <CheckCircle size={12} /> },
    { value: 'paid', label: 'Paid', color: '#3B82F6', bg: '#EFF6FF', icon: <Check size={12} /> },
    { value: 'rejected', label: 'Rejected', color: '#EF4444', bg: '#FEF2F2', icon: <XCircle size={12} /> },
];

export default function FinanceExpensesPage() {
    const [activeTab, setActiveTab] = useState<ExpenseViewTab>('all');
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        fixed: true,
        variable: true,
        project: true,
    });

    const [form, setForm] = useState<CreateExpensePayload>({
        title: '',
        amount: 0,
        category: 'project',
        expenseLevel: 'company',
        date: new Date().toISOString().split('T')[0],
    });

    const { data, isLoading } = useGetExpensesQuery({
        page,
        limit: 100,
        ...(statusFilter ? { status: statusFilter } : {}),
    });

    const { data: projectsData } = useGetProjectsQuery({});

    const [createExpense, { isLoading: creating }] = useCreateExpenseMutation();
    const [updateExpense] = useUpdateExpenseMutation();
    const [deleteExpense] = useDeleteExpenseMutation();
    const [approveExpense] = useApproveExpenseMutation();

    const expenses = data?.expenses || [];
    const projects = projectsData?.data || [];

    // Filter and categorize expenses
    const { summaryStats, companyFixedExpenses, companyVariableExpenses, projectExpenses } = useMemo(() => {
        let filtered = expenses;

        // Filter by search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(e => e.title.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q));
        }

        // Filter by tab
        if (activeTab === 'company') {
            filtered = filtered.filter(e => e.expenseLevel !== 'project');
        } else if (activeTab === 'project') {
            filtered = filtered.filter(e => e.expenseLevel === 'project' || e.category === 'project');
        }

        // Calculate stats
        const totalExpenses = filtered.reduce((sum, e) => sum + e.amountInBaseCurrency, 0);
        const pendingExpenses = filtered.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amountInBaseCurrency, 0);
        const approvedExpenses = filtered.filter(e => e.status === 'approved' || e.status === 'paid').reduce((sum, e) => sum + e.amountInBaseCurrency, 0);
        const fixedCosts = filtered.filter(e => {
            const catInfo = COMPANY_CATEGORIES.find(c => c.value === e.category);
            return catInfo?.type === 'fixed';
        }).reduce((sum, e) => sum + e.amountInBaseCurrency, 0);
        const variableCosts = filtered.filter(e => {
            const catInfo = COMPANY_CATEGORIES.find(c => c.value === e.category);
            return catInfo?.type === 'variable';
        }).reduce((sum, e) => sum + e.amountInBaseCurrency, 0);
        const projectCosts = filtered.filter(e => e.expenseLevel === 'project' || e.category === 'project').reduce((sum, e) => sum + e.amountInBaseCurrency, 0);

        // Categorize expenses
        const companyFixed = filtered.filter(e => {
            const catInfo = COMPANY_CATEGORIES.find(c => c.value === e.category);
            return catInfo?.type === 'fixed' && e.expenseLevel !== 'project';
        });

        const companyVariable = filtered.filter(e => {
            const catInfo = COMPANY_CATEGORIES.find(c => c.value === e.category);
            return catInfo?.type === 'variable' && e.expenseLevel !== 'project';
        });

        const project = filtered.filter(e => e.expenseLevel === 'project' || e.category === 'project');

        return {
            summaryStats: { totalExpenses, pendingExpenses, approvedExpenses, fixedCosts, variableCosts, projectCosts },
            companyFixedExpenses: companyFixed,
            companyVariableExpenses: companyVariable,
            projectExpenses: project,
        };
    }, [expenses, searchQuery, activeTab]);

    const openCreate = (level: ExpenseLevel = 'company', companyType?: CompanyExpenseType) => {
        setEditingId(null);
        const defaultCategory: ExpenseCategory = level === 'project' ? 'project' : (companyType === 'fixed' ? 'salary' : 'cac');
        setForm({
            title: '',
            amount: 0,
            category: defaultCategory,
            expenseLevel: level,
            costType: companyType,
            date: new Date().toISOString().split('T')[0],
        });
        setShowModal(true);
    };

    const openEdit = (exp: Expense) => {
        setEditingId(exp._id);
        const catInfo = COMPANY_CATEGORIES.find(c => c.value === exp.category);
        setForm({
            title: exp.title,
            description: exp.description || '',
            amount: exp.amount,
            currency: exp.currency,
            exchangeRate: exp.exchangeRate,
            category: exp.category,
            expenseLevel: exp.expenseLevel || (exp.category === 'project' ? 'project' : 'company'),
            costType: catInfo?.type,
            projectId: typeof exp.projectId === 'object' ? exp.projectId?._id : exp.projectId,
            date: exp.date?.split('T')[0] || '',
            recurring: exp.recurring,
            recurringFrequency: exp.recurringFrequency,
            gstApplicable: exp.gstApplicable,
            gstAmount: exp.gstAmount,
            tdsApplicable: exp.tdsApplicable,
            tdsAmount: exp.tdsAmount,
            notes: exp.notes || '',
        });
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (editingId) {
            await updateExpense({ id: editingId, data: form });
        } else {
            await createExpense(form);
        }
        setShowModal(false);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            await deleteExpense(id);
        }
    };

    const getStatusInfo = (status: ExpenseStatus) => STATUSES.find(s => s.value === status) || STATUSES[0];

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const renderExpenseItem = (exp: Expense, index: number) => {
        const statusInfo = getStatusInfo(exp.status);
        const projectName = typeof exp.projectId === 'object' ? exp.projectId?.name : '';

        return (
            <div key={exp._id} className="expense-item" style={{ animationDelay: `${index * 20}ms` }}>
                <div className="expense-main">
                    <div className="expense-info">
                        <h4 className="expense-title">{exp.title}</h4>
                        <div className="expense-meta">
                            {projectName && (
                                <span className="meta-tag">
                                    <FolderKanban size={11} />
                                    {projectName}
                                </span>
                            )}
                            <span className="meta-tag">
                                <Calendar size={11} />
                                {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                            {exp.recurring && (
                                <span className="meta-tag recurring">
                                    <Pause size={11} />
                                    {exp.recurringFrequency}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="expense-right">
                    <div className="expense-amount">{formatCurrency(exp.amountInBaseCurrency)}</div>
                    <span className="status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.icon}
                        {statusInfo.label}
                    </span>
                    <div className="expense-actions">
                        {exp.status === 'pending' && (
                            <button className="action-btn approve" title="Approve" onClick={() => approveExpense(exp._id)}>
                                <Check size={13} />
                            </button>
                        )}
                        <button className="action-btn" title="Edit" onClick={() => openEdit(exp)}>
                            <Edit size={13} />
                        </button>
                        <button className="action-btn danger" title="Delete" onClick={() => handleDelete(exp._id)}>
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderExpenseSection = (
        title: string,
        subtitle: string,
        expenses: Expense[],
        total: number,
        sectionKey: string,
        createLevel: ExpenseLevel,
        companyType?: CostType,
        color: string = '#3B82F6'
    ) => {
        const isExpanded = expandedSections[sectionKey];

        return (
            <div className="expense-section">
                <div className="section-header" onClick={() => toggleSection(sectionKey)}>
                    <div className="section-header-left">
                        <div className="section-icon" style={{ background: `${color}15`, color }}>
                            {createLevel === 'project' ? <FolderKanban size={18} /> : <Building2 size={18} />}
                        </div>
                        <div>
                            <h3 className="section-title">{title}</h3>
                            <p className="section-subtitle">{subtitle}</p>
                        </div>
                    </div>
                    <div className="section-header-right">
                        <div className="section-stats">
                            <span className="section-total">{formatCurrency(total)}</span>
                            <span className="section-count">{expenses.length} items</span>
                        </div>
                        <button
                            className="add-expense-btn"
                            onClick={(e) => { e.stopPropagation(); openCreate(createLevel, companyType); }}
                        >
                            <Plus size={14} />
                        </button>
                        <ChevronDown size={18} className={`section-chevron ${isExpanded ? 'expanded' : ''}`} />
                    </div>
                </div>
                {isExpanded && (
                    <div className="section-content">
                        {expenses.length === 0 ? (
                            <div className="section-empty">
                                <p>No expenses in this category</p>
                                <button className="btn-outline" onClick={() => openCreate(createLevel, companyType)}>
                                    <Plus size={14} />
                                    Add {title.split(' ')[0]} Expense
                                </button>
                            </div>
                        ) : (
                            <div className="expense-list">
                                {expenses.map((exp, i) => renderExpenseItem(exp, i))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="finance-expenses">
            {/* Header */}
            <div className="page-header">
                <div className="header-left">
                    <div className="header-icon">
                        <Receipt size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Expenses</h1>
                        <p className="page-subtitle">Track and manage company & project expenses</p>
                    </div>
                </div>
                <button className="btn-primary" onClick={() => openCreate()}>
                    <Plus size={16} />
                    Add Expense
                </button>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="summary-card">
                    <div className="summary-content">
                        <span className="summary-label">Total Expenses</span>
                        <span className="summary-value">{formatCurrency(summaryStats.totalExpenses)}</span>
                    </div>
                    <div className="summary-breakdown">
                        <div className="breakdown-bar">
                            <div className="breakdown-segment fixed" style={{ width: `${(summaryStats.fixedCosts / (summaryStats.totalExpenses || 1)) * 100}%` }} />
                            <div className="breakdown-segment variable" style={{ width: `${(summaryStats.variableCosts / (summaryStats.totalExpenses || 1)) * 100}%` }} />
                            <div className="breakdown-segment project" style={{ width: `${(summaryStats.projectCosts / (summaryStats.totalExpenses || 1)) * 100}%` }} />
                        </div>
                        <div className="breakdown-legend">
                            <span><span className="legend-dot fixed" /> Fixed</span>
                            <span><span className="legend-dot variable" /> Variable</span>
                            <span><span className="legend-dot project" /> Project</span>
                        </div>
                    </div>
                </div>
                <div className="summary-card small">
                    <div className="summary-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}>
                        <Building2 size={18} />
                    </div>
                    <div>
                        <span className="summary-label">Fixed Costs</span>
                        <span className="summary-value">{formatCurrency(summaryStats.fixedCosts)}</span>
                    </div>
                </div>
                <div className="summary-card small">
                    <div className="summary-icon" style={{ background: '#F5F3FF', color: '#8B5CF6' }}>
                        <ArrowRight size={18} />
                    </div>
                    <div>
                        <span className="summary-label">Variable Costs</span>
                        <span className="summary-value">{formatCurrency(summaryStats.variableCosts)}</span>
                    </div>
                </div>
                <div className="summary-card small">
                    <div className="summary-icon" style={{ background: '#ECFDF5', color: '#10B981' }}>
                        <FolderKanban size={18} />
                    </div>
                    <div>
                        <span className="summary-label">Project Costs</span>
                        <span className="summary-value">{formatCurrency(summaryStats.projectCosts)}</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-bar">
                <div className="tabs">
                    {(['all', 'company', 'project'] as ExpenseViewTab[]).map((tab) => (
                        <button
                            key={tab}
                            className={`tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'all' ? 'All Expenses' : tab === 'company' ? 'Company Level' : 'Project Level'}
                        </button>
                    ))}
                </div>
                <div className="filters">
                    <div className="search-box">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
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
                    <span>Loading expenses...</span>
                </div>
            ) : (
                <div className="expenses-content">
                    {(activeTab === 'all' || activeTab === 'company') && (
                        <>
                            {renderExpenseSection(
                                'Fixed Costs',
                                'Recurring expenses like salaries, rent, and utilities',
                                companyFixedExpenses,
                                summaryStats.fixedCosts,
                                'fixed',
                                'company',
                                'fixed',
                                '#3B82F6'
                            )}
                            {renderExpenseSection(
                                'Variable Costs',
                                'Marketing, acquisition, and other variable expenses',
                                companyVariableExpenses,
                                summaryStats.variableCosts,
                                'variable',
                                'company',
                                'variable',
                                '#8B5CF6'
                            )}
                        </>
                    )}
                    {(activeTab === 'all' || activeTab === 'project') && (
                        renderExpenseSection(
                            'Project Costs',
                            'Direct costs associated with specific projects',
                            projectExpenses,
                            summaryStats.projectCosts,
                            'project',
                            'project',
                            undefined,
                            '#10B981'
                        )
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Edit Expense' : 'Add Expense'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Expense Level Toggle */}
                            <div className="level-toggle">
                                <button
                                    className={`level-btn ${form.expenseLevel === 'company' ? 'active' : ''}`}
                                    onClick={() => setForm({ ...form, expenseLevel: 'company', category: 'salary', projectId: undefined })}
                                >
                                    <Building2 size={16} />
                                    Company Level
                                </button>
                                <button
                                    className={`level-btn ${form.expenseLevel === 'project' ? 'active' : ''}`}
                                    onClick={() => setForm({ ...form, expenseLevel: 'project', category: 'project' })}
                                >
                                    <FolderKanban size={16} />
                                    Project Level
                                </button>
                            </div>

                            {/* Company Expense Type Toggle */}
                            {form.expenseLevel === 'company' && (
                                <div className="type-toggle">
                                    <button
                                        className={`type-btn ${form.costType === 'fixed' ? 'active' : ''}`}
                                        onClick={() => setForm({ ...form, costType: 'fixed', category: 'salary' })}
                                    >
                                        Fixed Cost
                                    </button>
                                    <button
                                        className={`type-btn ${form.costType === 'variable' ? 'active' : ''}`}
                                        onClick={() => setForm({ ...form, costType: 'variable', category: 'cac' })}
                                    >
                                        Variable Cost
                                    </button>
                                </div>
                            )}

                            <div className="form-grid">
                                <div className="form-field full">
                                    <label>Title *</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Expense title"
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
                                    <label>Category *</label>
                                    <select
                                        value={form.category}
                                        onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                                    >
                                        {form.expenseLevel === 'project' ? (
                                            PROJECT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)
                                        ) : (
                                            COMPANY_CATEGORIES
                                                .filter(c => !form.costType || c.type === form.costType)
                                                .map(c => <option key={c.value} value={c.value}>{c.label}</option>)
                                        )}
                                    </select>
                                </div>

                                <div className="form-field">
                                    <label>Date *</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                                    />
                                </div>

                                {form.expenseLevel === 'project' && (
                                    <div className="form-field">
                                        <label>Project *</label>
                                        <select
                                            value={form.projectId || ''}
                                            onChange={(e) => setForm({ ...form, projectId: e.target.value || undefined })}
                                        >
                                            <option value="">Select Project</option>
                                            {projects.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                )}

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
                                            checked={form.recurring || false}
                                            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                                        />
                                        Recurring Expense
                                    </label>
                                    {form.recurring && (
                                        <select
                                            value={form.recurringFrequency || 'monthly'}
                                            onChange={(e) => setForm({ ...form, recurringFrequency: e.target.value as any })}
                                            className="inline-select"
                                        >
                                            <option value="monthly">Monthly</option>
                                            <option value="quarterly">Quarterly</option>
                                            <option value="yearly">Yearly</option>
                                        </select>
                                    )}
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
                                        <input
                                            type="number"
                                            placeholder="GST Amount"
                                            value={form.gstAmount || 0}
                                            onChange={(e) => setForm({ ...form, gstAmount: Number(e.target.value) })}
                                            className="inline-input"
                                        />
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
                                        <input
                                            type="number"
                                            placeholder="TDS Amount"
                                            value={form.tdsAmount || 0}
                                            onChange={(e) => setForm({ ...form, tdsAmount: Number(e.target.value) })}
                                            className="inline-input"
                                        />
                                    )}
                                </div>

                                <div className="form-field full">
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={form.notes || ''}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        placeholder="Optional notes"
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
                .finance-expenses {
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
                    background: linear-gradient(135deg, #EF444420, #EF444410);
                    color: #EF4444;
                    border: 1px solid #EF444425;
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
                    background: linear-gradient(135deg, #EF4444, #DC2626);
                    color: white;
                    font-weight: 600;
                    font-size: 0.875rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
                }

                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);
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

                .btn-outline {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.5rem 1rem;
                    border: 1px dashed var(--color-border-default, #d1d5db);
                    border-radius: 8px;
                    background: transparent;
                    color: var(--color-text-muted, #666);
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .btn-outline:hover {
                    border-color: var(--color-primary, #3b82f6);
                    color: var(--color-primary, #3b82f6);
                    background: var(--color-primary-soft, #eff6ff);
                }

                /* Summary Cards */
                .summary-cards {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .summary-card {
                    padding: 1.25rem;
                    background: var(--color-bg-surface, #fff);
                    border-radius: 14px;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    animation: slideUp 0.4s ease-out backwards;
                }

                .summary-card.small {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .summary-card:nth-child(1) { animation-delay: 0ms; }
                .summary-card:nth-child(2) { animation-delay: 50ms; }
                .summary-card:nth-child(3) { animation-delay: 100ms; }
                .summary-card:nth-child(4) { animation-delay: 150ms; }

                .summary-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .summary-content {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    margin-bottom: 1rem;
                }

                .summary-label {
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--color-text-muted, #666);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .summary-value {
                    font-size: 1.35rem;
                    font-weight: 700;
                    color: var(--color-text-primary, #111);
                    font-family: 'Outfit', sans-serif;
                }

                .summary-card.small .summary-value {
                    font-size: 1.1rem;
                }

                .summary-breakdown {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .breakdown-bar {
                    display: flex;
                    height: 8px;
                    border-radius: 4px;
                    overflow: hidden;
                    background: var(--color-bg-subtle, #f3f4f6);
                }

                .breakdown-segment {
                    height: 100%;
                    transition: width 0.5s ease;
                }

                .breakdown-segment.fixed { background: #3B82F6; }
                .breakdown-segment.variable { background: #8B5CF6; }
                .breakdown-segment.project { background: #10B981; }

                .breakdown-legend {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.7rem;
                    color: var(--color-text-muted, #666);
                }

                .legend-dot {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 4px;
                }

                .legend-dot.fixed { background: #3B82F6; }
                .legend-dot.variable { background: #8B5CF6; }
                .legend-dot.project { background: #10B981; }

                /* Tab Bar */
                .tab-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .tabs {
                    display: flex;
                    background: var(--color-bg-subtle, #f3f4f6);
                    border-radius: 10px;
                    padding: 4px;
                }

                .tab {
                    padding: 0.5rem 1.25rem;
                    border: none;
                    border-radius: 8px;
                    background: transparent;
                    color: var(--color-text-secondary, #666);
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .tab:hover {
                    color: var(--color-text-primary, #111);
                }

                .tab.active {
                    background: var(--color-bg-surface, #fff);
                    color: var(--color-primary, #3b82f6);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }

                .filters {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .search-box {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.4rem 0.75rem;
                    background: var(--color-bg-surface, #fff);
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 8px;
                    min-width: 200px;
                    color: var(--color-text-muted, #999);
                }

                .search-box input {
                    border: none;
                    background: transparent;
                    outline: none;
                    flex: 1;
                    font-size: 0.85rem;
                    color: var(--color-text-primary, #111);
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

                /* Expense Sections */
                .expenses-content {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .expense-section {
                    background: var(--color-bg-surface, #fff);
                    border-radius: 16px;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    overflow: hidden;
                    animation: slideUp 0.4s ease-out backwards;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .section-header:hover {
                    background: var(--color-bg-subtle, #f9fafb);
                }

                .section-header-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .section-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .section-title {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--color-text-primary, #111);
                    margin: 0;
                }

                .section-subtitle {
                    font-size: 0.75rem;
                    color: var(--color-text-muted, #666);
                    margin: 2px 0 0 0;
                }

                .section-header-right {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .section-stats {
                    text-align: right;
                }

                .section-total {
                    display: block;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--color-text-primary, #111);
                    font-family: 'Outfit', sans-serif;
                }

                .section-count {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--color-text-muted, #999);
                }

                .add-expense-btn {
                    width: 32px;
                    height: 32px;
                    border: 1px dashed var(--color-border-default, #d1d5db);
                    border-radius: 8px;
                    background: transparent;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-text-muted, #999);
                    transition: all 0.15s;
                }

                .add-expense-btn:hover {
                    border-color: var(--color-primary, #3b82f6);
                    color: var(--color-primary, #3b82f6);
                    background: var(--color-primary-soft, #eff6ff);
                }

                .section-chevron {
                    color: var(--color-text-muted, #999);
                    transition: transform 0.2s;
                }

                .section-chevron.expanded {
                    transform: rotate(180deg);
                }

                .section-content {
                    border-top: 1px solid var(--color-border-default, #e5e7eb);
                    padding: 1rem 1.25rem;
                }

                .section-empty {
                    text-align: center;
                    padding: 2rem;
                    color: var(--color-text-muted, #999);
                }

                .section-empty p {
                    margin: 0 0 1rem 0;
                }

                /* Expense Items */
                .expense-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .expense-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.875rem 1rem;
                    background: var(--color-bg-subtle, #f9fafb);
                    border-radius: 10px;
                    animation: slideUp 0.25s ease-out backwards;
                    transition: all 0.15s;
                }

                .expense-item:hover {
                    background: var(--color-bg-surface, #fff);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                }

                .expense-main {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .expense-info {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }

                .expense-title {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--color-text-primary, #111);
                    margin: 0;
                }

                .expense-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .meta-tag {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 0.7rem;
                    color: var(--color-text-muted, #999);
                }

                .meta-tag.recurring {
                    color: #8B5CF6;
                }

                .expense-right {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .expense-amount {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--color-text-primary, #111);
                    font-family: 'Outfit', sans-serif;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 600;
                }

                .expense-actions {
                    display: flex;
                    gap: 3px;
                }

                .action-btn {
                    width: 28px;
                    height: 28px;
                    border: 1px solid transparent;
                    border-radius: 6px;
                    background: transparent;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-text-muted, #999);
                    transition: all 0.15s;
                }

                .action-btn:hover {
                    background: var(--color-bg-surface, #fff);
                    border-color: var(--color-border-default, #e5e7eb);
                    color: var(--color-text-primary, #111);
                }

                .action-btn.approve:hover {
                    background: #ECFDF5;
                    color: #10B981;
                    border-color: #A7F3D0;
                }

                .action-btn.danger:hover {
                    background: #FEF2F2;
                    color: #EF4444;
                    border-color: #FECACA;
                }

                /* Loading State */
                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 2rem;
                    gap: 1rem;
                    color: var(--color-text-muted, #666);
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
                    max-width: 580px;
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

                /* Level & Type Toggles */
                .level-toggle, .type-toggle {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 1.25rem;
                }

                .level-btn, .type-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 0.75rem;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 10px;
                    background: transparent;
                    color: var(--color-text-secondary, #666);
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .level-btn:hover, .type-btn:hover {
                    border-color: var(--color-primary, #3b82f6);
                }

                .level-btn.active, .type-btn.active {
                    background: var(--color-primary-soft, #eff6ff);
                    border-color: var(--color-primary, #3b82f6);
                    color: var(--color-primary-dark, #1d4ed8);
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

                .inline-select, .inline-input {
                    margin-top: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-border-default, #e5e7eb);
                    border-radius: 8px;
                    font-size: 0.85rem;
                    width: 100%;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .finance-expenses {
                        padding: 1rem;
                    }

                    .page-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 1rem;
                    }

                    .summary-cards {
                        grid-template-columns: 1fr;
                    }

                    .tab-bar {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .tabs {
                        width: 100%;
                        overflow-x: auto;
                    }

                    .filters {
                        flex-wrap: wrap;
                    }

                    .expense-item {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.75rem;
                    }

                    .expense-right {
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
