import React from 'react';
import { Calendar, Building2, Edit2, Trash2, Loader2, Receipt } from 'lucide-react';
import { type Revenue, formatCurrency } from '@/features/finance';

export interface RevenueListProps {
    revenues: Revenue[];
    isLoading: boolean;
    onEdit: (revenue: Revenue) => void;
    onDelete: (revenue: Revenue) => void;
    selectedIds: string[];
    onSelectAll: (checked: boolean) => void;
    onSelect: (id: string, checked: boolean) => void;
}

const EmptyState = () => (
    <div className="text-center py-12">
        <Receipt size={48} className="mx-auto mb-3 text-gray-400" />
        <p className="text-sm text-gray-500">No revenue entries found</p>
        <p className="text-xs mt-1 text-gray-400">Add your first revenue entry to get started</p>
    </div>
);

export const RevenueList: React.FC<RevenueListProps> = ({ revenues, isLoading, onEdit, onDelete, selectedIds, onSelectAll, onSelect }) => {
    if (isLoading) {
        return (
            <div className="rounded-xl border bg-white border-[var(--color-border-default)]">
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                </div>
            </div>
        );
    }

    if (!revenues.length) {
        return (
            <div className="rounded-xl border bg-white border-[var(--color-border-default)]">
                <EmptyState />
            </div>
        );
    }

    return (
        <div className="rounded-xl border overflow-hidden bg-white border-[var(--color-border-default)]">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="text-left w-12 px-5 py-3">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={revenues.length > 0 && selectedIds.length === revenues.length}
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                            <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Client</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Total Amount (INR)</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Received</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">TDS</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">GST</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Amount (without GST)</th>
                            <th className="text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {revenues.map((entry: Revenue, index: number) => (
                            <tr
                                key={entry._id}
                                className={`transition-colors hover:bg-gray-50 ${index > 0 ? 'border-t border-gray-200' : ''}`}
                            >
                                <td className="px-5 py-3">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300"
                                        checked={selectedIds.includes(entry._id)}
                                        onChange={(e) => onSelect(entry._id, e.target.checked)}
                                    />
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span className="text-sm text-gray-500">
                                            {new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                        <Building2 size={14} className="text-gray-400" />
                                        <div>
                                            <p className="text-sm text-gray-900">{entry.client}</p>
                                            {entry.project && <p className="text-xs text-gray-400">{entry.project}</p>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-3 text-sm text-right font-semibold text-gray-900">
                                    {formatCurrency(entry.totalAmount || entry.amountINR || entry.amount)}
                                </td>
                                <td className="px-5 py-3 text-sm text-right font-semibold text-green-500">
                                    {formatCurrency(entry.receivedAmount || 0)}
                                </td>
                                <td className="px-5 py-3 text-sm text-right text-gray-400">
                                    {formatCurrency(entry.tdsDeducted || 0)}
                                </td>
                                <td className="px-5 py-3 text-sm text-right text-gray-400">
                                    {formatCurrency(entry.gst || 0)}
                                </td>
                                <td className="px-5 py-3 text-sm text-right text-gray-900">
                                    {formatCurrency(entry.amountINR || entry.amount || 0)}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => onEdit(entry)}
                                            className="p-1.5 rounded-md transition-colors hover:bg-gray-100 text-gray-400"
                                            title="Edit"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(entry)}
                                            className="p-1.5 rounded-md transition-colors hover:bg-red-50 text-gray-400"
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
        </div>
    );
};
