import { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, IndianRupee, Wallet,
    Receipt, Calendar, ChevronDown, Filter, Loader2,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, LineChart, Line, ReferenceLine, Cell,
} from 'recharts';
import { useGetFinanceDashboardQuery } from '@/features/finance/api/financeApi';

// ── Types ─────────────────────────────────────────────────────────────────
type FilterType = 'fiscal-year' | 'quarter' | 'month' | 'custom';

interface FiscalYear {
    label: string;
    value: string;
    startDate: Date;
    endDate: Date;
}

// ── Fiscal Year Utilities ─────────────────────────────────────────────────
const generateFiscalYears = (): FiscalYear[] => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const fiscalYears: FiscalYear[] = [];

    // Generate last 5 fiscal years
    for (let i = 0; i < 5; i++) {
        const startYear = currentMonth >= 3 ? currentYear - i : currentYear - i - 1;
        const endYear = startYear + 1;
        fiscalYears.push({
            label: `FY ${startYear}-${endYear.toString().slice(-2)}`,
            value: `${startYear}-${endYear}`,
            startDate: new Date(startYear, 3, 1), // April 1st
            endDate: new Date(endYear, 2, 31), // March 31st
        });
    }
    return fiscalYears;
};

const FISCAL_YEARS = generateFiscalYears();
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const QUARTERS = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];

