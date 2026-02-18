import { useState } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    FileText,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    FolderKanban,
    BarChart3,
} from 'lucide-react';
import {
    useGetFinanceDashboardQuery,
    useGetMonthlyReportQuery,
} from '@/features/finance/api/financeApi';
import type { MonthlyReportEntry } from '@/features/finance/types/finance.types';

function formatCurrency(amount: number, currency = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Stat Card Component ─────────────────────────────────────────────
function StatCard({
    label,
    value,
    icon,
    trend,
    trendLabel,
    color,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendLabel?: string;
    color: string;
}) {
    return (
        <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="stat-card-header">
                <span className="stat-card-label">{label}</span>
                <div className="stat-card-icon" style={{ color }}>
                    {icon}
                </div>
            </div>
            <div className="stat-card-value">{value}</div>
            {trendLabel && (
                <div className={`stat-card-trend ${trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : ''}`}>
                    {trend === 'up' ? <ArrowUpRight size={14} /> : trend === 'down' ? <ArrowDownRight size={14} /> : null}
                    <span>{trendLabel}</span>
                </div>
            )}
        </div>
    );
}

// ── Mini Bar Chart ──────────────────────────────────────────────────
function MiniBarChart({
    data,
    barKey,
    color,
    label,
}: {
    data: MonthlyReportEntry[];
    barKey: keyof MonthlyReportEntry;
    color: string;
    label: string;
}) {
    const maxVal = Math.max(...data.map((d) => Number(d[barKey]) || 0), 1);

    return (
        <div className="mini-chart">
            <div className="mini-chart-header">
                <span className="mini-chart-label">{label}</span>
            </div>
            <div className="mini-chart-bars">
                {data.map((entry) => {
                    const val = Number(entry[barKey]) || 0;
                    const height = (val / maxVal) * 100;
                    return (
                        <div key={entry.month} className="mini-chart-bar-group" title={`${MONTH_NAMES[entry.month - 1]}: ${formatCurrency(val)}`}>
                            <div className="mini-chart-bar" style={{ height: `${height}%`, backgroundColor: color }} />
                            <span className="mini-chart-month">{MONTH_NAMES[entry.month - 1]}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Dashboard ──────────────────────────────────────────────────
export default function FinanceDashboardPage() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: stats, isLoading: statsLoading } = useGetFinanceDashboardQuery({ startDate, endDate });
    const { data: monthlyData, isLoading: monthlyLoading } = useGetMonthlyReportQuery(year);

    const isLoading = statsLoading || monthlyLoading;

    // Compute YTD totals from monthly
    /*    const ytdNetProfit = useMemo(() => {
            if (!monthlyData) return 0;
            return monthlyData.reduce((sum, m) => sum + m.netProfit, 0);
        }, [monthlyData]);*/

    return (
        <div className="finance-dashboard">
            {/* ── Header ───────────────────────────────────────────── */}
            <div className="finance-page-header">
                <div>
                    <h1 className="finance-page-title">Finance Dashboard</h1>
                    <p className="finance-page-subtitle">Company-wide financial overview</p>
                </div>
                <div className="finance-header-actions">
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="finance-select"
                    >
                        {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="finance-loading">
                    <div className="finance-spinner" />
                    <span>Loading financial data...</span>
                </div>
            ) : (
                <>
                    {/* ── Stat Cards ──────────────────────────────── */}
                    <div className="finance-stats-grid">
                        <StatCard
                            label="Total Revenue"
                            value={formatCurrency(stats?.totalRevenue || 0)}
                            icon={<DollarSign size={20} />}
                            color="#10b981"
                            trend="up"
                            trendLabel={`${formatCurrency(stats?.revenueWithoutGst || 0)} excl. GST`}
                        />
                        <StatCard
                            label="Total Expenses"
                            value={formatCurrency(stats?.totalExpenses || 0)}
                            icon={<TrendingDown size={20} />}
                            color="#ef4444"
                            trendLabel={`Payroll: ${formatCurrency(stats?.payrollCost || 0)}`}
                        />
                        <StatCard
                            label="Net Profit"
                            value={formatCurrency(stats?.netProfit || 0)}
                            icon={<TrendingUp size={20} />}
                            color={stats?.netProfit && stats.netProfit >= 0 ? '#10b981' : '#ef4444'}
                            trend={stats?.netProfit && stats.netProfit >= 0 ? 'up' : 'down'}
                            trendLabel={`${stats?.netMargin?.toFixed(1) || 0}% margin`}
                        />
                        <StatCard
                            label="GST Collected"
                            value={formatCurrency(stats?.totalGstCollected || 0)}
                            icon={<FileText size={20} />}
                            color="#8b5cf6"
                        />
                        <StatCard
                            label="Pending Payments"
                            value={formatCurrency(stats?.totalPending || 0)}
                            icon={<AlertTriangle size={20} />}
                            color="#f59e0b"
                            trendLabel={`${stats?.overdueInvoices || 0} overdue invoices`}
                        />
                        <StatCard
                            label="Active Projects"
                            value={`${stats?.activeProjects || 0} / ${stats?.totalProjects || 0}`}
                            icon={<FolderKanban size={20} />}
                            color="#3b82f6"
                        />
                    </div>

                    {/* ── Charts Section ──────────────────────────── */}
                    {monthlyData && monthlyData.length > 0 && (
                        <div className="finance-charts-grid">
                            <div className="finance-chart-card">
                                <MiniBarChart
                                    data={monthlyData}
                                    barKey="revenue"
                                    color="#10b981"
                                    label="Monthly Revenue"
                                />
                            </div>
                            <div className="finance-chart-card">
                                <MiniBarChart
                                    data={monthlyData}
                                    barKey="totalExpenses"
                                    color="#ef4444"
                                    label="Monthly Expenses"
                                />
                            </div>
                            <div className="finance-chart-card">
                                <MiniBarChart
                                    data={monthlyData}
                                    barKey="netProfit"
                                    color="#8b5cf6"
                                    label="Monthly Net Profit"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Expense Breakdown ───────────────────────── */}
                    <div className="finance-section">
                        <h2 className="finance-section-title">
                            <BarChart3 size={20} /> Expense Breakdown
                        </h2>
                        <div className="expense-breakdown-grid">
                            {[
                                { label: 'Payroll', value: stats?.payrollCost || 0, color: '#3b82f6' },
                                { label: 'Fixed Costs', value: stats?.fixedCosts || 0, color: '#f59e0b' },
                                { label: 'CAC (Marketing & Sales)', value: stats?.cac || 0, color: '#ec4899' },
                                { label: 'Project Costs', value: stats?.projectCosts || 0, color: '#8b5cf6' },
                                { label: 'Overhead', value: stats?.overheadCosts || 0, color: '#6b7280' },
                            ].map((item) => (
                                <div key={item.label} className="expense-breakdown-item">
                                    <div className="expense-breakdown-bar">
                                        <div
                                            className="expense-breakdown-fill"
                                            style={{
                                                width: `${stats?.totalExpenses ? (item.value / stats.totalExpenses) * 100 : 0}%`,
                                                backgroundColor: item.color,
                                            }}
                                        />
                                    </div>
                                    <div className="expense-breakdown-info">
                                        <span className="expense-breakdown-label">{item.label}</span>
                                        <span className="expense-breakdown-value">{formatCurrency(item.value)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Monthly P&L Table ───────────────────────── */}
                    {monthlyData && monthlyData.length > 0 && (
                        <div className="finance-section">
                            <h2 className="finance-section-title">
                                <FileText size={20} /> Monthly P&L ({year})
                            </h2>
                            <div className="finance-table-wrapper">
                                <table className="finance-table">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Revenue</th>
                                            <th>GST</th>
                                            <th>Rev (excl. GST)</th>
                                            <th>Expenses</th>
                                            <th>Payroll</th>
                                            <th>Net Profit</th>
                                            <th>Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyData.map((m) => (
                                            <tr key={m.month}>
                                                <td>{MONTH_NAMES[m.month - 1]}</td>
                                                <td>{formatCurrency(m.revenue)}</td>
                                                <td>{formatCurrency(m.gst)}</td>
                                                <td>{formatCurrency(m.revenueWithoutGst)}</td>
                                                <td>{formatCurrency(m.expenses)}</td>
                                                <td>{formatCurrency(m.payroll)}</td>
                                                <td style={{ color: m.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                                    {formatCurrency(m.netProfit)}
                                                </td>
                                                <td style={{ color: m.netMargin >= 0 ? '#10b981' : '#ef4444' }}>
                                                    {m.netMargin.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td><strong>YTD</strong></td>
                                            <td><strong>{formatCurrency(stats?.totalRevenue || 0)}</strong></td>
                                            <td><strong>{formatCurrency(stats?.totalGstCollected || 0)}</strong></td>
                                            <td><strong>{formatCurrency(stats?.revenueWithoutGst || 0)}</strong></td>
                                            <td><strong>{formatCurrency((stats?.totalExpenses || 0) - (stats?.payrollCost || 0))}</strong></td>
                                            <td><strong>{formatCurrency(stats?.payrollCost || 0)}</strong></td>
                                            <td style={{ color: (stats?.netProfit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                                                <strong>{formatCurrency(stats?.netProfit || 0)}</strong>
                                            </td>
                                            <td style={{ color: (stats?.netMargin || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                                                <strong>{stats?.netMargin?.toFixed(1) || 0}%</strong>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            <style>{`
                .finance-dashboard {
                    padding: 2rem;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .finance-page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 2rem;
                }
                .finance-page-title {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--color-text, #111);
                    margin: 0;
                }
                .finance-page-subtitle {
                    color: var(--color-text-secondary, #666);
                    margin: 0.25rem 0 0 0;
                    font-size: 0.9rem;
                }
                .finance-header-actions {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .finance-select {
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-border, #e5e7eb);
                    border-radius: 8px;
                    background: var(--color-surface, #fff);
                    color: var(--color-text, #111);
                    font-size: 0.875rem;
                    cursor: pointer;
                }

                /* Stat Cards */
                .finance-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .stat-card {
                    background: var(--color-surface, #fff);
                    border-radius: 12px;
                    padding: 1.25rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                    transition: transform 0.2s;
                }
                .stat-card:hover { transform: translateY(-2px); }
                .stat-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .stat-card-label {
                    font-size: 0.8rem;
                    color: var(--color-text-secondary, #666);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-weight: 500;
                }
                .stat-card-icon {
                    width: 36px; height: 36px;
                    border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(0,0,0,0.04);
                }
                .stat-card-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--color-text, #111);
                    line-height: 1.2;
                }
                .stat-card-trend {
                    display: flex; align-items: center; gap: 4px;
                    font-size: 0.75rem;
                    color: var(--color-text-secondary, #666);
                    margin-top: 0.5rem;
                }
                .trend-up { color: #10b981; }
                .trend-down { color: #ef4444; }

                /* Charts */
                .finance-charts-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .finance-chart-card {
                    background: var(--color-surface, #fff);
                    border-radius: 12px;
                    padding: 1.25rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .mini-chart { width: 100%; }
                .mini-chart-header { margin-bottom: 0.75rem; }
                .mini-chart-label {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--color-text, #111);
                }
                .mini-chart-bars {
                    display: flex;
                    align-items: flex-end;
                    gap: 4px;
                    height: 120px;
                }
                .mini-chart-bar-group {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                    justify-content: flex-end;
                }
                .mini-chart-bar {
                    width: 100%;
                    border-radius: 3px 3px 0 0;
                    min-height: 2px;
                    transition: height 0.4s ease;
                    cursor: pointer;
                }
                .mini-chart-bar:hover { opacity: 0.8; }
                .mini-chart-month {
                    font-size: 0.65rem;
                    color: var(--color-text-secondary, #999);
                    margin-top: 4px;
                }

                /* Sections */
                .finance-section {
                    background: var(--color-surface, #fff);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .finance-section-title {
                    display: flex; align-items: center; gap: 8px;
                    font-size: 1rem; font-weight: 600;
                    color: var(--color-text, #111);
                    margin: 0 0 1.25rem 0;
                }

                /* Expense Breakdown */
                .expense-breakdown-grid { display: flex; flex-direction: column; gap: 0.75rem; }
                .expense-breakdown-item { }
                .expense-breakdown-bar {
                    height: 8px; background: var(--color-bg, #f3f4f6);
                    border-radius: 4px; overflow: hidden;
                }
                .expense-breakdown-fill {
                    height: 100%; border-radius: 4px; transition: width 0.6s ease;
                }
                .expense-breakdown-info {
                    display: flex; justify-content: space-between;
                    margin-top: 4px;
                }
                .expense-breakdown-label { font-size: 0.8rem; color: var(--color-text-secondary, #666); }
                .expense-breakdown-value { font-size: 0.8rem; font-weight: 600; color: var(--color-text, #111); }

                /* Table */
                .finance-table-wrapper { overflow-x: auto; }
                .finance-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }
                .finance-table th, .finance-table td {
                    padding: 0.75rem 1rem;
                    text-align: right;
                    border-bottom: 1px solid var(--color-border, #e5e7eb);
                }
                .finance-table th {
                    text-align: right;
                    font-weight: 600;
                    color: var(--color-text-secondary, #666);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .finance-table th:first-child, .finance-table td:first-child { text-align: left; }
                .finance-table tbody tr:hover { background: var(--color-bg, #f9fafb); }
                .finance-table tfoot td {
                    border-top: 2px solid var(--color-border, #e5e7eb);
                    font-weight: 600;
                }

                /* Loading */
                .finance-loading {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    height: 300px; gap: 1rem;
                    color: var(--color-text-secondary, #666);
                }
                .finance-spinner {
                    width: 32px; height: 32px;
                    border: 3px solid var(--color-border, #e5e7eb);
                    border-top-color: var(--color-primary, #3b82f6);
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
