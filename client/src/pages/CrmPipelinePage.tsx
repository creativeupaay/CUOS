import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    LayoutDashboard,
    List,
    DollarSign,
    Calendar,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import { useGetLeadsQuery } from '@/features/crm';

const stages = [
    { id: 'new', label: 'New', color: 'var(--color-info)' },
    { id: 'contacted', label: 'Contacted', color: 'var(--color-warning)' },
    { id: 'qualified', label: 'Qualified', color: 'var(--color-success)' },
    { id: 'proposal-sent', label: 'Proposal', color: '#4338CA' },
    { id: 'negotiation', label: 'Negotiation', color: '#7E22CE' },
    { id: 'won', label: 'Won', color: 'var(--color-success-dark)' },
    { id: 'lost', label: 'Lost', color: 'var(--color-danger)' },
];

export default function CrmPipelinePage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');

    const { data, isLoading, error } = useGetLeadsQuery({ limit: 100, search });
    const leads = data?.data.leads || [];

    const columns = stages.map((stage) => {
        const stageLeads = leads.filter((lead) => lead.stage === stage.id);
        const totalValue = stageLeads.reduce((sum, lead) => sum + (lead.estimatedValue || 0), 0);
        return {
            ...stage,
            leads: stageLeads,
            totalValue,
            count: stageLeads.length,
        };
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            compactDisplay: 'short',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)]">
                <Loader2 className="animate-spin text-gray-500 mr-2" />
                <span className="text-gray-500">Loading pipeline...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-64px)] text-red-500">
                <AlertCircle className="mr-2" />
                Error loading pipeline
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            {/* Header */}
            <div className="flex-none px-6 py-4 bg-white border-b border-gray-200">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">Deals Pipeline</h1>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search deals..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                            <button
                                onClick={() => navigate('/crm/leads')}
                                className="p-2 rounded hover:bg-white text-gray-500"
                                title="List View"
                            >
                                <List size={18} />
                            </button>
                            <button
                                className="p-2 rounded bg-white shadow-sm text-primary"
                                title="Pipeline View"
                            >
                                <LayoutDashboard size={18} />
                            </button>
                        </div>
                        <button
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            onClick={() => navigate('/crm/leads/new')}
                        >
                            <Plus size={16} />
                            New Deal
                        </button>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto p-6 bg-gray-50">
                <div className="flex h-full gap-6 min-w-max">
                    {columns.map((column) => (
                        <div key={column.id} className="flex flex-col w-80 h-full rounded-xl bg-gray-100/50 border border-gray-200">
                            {/* Column Header */}
                            <div className="p-3 border-b border-gray-200 bg-white rounded-t-xl">
                                <div className="flex justify-between items-center mb-1">
                                    <span
                                        className="text-xs font-semibold px-2 py-1 rounded-full uppercase"
                                        style={{ backgroundColor: `${column.color}20`, color: column.color }}
                                    >
                                        {column.label}
                                    </span>
                                    <span className="text-xs text-gray-500 font-medium">{column.count}</span>
                                </div>
                                <div className="text-xs text-gray-500 font-medium px-1">
                                    {formatCurrency(column.totalValue)}
                                </div>
                            </div>

                            {/* Cards Container */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-3">
                                {column.leads.map((lead) => (
                                    <div
                                        key={lead._id}
                                        onClick={() => navigate(`/crm/leads/${lead._id}`)}
                                        className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                                    >
                                        <div className="mb-2">
                                            <h3 className="font-medium text-sm text-gray-900 line-clamp-2">{lead.name}</h3>
                                            {lead.company && <p className="text-xs text-gray-500 truncate">{lead.company}</p>}
                                        </div>

                                        <div className="flex justify-between items-center text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                                            <div className="flex items-center gap-1">
                                                <DollarSign size={12} />
                                                <span className="font-medium text-gray-700">
                                                    {formatCurrency(lead.estimatedValue || 0)}
                                                </span>
                                            </div>
                                            {lead.expectedCloseDate && (
                                                <div className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    <span>
                                                        {new Date(lead.expectedCloseDate).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                        })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500">
                                                    {(lead.assignedTo as any)?.name?.[0] || 'U'}
                                                </div>
                                            </div>
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{
                                                    backgroundColor:
                                                        lead.priority === 'critical' ? 'var(--color-danger)' :
                                                            lead.priority === 'high' ? '#EA580C' :
                                                                lead.priority === 'medium' ? 'var(--color-warning)' :
                                                                    'var(--color-success)',
                                                }}
                                                title={`Priority: ${lead.priority}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {column.leads.length === 0 && (
                                    <div className="text-center py-8 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                                        No deals
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
