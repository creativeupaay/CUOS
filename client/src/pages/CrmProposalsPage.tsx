import { useState } from 'react';
import {
    Plus,
    Search,
    FileText,
    Download,
    Eye,
    Send,
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    Calendar,
} from 'lucide-react';
import { useGetProposalsQuery, useUpdateProposalStatusMutation } from '@/features/crm';

const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'var(--color-bg-subtle)', text: 'var(--color-text-secondary)' },
    sent: { bg: '#E0E7FF', text: '#4338CA' },
    viewed: { bg: '#F3E8FF', text: '#7E22CE' },
    accepted: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
    rejected: { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
    expired: { bg: '#F3F4F6', text: '#9CA3AF' },
};

export default function CrmProposalsPage() {
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');

    const queryParams: any = {};
    if (statusFilter) queryParams.status = statusFilter;
    if (search) queryParams.search = search;

    const { data, isLoading, error } = useGetProposalsQuery(queryParams);
    const [updateStatus] = useUpdateProposalStatusMutation();

    const proposals = data?.data.proposals || [];

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const handleStatusUpdate = async (id: string, newStatus: any) => {
        try {
            await updateStatus({ id, data: { status: newStatus } }).unwrap();
        } catch (error) {
            console.error('Failed to update status:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <Loader2 className="animate-spin text-gray-500 mr-2" />
                <span className="text-gray-500">Loading proposals...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)] text-red-500">
                <AlertCircle className="mr-2" />
                Error loading proposals
            </div>
        );
    }

    return (
        <div className="px-8 py-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage and track your proposals
                    </p>
                </div>
                <button
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                    <Plus size={18} />
                    New Proposal
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search proposals..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="viewed">Viewed</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                </select>
            </div>

            {/* Proposals List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Proposal</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Lead / Client</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Value</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {proposals.map((proposal) => (
                            <tr key={proposal._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{proposal.title}</p>
                                            <p className="text-xs text-gray-500">ID: {proposal._id.slice(-6).toUpperCase()}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-900">
                                        {(proposal.clientId as any)?.name || (proposal.leadId as any)?.name || 'Unknown'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {(proposal.clientId as any) ? 'Client' : 'Lead'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-medium text-gray-900">
                                        {formatCurrency(proposal.total, proposal.currency)}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <Calendar size={14} />
                                        {new Date(proposal.createdAt).toLocaleDateString()}
                                    </div>
                                    {proposal.validUntil && (
                                        <p className="text-xs text-red-500 mt-1">
                                            Expires {new Date(proposal.validUntil).toLocaleDateString()}
                                        </p>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                                        style={{
                                            backgroundColor: statusColors[proposal.status]?.bg || '#f3f4f6',
                                            color: statusColors[proposal.status]?.text || '#6b7280'
                                        }}
                                    >
                                        {proposal.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 text-gray-400">
                                        {proposal.status === 'draft' && (
                                            <button
                                                onClick={() => handleStatusUpdate(proposal._id, 'sent')}
                                                className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                                                title="Mark as Sent"
                                            >
                                                <Send size={16} />
                                            </button>
                                        )}
                                        {proposal.status === 'sent' && (
                                            <>
                                                <button
                                                    onClick={() => handleStatusUpdate(proposal._id, 'accepted')}
                                                    className="p-1.5 hover:bg-green-50 hover:text-green-600 rounded-lg transition-colors"
                                                    title="Mark as Accepted"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(proposal._id, 'rejected')}
                                                    className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                    title="Mark as Rejected"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            </>
                                        )}
                                        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="View Details">
                                            <Eye size={16} />
                                        </button>
                                        <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Download PDF">
                                            <Download size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {proposals.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                            <FileText size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-sm font-medium text-gray-900">No proposals found</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Create a new proposal to get started
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
