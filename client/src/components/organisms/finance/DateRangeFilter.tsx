import React from 'react';
import { Calendar } from 'lucide-react';
import { getCurrentFiscalYearRange, getPreviousFiscalYearRange, toDateInputValue } from '@/lib/utils/date';

export type DateRange = {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
};

interface DateRangeFilterProps {
    dateRange: DateRange;
    onDateRangeChange: (range: DateRange) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ dateRange, onDateRangeChange }) => {

    const handleQuickSelect = (type: 'current_fy' | 'previous_fy') => {
        let range;
        if (type === 'current_fy') {
            range = getCurrentFiscalYearRange();
        } else {
            range = getPreviousFiscalYearRange();
        }
        onDateRangeChange({
            startDate: toDateInputValue(range.startDate),
            endDate: toDateInputValue(range.endDate)
        });
    };

    return (
        <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center p-4 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                <Calendar size={16} />
                <span>Date Range:</span>
            </div>
            
            <div className="flex items-center gap-2">
                <input 
                    type="date" 
                    value={dateRange.startDate}
                    onChange={(e) => onDateRangeChange({ ...dateRange, startDate: e.target.value })}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                />
                <span className="text-gray-400">to</span>
                <input 
                    type="date" 
                    value={dateRange.endDate}
                    onChange={(e) => onDateRangeChange({ ...dateRange, endDate: e.target.value })}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                />
            </div>

            <div className="flex gap-2 ml-auto">
                <button 
                    onClick={() => handleQuickSelect('previous_fy')}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                    Prev FY
                </button>
                <button 
                    onClick={() => handleQuickSelect('current_fy')}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                >
                    Current FY
                </button>
            </div>
        </div>
    );
};
