import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { 
    useCreateRevenueMutation, 
    useUpdateRevenueMutation, 
    type Revenue 
} from '@/features/finance';
import ModalPortal from '@/components/ui/ModalPortal';
import { logger } from '@/utils/logger';
import { formatCurrency } from '@/features/finance/utils/currency';

export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

export interface RevenueFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingRevenue: Revenue | null;
}

type RevenueSource = 'manual' | 'invoice' | 'project';
type RevenueStatus = 'received' | 'pending' | 'partial' | 'overdue';

interface RevenueFormData {
    date: string;
    description: string;
    client: string;
    project?: string;
    amount: number;
    currency: Currency;
    exchangeRate: number;
    gstApplicable: boolean;
    gstRate: number;
    tdsDeducted: number;
    receivedAmount: number;
    source: RevenueSource;
    status: RevenueStatus;
    invoiceNumber?: string;
    dueDate?: string;
    notes?: string;
}

const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
];

const initialFormState: RevenueFormData = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    client: '',
    project: '',
    amount: 0,
    currency: 'INR',
    exchangeRate: 1,
    gstApplicable: true,
    gstRate: 18,
    tdsDeducted: 0,
    receivedAmount: 0,
    source: 'manual',
    status: 'pending',
    invoiceNumber: '',
    dueDate: '',
    notes: '',
};

export const RevenueFormModal: React.FC<RevenueFormModalProps> = ({ isOpen, onClose, editingRevenue }) => {
    const [formData, setFormData] = useState<RevenueFormData>(() => {
        if (editingRevenue) {
            return {
                ...initialFormState,
                ...editingRevenue,
                date: editingRevenue.date?.split('T')[0] || new Date().toISOString().split('T')[0],
                dueDate: editingRevenue.dueDate?.split('T')[0] || '',
            };
        }
        return initialFormState;
    });

    const [createRevenue, { isLoading: isCreating }] = useCreateRevenueMutation();
    const [updateRevenue, { isLoading: isUpdating }] = useUpdateRevenueMutation();

    const formAmountINR = formData.currency === 'INR' ? formData.amount : formData.amount * formData.exchangeRate;
    const formGst = formData.gstApplicable ? (formAmountINR * formData.gstRate) / 100 : 0;
    const formTotalAmount = formAmountINR + formGst - formData.tdsDeducted;

    const handleSubmit = async () => {
        try {
            const payload = {
                ...formData,
                project: formData.project || undefined,
                invoiceNumber: formData.invoiceNumber || undefined,
                dueDate: formData.dueDate || undefined,
                notes: formData.notes || undefined,
            };

            if (editingRevenue) {
                await updateRevenue({ id: editingRevenue._id, ...payload }).unwrap();
            } else {
                await createRevenue(payload).unwrap();
            }
            onClose();
        } catch (error) {
            logger.error('Failed to save revenue:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <ModalPortal>
            <div className="w-full max-w-2xl rounded-xl shadow-xl max-h-[90vh] overflow-y-auto bg-white">
                <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 border-gray-200 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {editingRevenue ? 'Edit Revenue Entry' : 'Add Revenue Entry'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block text-gray-700">Date *</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block text-gray-700">Invoice Number</label>
                            <input
                                type="text"
                                placeholder="INV-2025-001"
                                value={formData.invoiceNumber}
                                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block text-gray-700">Description *</label>
                        <input
                            type="text"
                            placeholder="Enter description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block text-gray-700">Client Name *</label>
                            <input
                                type="text"
                                placeholder="Enter client name"
                                value={formData.client}
                                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block text-gray-700">Project (Optional)</label>
                            <input
                                type="text"
                                placeholder="Enter project name"
                                value={formData.project}
                                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                            />
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-gray-50">
                        <h3 className="text-sm font-semibold mb-3 text-gray-700">Amount Details</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block text-gray-700">Currency</label>
                                <select
                                    value={formData.currency}
                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency, exchangeRate: e.target.value === 'INR' ? 1 : formData.exchangeRate })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                                >
                                    {CURRENCIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block text-gray-700">Amount</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={formData.amount || ''}
                                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                                />
                            </div>
                            {formData.currency !== 'INR' && (
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block text-gray-700">Exchange Rate</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="1.00"
                                        value={formData.exchangeRate || ''}
                                        onChange={(e) => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 rounded-lg bg-gray-50">
                        <h3 className="text-sm font-semibold mb-3 text-gray-700">Tax Details</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium mb-1.5 text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={formData.gstApplicable}
                                        onChange={(e) => setFormData({ ...formData, gstApplicable: e.target.checked })}
                                        className="rounded"
                                    />
                                    GST Applicable
                                </label>
                                {formData.gstApplicable && (
                                    <select
                                        value={formData.gstRate}
                                        onChange={(e) => setFormData({ ...formData, gstRate: parseFloat(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-lg border text-sm mt-1 border-gray-200 bg-white text-gray-700"
                                    >
                                        <option value={5}>5%</option>
                                        <option value={12}>12%</option>
                                        <option value={18}>18%</option>
                                        <option value={28}>28%</option>
                                    </select>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block text-gray-700">GST Amount</label>
                                <input
                                    type="text"
                                    value={formatCurrency(formGst)}
                                    disabled
                                    className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-gray-100 text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block text-gray-700">TDS Deducted</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={formData.tdsDeducted || ''}
                                    onChange={(e) => setFormData({ ...formData, tdsDeducted: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                                />
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="flex justify-between">
                                <span className="text-sm font-semibold text-gray-700">Total Amount (INR)</span>
                                <span className="text-lg font-bold text-green-500">{formatCurrency(formTotalAmount)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block text-gray-700">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value as RevenueStatus })}
                                className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                            >
                                <option value="pending">Pending</option>
                                <option value="partial">Partial</option>
                                <option value="received">Received</option>
                                <option value="overdue">Overdue</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block text-gray-700">Received Amount</label>
                            <input
                                type="number"
                                placeholder="0"
                                value={formData.receivedAmount || ''}
                                onChange={(e) => setFormData({ ...formData, receivedAmount: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block text-gray-700">Due Date</label>
                        <input
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border text-sm border-gray-200 bg-white text-gray-700"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1.5 block text-gray-700">Notes</label>
                        <textarea
                            rows={3}
                            placeholder="Add any additional notes..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border text-sm resize-none border-gray-200 bg-white text-gray-700"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t sticky bottom-0 border-gray-200 bg-white">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-50 border border-gray-200 text-gray-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isCreating || isUpdating || !formData.description || !formData.client || !formData.amount}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 text-white bg-[var(--color-primary)]"
                    >
                        {(isCreating || isUpdating) && <Loader2 size={16} className="animate-spin" />}
                        {editingRevenue ? 'Update Entry' : 'Add Entry'}
                    </button>
                </div>
            </div>
        </ModalPortal>
    );
};
