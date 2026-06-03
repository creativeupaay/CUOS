import React from 'react';
import { Search } from 'lucide-react';

export type RevenueStatusFilter = 'all' | 'received' | 'pending' | 'partial' | 'overdue';
export type RevenueSourceFilter = 'all' | 'manual' | 'invoice' | 'project';

export interface RevenueFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    filterStatus: RevenueStatusFilter;
    onFilterStatusChange: (value: RevenueStatusFilter) => void;
    filterSource: RevenueSourceFilter;
    onFilterSourceChange: (value: RevenueSourceFilter) => void;
}

export const RevenueFilters: React.FC<RevenueFiltersProps> = ({
    searchQuery,
    onSearchChange,
    filterStatus,
    onFilterStatusChange,
    filterSource,
    onFilterSourceChange,
}) => {
    return (
        <div className="rounded-xl border p-4" style={{ backgroundColor: 'white', borderColor: 'var(--color-border-default)' }}>
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                    <input
                        type="text"
                        placeholder="Search by description, client, or invoice..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm"
                        style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => onFilterStatusChange(e.target.value as RevenueStatusFilter)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                >
                    <option value="all">All Status</option>
                    <option value="received">Received</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="overdue">Overdue</option>
                </select>
                <select
                    value={filterSource}
                    onChange={(e) => onFilterSourceChange(e.target.value as RevenueSourceFilter)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: '#E5E7EB', backgroundColor: 'white', color: '#374151' }}
                >
                    <option value="all">All Sources</option>
                    <option value="manual">Manual</option>
                    <option value="invoice">Invoice</option>
                    <option value="project">Project</option>
                </select>
            </div>
        </div>
    );
};
