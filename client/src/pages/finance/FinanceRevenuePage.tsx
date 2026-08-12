import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { 
    useGetRevenuesQuery, 
    useRevenueMetrics,
    useDeleteRevenueMutation,
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
import type { RevenueSourceFilter } from '@/components/organisms/finance/RevenueFilters';
import { getCurrentFiscalYearRange, toDateInputValue } from '@/lib/utils/date';
import { Loader2, Trash2 } from 'lucide-react';
import { logger } from '@/utils/logger';

const FinanceRevenuePage: React.FC = () => {
    // State for filters
    const [searchQuery, setSearchQuery] = useState('');
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
        source: filterSource === 'all' ? undefined : filterSource,
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined
    });

    const revenues = revenuesData?.data?.revenues || [];
    
    // Checkbox and Delete state
    const [selectedRevenueIds, setSelectedRevenueIds] = useState<string[]>([]);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [deleteRevenueMutation] = useDeleteRevenueMutation();

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRevenueIds(revenues.map(r => r._id));
        } else {
            setSelectedRevenueIds([]);
        }
    };

    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedRevenueIds(prev => [...prev, id]);
        } else {
            setSelectedRevenueIds(prev => prev.filter(rId => rId !== id));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRevenueIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedRevenueIds.length} revenue entries?`)) return;

        setIsBulkDeleting(true);
        try {
            await Promise.all(selectedRevenueIds.map(id => deleteRevenueMutation(id).unwrap()));
            setSelectedRevenueIds([]);
        } catch (error) {
            logger.error('Failed to delete revenues:', error);
            alert('Failed to delete some entries. Please try again.');
        } finally {
            setIsBulkDeleting(false);
        }
    };
    
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
                    filterSource={filterSource}
                    onFilterSourceChange={setFilterSource}
                />

                {selectedRevenueIds.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center">
                        <button
                            type="button"
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60"
                        >
                            {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Delete Selected ({selectedRevenueIds.length})
                        </button>
                    </div>
                )}

                <RevenueList
                    revenues={revenues}
                    isLoading={isLoading}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    selectedIds={selectedRevenueIds}
                    onSelectAll={handleSelectAll}
                    onSelect={handleSelect}
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
