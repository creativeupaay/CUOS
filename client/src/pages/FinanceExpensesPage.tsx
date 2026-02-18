import { useState } from 'react';
import {
    Receipt,
    Plus,
    X,
    Filter,
    Check,
    Trash2,
    Edit,
} from 'lucide-react';
import {
    useGetExpensesQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
    useApproveExpenseMutation,
} from '@/features/finance/api/financeApi';
import type { ExpenseCategory, ExpenseStatus, CreateExpensePayload } from '@/features/finance/types/finance.types';

function formatCurrency(amount: number, currency = 'INR'): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
    { value: 'salary', label: 'Salary' },
    { value: 'fixed', label: 'Fixed Cost' },
    { value: 'cac', label: 'CAC (Marketing)' },
    { value: 'project', label: 'Project Cost' },
    { value: 'overhead', label: 'Overhead' },
    { value: 'tax', label: 'Tax' },
    { value: 'transaction-fee', label: 'Transaction Fee' },
    { value: 'currency-loss', label: 'Currency Loss' },
];

const STATUSES: ExpenseStatus[] = ['pending', 'approved', 'paid', 'rejected'];

const STATUS_COLORS: Record<string, string> = {
    pending: '#f59e0b',
    approved: '#10b981',
    paid: '#3b82f6',
    rejected: '#ef4444',
};

