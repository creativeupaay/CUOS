import { useState } from 'react';
import {
    BarChart3,
    TrendingUp,
    RefreshCw,
} from 'lucide-react';
import {
    useGetMonthlyReportQuery,
    useGetAccrualVsCashflowQuery,
    useGetAllProjectsFinanceQuery,
} from '@/features/finance/api/financeApi';
import { useNavigate } from 'react-router-dom';
import type { ProjectFinanceOverview } from '@/features/finance/types/finance.types';

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FinanceReportsPage() {
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [activeTab, setActiveTab] = useState<'monthly' | 'accrual' | 'projects'>('monthly');

    const { data: monthlyData, isLoading: monthlyLoading } = useGetMonthlyReportQuery(year);
    const { data: accrualData, isLoading: accrualLoading } = useGetAccrualVsCashflowQuery({
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
    });
    const { data: projectsData, isLoading: projectsLoading } = useGetAllProjectsFinanceQuery();

    const isLoading = monthlyLoading || accrualLoading || projectsLoading;

    return (
        <div className="finance-reports">
            <div className="finance-page-header">
                <div>
                    <h1 className="finance-page-title">Financial Reports</h1>
                    <p className="finance-page-subtitle">Detailed financial analysis and comparisons</p>
                </div>
                <div className="reports-controls">
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="finance-select">
                        {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="reports-tabs">
                {[
                    { key: 'monthly' as const, label: 'Monthly P&L', icon: <BarChart3 size={16} /> },
                    { key: 'accrual' as const, label: 'Accrual vs Cash', icon: <RefreshCw size={16} /> },
                    { key: 'projects' as const, label: 'Project Finance', icon: <TrendingUp size={16} /> },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        className={`reports-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="finance-loading"><div className="finance-spinner" /><span>Loading reports...</span></div>
            ) : (
                <>
                    {/* Monthly P&L */}
                    {activeTab === 'monthly' && monthlyData && (
                        <div className="reports-section">
                            <h2 className="reports-section-title">Monthly Profit & Loss — {year}</h2>
                            <div className="finance-table-wrapper">
                                <table className="finance-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Month</th>
                                            <th>Revenue</th>
                                            <th>GST</th>
                                            <th>Rev (excl GST)</th>
                                            <th>Expenses</th>
                                            <th>Payroll</th>
                                            <th>Total Expenses</th>
                                            <th>Net Profit</th>
                                            <th>Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthlyData.map((m) => (
                                            <tr key={m.month}>
                                                <td style={{ textAlign: 'left' }}>{MONTH_NAMES[m.month - 1]}</td>
                                                <td>{formatCurrency(m.revenue)}</td>
                                                <td>{formatCurrency(m.gst)}</td>
                                                <td>{formatCurrency(m.revenueWithoutGst)}</td>
                                                <td>{formatCurrency(m.expenses)}</td>
                                                <td>{formatCurrency(m.payroll)}</td>
                                                <td>{formatCurrency(m.totalExpenses)}</td>
                                                <td style={{ color: m.netProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
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
                                            <td style={{ textAlign: 'left' }}><strong>Total</strong></td>
                                            <td><strong>{formatCurrency(monthlyData.reduce((s, m) => s + m.revenue, 0))}</strong></td>
                                            <td><strong>{formatCurrency(monthlyData.reduce((s, m) => s + m.gst, 0))}</strong></td>
                                            <td><strong>{formatCurrency(monthlyData.reduce((s, m) => s + m.revenueWithoutGst, 0))}</strong></td>
                                            <td><strong>{formatCurrency(monthlyData.reduce((s, m) => s + m.expenses, 0))}</strong></td>
                                            <td><strong>{formatCurrency(monthlyData.reduce((s, m) => s + m.payroll, 0))}</strong></td>
                                            <td><strong>{formatCurrency(monthlyData.reduce((s, m) => s + m.totalExpenses, 0))}</strong></td>
                                            <td><strong>{formatCurrency(monthlyData.reduce((s, m) => s + m.netProfit, 0))}</strong></td>
                                            <td>—</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* Bar comparison */}
                            <div className="reports-bars" style={{ marginTop: '2rem' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>Revenue vs Expenses</h3>
                                <div className="comparison-chart">
                                    {monthlyData.map((m) => {
                                        const maxVal = Math.max(m.revenue, m.totalExpenses, 1);
                                        return (
                                            <div key={m.month} className="comparison-col">
                                                <div className="comparison-bars">
                                                    <div className="comparison-bar revenue" style={{ height: `${(m.revenue / maxVal) * 100}%` }} title={`Revenue: ${formatCurrency(m.revenue)}`} />
                                                    <div className="comparison-bar expense" style={{ height: `${(m.totalExpenses / maxVal) * 100}%` }} title={`Expenses: ${formatCurrency(m.totalExpenses)}`} />
                                                </div>
                                                <span className="comparison-label">{MONTH_NAMES[m.month - 1]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="comparison-legend">
                                    <span><span className="legend-dot" style={{ background: '#10b981' }} /> Revenue</span>
                                    <span><span className="legend-dot" style={{ background: '#ef4444' }} /> Expenses</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Accrual vs Cash */}
                    {activeTab === 'accrual' && accrualData && (
                        <div className="reports-section">
                            <h2 className="reports-section-title">Accrual vs Cash Revenue — {year}</h2>
                            <p className="reports-section-desc">
                                <strong>Accrual:</strong> Revenue recognized when invoice is raised. <strong>Cash:</strong> Revenue when payment is received.
                            </p>
                            <div className="finance-table-wrapper">
                                <table className="finance-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Month</th>
                                            <th>Accrual Revenue</th>
                                            <th>Cash Revenue</th>
                                            <th>Difference</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accrualData.map((entry) => {
                                            const diff = entry.accrualRevenue - entry.cashRevenue;
                                            return (
                                                <tr key={entry.month}>
                                                    <td style={{ textAlign: 'left' }}>{MONTH_NAMES[entry.month - 1]}</td>
                                                    <td>{formatCurrency(entry.accrualRevenue)}</td>
                                                    <td>{formatCurrency(entry.cashRevenue)}</td>
                                                    <td style={{ color: diff >= 0 ? '#f59e0b' : '#10b981' }}>
                                                        {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Project Finance Overview */}
                    {activeTab === 'projects' && projectsData && (
                        <div className="reports-section">
                            <h2 className="reports-section-title">All Projects — Financial Overview</h2>
                            <div className="finance-table-wrapper">
                                <table className="finance-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Project</th>
                                            <th style={{ textAlign: 'left' }}>Client</th>
                                            <th>Status</th>
                                            <th>Budget</th>
                                            <th>Invoiced</th>
                                            <th>Paid</th>
                                            <th>Expenses</th>
                                            <th>Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(projectsData as ProjectFinanceOverview[]).map((p) => (
                                            <tr key={p.projectId} style={{ cursor: 'pointer' }} onClick={() => navigate(`/finance/projects/${p.projectId}`)}>
                                                <td style={{ textAlign: 'left' }}><strong>{p.projectName}</strong></td>
                                                <td style={{ textAlign: 'left' }}>{p.clientName}</td>
                                                <td>
                                                    <span className="finance-badge" style={{
                                                        background: p.status === 'active' ? '#10b98120' : '#6b728020',
                                                        color: p.status === 'active' ? '#10b981' : '#6b7280',
                                                    }}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td>{formatCurrency(p.budget)}</td>
                                                <td>{formatCurrency(p.totalInvoiced)}</td>
                                                <td>{formatCurrency(p.totalPaid)}</td>
                                                <td>{formatCurrency(p.totalExpenses)}</td>
                                                <td style={{ color: p.profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                    {formatCurrency(p.profit)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            <style>{`
                .finance-reports { padding: 2rem; max-width: 1400px; margin: 0 auto; }
                .finance-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
                .finance-page-title { font-size: 1.75rem; font-weight: 700; color: var(--color-text, #111); margin: 0; }
                .finance-page-subtitle { color: var(--color-text-secondary, #666); margin: 0.25rem 0 0; font-size: 0.9rem; }
                .reports-controls { display: flex; gap: 0.75rem; }
                .finance-select { padding: 0.5rem 0.75rem; border: 1px solid var(--color-border, #e5e7eb); border-radius: 8px; background: var(--color-surface, #fff); color: var(--color-text, #111); font-size: 0.875rem; cursor: pointer; }

                .reports-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
                .reports-tab {
                    display: flex; align-items: center; gap: 6px;
                    padding: 0.6rem 1rem; border: 1px solid var(--color-border, #e5e7eb);
                    border-radius: 8px; background: var(--color-surface, #fff);
                    color: var(--color-text-secondary, #666); font-size: 0.85rem;
                    cursor: pointer; transition: all 0.2s; font-weight: 500;
                }
                .reports-tab.active {
                    background: var(--color-primary, #3b82f6); color: white; border-color: transparent;
                }
                .reports-tab:hover:not(.active) { background: var(--color-bg, #f3f4f6); }

                .reports-section {
                    background: var(--color-surface, #fff); border-radius: 12px; padding: 1.5rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .reports-section-title { font-size: 1rem; font-weight: 600; margin: 0 0 1rem; color: var(--color-text, #111); }
                .reports-section-desc { font-size: 0.825rem; color: var(--color-text-secondary, #666); margin-bottom: 1.25rem; }

                .finance-table-wrapper { overflow-x: auto; }
                .finance-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .finance-table th, .finance-table td { padding: 0.75rem 1rem; text-align: right; border-bottom: 1px solid var(--color-border, #e5e7eb); }
                .finance-table th { font-weight: 600; color: var(--color-text-secondary, #666); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .finance-table tbody tr:hover { background: var(--color-bg, #f9fafb); }
                .finance-table tfoot td { border-top: 2px solid var(--color-border, #e5e7eb); font-weight: 600; }
                .finance-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }

                .comparison-chart { display: flex; align-items: flex-end; gap: 10px; height: 160px; }
                .comparison-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
                .comparison-bars { display: flex; gap: 3px; align-items: flex-end; height: 100%; width: 100%; }
                .comparison-bar { flex: 1; border-radius: 3px 3px 0 0; transition: height 0.5s ease; min-height: 2px; cursor: pointer; }
                .comparison-bar.revenue { background: #10b981; }
                .comparison-bar.expense { background: #ef4444; }
                .comparison-label { font-size: 0.65rem; color: var(--color-text-secondary, #999); margin-top: 6px; }
                .comparison-legend { display: flex; gap: 1rem; justify-content: center; margin-top: 1rem; font-size: 0.8rem; color: var(--color-text-secondary, #666); }
                .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }

                .finance-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 1rem; color: var(--color-text-secondary, #666); }
                .finance-spinner { width: 32px; height: 32px; border: 3px solid var(--color-border, #e5e7eb); border-top-color: var(--color-primary, #3b82f6); border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
