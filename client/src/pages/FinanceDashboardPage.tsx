import { useState, useMemo } from 'react';
import {
    TrendingDown,
    DollarSign,
    Wallet,
    CreditCard,
    BarChart3,
    Calendar,
    ChevronDown,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    AlertTriangle,
    CheckCircle,
} from 'lucide-react';
import {
    useGetFinanceDashboardQuery,
    useGetMonthlyReportQuery,
    useGetMonthlySalariesQuery,
    useGetProjectProfitabilityQuery,
} from '@/features/finance/api/financeApi';

// ── Utilities ───────────────────────────────────────────────────────
function formatCurrency(amount: number, compact = false): string {
    if (compact && Math.abs(amount) >= 100000) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            notation: 'compact',
            maximumFractionDigits: 1,
        }).format(amount);
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

// Fiscal year month names (Apr-Mar order)
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Convert calendar month to fiscal month label
function getFiscalMonthLabel(calendarMonth: number): string {
    return MONTH_NAMES[calendarMonth - 1];
}

type FilterType = 'yearly' | 'quarterly' | 'monthly' | 'custom';

// ── Stat Card Component ─────────────────────────────────────────────
function StatCard({
    label,
    value,
    icon,
    trend,
    trendValue,
    color,
    bgGradient,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    color: string;
    bgGradient: string;
}) {
    return (
        <div className="stat-card" style={{ '--card-color': color, '--card-gradient': bgGradient } as React.CSSProperties}>
            <div className="stat-card-icon-wrapper">
                {icon}
            </div>
            <div className="stat-card-content">
                <span className="stat-card-label">{label}</span>
                <div className="stat-card-value">{value}</div>
                {trendValue && (
                    <div className={`stat-card-trend ${trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : ''}`}>
                        {trend === 'up' ? <ArrowUpRight size={12} /> : trend === 'down' ? <ArrowDownRight size={12} /> : null}
                        <span>{trendValue}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Line Chart (Revenue vs Expenses) ────────────────────────────────
function RevenueExpenseChart({
    data,
}: {
    data: { month: number; calendarYear?: number; revenue: number; expenses: number }[];
}) {
    const maxVal = useMemo(() => {
        const allVals = data.flatMap(d => [d.revenue, d.expenses]);
        return Math.max(...allVals, 1);
    }, [data]);

    const chartHeight = 200;
    const chartWidth = 100;

    const getY = (val: number) => chartHeight - (val / maxVal) * chartHeight;

    const revenuePath = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i / Math.max(data.length - 1, 1)) * chartWidth} ${getY(d.revenue)}`)
        .join(' ');

    const expensePath = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i / Math.max(data.length - 1, 1)) * chartWidth} ${getY(d.expenses)}`)
        .join(' ');

    return (
        <div className="chart-container line-chart">
            <div className="chart-header">
                <h3>Revenue vs Expenses</h3>
                <div className="chart-legend">
                    <span className="legend-item"><span className="legend-dot revenue"></span> Revenue</span>
                    <span className="legend-item"><span className="legend-dot expenses"></span> Expenses</span>
                </div>
            </div>
            <div className="chart-body">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="line-chart-svg">
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                        <line
                            key={pct}
                            x1="0"
                            y1={chartHeight * (1 - pct)}
                            x2={chartWidth}
                            y2={chartHeight * (1 - pct)}
                            className="grid-line"
                        />
                    ))}
                    {/* Revenue line */}
                    <path d={revenuePath} className="chart-line revenue-line" />
                    {/* Expenses line */}
                    <path d={expensePath} className="chart-line expenses-line" />
                    {/* Data points */}
                    {data.map((d, i) => (
                        <g key={i}>
                            <circle
                                cx={(i / Math.max(data.length - 1, 1)) * chartWidth}
                                cy={getY(d.revenue)}
                                r="1.5"
                                className="data-point revenue-point"
                            />
                            <circle
                                cx={(i / Math.max(data.length - 1, 1)) * chartWidth}
                                cy={getY(d.expenses)}
                                r="1.5"
                                className="data-point expenses-point"
                            />
                        </g>
                    ))}
                </svg>
                <div className="chart-x-labels">
                    {data.map((d, i) => (
                        <span key={i}>{getFiscalMonthLabel(d.month)}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Bar Chart (Monthly Salaries) ─────────────────────────────────────
function SalariesChart({
    data,
}: {
    data: { month: number; totalSalary: number; employeeCount: number }[];
}) {
    const maxSalary = useMemo(() => Math.max(...data.map(d => d.totalSalary), 1), [data]);

    return (
        <div className="chart-container bar-chart salaries-chart">
            <div className="chart-header">
                <h3>Monthly Salaries</h3>
                <div className="chart-legend">
                    <span className="legend-item"><span className="legend-dot salary"></span> Payroll</span>
                </div>
            </div>
            <div className="chart-body">
                <div className="bar-chart-wrapper">
                    {data.map((d, i) => {
                        const heightPct = (d.totalSalary / maxSalary) * 100;
                        return (
                            <div key={i} className="bar-column">
                                <div className="bar-container">
                                    <div
                                        className="bar salary"
                                        style={{ height: `${heightPct}%` }}
                                        title={`${getFiscalMonthLabel(d.month)}: ${formatCurrency(d.totalSalary)} (${d.employeeCount} employees)`}
                                    />
                                </div>
                                <span className="bar-label">{getFiscalMonthLabel(d.month)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ── Bar Chart (Monthly Profitability) ───────────────────────────────
function ProfitabilityChart({
    data,
}: {
    data: { month: number; profit: number }[];
}) {
    const maxProfit = useMemo(() => Math.max(...data.map(d => Math.abs(d.profit)), 1), [data]);
    const hasNegative = data.some(d => d.profit < 0);

    return (
        <div className="chart-container bar-chart">
            <div className="chart-header">
                <h3>Monthly Profitability</h3>
            </div>
            <div className="chart-body profitability-chart">
                <div className="bar-chart-wrapper" style={{ '--has-negative': hasNegative ? 1 : 0 } as React.CSSProperties}>
                    {data.map((d, i) => {
                        const heightPct = (Math.abs(d.profit) / maxProfit) * 100;
                        const isNegative = d.profit < 0;
                        return (
                            <div key={i} className="bar-column">
                                <div className="bar-container">
                                    <div
                                        className={`bar ${isNegative ? 'negative' : 'positive'}`}
                                        style={{
                                            height: `${heightPct}%`,
                                            [isNegative ? 'bottom' : 'top']: hasNegative && !isNegative ? '50%' : 0,
                                        }}
                                        title={`${getFiscalMonthLabel(d.month)}: ${formatCurrency(d.profit)}`}
                                    />
                                </div>
                                <span className="bar-label">{getFiscalMonthLabel(d.month)}</span>
                            </div>
                        );
                    })}
                </div>
                {hasNegative && <div className="zero-line" />}
            </div>
        </div>
    );
}

// ── Project Profitability Chart ──────────────────────────────────────
function ProjectProfitabilityChart({
    data,
}: {
    data: {
        projectId: string;
        projectName: string;
        profitMargin: number;
        isProfitable: boolean;
        profitableUntil: string | null;
        totalRevenue: number;
        totalExpenses: number;
    }[];
}) {
    const maxMargin = useMemo(() => Math.max(...data.map(d => Math.abs(d.profitMargin)), 1), [data]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    };

    return (
        <div className="chart-container project-profitability-chart">
            <div className="chart-header">
                <h3>Project-wise Profitability</h3>
            </div>
            <div className="chart-body">
                {data.length === 0 ? (
                    <div className="no-data">No active projects found</div>
                ) : (
                    <div className="project-profitability-list">
                        {data.slice(0, 6).map((project) => {
                            const widthPct = (Math.abs(project.profitMargin) / maxMargin) * 100;
                            return (
                                <div key={project.projectId} className="project-profitability-item">
                                    <div className="project-info">
                                        <span className="project-name">{project.projectName}</span>
                                        <div className="project-meta">
                                            {project.isProfitable ? (
                                                <span className="status profitable">
                                                    <CheckCircle size={12} />
                                                    {project.profitMargin.toFixed(1)}% margin
                                                </span>
                                            ) : (
                                                <span className="status unprofitable">
                                                    <AlertTriangle size={12} />
                                                    {project.profitMargin.toFixed(1)}% (loss)
                                                </span>
                                            )}
                                            {project.profitableUntil && (
                                                <span className="until-date">
                                                    <Clock size={12} />
                                                    Until {formatDate(project.profitableUntil)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="project-bar-container">
                                        <div
                                            className={`project-bar ${project.isProfitable ? 'profitable' : 'unprofitable'}`}
                                            style={{ width: `${widthPct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Dashboard ──────────────────────────────────────────────────
export default function FinanceDashboardPage() {
    // Indian Fiscal Year: April-March
    const currentDate = new Date();
    const currentCalendarYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-indexed

    // Determine current fiscal year (e.g., FY 2024-25 if current month >= April)
    const currentFiscalYear = currentMonth >= 3 ? currentCalendarYear : currentCalendarYear - 1; // April = month 3
    const currentFiscalQuarter = Math.floor((currentMonth + 9) % 12 / 3); // Adjust for April start

    const [filterType, setFilterType] = useState<FilterType>('yearly');
    const [selectedYear, setSelectedYear] = useState(currentFiscalYear);
    const [selectedQuarter, setSelectedQuarter] = useState(currentFiscalQuarter);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [customRange, setCustomRange] = useState({
        startDate: `${currentFiscalYear}-04-01`,
        endDate: `${currentFiscalYear + 1}-03-31`,
    });

    // Calculate date range based on filter
    const { startDate, endDate } = useMemo(() => {
        switch (filterType) {
            case 'yearly':
                // Fiscal year: April 1 to March 31
                return {
                    startDate: `${selectedYear}-04-01`,
                    endDate: `${selectedYear + 1}-03-31`,
                };
            case 'quarterly':
                // Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
                const fiscalQuarterMonths = [
                    { start: 4, end: 6 },   // Q1
                    { start: 7, end: 9 },   // Q2
                    { start: 10, end: 12 }, // Q3
                    { start: 1, end: 3 },   // Q4
                ];
                const quarter = fiscalQuarterMonths[selectedQuarter];
                const qYear = selectedQuarter === 3 ? selectedYear + 1 : selectedYear; // Q4 is in next calendar year
                const qStartMonth = quarter.start;
                const qEndMonth = quarter.end;
                const qLastDay = new Date(qYear, qEndMonth, 0).getDate();

                return {
                    startDate: `${selectedQuarter === 3 ? selectedYear + 1 : selectedYear}-${String(qStartMonth).padStart(2, '0')}-01`,
                    endDate: `${qYear}-${String(qEndMonth).padStart(2, '0')}-${qLastDay}`,
                };
            case 'monthly':
                const monthNum = selectedMonth + 1;
                const yearForMonth = selectedMonth < 3 ? selectedYear + 1 : selectedYear; // Jan-Mar are in next calendar year
                const lastDay = new Date(yearForMonth, monthNum, 0).getDate();
                return {
                    startDate: `${yearForMonth}-${String(monthNum).padStart(2, '0')}-01`,
                    endDate: `${yearForMonth}-${String(monthNum).padStart(2, '0')}-${lastDay}`,
                };
            case 'custom':
                return customRange;
            default:
                return { startDate: `${selectedYear}-04-01`, endDate: `${selectedYear + 1}-03-31` };
        }
    }, [filterType, selectedYear, selectedQuarter, selectedMonth, customRange]);

    const { data: stats, isLoading: statsLoading } = useGetFinanceDashboardQuery({ startDate, endDate });
    const { data: monthlyData, isLoading: monthlyLoading } = useGetMonthlyReportQuery(selectedYear);
    const { data: salaryData, isLoading: salaryLoading } = useGetMonthlySalariesQuery(selectedYear);
    const { data: projectProfitability, isLoading: profitabilityLoading } = useGetProjectProfitabilityQuery();

    const isLoading = statsLoading || monthlyLoading || salaryLoading || profitabilityLoading;

    // Filter monthly data based on selection (data is already in fiscal year order from API)
    const filteredMonthlyData = useMemo(() => {
        if (!monthlyData) return [];
        switch (filterType) {
            case 'yearly':
                return monthlyData;
            case 'quarterly':
                const qStart = selectedQuarter * 3;
                return monthlyData.slice(qStart, qStart + 3);
            case 'monthly':
                // Find the month in fiscal order (Apr=0, May=1, ..., Mar=11)
                const fiscalMonthIndex = selectedMonth >= 3 ? selectedMonth - 3 : selectedMonth + 9;
                return monthlyData.filter((_, idx) => idx === fiscalMonthIndex);
            case 'custom':
                return monthlyData; // Show all for custom range
            default:
                return monthlyData;
        }
    }, [monthlyData, filterType, selectedQuarter, selectedMonth]);

    // Filter salary data similar to monthly data
    const filteredSalaryData = useMemo(() => {
        if (!salaryData) return [];
        switch (filterType) {
            case 'yearly':
                return salaryData;
            case 'quarterly':
                const qStart = selectedQuarter * 3;
                return salaryData.slice(qStart, qStart + 3);
            case 'monthly':
                const fiscalMonthIndex = selectedMonth >= 3 ? selectedMonth - 3 : selectedMonth + 9;
                return salaryData.filter((_, idx) => idx === fiscalMonthIndex);
            case 'custom':
                return salaryData;
            default:
                return salaryData;
        }
    }, [salaryData, filterType, selectedQuarter, selectedMonth]);

    const chartData = useMemo(() => {
        return (filteredMonthlyData || []).map(m => ({
            month: m.month,
            calendarYear: m.calendarYear,
            revenue: m.revenueWithoutGst,
            expenses: m.totalExpenses,
            profit: m.netProfit,
        }));
    }, [filteredMonthlyData]);

    const salaryChartData = useMemo(() => {
        return (filteredSalaryData || []).map(m => ({
            month: m.month,
            totalSalary: m.totalSalary,
            employeeCount: m.employeeCount,
        }));
    }, [filteredSalaryData]);

    // Format runway value
    const formatRunway = (months: number) => {
        if (months <= 0) return 'N/A';
        if (months >= 24) return '24+ months';
        return `${months.toFixed(1)} months`;
    };

    // Get fiscal month options for monthly filter
    const getFiscalMonthOptions = () => {
        // Return months in fiscal year order: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar
        return [
            { value: 3, label: 'April' },
            { value: 4, label: 'May' },
            { value: 5, label: 'June' },
            { value: 6, label: 'July' },
            { value: 7, label: 'August' },
            { value: 8, label: 'September' },
            { value: 9, label: 'October' },
            { value: 10, label: 'November' },
            { value: 11, label: 'December' },
            { value: 0, label: 'January' },
            { value: 1, label: 'February' },
            { value: 2, label: 'March' },
        ];
    };

    return (
        <div className="finance-dashboard-v2">
            {/* ── Header ───────────────────────────────────────────── */}
            <div className="dashboard-header">
                <div>
                    <h1>Finance Dashboard</h1>
                    <p>Company-wide financial overview</p>
                </div>
            </div>

            {/* ── Filter Tabs ──────────────────────────────────────── */}
            <div className="filter-section">
                <div className="filter-tabs">
                    {(['yearly', 'quarterly', 'monthly', 'custom'] as FilterType[]).map((type) => (
                        <button
                            key={type}
                            className={`filter-tab ${filterType === type ? 'active' : ''}`}
                            onClick={() => setFilterType(type)}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="filter-controls">
                    {filterType !== 'custom' && (
                        <div className="select-wrapper">
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                            >
                                {[currentFiscalYear, currentFiscalYear - 1, currentFiscalYear - 2, currentFiscalYear - 3].map((y) => (
                                    <option key={y} value={y}>FY {y}-{String(y + 1).slice(-2)}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} />
                        </div>
                    )}

                    {filterType === 'quarterly' && (
                        <div className="select-wrapper">
                            <select
                                value={selectedQuarter}
                                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                            >
                                {['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'].map((q, i) => (
                                    <option key={i} value={i}>{q}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} />
                        </div>
                    )}

                    {filterType === 'monthly' && (
                        <div className="select-wrapper">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            >
                                {getFiscalMonthOptions().map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} />
                        </div>
                    )}

                    {filterType === 'custom' && (
                        <div className="custom-date-range">
                            <div className="date-input-wrapper">
                                <Calendar size={14} />
                                <input
                                    type="date"
                                    value={customRange.startDate}
                                    onChange={(e) => setCustomRange(prev => ({ ...prev, startDate: e.target.value }))}
                                />
                            </div>
                            <span className="date-separator">to</span>
                            <div className="date-input-wrapper">
                                <Calendar size={14} />
                                <input
                                    type="date"
                                    value={customRange.endDate}
                                    onChange={(e) => setCustomRange(prev => ({ ...prev, endDate: e.target.value }))}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="loading-state">
                    <div className="spinner" />
                    <span>Loading financial data...</span>
                </div>
            ) : (
                <>
                    {/* ── Stat Cards ──────────────────────────────── */}
                    <div className="stats-grid">
                        <StatCard
                            label="Total Revenue"
                            value={formatCurrency(stats?.totalRevenue || 0, true)}
                            icon={<DollarSign size={20} />}
                            color="#10b981"
                            bgGradient="linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
                            trend="up"
                            trendValue={`${formatCurrency(stats?.revenueWithoutGst || 0, true)} excl. GST`}
                        />
                        <StatCard
                            label="Total Expenses"
                            value={formatCurrency(stats?.totalExpenses || 0, true)}
                            icon={<CreditCard size={20} />}
                            color="#ef4444"
                            bgGradient="linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)"
                            trendValue={`Payroll: ${formatCurrency(stats?.payrollCost || 0, true)}`}
                        />
                        <StatCard
                            label="EBITDA"
                            value={formatCurrency(stats?.ebitda || 0, true)}
                            icon={<BarChart3 size={20} />}
                            color="#3b82f6"
                            bgGradient="linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
                            trend={(stats?.ebitda || 0) >= 0 ? 'up' : 'down'}
                            trendValue={`${stats?.ebitdaMargin?.toFixed(1) || 0}% margin`}
                        />
                        <StatCard
                            label="Runway Left"
                            value={formatRunway(stats?.runwayMonths || 0)}
                            icon={<Clock size={20} />}
                            color="#8b5cf6"
                            bgGradient="linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)"
                            trend={(stats?.runwayMonths || 0) >= 6 ? 'up' : 'down'}
                            trendValue={`Avg burn: ${formatCurrency(stats?.avgMonthlyExpenses || 0, true)}/mo`}
                        />
                        <StatCard
                            label="Cash in Bank"
                            value={formatCurrency(stats?.cashInBank || 0, true)}
                            icon={<Wallet size={20} />}
                            color="#f59e0b"
                            bgGradient="linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                            trendValue={`Net position`}
                        />
                        <StatCard
                            label="Receivables"
                            value={formatCurrency(stats?.receivables || 0, true)}
                            icon={<TrendingDown size={20} />}
                            color="#ec4899"
                            bgGradient="linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)"
                            trendValue={`${stats?.overdueInvoices || 0} overdue invoices`}
                        />
                    </div>

                    {/* ── Charts Section Row 1 ─────────────────────── */}
                    {chartData.length > 1 && (
                        <div className="charts-grid two-col">
                            <RevenueExpenseChart data={chartData} />
                            <SalariesChart data={salaryChartData} />
                        </div>
                    )}

                    {/* ── Charts Section Row 2 ─────────────────────── */}
                    <div className="charts-grid two-col">
                        {chartData.length > 1 && (
                            <ProfitabilityChart data={chartData.map(d => ({ month: d.month, profit: d.profit }))} />
                        )}
                        {projectProfitability && projectProfitability.length > 0 && (
                            <ProjectProfitabilityChart data={projectProfitability} />
                        )}
                    </div>

                    {/* ── Monthly P&L Table ───────────────────────── */}
                    {filteredMonthlyData && filteredMonthlyData.length > 0 && (
                        <div className="data-table-section">
                            <div className="section-header">
                                <h2>Monthly P&L Statement</h2>
                            </div>
                            <div className="table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Revenue</th>
                                            <th>GST</th>
                                            <th>Revenue (excl. GST)</th>
                                            <th>Expenses</th>
                                            <th>Payroll</th>
                                            <th>Net Profit</th>
                                            <th>Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMonthlyData.map((m, idx) => (
                                            <tr key={idx}>
                                                <td className="month-cell">
                                                    {MONTH_FULL_NAMES[m.month - 1]} {m.calendarYear ? `'${String(m.calendarYear).slice(-2)}` : ''}
                                                </td>
                                                <td>{formatCurrency(m.revenue)}</td>
                                                <td>{formatCurrency(m.gst)}</td>
                                                <td>{formatCurrency(m.revenueWithoutGst)}</td>
                                                <td>{formatCurrency(m.expenses)}</td>
                                                <td>{formatCurrency(m.payroll)}</td>
                                                <td className={m.netProfit >= 0 ? 'positive' : 'negative'}>
                                                    {formatCurrency(m.netProfit)}
                                                </td>
                                                <td className={m.netMargin >= 0 ? 'positive' : 'negative'}>
                                                    {m.netMargin.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {filteredMonthlyData.length > 1 && (
                                        <tfoot>
                                            <tr>
                                                <td><strong>Total</strong></td>
                                                <td><strong>{formatCurrency(filteredMonthlyData.reduce((s, m) => s + m.revenue, 0))}</strong></td>
                                                <td><strong>{formatCurrency(filteredMonthlyData.reduce((s, m) => s + m.gst, 0))}</strong></td>
                                                <td><strong>{formatCurrency(filteredMonthlyData.reduce((s, m) => s + m.revenueWithoutGst, 0))}</strong></td>
                                                <td><strong>{formatCurrency(filteredMonthlyData.reduce((s, m) => s + m.expenses, 0))}</strong></td>
                                                <td><strong>{formatCurrency(filteredMonthlyData.reduce((s, m) => s + m.payroll, 0))}</strong></td>
                                                <td className={(stats?.netProfit || 0) >= 0 ? 'positive' : 'negative'}>
                                                    <strong>{formatCurrency(filteredMonthlyData.reduce((s, m) => s + m.netProfit, 0))}</strong>
                                                </td>
                                                <td className={(stats?.netMargin || 0) >= 0 ? 'positive' : 'negative'}>
                                                    <strong>{stats?.netMargin?.toFixed(1) || 0}%</strong>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            <style>{`
                .finance-dashboard-v2 {
                    padding: 1.5rem 2rem 2rem;
                    max-width: 1440px;
                    margin: 0 auto;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* ── Header ──────────────────────────────────────── */
                .dashboard-header {
                    margin-bottom: 1.5rem;
                }
                .dashboard-header h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--color-text-primary, #0f172a);
                    margin: 0 0 0.25rem 0;
                }
                .dashboard-header p {
                    font-size: 0.875rem;
                    color: var(--color-text-secondary, #64748b);
                    margin: 0;
                }

                /* ── Filter Section ──────────────────────────────── */
                .filter-section {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                .filter-tabs {
                    display: flex;
                    gap: 0.25rem;
                    background: var(--color-bg-subtle, #f1f5f9);
                    padding: 0.25rem;
                    border-radius: 10px;
                }
                .filter-tab {
                    padding: 0.5rem 1rem;
                    border: none;
                    background: transparent;
                    border-radius: 8px;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--color-text-secondary, #64748b);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .filter-tab:hover {
                    color: var(--color-text-primary, #0f172a);
                }
                .filter-tab.active {
                    background: white;
                    color: var(--color-primary, #10b981);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }
                .filter-controls {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .select-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .select-wrapper select {
                    appearance: none;
                    padding: 0.5rem 2rem 0.5rem 0.75rem;
                    border: 1px solid var(--color-border, #e2e8f0);
                    border-radius: 8px;
                    background: white;
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--color-text-primary, #0f172a);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .select-wrapper select:hover {
                    border-color: var(--color-primary, #10b981);
                }
                .select-wrapper select:focus {
                    outline: none;
                    border-color: var(--color-primary, #10b981);
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
                }
                .select-wrapper svg {
                    position: absolute;
                    right: 0.5rem;
                    pointer-events: none;
                    color: var(--color-text-secondary, #64748b);
                }
                .custom-date-range {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .date-input-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-border, #e2e8f0);
                    border-radius: 8px;
                    background: white;
                }
                .date-input-wrapper svg {
                    color: var(--color-text-secondary, #64748b);
                }
                .date-input-wrapper input {
                    border: none;
                    outline: none;
                    font-size: 0.8125rem;
                    color: var(--color-text-primary, #0f172a);
                    background: transparent;
                    width: 110px;
                }
                .date-separator {
                    color: var(--color-text-secondary, #64748b);
                    font-size: 0.75rem;
                }

                /* ── Stats Grid ──────────────────────────────────── */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .stat-card {
                    background: var(--card-gradient);
                    border-radius: 16px;
                    padding: 1.25rem;
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    border: 1px solid rgba(0,0,0,0.03);
                }
                .stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
                }
                .stat-card-icon-wrapper {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    color: var(--card-color);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    flex-shrink: 0;
                }
                .stat-card-content {
                    flex: 1;
                    min-width: 0;
                }
                .stat-card-label {
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--color-text-secondary, #64748b);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .stat-card-value {
                    font-size: 1.375rem;
                    font-weight: 700;
                    color: var(--color-text-primary, #0f172a);
                    margin: 0.25rem 0;
                    line-height: 1.2;
                }
                .stat-card-trend {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    color: var(--color-text-secondary, #64748b);
                }
                .stat-card-trend.positive { color: #10b981; }
                .stat-card-trend.negative { color: #ef4444; }

                /* ── Charts Grid ─────────────────────────────────── */
                .charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .charts-grid.two-col {
                    grid-template-columns: 1fr 1fr;
                }
                .chart-container {
                    background: white;
                    border-radius: 16px;
                    padding: 1.25rem;
                    border: 1px solid var(--color-border, #e2e8f0);
                }
                .chart-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .chart-header h3 {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: var(--color-text-primary, #0f172a);
                    margin: 0;
                }
                .chart-legend {
                    display: flex;
                    gap: 1rem;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.75rem;
                    color: var(--color-text-secondary, #64748b);
                }
                .legend-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 2px;
                }
                .legend-dot.revenue { background: #10b981; }
                .legend-dot.expenses { background: #ef4444; }
                .legend-dot.salary { background: #8b5cf6; }
                .chart-body {
                    position: relative;
                }
                .line-chart-svg {
                    width: 100%;
                    height: 180px;
                }
                .grid-line {
                    stroke: var(--color-border, #e2e8f0);
                    stroke-width: 0.5;
                }
                .chart-line {
                    fill: none;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }
                .revenue-line { stroke: #10b981; }
                .expenses-line { stroke: #ef4444; }
                .data-point { transition: r 0.15s ease; }
                .data-point:hover { r: 3; }
                .revenue-point { fill: #10b981; }
                .expenses-point { fill: #ef4444; }
                .chart-x-labels {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 0.5rem;
                    font-size: 0.6875rem;
                    color: var(--color-text-secondary, #94a3b8);
                }

                /* Bar Chart */
                .profitability-chart {
                    height: 200px;
                    position: relative;
                }
                .bar-chart-wrapper {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    height: 100%;
                    gap: 0.25rem;
                }
                .bar-column {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                }
                .bar-container {
                    flex: 1;
                    width: 100%;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                }
                .bar {
                    width: 80%;
                    max-width: 32px;
                    margin: 0 auto;
                    border-radius: 4px 4px 0 0;
                    transition: height 0.4s ease, opacity 0.2s ease;
                    cursor: pointer;
                }
                .bar:hover { opacity: 0.85; }
                .bar.positive { background: linear-gradient(180deg, #10b981 0%, #059669 100%); }
                .bar.negative {
                    background: linear-gradient(0deg, #ef4444 0%, #dc2626 100%);
                    border-radius: 0 0 4px 4px;
                }
                .bar.salary { background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%); }
                .bar-label {
                    font-size: 0.6875rem;
                    color: var(--color-text-secondary, #94a3b8);
                    margin-top: 0.375rem;
                }
                .zero-line {
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: 50%;
                    height: 1px;
                    background: var(--color-border, #e2e8f0);
                }

                /* Salaries Chart */
                .salaries-chart .chart-body {
                    height: 200px;
                }
                .salaries-chart .bar-chart-wrapper {
                    height: 180px;
                }

                /* Project Profitability Chart */
                .project-profitability-chart .chart-body {
                    max-height: 220px;
                    overflow-y: auto;
                }
                .project-profitability-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .project-profitability-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.375rem;
                }
                .project-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .project-name {
                    font-size: 0.8125rem;
                    font-weight: 500;
                    color: var(--color-text-primary, #0f172a);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 150px;
                }
                .project-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .project-meta .status {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    font-weight: 500;
                }
                .project-meta .status.profitable { color: #10b981; }
                .project-meta .status.unprofitable { color: #ef4444; }
                .project-meta .until-date {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.6875rem;
                    color: var(--color-text-secondary, #64748b);
                }
                .project-bar-container {
                    height: 8px;
                    background: var(--color-bg-subtle, #f1f5f9);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .project-bar {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.3s ease;
                }
                .project-bar.profitable { background: linear-gradient(90deg, #10b981 0%, #34d399 100%); }
                .project-bar.unprofitable { background: linear-gradient(90deg, #ef4444 0%, #f87171 100%); }
                .no-data {
                    text-align: center;
                    padding: 2rem;
                    color: var(--color-text-secondary, #64748b);
                    font-size: 0.875rem;
                }

                /* ── Data Table ──────────────────────────────────── */
                .data-table-section {
                    background: white;
                    border-radius: 16px;
                    border: 1px solid var(--color-border, #e2e8f0);
                    overflow: hidden;
                }
                .section-header {
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--color-border, #e2e8f0);
                }
                .section-header h2 {
                    font-size: 0.9375rem;
                    font-weight: 600;
                    color: var(--color-text-primary, #0f172a);
                    margin: 0;
                }
                .table-wrapper {
                    overflow-x: auto;
                }
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8125rem;
                }
                .data-table th,
                .data-table td {
                    padding: 0.75rem 1rem;
                    text-align: right;
                    border-bottom: 1px solid var(--color-border, #e2e8f0);
                }
                .data-table th {
                    font-weight: 600;
                    font-size: 0.6875rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-text-secondary, #64748b);
                    background: var(--color-bg-subtle, #f8fafc);
                }
                .data-table th:first-child,
                .data-table td:first-child {
                    text-align: left;
                }
                .data-table tbody tr {
                    transition: background 0.15s ease;
                }
                .data-table tbody tr:hover {
                    background: var(--color-bg-subtle, #f8fafc);
                }
                .data-table td.month-cell {
                    font-weight: 500;
                    color: var(--color-text-primary, #0f172a);
                }
                .data-table td.positive { color: #10b981; font-weight: 500; }
                .data-table td.negative { color: #ef4444; font-weight: 500; }
                .data-table tfoot td {
                    border-top: 2px solid var(--color-border, #e2e8f0);
                    background: var(--color-bg-subtle, #f8fafc);
                }

                /* ── Loading State ───────────────────────────────── */
                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem;
                    gap: 1rem;
                    color: var(--color-text-secondary, #64748b);
                }
                .spinner {
                    width: 36px;
                    height: 36px;
                    border: 3px solid var(--color-border, #e2e8f0);
                    border-top-color: var(--color-primary, #10b981);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* ── Responsive ──────────────────────────────────── */
                @media (max-width: 1024px) {
                    .charts-grid.two-col {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 768px) {
                    .finance-dashboard-v2 {
                        padding: 1rem;
                    }
                    .filter-section {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .filter-controls {
                        flex-wrap: wrap;
                    }
                    .charts-grid {
                        grid-template-columns: 1fr;
                    }
                    .stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>
        </div>
    );
}
