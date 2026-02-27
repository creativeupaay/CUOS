import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    MoreVertical,
    Phone,
    Mail,
    Building,
    Calendar,
    Loader2,
    AlertCircle,
    LayoutDashboard,
    List,
    Lock,
} from 'lucide-react';
import { useGetLeadsQuery, useGetPipelineSummaryQuery } from '@/features/crm';

const stageColors: Record<string, { bg: string; text: string }> = {
    new: { bg: 'var(--color-info-soft)', text: 'var(--color-info)' },
    contacted: { bg: 'var(--color-warning-soft)', text: 'var(--color-warning)' },
    qualified: { bg: 'var(--color-success-soft)', text: 'var(--color-success)' },
    'proposal-sent': { bg: '#E0E7FF', text: '#4338CA' },
    negotiation: { bg: '#F3E8FF', text: '#7E22CE' },
    closed: { bg: 'var(--color-success)', text: '#FFFFFF' },
    pending: { bg: '#FEF3C7', text: '#92400E' },
    'lead-lost': { bg: 'var(--color-danger-soft)', text: 'var(--color-danger)' },
    'follow-up': { bg: '#DBEAFE', text: '#1D4ED8' },
};

const priorityColors: Record<string, string> = {
    critical: 'var(--color-danger)',
    high: '#EA580C',
    medium: 'var(--color-warning)',
    low: 'var(--color-success)',
};

export default function CrmLeadsPage() {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');
    const [filters, setFilters] = useState({
        search: '',
        stage: '',
        priority: '',
    });

    // Determine query params (debounced search handled by user typing pause effectively in simple implementations, or just pass directly)
    const queryParams: any = {};
    if (filters.search) queryParams.search = filters.search;
    if (filters.stage) queryParams.stage = filters.stage;
    if (filters.priority) queryParams.priority = filters.priority;

    const { data, isLoading, error } = useGetLeadsQuery(queryParams);
    const { data: pipelineData } = useGetPipelineSummaryQuery();

    const leads = data?.data.leads || [];
    const summary = pipelineData?.data;

    // Format currency
    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    <Loader2 size={18} className="animate-spin" />
                    Loading leads...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]" style={{ backgroundColor: 'var(--color-bg-app)' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
                    <AlertCircle size={18} />
                    Error loading leads
                </div>
            </div>
        );
    }

    return (
        <div className="px-8 py-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        CRM & Leads
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        Manage your sales pipeline and customer relationships
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white rounded-lg border p-1" style={{ borderColor: 'var(--color-border-default)' }}>
                        <button
                            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
                            onClick={() => setViewMode('list')}
                            title="List View"
                        >
                            <List size={18} style={{ color: 'var(--color-text-primary)' }} />
                        </button>
                        <button
                            className={`p-2 rounded-md transition-colors ${viewMode === 'pipeline' ? 'bg-gray-100' : ''}`}
                            onClick={() => navigate('/crm/pipeline')} // Navigate to separate pipeline page for Kanban
                            title="Pipeline View"
                        >
                            <LayoutDashboard size={18} style={{ color: 'var(--color-text-primary)' }} />
                        </button>
                    </div>
                    <button
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg btn-premium"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                        onClick={() => navigate('/crm/leads/new')}
                    >
                        <Plus size={18} />
                        New Lead
                    </button>
                </div>
            </div>

            {/* Pipeline Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Leads', value: summary.totalLeads, subtext: 'All stages' },
                        { label: 'Pipeline Value', value: formatCurrency(summary.totalValue, 'INR'), subtext: 'Total estimated value' },
                        { label: 'New Leads', value: summary.stages.find(s => s.stage === 'new')?.count || 0, subtext: 'Needs attention' },
                        { label: 'Closed Deals', value: summary.stages.find(s => s.stage === 'closed')?.count || 0, subtext: 'Successfully closed' }
                    ].map((card, idx) => (
                        <div key={idx} className="p-4 rounded-[1rem] bg-white shadow-premium border-0">
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{card.label}</p>
                            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>{card.value}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{card.subtext}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} style={{ color: 'var(--color-text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Search leads, companies, emails..."
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border outline-none focus:ring-2 transition-all"
                        style={{
                            borderColor: 'var(--color-border-default)',
                            backgroundColor: 'var(--color-bg-surface)',
                            color: 'var(--color-text-primary)',
                            // focus ring color would be var(--color-primary-soft) usually
                        }}
                    />
                </div>
                <select
                    value={filters.stage}
                    onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
                    className="px-4 py-2.5 rounded-lg border outline-none bg-white min-w-[150px]"
                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                >
                    <option value="">All Stages</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="proposal-sent">Proposal Sent</option>
                    <option value="negotiation">Negotiation</option>
                    <option value="closed">Closed</option>
                    <option value="pending">Pending</option>
                    <option value="lead-lost">Lead Lost</option>
                    <option value="follow-up">Follow Up</option>
                </select>
                <select
                    value={filters.priority}
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                    className="px-4 py-2.5 rounded-lg border outline-none bg-white min-w-[150px]"
                    style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
                >
                    <option value="">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>

            {/* Leads List Table */}
            <div className="bg-white rounded-[1rem] shadow-premium overflow-hidden border-0">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'var(--color-bg-subtle)' }}>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Lead Info</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Contact</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Value</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Priority</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>Created</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-border-default)' }}>
                        {leads.map((lead) => (
                            <tr
                                key={lead._id}
                                className="group hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => navigate(`/crm/leads/${lead._id}`)}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm" style={{ color: 'var(--color-text-primary)' }}>{lead.name}</span>
                                        {lead.company && (
                                            <span className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                <Building size={12} />
                                                {lead.company}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                            <Mail size={12} />
                                            {lead.email}
                                        </div>
                                        {lead.phone && (
                                            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                                <Phone size={12} />
                                                {lead.phone}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {lead.estimatedValue ? (
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                            {formatCurrency(lead.estimatedValue, lead.currency)}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                                        style={{
                                            backgroundColor: stageColors[lead.stage]?.bg || '#f3f4f6',
                                            color: stageColors[lead.stage]?.text || '#6b7280'
                                        }}
                                    >
                                        {lead.stage.replace(/-/g, ' ')}
                                    </span>
                                    {lead.isLocked && (
                                        <span title="Lead is locked">
                                            <Lock size={12} className="ml-1.5 text-gray-400 inline" />
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: priorityColors[lead.priority] }}
                                        />
                                        <span className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                                            {lead.priority}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                        <Calendar size={12} />
                                        {new Date(lead.createdAt).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <MoreVertical size={16} className="text-gray-400 group-hover:text-gray-600" />
                                </td>
                            </tr>
                        ))}
                        {leads.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                            <Search size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>No leads found</p>
                                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                            Try adjusting your filters or create a new lead
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination (Simplified for now) */}
            {/* <div className="flex justify-between items-center mt-4">
                 Pagination controls would go here
            </div> */}
        </div>
    );
}