export default function FinanceExpensesPage() {
    const [page, setPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState<CreateExpensePayload>({
        title: '',
        amount: 0,
        category: 'project',
        date: new Date().toISOString().split('T')[0],
    });

    const { data, isLoading } = useGetExpensesQuery({
        page,
        limit: 15,
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
    });

    const [createExpense, { isLoading: creating }] = useCreateExpenseMutation();
    const [updateExpense] = useUpdateExpenseMutation();
    const [deleteExpense] = useDeleteExpenseMutation();
    const [approveExpense] = useApproveExpenseMutation();

    const expenses = data?.expenses || [];
    const pagination = data?.pagination;

    const openCreate = () => {
        setEditingId(null);
        setForm({
            title: '',
            amount: 0,
            category: 'project',
            date: new Date().toISOString().split('T')[0],
        });
        setShowModal(true);
    };

    const openEdit = (exp: any) => {
        setEditingId(exp._id);
        setForm({
            title: exp.title,
            description: exp.description || '',
            amount: exp.amount,
            currency: exp.currency,
            exchangeRate: exp.exchangeRate,
            category: exp.category,
            projectId: typeof exp.projectId === 'object' ? exp.projectId?._id : exp.projectId,
            date: exp.date?.split('T')[0] || '',
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

    return (
        <div className="finance-expenses">
            {/* Header */}
            <div className="finance-page-header">
                <div>
                    <h1 className="finance-page-title">Expenses</h1>
                    <p className="finance-page-subtitle">Track and manage all company expenses</p>
                </div>
                <button className="finance-btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Add Expense
                </button>
            </div>

            {/* Filters */}
            <div className="finance-filters">
                <Filter size={16} />
                <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="finance-select">
                    <option value="">All Categories</option>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="finance-select">
                    <option value="">All Status</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="finance-loading"><div className="finance-spinner" /><span>Loading expenses...</span></div>
            ) : expenses.length === 0 ? (
                <div className="finance-empty">
                    <Receipt size={48} strokeWidth={1.5} />
                    <p>No expenses found</p>
                </div>
            ) : (
                <>
                    <div className="finance-table-wrapper">
                        <table className="finance-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Title</th>
                                    <th>Category</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>GST</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((exp) => (
                                    <tr key={exp._id}>
                                        <td style={{ textAlign: 'left' }}>
                                            <strong>{exp.title}</strong>
                                            {exp.notes && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: 2 }}>{exp.notes}</div>}
                                        </td>
                                        <td>
                                            <span className="finance-badge" style={{ background: '#f3f4f6', color: '#374151' }}>
                                                {CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category}
                                            </span>
                                        </td>
                                        <td>{new Date(exp.date).toLocaleDateString()}</td>
                                        <td>{formatCurrency(exp.amountInBaseCurrency)}</td>
                                        <td>{exp.gstApplicable ? formatCurrency(exp.gstAmount) : '—'}</td>
                                        <td>
                                            <span className="finance-badge" style={{ background: `${STATUS_COLORS[exp.status]}20`, color: STATUS_COLORS[exp.status] }}>
                                                {exp.status.charAt(0).toUpperCase() + exp.status.slice(1)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="finance-actions">
                                                {exp.status === 'pending' && (
                                                    <button className="finance-action-btn" title="Approve" onClick={() => approveExpense(exp._id)}>
                                                        <Check size={14} />
                                                    </button>
                                                )}
                                                <button className="finance-action-btn" title="Edit" onClick={() => openEdit(exp)}>
                                                    <Edit size={14} />
                                                </button>
                                                <button className="finance-action-btn danger" title="Delete" onClick={() => { if (confirm('Delete this expense?')) deleteExpense(exp._id); }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                        <div className="finance-pagination">
                            {Array.from({ length: pagination.pages }, (_, i) => (
                                <button
                                    key={i}
                                    className={`finance-page-btn ${page === i + 1 ? 'active' : ''}`}
                                    onClick={() => setPage(i + 1)}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Modal */}
            {showModal && (
                <div className="finance-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="finance-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="finance-modal-header">
                            <h2>{editingId ? 'Edit Expense' : 'Add Expense'}</h2>
                            <button className="finance-modal-close" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="finance-modal-body">
                            <div className="finance-form-grid">
                                <div className="finance-field full">
                                    <label>Title</label>
                                    <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Expense title" />
                                </div>
                                <div className="finance-field">
                                    <label>Amount</label>
                                    <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
                                </div>
                                <div className="finance-field">
                                    <label>Category</label>
                                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
                                        {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="finance-field">
                                    <label>Date</label>
                                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div className="finance-field">
                                    <label>Currency</label>
                                    <input value={form.currency || 'INR'} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                                </div>
                                <div className="finance-field">
                                    <label>Exchange Rate</label>
                                    <input type="number" step="0.01" value={form.exchangeRate || 1} onChange={(e) => setForm({ ...form, exchangeRate: Number(e.target.value) })} />
                                </div>
                                <div className="finance-field">
                                    <label>
                                        <input type="checkbox" checked={form.gstApplicable || false} onChange={(e) => setForm({ ...form, gstApplicable: e.target.checked })} /> GST Applicable
                                    </label>
                                    {form.gstApplicable && (
                                        <input type="number" placeholder="GST Amount" value={form.gstAmount || 0} onChange={(e) => setForm({ ...form, gstAmount: Number(e.target.value) })} />
                                    )}
                                </div>
                                <div className="finance-field">
                                    <label>
                                        <input type="checkbox" checked={form.tdsApplicable || false} onChange={(e) => setForm({ ...form, tdsApplicable: e.target.checked })} /> TDS Applicable
                                    </label>
                                    {form.tdsApplicable && (
                                        <input type="number" placeholder="TDS Amount" value={form.tdsAmount || 0} onChange={(e) => setForm({ ...form, tdsAmount: Number(e.target.value) })} />
                                    )}
                                </div>
                                <div className="finance-field full">
                                    <label>Notes</label>
                                    <textarea rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
                                </div>
                            </div>
                        </div>
                        <div className="finance-modal-footer">
                            <button className="finance-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="finance-btn-primary" onClick={handleSubmit} disabled={creating || !form.title || !form.amount}>
                                {creating ? 'Saving...' : editingId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .finance-expenses {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .finance-page-header {
                    display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;
                }
                .finance-page-title { font-size: 1.75rem; font-weight: 700; color: var(--color-text, #111); margin: 0; }
                .finance-page-subtitle { color: var(--color-text-secondary, #666); margin: 0.25rem 0 0; font-size: 0.9rem; }
                .finance-btn-primary {
                    display: flex; align-items: center; gap: 6px;
                    padding: 0.6rem 1.2rem; border: none; border-radius: 8px;
                    background: var(--color-primary, #3b82f6); color: white;
                    font-weight: 600; font-size: 0.875rem; cursor: pointer;
                    transition: background 0.2s;
                }
                .finance-btn-primary:hover { opacity: 0.9; }
                .finance-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .finance-btn-secondary {
                    padding: 0.6rem 1.2rem; border: 1px solid var(--color-border, #e5e7eb);
                    border-radius: 8px; background: transparent; color: var(--color-text, #111);
                    font-weight: 500; font-size: 0.875rem; cursor: pointer;
                }
                .finance-filters {
                    display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem;
                    color: var(--color-text-secondary, #666);
                }
                .finance-select {
                    padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb);
                    border-radius: 8px; background: var(--color-surface, #fff);
                    color: var(--color-text, #111); font-size: 0.875rem; cursor: pointer;
                }
                .finance-table-wrapper { overflow-x: auto; background: var(--color-surface, #fff); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
                .finance-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .finance-table th, .finance-table td { padding: 0.75rem 1rem; text-align: right; border-bottom: 1px solid var(--color-border, #e5e7eb); }
                .finance-table th { font-weight: 600; color: var(--color-text-secondary, #666); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .finance-table tbody tr:hover { background: var(--color-bg, #f9fafb); }
                .finance-badge {
                    display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px;
                    font-size: 0.72rem; font-weight: 600;
                }
                .finance-actions { display: flex; gap: 4px; justify-content: flex-end; }
                .finance-action-btn {
                    width: 28px; height: 28px; border: 1px solid var(--color-border, #e5e7eb);
                    border-radius: 6px; background: transparent; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    color: var(--color-text-secondary, #666); transition: all 0.15s;
                }
                .finance-action-btn:hover { background: var(--color-bg, #f3f4f6); }
                .finance-action-btn.danger:hover { background: #fef2f2; color: #ef4444; }
                .finance-pagination { display: flex; gap: 4px; justify-content: center; margin-top: 1.5rem; }
                .finance-page-btn {
                    width: 32px; height: 32px; border: 1px solid var(--color-border, #e5e7eb);
                    border-radius: 6px; background: var(--color-surface, #fff); color: var(--color-text, #111);
                    cursor: pointer; font-size: 0.8rem;
                }
                .finance-page-btn.active { background: var(--color-primary, #3b82f6); color: white; border-color: transparent; }
                .finance-empty {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    padding: 4rem; color: var(--color-text-secondary, #999);
                    background: var(--color-surface, #fff); border-radius: 12px;
                }
                .finance-loading {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    height: 300px; gap: 1rem; color: var(--color-text-secondary, #666);
                }
                .finance-spinner {
                    width: 32px; height: 32px;
                    border: 3px solid var(--color-border, #e5e7eb);
                    border-top-color: var(--color-primary, #3b82f6);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Modal */
                .finance-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
                    z-index: 1000; padding: 1rem;
                }
                .finance-modal {
                    background: var(--color-surface, #fff); border-radius: 16px; width: 580px;
                    max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .finance-modal-header {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border, #e5e7eb);
                }
                .finance-modal-header h2 { margin: 0; font-size: 1.1rem; font-weight: 600; }
                .finance-modal-close { background: none; border: none; cursor: pointer; color: var(--color-text-secondary, #666); }
                .finance-modal-body { padding: 1.5rem; }
                .finance-modal-footer {
                    display: flex; gap: 0.75rem; justify-content: flex-end;
                    padding: 1rem 1.5rem; border-top: 1px solid var(--color-border, #e5e7eb);
                }
                .finance-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .finance-field { display: flex; flex-direction: column; gap: 4px; }
                .finance-field.full { grid-column: 1 / -1; }
                .finance-field label { font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary, #666); display: flex; align-items: center; gap: 6px; }
                .finance-field input, .finance-field select, .finance-field textarea {
                    padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb);
                    border-radius: 8px; font-size: 0.875rem; background: var(--color-surface, #fff);
                    color: var(--color-text, #111);
                }
                .finance-field input[type="checkbox"] { width: auto; margin: 0; }
                .finance-field textarea { resize: vertical; }
            `}</style>
        </div>
    );
}
