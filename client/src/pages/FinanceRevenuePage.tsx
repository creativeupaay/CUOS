import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { 
    useGetRevenuesQuery, 
    useRevenueMetrics,
    type Revenue
} from '@/features/finance';
import { 
    MetricCardSet, 
    RevenueFilters, 
    RevenueList, 
    RevenueFormModal, 
    DeleteRevenueModal,
    DateRangeFilter,
    type DateRange
} from '@/components/organisms/finance';
import type { RevenueStatusFilter, RevenueSourceFilter } from '@/components/organisms/finance/RevenueFilters';
import { getCurrentFiscalYearRange, toDateInputValue } from '@/lib/utils/date';

const FinanceRevenuePage: React.FC = () => {
    // State for filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<RevenueStatusFilter>('all');
    const [filterSource, setFilterSource] = useState<RevenueSourceFilter>('all');
    
    // Default to current fiscal year
    const [dateRange, setDateRange] = useState<DateRange>(() => {
        const fy = getCurrentFiscalYearRange();
        return {
            startDate: toDateInputValue(fy.startDate),
            endDate: toDateInputValue(fy.endDate)
        };
    });

    // State for Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [revenueToDelete, setRevenueToDelete] = useState<Revenue | null>(null);

    // Queries
    const { data: revenuesData, isLoading } = useGetRevenuesQuery({ 
        search: searchQuery || undefined, 
        status: filterStatus === 'all' ? undefined : filterStatus,
        source: filterSource === 'all' ? undefined : filterSource,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined
    });

    const revenues = revenuesData?.data?.revenues || [];
    
    // Metrics hook
    const metricCards = useRevenueMetrics(revenues);

    // Handlers
    const handleEdit = (revenue: Revenue) => {
        setEditingRevenue(revenue);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingRevenue(null);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (revenue: Revenue) => {
        setRevenueToDelete(revenue);
        setIsDeleteModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingRevenue(null);
    };

    const handleCloseDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setRevenueToDelete(null);
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Revenue Management</h1>
                    <p className="text-sm text-gray-500 mt-1">Track and manage your project income and invoices</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold shadow-sm transition-all hover:opacity-90 active:scale-95"
                >
                    <Plus size={18} />
                    Add Revenue Entry
                </button>
            </div>

            {/* Metrics */}
            <MetricCardSet cards={metricCards} />

            {/* Content Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
                
                <RevenueFilters
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    filterStatus={filterStatus}
                    onFilterStatusChange={setFilterStatus}
                    filterSource={filterSource}
                    onFilterSourceChange={setFilterSource}
                />

                <RevenueList
                    revenues={revenues}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                />
            </div>

            {/* Modals */}
            <RevenueFormModal
                key={isModalOpen ? (editingRevenue?._id || 'new') : 'closed'}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                editingRevenue={editingRevenue}
            />

            <DeleteRevenueModal
                isOpen={isDeleteModalOpen}
                onClose={handleCloseDeleteModal}
                revenue={revenueToDelete}
            />
        </div>
    );
};

export default FinanceRevenuePage;
