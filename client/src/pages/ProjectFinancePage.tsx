import { useParams } from 'react-router-dom';
import {
    DollarSign,
    Users,
    FileText,
    Target,
    Clock,
    TrendingUp,
    TrendingDown,
    AlertCircle,
} from 'lucide-react';
import { useGetProjectFinanceSummaryQuery } from '@/features/finance/api/financeApi';

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
    return (
        <div className="pf-metric" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="pf-metric-icon" style={{ color }}>{icon}</div>
            <div>
                <div className="pf-metric-label">{label}</div>
                <div className="pf-metric-value">{value}</div>
            </div>
        </div>
    );
}

export default function ProjectFinancePage() {
    const { id } = useParams<{ id: string }>();
    const { data: summary, isLoading, error } = useGetProjectFinanceSummaryQuery(id || '');

    if (isLoading) {
        return (
            <div className="pf-page">
                <div className="finance-loading"><div className="finance-spinner" /><span>Loading project finance...</span></div>
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="pf-page">
                <div className="finance-empty"><AlertCircle size={48} /><p>Could not load project finance data</p></div>
            </div>
        );
    }

    const profitColor = summary.grossProfit >= 0 ? '#10b981' : '#ef4444';

    return (
        <div className="pf-page">
            {/* Header */}
            <div className="pf-header">
                <div>
                    <h1 className="finance-page-title">{summary.projectName}</h1>
                    <p className="finance-page-subtitle">
                        {summary.clientName} &middot; {summary.billingType} &middot; Budget: {formatCurrency(summary.budget)}
                    </p>
                </div>
                <div className="pf-profit-badge" style={{ background: `${profitColor}15`, color: profitColor }}>
                    {summary.grossProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    <span>{formatCurrency(summary.grossProfit)}</span>
                    <small>({summary.grossMargin.toFixed(1)}%)</small>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="pf-metrics-grid">
                <MetricCard label="Total Invoiced" value={formatCurrency(summary.totalInvoiced)} icon={<FileText size={18} />} color="#3b82f6" />
                <MetricCard label="Total Paid" value={formatCurrency(summary.totalPaid)} icon={<DollarSign size={18} />} color="#10b981" />
                <MetricCard label="Pending" value={formatCurrency(summary.totalPending)} icon={<Clock size={18} />} color="#f59e0b" />
                <MetricCard label="Revenue (excl GST)" value={formatCurrency(summary.revenueWithoutGst)} icon={<TrendingUp size={18} />} color="#8b5cf6" />
                <MetricCard label="Developer Cost" value={formatCurrency(summary.totalDeveloperCost)} icon={<Users size={18} />} color="#ef4444" />
                <MetricCard label="Direct Expenses" value={formatCurrency(summary.directExpenses)} icon={<DollarSign size={18} />} color="#6b7280" />
                <MetricCard label="Total Cost" value={formatCurrency(summary.totalCost)} icon={<TrendingDown size={18} />} color="#ef4444" />
                <MetricCard label="Budget Used" value={`${summary.budgetUtilization.toFixed(1)}%`} icon={<Target size={18} />} color="#f59e0b" />
            </div>

            {/* Developer Costs Table */}
            {summary.developerCosts.length > 0 && (
                <div className="pf-section">
                    <h2 className="pf-section-title"><Users size={18} /> Developer Cost Breakdown</h2>
                    <div className="finance-table-wrapper">
                        <table className="finance-table">
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left' }}>Developer</th>
                                    <th>Designation</th>
                                    <th>Total Hours</th>
                                    <th>Billable Hours</th>
                                    <th>Hourly Rate</th>
                                    <th>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.developerCosts.map((dev) => (
                                    <tr key={dev.userId}>
                                        <td style={{ textAlign: 'left' }}>{dev.userName}</td>
                                        <td>{dev.designation}</td>
                                        <td>{dev.totalHours}h</td>
                                        <td>{dev.billableHours}h</td>
                                        <td>{formatCurrency(dev.hourlyRate)}/h</td>
                                        <td><strong>{formatCurrency(dev.totalCost)}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'left' }}><strong>Total Developer Cost</strong></td>
                                    <td><strong>{formatCurrency(summary.totalDeveloperCost)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Milestone Progress */}
            {summary.milestones.total > 0 && (
                <div className="pf-section">
                    <h2 className="pf-section-title"><Target size={18} /> Payment Milestones</h2>
                    <div className="pf-milestone-stats">
                        <div className="pf-milestone-stat">
                            <span className="pf-ms-num">{summary.milestones.completed}</span>
                            <span className="pf-ms-label">Completed</span>
                        </div>
                        <div className="pf-milestone-stat">
                            <span className="pf-ms-num">{summary.milestones.paid}</span>
                            <span className="pf-ms-label">Paid</span>
                        </div>
                        <div className="pf-milestone-stat">
                            <span className="pf-ms-num">{summary.milestones.pending}</span>
                            <span className="pf-ms-label">Pending</span>
                        </div>
                        <div className="pf-milestone-stat">
                            <span className="pf-ms-num">{formatCurrency(summary.milestones.paidAmount)}</span>
                            <span className="pf-ms-label">of {formatCurrency(summary.milestones.totalAmount)}</span>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="pf-ms-progress-bar">
                        <div
                            className="pf-ms-progress-fill"
                            style={{
                                width: `${summary.milestones.totalAmount > 0 ? (summary.milestones.paidAmount / summary.milestones.totalAmount) * 100 : 0}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* P&L Summary */}
            <div className="pf-section">
                <h2 className="pf-section-title"><FileText size={18} /> Profit & Loss Summary</h2>
                <div className="pf-pl-grid">
                    <div className="pf-pl-col">
                        <h4>Revenue</h4>
                        <div className="pf-pl-row"><span>Total Invoiced</span><span>{formatCurrency(summary.totalInvoiced)}</span></div>
                        <div className="pf-pl-row"><span>GST Collected</span><span>{formatCurrency(summary.gstCollected)}</span></div>
                        <div className="pf-pl-row total"><span>Revenue (excl. GST)</span><span>{formatCurrency(summary.revenueWithoutGst)}</span></div>
                    </div>
                    <div className="pf-pl-col">
                        <h4>Costs</h4>
                        <div className="pf-pl-row"><span>Developer Cost</span><span>{formatCurrency(summary.totalDeveloperCost)}</span></div>
                        <div className="pf-pl-row"><span>Direct Expenses</span><span>{formatCurrency(summary.directExpenses)}</span></div>
                        <div className="pf-pl-row"><span>Tax Overhead</span><span>{formatCurrency(summary.taxExpenses)}</span></div>
                        <div className="pf-pl-row"><span>Transaction Fees</span><span>{formatCurrency(summary.transactionFees)}</span></div>
                        <div className="pf-pl-row"><span>Currency Losses</span><span>{formatCurrency(summary.currencyLosses)}</span></div>
                        <div className="pf-pl-row total"><span>Total Cost</span><span>{formatCurrency(summary.totalCost)}</span></div>
                    </div>
                </div>
                <div className="pf-pl-grand" style={{ color: profitColor }}>
                    <span>Gross Profit</span>
                    <span>{formatCurrency(summary.grossProfit)} ({summary.grossMargin.toFixed(1)}%)</span>
                </div>
            </div>

            <style>{`
                .pf-page { padding: 2rem; max-width: 1200px; margin: 0 auto; }
                .pf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
                .finance-page-title { font-size: 1.75rem; font-weight: 700; color: var(--color-text, #111); margin: 0; }
                .finance-page-subtitle { color: var(--color-text-secondary, #666); margin: 0.25rem 0 0; font-size: 0.9rem; }
                .pf-profit-badge {
                    display: flex; align-items: center; gap: 8px;
                    padding: 0.75rem 1.25rem; border-radius: 12px; font-weight: 700; font-size: 1.1rem;
                }
                .pf-profit-badge small { font-size: 0.8rem; font-weight: 500; opacity: 0.8; }

                .pf-metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
                .pf-metric {
                    display: flex; align-items: center; gap: 0.75rem;
                    background: var(--color-surface, #fff); padding: 1rem 1.25rem;
                    border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .pf-metric-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.04); }
                .pf-metric-label { font-size: 0.72rem; color: var(--color-text-secondary, #999); text-transform: uppercase; letter-spacing: 0.05em; }
                .pf-metric-value { font-size: 1.1rem; font-weight: 700; color: var(--color-text, #111); }

                .pf-section {
                    background: var(--color-surface, #fff); border-radius: 12px; padding: 1.5rem;
                    margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
                }
                .pf-section-title { display: flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 600; margin: 0 0 1.25rem; color: var(--color-text, #111); }

                .finance-table-wrapper { overflow-x: auto; }
                .finance-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .finance-table th, .finance-table td { padding: 0.75rem 1rem; text-align: right; border-bottom: 1px solid var(--color-border, #e5e7eb); }
                .finance-table th { font-weight: 600; color: var(--color-text-secondary, #666); font-size: 0.75rem; text-transform: uppercase; }
                .finance-table tbody tr:hover { background: var(--color-bg, #f9fafb); }
                .finance-table tfoot td { border-top: 2px solid var(--color-border, #e5e7eb); }

                .pf-milestone-stats { display: flex; gap: 2rem; margin-bottom: 1rem; }
                .pf-milestone-stat { display: flex; flex-direction: column; align-items: center; }
                .pf-ms-num { font-size: 1.25rem; font-weight: 700; color: var(--color-text, #111); }
                .pf-ms-label { font-size: 0.72rem; color: var(--color-text-secondary, #999); text-transform: uppercase; }
                .pf-ms-progress-bar { height: 8px; background: var(--color-bg, #f3f4f6); border-radius: 4px; overflow: hidden; }
                .pf-ms-progress-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #3b82f6, #10b981); transition: width 0.6s ease; }

                .pf-pl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
                .pf-pl-col h4 { margin: 0 0 0.75rem; font-size: 0.85rem; color: var(--color-text-secondary, #666); text-transform: uppercase; }
                .pf-pl-row { display: flex; justify-content: space-between; padding: 0.4rem 0; font-size: 0.85rem; border-bottom: 1px solid var(--color-border, #f3f4f6); }
                .pf-pl-row.total { border-top: 2px solid var(--color-text, #333); margin-top: 0.5rem; padding-top: 0.5rem; font-weight: 700; border-bottom: none; }
                .pf-pl-grand {
                    display: flex; justify-content: space-between; margin-top: 1.5rem;
                    padding: 1rem; border-radius: 10px; background: rgba(0,0,0,0.03);
                    font-size: 1.1rem; font-weight: 700;
                }

                .finance-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; gap: 1rem; color: var(--color-text-secondary, #666); }
                .finance-spinner { width: 32px; height: 32px; border: 3px solid var(--color-border, #e5e7eb); border-top-color: var(--color-primary, #3b82f6); border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .finance-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; color: var(--color-text-secondary, #999); }
            `}</style>
        </div>
    );
}