// ── Format Currency ───────────────────────────────────────────────────────
const formatCurrency = (value: number) => {
    if (value >= 10000000) return `${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(2)} L`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)} K`;
    return value.toLocaleString('en-IN');
};

const formatFullCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(value);
};

// ── Custom Tooltip ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div
                className="rounded-lg border p-3 shadow-lg"
                style={{
                    backgroundColor: 'white',
                    borderColor: '#E5E7EB',
                }}
            >
                <p className="font-semibold mb-2" style={{ color: '#111827' }}>{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {formatFullCurrency(entry.value)}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// ── Empty State Component ─────────────────────────────────────────────────
const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12">
        <Receipt size={48} className="mb-3" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
    </div>
);

export default function FinanceDashboardPage() {
    const [filterType, setFilterType] = useState<FilterType>('fiscal-year');
    const [selectedFiscalYear, setSelectedFiscalYear] = useState(FISCAL_YEARS[0].value);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedQuarter, setSelectedQuarter] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.filter-dropdown-container')) {
                setShowFilterDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Build filter params for API
    const getFilterParams = () => {
        const currentYear = new Date().getFullYear();
        const currentMonthIndex = new Date().getMonth();
        const fyStartYear = currentMonthIndex >= 3 ? currentYear : currentYear - 1;

        if (filterType === 'fiscal-year') {
            const fy = FISCAL_YEARS.find(f => f.value === selectedFiscalYear);
            if (fy) {
                return {
                    startDate: fy.startDate.toISOString(),
                    endDate: fy.endDate.toISOString(),
                };
            }
        }

        if (filterType === 'month' && selectedMonth) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.indexOf(selectedMonth);
            const year = monthIndex >= 3 ? fyStartYear : fyStartYear + 1;
            const startDate = new Date(year, monthIndex, 1);
            const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59);
            return {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            };
        }

        if (filterType === 'quarter' && selectedQuarter) {
            let startMonth = 3, endMonth = 5, yearStart = fyStartYear, yearEnd = fyStartYear;
            if (selectedQuarter === 'Q1 (Apr-Jun)') { startMonth = 3; endMonth = 5; } // April to June
            else if (selectedQuarter === 'Q2 (Jul-Sep)') { startMonth = 6; endMonth = 8; } // July to Sep
            else if (selectedQuarter === 'Q3 (Oct-Dec)') { startMonth = 9; endMonth = 11; } // Oct to Dec
            else if (selectedQuarter === 'Q4 (Jan-Mar)') { startMonth = 0; endMonth = 2; yearStart = fyStartYear + 1; yearEnd = fyStartYear + 1; } // Jan to Mar
            
            const startDate = new Date(yearStart, startMonth, 1);
            const endDate = new Date(yearEnd, endMonth + 1, 0, 23, 59, 59);
            return {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            };
        }

        if (filterType === 'custom' && dateRange.from && dateRange.to) {
            return {
                startDate: new Date(dateRange.from).toISOString(),
                endDate: new Date(dateRange.to).toISOString(),
            };
        }
        // Default to current fiscal year
        return {
            startDate: FISCAL_YEARS[0].startDate.toISOString(),
            endDate: FISCAL_YEARS[0].endDate.toISOString(),
        };
    };

    // Fetch dashboard data from API
    const { data: dashboardData, isLoading } = useGetFinanceDashboardQuery(getFilterParams());

    const metrics = dashboardData?.data?.metrics || {
        totalRevenue: 0,
        totalExpense: 0,
        ebidta: 0,
        runwayLeft: 0,
        cashInBank: 0,
        receivables: 0,
    };

    const monthlyData = dashboardData?.data?.monthlyData || [];
    const breakdownData = dashboardData?.data?.breakdownData || [];

    const metricCards = [
        {
            label: 'Cash in Bank',
            value: formatCurrency(metrics.cashInBank),
            fullValue: formatFullCurrency(metrics.cashInBank),
            icon: Wallet,
            color: '#0EA5E9',
            bg: '#F0F9FF',
        },
        {
            label: 'Total Revenue',
            value: formatCurrency(metrics.totalRevenue),
            fullValue: formatFullCurrency(metrics.totalRevenue),
            icon: TrendingUp,
            color: '#22C55E',
            bg: '#F0FDF4',
        },
        {
            label: 'Total Expense',
            value: formatCurrency(metrics.totalExpense),
            fullValue: formatFullCurrency(metrics.totalExpense),
            icon: TrendingDown,
            color: '#EF4444',
            bg: '#FEF2F2',
        },
        {
            label: 'EBIDTA',
            value: formatCurrency(metrics.ebidta),
            fullValue: formatFullCurrency(metrics.ebidta),
            icon: IndianRupee,
            color: metrics.ebidta >= 0 ? '#6366F1' : '#EF4444',
            bg: metrics.ebidta >= 0 ? '#EEF2FF' : '#FEF2F2',
        },
        {
            label: 'Receivables',
            value: formatCurrency(metrics.receivables),
            fullValue: formatFullCurrency(metrics.receivables),
            icon: Receipt,
            color: '#8B5CF6',
            bg: '#F5F3FF',
        },
        {
            label: 'Runway Left',
            value: metrics.runwayLeft > 0 ? `${metrics.runwayLeft} mo` : 'N/A',
            fullValue: metrics.runwayLeft > 0 ? `${metrics.runwayLeft} months` : 'Not enough data',
            icon: Calendar,
            color: '#F59E0B',
            bg: '#FFFBEB',
        },
    ];

    const getFilterLabel = () => {
        switch (filterType) {
            case 'fiscal-year':
                return FISCAL_YEARS.find(fy => fy.value === selectedFiscalYear)?.label || 'Select FY';
            case 'month':
                return selectedMonth || 'Select Month';
            case 'quarter':
                return selectedQuarter || 'Select Quarter';
            case 'custom':
                return dateRange.from && dateRange.to
                    ? `${new Date(dateRange.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - ${new Date(dateRange.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                    : 'Select Range';
            default:
                return 'Filter';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="text-center">
                    <Loader2 size={36} className="mx-auto mb-3 animate-spin" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading financial data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Header with Filters ─────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        Finance Dashboard
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        Financial overview and analytics
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Filter Type Selector */}
                    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border-default)', backgroundColor: 'white' }}>
                        {(['fiscal-year', 'quarter', 'month', 'custom'] as FilterType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className="px-3 py-2 text-sm font-medium transition-colors"
                                style={{
                                    background: filterType === type ? 'var(--color-primary)' : 'white',
                                    color: filterType === type ? 'white' : 'var(--color-text-secondary)',
                                }}
                            >
                                {type === 'fiscal-year' ? 'FY' : type === 'custom' ? 'Custom' : type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Filter Value Selector */}
                    <div className="relative filter-dropdown-container">
                        <button
                            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                            style={{
                                borderColor: 'var(--color-border-default)',
                                backgroundColor: 'white',
                                color: 'var(--color-text-primary)',
                            }}
                        >
                            <Filter size={16} />
                            {getFilterLabel()}
                            <ChevronDown size={16} />
                        </button>

                        {showFilterDropdown && (
                            <div
                                className="absolute right-0 mt-2 w-64 rounded-lg border shadow-xl z-50 p-3"
                                style={{
                                    backgroundColor: 'white',
                                    borderColor: '#E5E7EB',
                                }}
                            >
                                {filterType === 'fiscal-year' && (
                                    <div className="space-y-1">
                                        {FISCAL_YEARS.map((fy) => (
                                            <button
                                                key={fy.value}
                                                onClick={() => {
                                                    setSelectedFiscalYear(fy.value);
                                                    setShowFilterDropdown(false);
                                                }}
                                                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-gray-50"
                                                style={{
                                                    backgroundColor: selectedFiscalYear === fy.value ? '#F0F9FF' : 'transparent',
                                                    color: selectedFiscalYear === fy.value ? '#0369A1' : '#374151',
                                                }}
                                            >
                                                {fy.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {filterType === 'month' && (
                                    <div className="grid grid-cols-3 gap-1">
                                        {MONTHS.map((month) => (
                                            <button
                                                key={month}
                                                onClick={() => {
                                                    setSelectedMonth(month);
                                                    setShowFilterDropdown(false);
                                                }}
                                                className="px-2 py-2 rounded-md text-sm transition-colors hover:bg-gray-50"
                                                style={{
                                                    backgroundColor: selectedMonth === month ? '#F0F9FF' : 'transparent',
                                                    color: selectedMonth === month ? '#0369A1' : '#374151',
                                                }}
                                            >
                                                {month}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {filterType === 'quarter' && (
                                    <div className="space-y-1">
                                        {QUARTERS.map((q) => (
                                            <button
                                                key={q}
                                                onClick={() => {
                                                    setSelectedQuarter(q);
                                                    setShowFilterDropdown(false);
                                                }}
                                                className="w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-gray-50"
                                                style={{
                                                    backgroundColor: selectedQuarter === q ? '#F0F9FF' : 'transparent',
                                                    color: selectedQuarter === q ? '#0369A1' : '#374151',
                                                }}
                                            >
                                                {q}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {filterType === 'custom' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium mb-1 block" style={{ color: '#6B7280' }}>From</label>
                                            <input
                                                type="date"
                                                value={dateRange.from}
                                                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                                                className="w-full px-3 py-2 rounded-md border text-sm"
                                                style={{
                                                    borderColor: '#E5E7EB',
                                                    backgroundColor: 'white',
                                                    color: '#374151',
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium mb-1 block" style={{ color: '#6B7280' }}>To</label>
                                            <input
                                                type="date"
                                                value={dateRange.to}
                                                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                                                className="w-full px-3 py-2 rounded-md border text-sm"
                                                style={{
                                                    borderColor: '#E5E7EB',
                                                    backgroundColor: 'white',
                                                    color: '#374151',
                                                }}
                                            />
                                        </div>
                                        <button
                                            onClick={() => setShowFilterDropdown(false)}
                                            className="w-full py-2 rounded-md text-sm font-medium"
                                            style={{ background: 'var(--color-primary)', color: 'white' }}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Metric Cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {metricCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-xl border p-4 transition-all hover:shadow-md"
                        style={{
                            backgroundColor: 'white',
                            borderColor: 'var(--color-border-default)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ background: card.bg }}
                            >
                                <card.icon size={20} style={{ color: card.color }} />
                            </div>
                        </div>
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>
                            {card.label}
                        </p>
                        <p className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }} title={card.fullValue}>
                            {card.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── Charts Section ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue vs Expense Chart - LINE GRAPH */}
                <div
                    className="rounded-xl border p-5"
                    style={{
                        backgroundColor: 'white',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                        Monthly Revenue & Expense
                    </h3>
                    <div className="h-72">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fill: '#6B7280', fontSize: 12 }}
                                        axisLine={{ stroke: '#E5E7EB' }}
                                    />
                                    <YAxis
                                        tick={{ fill: '#6B7280', fontSize: 12 }}
                                        axisLine={{ stroke: '#E5E7EB' }}
                                        tickFormatter={(value) => formatCurrency(value)}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ paddingTop: '10px' }}
                                        formatter={(value) => <span style={{ color: '#6B7280', fontSize: '12px' }}>{value}</span>}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="revenue"
                                        name="Revenue"
                                        stroke="#22C55E"
                                        strokeWidth={2}
                                        dot={{ fill: '#22C55E', strokeWidth: 2, r: 4 }}
                                        activeDot={{ r: 6 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="expense"
                                        name="Expense"
                                        stroke="#EF4444"
                                        strokeWidth={2}
                                        dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="No data available for the selected period" />
                        )}
                    </div>
                </div>

                {/* Profitability Chart - BAR with positive/negative */}
                <div
                    className="rounded-xl border p-5"
                    style={{
                        backgroundColor: 'white',
                        borderColor: 'var(--color-border-default)',
                    }}
                >
                    <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                        Monthly Profitability (EBIDTA)
                    </h3>
                    <div className="h-72">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fill: '#6B7280', fontSize: 12 }}
                                        axisLine={{ stroke: '#E5E7EB' }}
                                    />
                                    <YAxis
                                        tick={{ fill: '#6B7280', fontSize: 12 }}
                                        axisLine={{ stroke: '#E5E7EB' }}
                                        tickFormatter={(value) => formatCurrency(value)}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <ReferenceLine y={0} stroke="#9CA3AF" />
                                    <Bar dataKey="profit" name="Profit/Loss" radius={[4, 4, 0, 0]}>
                                        {monthlyData.map((entry: any, index: number) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.profit >= 0 ? '#22C55E' : '#EF4444'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyState message="No data available for the selected period" />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Monthly Breakdown Table ─────────────────────────────────── */}
            <div
                className="rounded-xl border overflow-hidden"
                style={{
                    backgroundColor: 'white',
                    borderColor: 'var(--color-border-default)',
                }}
            >
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        Monthly Financial Breakdown
                    </h3>
                </div>
                {breakdownData.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                                        Month
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                                        Revenue
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                                        Expense
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                                        EBIDTA
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                                        Salaries
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                                        Project Costs
                                    </th>
                                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                                        Fixed Costs
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {breakdownData.map((row: any, index: number) => (
                                    <tr
                                        key={row.month}
                                        className="transition-colors hover:bg-gray-50"
                                        style={{
                                            borderTop: index > 0 ? '1px solid #E5E7EB' : undefined,
                                        }}
                                    >
                                        <td className="px-5 py-3 text-sm font-medium" style={{ color: '#111827' }}>
                                            {row.month}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right font-medium" style={{ color: '#22C55E' }}>
                                            {formatFullCurrency(row.revenue)}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right font-medium" style={{ color: '#EF4444' }}>
                                            {formatFullCurrency(row.expense)}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right font-semibold" style={{ color: row.ebidta >= 0 ? '#22C55E' : '#EF4444' }}>
                                            {formatFullCurrency(row.ebidta)}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right" style={{ color: '#6B7280' }}>
                                            {formatFullCurrency(row.salaries || 0)}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right" style={{ color: '#6B7280' }}>
                                            {formatFullCurrency(row.projectCosts || 0)}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-right" style={{ color: '#6B7280' }}>
                                            {formatFullCurrency(row.fixedCosts || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ backgroundColor: '#F9FAFB', borderTop: '2px solid #E5E7EB' }}>
                                    <td className="px-5 py-3 text-sm font-bold" style={{ color: '#111827' }}>
                                        Total
                                    </td>
                                    <td className="px-5 py-3 text-sm text-right font-bold" style={{ color: '#22C55E' }}>
                                        {formatFullCurrency(breakdownData.reduce((acc: number, row: any) => acc + (row.revenue || 0), 0))}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-right font-bold" style={{ color: '#EF4444' }}>
                                        {formatFullCurrency(breakdownData.reduce((acc: number, row: any) => acc + (row.expense || 0), 0))}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-right font-bold" style={{ color: '#6366F1' }}>
                                        {formatFullCurrency(breakdownData.reduce((acc: number, row: any) => acc + (row.ebidta || 0), 0))}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-right font-bold" style={{ color: '#6B7280' }}>
                                        {formatFullCurrency(breakdownData.reduce((acc: number, row: any) => acc + (row.salaries || 0), 0))}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-right font-bold" style={{ color: '#6B7280' }}>
                                        {formatFullCurrency(breakdownData.reduce((acc: number, row: any) => acc + (row.projectCosts || 0), 0))}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-right font-bold" style={{ color: '#6B7280' }}>
                                        {formatFullCurrency(breakdownData.reduce((acc: number, row: any) => acc + (row.fixedCosts || 0), 0))}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <EmptyState message="No financial data available. Add revenue and expense entries to see the breakdown." />
                )}
            </div>
        </div>
    );
}
