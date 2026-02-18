import { useState } from 'react';
import {
    FileText,
    Plus,
    X,
    Trash2,
    CreditCard,
    AlertTriangle,
} from 'lucide-react';
import {
    useGetInvoicesQuery,
    useCreateInvoiceMutation,
    useDeleteInvoiceMutation,
    useRecordPaymentMutation,
    useGetOverdueInvoicesQuery,
} from '@/features/finance/api/financeApi';
import type { CreateInvoicePayload, InvoiceItem } from '@/features/finance/types/finance.types';

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

const STATUS_COLORS: Record<string, string> = {
    draft: '#6b7280',
    sent: '#3b82f6',
    partial: '#f59e0b',
    paid: '#10b981',
    overdue: '#ef4444',
    cancelled: '#9ca3af',
};

export default function FinanceInvoicesPage() {
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [paymentModal, setPaymentModal] = useState<{ invoiceId: string; total: number; paid: number } | null>(null);
    const [paymentAmount, setPaymentAmount] = useState(0);

    const [form, setForm] = useState<CreateInvoicePayload>({
        projectId: '',
        clientId: '',
        items: [{ description: '', quantity: 1, rate: 0 }],
        gstRate: 18,
        tdsRate: 0,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '',
    });

    const { data, isLoading } = useGetInvoicesQuery({
        page,
        limit: 15,
        ...(statusFilter ? { status: statusFilter } : {}),
    });

    const { data: overdueInvoices } = useGetOverdueInvoicesQuery();

    const [createInvoice, { isLoading: creating }] = useCreateInvoiceMutation();
    const [deleteInvoice] = useDeleteInvoiceMutation();
    const [recordPayment, { isLoading: paying }] = useRecordPaymentMutation();

    const invoices = data?.invoices || [];
    const pagination = data?.pagination;

    const addItem = () => {
        setForm({ ...form, items: [...form.items, { description: '', quantity: 1, rate: 0 }] });
    };

    const removeItem = (idx: number) => {
        setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
    };

    const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
        const items = [...form.items];
        (items[idx] as any)[field] = value;
        setForm({ ...form, items });
    };

    const subtotal = form.items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const gst = (subtotal * (form.gstRate || 0)) / 100;
    const tds = (subtotal * (form.tdsRate || 0)) / 100;
    const total = subtotal + gst - tds;

    const handleCreate = async () => {
        await createInvoice(form);
        setShowCreate(false);
    };

    const handlePayment = async () => {
        if (paymentModal) {
            await recordPayment({ id: paymentModal.invoiceId, amount: paymentAmount });
            setPaymentModal(null);
            setPaymentAmount(0);
        }
    };

    return (
        <div className="finance-invoices">
            <div className="finance-page-header">
                <div>
                    <h1 className="finance-page-title">Invoices</h1>
                    <p className="finance-page-subtitle">Manage client invoices and payments</p>
                </div>
                <button className="finance-btn-primary" onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> Create Invoice
                </button>
            </div>

            {/* Overdue alert */}
            {overdueInvoices && overdueInvoices.length > 0 && (
                <div className="overdue-alert">
                    <AlertTriangle size={16} />
                    <span><strong>{overdueInvoices.length}</strong> overdue invoice{overdueInvoices.length > 1 ? 's' : ''} — {formatCurrency(overdueInvoices.reduce((s, i) => s + i.total - i.paidAmount, 0))} pending</span>
                </div>
            )}

            {/* Filters */}
            <div className="finance-filters">
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="finance-select">
                    <option value="">All Status</option>
                    {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
            </div>

            {isLoading ? (
                <div className="finance-loading"><div className="finance-spinner" /><span>Loading invoices...</span></div>
            ) : invoices.length === 0 ? (
                <div className="finance-empty">
                    <FileText size={48} strokeWidth={1.5} />
                    <p>No invoices found</p>
                </div>
            ) : (
                <>
                    <div className="finance-table-wrapper">
                        <table className="finance-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Invoice #</th>
                                    <th style={{ textAlign: 'left' }}>Client / Project</th>
                                    <th>Issue Date</th>
                                    <th>Due Date</th>
                                    <th>Subtotal</th>
                                    <th>GST</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => {
                                    const clientName = typeof inv.clientId === 'object' ? (inv.clientId.companyName || inv.clientId.name) : '';
                                    const projectName = typeof inv.projectId === 'object' ? inv.projectId.name : '';
                                    const isOverdue = new Date(inv.dueDate) < new Date() && ['sent', 'partial'].includes(inv.status);

                                    return (
                                        <tr key={inv._id}>
                                            <td style={{ textAlign: 'left' }}>
                                                <strong>{inv.invoiceNumber}</strong>
                                            </td>
                                            <td style={{ textAlign: 'left' }}>
                                                <div>{clientName}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#999' }}>{projectName}</div>
                                            </td>
                                            <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
                                            <td style={{ color: isOverdue ? '#ef4444' : undefined }}>
                                                {new Date(inv.dueDate).toLocaleDateString()}
                                            </td>
                                            <td>{formatCurrency(inv.subtotal)}</td>
                                            <td>{formatCurrency(inv.gstAmount)}</td>
                                            <td><strong>{formatCurrency(inv.total)}</strong></td>
                                            <td>{formatCurrency(inv.paidAmount)}</td>
                                            <td>
                                                <span className="finance-badge" style={{ background: `${STATUS_COLORS[inv.status]}20`, color: STATUS_COLORS[inv.status] }}>
                                                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="finance-actions">
                                                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                                        <button
                                                            className="finance-action-btn"
                                                            title="Record Payment"
                                                            onClick={() => setPaymentModal({ invoiceId: inv._id, total: inv.total, paid: inv.paidAmount })}
                                                        >
                                                            <CreditCard size={14} />
                                                        </button>
                                                    )}
                                                    {inv.status === 'draft' && (
                                                        <button className="finance-action-btn danger" title="Delete" onClick={() => { if (confirm('Delete this invoice?')) deleteInvoice(inv._id); }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {pagination && pagination.pages > 1 && (
                        <div className="finance-pagination">
                            {Array.from({ length: pagination.pages }, (_, i) => (
                                <button key={i} className={`finance-page-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Create Invoice Modal */}
            {showCreate && (
                <div className="finance-modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="finance-modal wide" onClick={(e) => e.stopPropagation()}>
                        <div className="finance-modal-header">
                            <h2>Create Invoice</h2>
                            <button className="finance-modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button>
                        </div>
                        <div className="finance-modal-body">
                            <div className="finance-form-grid">
                                <div className="finance-field">
                                    <label>Project ID</label>
                                    <input value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="Paste project ID" />
                                </div>
                                <div className="finance-field">
                                    <label>Client ID</label>
                                    <input value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="Paste client ID" />
                                </div>
                                <div className="finance-field">
                                    <label>Issue Date</label>
                                    <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
                                </div>
                                <div className="finance-field">
                                    <label>Due Date</label>
                                    <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                                </div>
                                <div className="finance-field">
                                    <label>GST Rate (%)</label>
                                    <input type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} />
                                </div>
                                <div className="finance-field">
                                    <label>TDS Rate (%)</label>
                                    <input type="number" value={form.tdsRate} onChange={(e) => setForm({ ...form, tdsRate: Number(e.target.value) })} />
                                </div>
                            </div>

                            {/* Line Items */}
                            <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Line Items</h3>
                            {form.items.map((item, idx) => (
                                <div key={idx} className="invoice-item-row">
                                    <input
                                        placeholder="Description"
                                        value={item.description}
                                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                        style={{ flex: 3 }}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Rate"
                                        value={item.rate}
                                        onChange={(e) => updateItem(idx, 'rate', Number(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                    <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>
                                        {formatCurrency(item.quantity * item.rate)}
                                    </span>
                                    {form.items.length > 1 && (
                                        <button className="finance-action-btn danger" onClick={() => removeItem(idx)}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button className="finance-btn-secondary" onClick={addItem} style={{ marginTop: '0.5rem' }}>
                                <Plus size={14} /> Add Item
                            </button>

                            {/* Totals */}
                            <div className="invoice-totals">
                                <div className="invoice-total-row"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                                <div className="invoice-total-row"><span>GST ({form.gstRate}%)</span><span>{formatCurrency(gst)}</span></div>
                                {(form.tdsRate || 0) > 0 && <div className="invoice-total-row"><span>TDS ({form.tdsRate}%)</span><span>-{formatCurrency(tds)}</span></div>}
                                <div className="invoice-total-row grand"><span>Total</span><span>{formatCurrency(total)}</span></div>
                            </div>
                        </div>
                        <div className="finance-modal-footer">
                            <button className="finance-btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="finance-btn-primary" onClick={handleCreate} disabled={creating || !form.projectId || !form.clientId || !form.dueDate}>
                                {creating ? 'Creating...' : 'Create Invoice'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {paymentModal && (
                <div className="finance-modal-overlay" onClick={() => setPaymentModal(null)}>
                    <div className="finance-modal" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
                        <div className="finance-modal-header">
                            <h2>Record Payment</h2>
                            <button className="finance-modal-close" onClick={() => setPaymentModal(null)}><X size={18} /></button>
                        </div>
                        <div className="finance-modal-body">
                            <p style={{ fontSize: '0.85rem', color: '#666' }}>
                                Total: <strong>{formatCurrency(paymentModal.total)}</strong> | Paid: <strong>{formatCurrency(paymentModal.paid)}</strong> | Balance: <strong>{formatCurrency(paymentModal.total - paymentModal.paid)}</strong>
                            </p>
                            <div className="finance-field" style={{ marginTop: '1rem' }}>
                                <label>Payment Amount</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                                    max={paymentModal.total - paymentModal.paid}
                                />
                            </div>
                        </div>
                        <div className="finance-modal-footer">
                            <button className="finance-btn-secondary" onClick={() => setPaymentModal(null)}>Cancel</button>
                            <button className="finance-btn-primary" onClick={handlePayment} disabled={paying || paymentAmount <= 0}>
                                {paying ? 'Processing...' : 'Record Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .finance-invoices { padding: 2rem; max-width: 1400px; margin: 0 auto; }
                .finance-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
                .finance-page-title { font-size: 1.75rem; font-weight: 700; color: var(--color-text, #111); margin: 0; }
                .finance-page-subtitle { color: var(--color-text-secondary, #666); margin: 0.25rem 0 0; font-size: 0.9rem; }
                .finance-btn-primary { display: flex; align-items: center; gap: 6px; padding: 0.6rem 1.2rem; border: none; border-radius: 8px; background: var(--color-primary, #3b82f6); color: white; font-weight: 600; font-size: 0.875rem; cursor: pointer; }
                .finance-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .finance-btn-secondary { display: flex; align-items: center; gap: 6px; padding: 0.6rem 1.2rem; border: 1px solid var(--color-border, #e5e7eb); border-radius: 8px; background: transparent; color: var(--color-text, #111); font-weight: 500; font-size: 0.875rem; cursor: pointer; }
                .finance-filters { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
                .finance-select { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb); border-radius: 8px; background: var(--color-surface, #fff); color: var(--color-text, #111); font-size: 0.875rem; cursor: pointer; }
                .overdue-alert { display: flex; align-items: center; gap: 8px; padding: 0.75rem 1rem; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; color: #ef4444; margin-bottom: 1.5rem; font-size: 0.85rem; }
                .finance-table-wrapper { overflow-x: auto; background: var(--color-surface, #fff); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
                .finance-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .finance-table th, .finance-table td { padding: 0.75rem 0.75rem; text-align: right; border-bottom: 1px solid var(--color-border, #e5e7eb); }
                .finance-table th { font-weight: 600; color: var(--color-text-secondary, #666); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .finance-table tbody tr:hover { background: var(--color-bg, #f9fafb); }
                .finance-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
                .finance-actions { display: flex; gap: 4px; justify-content: flex-end; }
                .finance-action-btn { width: 28px; height: 28px; border: 1px solid var(--color-border, #e5e7eb); border-radius: 6px; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary, #666); }
                .finance-action-btn:hover { background: var(--color-bg, #f3f4f6); }
                .finance-action-btn.danger:hover { background: #fef2f2; color: #ef4444; }
                .finance-pagination { display: flex; gap: 4px; justify-content: center; margin-top: 1.5rem; }
                .finance-page-btn { width: 32px; height: 32px; border: 1px solid var(--color-border, #e5e7eb); border-radius: 6px; background: var(--color-surface, #fff); color: var(--color-text, #111); cursor: pointer; font-size: 0.8rem; }
                .finance-page-btn.active { background: var(--color-primary, #3b82f6); color: white; border-color: transparent; }
                .finance-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; color: var(--color-text-secondary, #999); background: var(--color-surface, #fff); border-radius: 12px; }
                .finance-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 1rem; color: var(--color-text-secondary, #666); }
                .finance-spinner { width: 32px; height: 32px; border: 3px solid var(--color-border, #e5e7eb); border-top-color: var(--color-primary, #3b82f6); border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .finance-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
                .finance-modal { background: var(--color-surface, #fff); border-radius: 16px; width: 580px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
                .finance-modal.wide { width: 720px; }
                .finance-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border, #e5e7eb); }
                .finance-modal-header h2 { margin: 0; font-size: 1.1rem; font-weight: 600; }
                .finance-modal-close { background: none; border: none; cursor: pointer; color: var(--color-text-secondary, #666); }
                .finance-modal-body { padding: 1.5rem; }
                .finance-modal-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding: 1rem 1.5rem; border-top: 1px solid var(--color-border, #e5e7eb); }
                .finance-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .finance-field { display: flex; flex-direction: column; gap: 4px; }
                .finance-field label { font-size: 0.8rem; font-weight: 500; color: var(--color-text-secondary, #666); }
                .finance-field input, .finance-field select { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb); border-radius: 8px; font-size: 0.875rem; background: var(--color-surface, #fff); color: var(--color-text, #111); }
                .invoice-item-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
                .invoice-item-row input { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb); border-radius: 8px; font-size: 0.85rem; }
                .invoice-totals { margin-top: 1.5rem; border-top: 1px solid var(--color-border, #e5e7eb); padding-top: 1rem; }
                .invoice-total-row { display: flex; justify-content: space-between; padding: 0.3rem 0; font-size: 0.85rem; }
                .invoice-total-row.grand { border-top: 2px solid var(--color-text, #111); margin-top: 0.5rem; padding-top: 0.5rem; font-weight: 700; font-size: 1rem; }
            `}</style>
        </div>
    );
}
