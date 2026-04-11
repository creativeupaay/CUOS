import { useState, useEffect, useMemo } from 'react';
import {
    TrendingUp, TrendingDown, IndianRupee, Wallet,
    Receipt, Calendar, ChevronDown, Filter, Loader2, X, Clock3, AlertTriangle,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, LineChart, Line, ReferenceLine, Cell,
} from 'recharts';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useGetBankTransactionsQuery, useGetFinanceDashboardQuery, useGetRevenuesQuery } from '@/features/finance/api/financeApi';
import { useGetProjectsQuery } from '@/features/project/projectApi';
import useBodyScrollLock from '@/hooks/useBodyScrollLock';

// ── Types ─────────────────────────────────────────────────────────────────
type FilterType = 'fiscal-year' | 'quarter' | 'month' | 'custom';
type FinanceDrawerType = 'runway' | 'receivables' | 'ebidta' | null;

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

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.44;

const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getTime() + (days * DAY_MS));
const diffDays = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

const formatDateLong = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const getPhaseExpectedAmount = (phase: any, project: any) => {
    if (Number(phase?.paymentAmount || 0) > 0) return Number(phase.paymentAmount || 0);
    if (Number(phase?.paymentPercentage || 0) > 0 && Number(project?.budget || 0) > 0) {
        return (Number(project.budget || 0) * Number(phase.paymentPercentage || 0)) / 100;
    }
    return 0;
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
    const navigate = useNavigate();
    const [filterType, setFilterType] = useState<FilterType>('fiscal-year');
    const [selectedFiscalYear, setSelectedFiscalYear] = useState(FISCAL_YEARS[0].value);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedQuarter, setSelectedQuarter] = useState('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [activeDrawer, setActiveDrawer] = useState<FinanceDrawerType>(null);
    const [renderDrawer, setRenderDrawer] = useState(false);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

    useBodyScrollLock(Boolean(activeDrawer));

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
    // Keep cash metric aligned with Cash in Bank page summary source.
    const { data: cashSummaryData } = useGetBankTransactionsQuery({ page: 1, limit: 1 });
    const { data: revenuesData } = useGetRevenuesQuery({ page: 1, limit: 500 });
    const { data: projectsData } = useGetProjectsQuery({});
    const cashInBank = cashSummaryData?.data?.summary?.totalCashInBank ?? dashboardData?.data?.metrics?.cashInBank ?? 0;

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

    const projectPhaseReceivables = useMemo(() => {
        const projects = projectsData?.data || [];

        const items = projects.flatMap((project: any) => {
            const phases = project?.phases || [];
            return phases
                .filter((phase: any) => phase?.hasPayment)
                .map((phase: any, index: number) => {
                    const expectedAmount = getPhaseExpectedAmount(phase, project);
                    const receivedAmount = Number(phase?.paymentReceivedAmount || 0);
                    const outstanding = Math.max(0, expectedAmount - receivedAmount);
                    const status = String(phase?.paymentStatus || 'pending').toLowerCase();
                    const dueDateRaw = phase?.paymentDueDate || phase?.endDate || null;
                    const dueDate = dueDateRaw ? getStartOfDay(new Date(dueDateRaw)) : null;

                    return {
                        id: `${String(project?._id || 'project')}-${String(phase?._id || index)}`,
                        client: String(project?.name || 'Project'),
                        description: `Phase Payment: ${String(phase?.name || 'Unnamed phase')}`,
                        outstanding,
                        dueDate,
                        source: 'phase-payment' as const,
                        status,
                    };
                })
                .filter((item: any) => item.outstanding > 0 && ['pending', 'partial'].includes(item.status));
        });

        const total = items.reduce((acc: number, item: any) => acc + Number(item.outstanding || 0), 0);
        return { items, total };
    }, [projectsData]);

    const combinedReceivablesValue = Math.max(0, Number(metrics.receivables || 0)) + projectPhaseReceivables.total;

    const runwayInsights = useMemo(() => {
        const today = getStartOfDay(new Date());
        const rowsWithExpense = monthlyData.filter((row: any) => Number(row.expense || 0) > 0);
        const rowsWithNetBurn = monthlyData.filter((row: any) => Number(row.expense || 0) - Number(row.revenue || 0) > 0);

        const averageMonthlyExpense = rowsWithExpense.length > 0
            ? rowsWithExpense.reduce((acc: number, row: any) => acc + Number(row.expense || 0), 0) / rowsWithExpense.length
            : 0;

        const averageNetBurn = rowsWithNetBurn.length > 0
            ? rowsWithNetBurn.reduce((acc: number, row: any) => acc + (Number(row.expense || 0) - Number(row.revenue || 0)), 0) / rowsWithNetBurn.length
            : 0;

        const burnRateMonthly = averageNetBurn > 0 ? averageNetBurn : averageMonthlyExpense;
        const burnBasisLabel = averageNetBurn > 0 ? 'Net burn (Expense - Revenue)' : 'Gross expense burn';

        const openRevenues = (revenuesData?.data?.revenues || []).filter((item: any) =>
            ['pending', 'partial', 'overdue'].includes(String(item.status || '').toLowerCase())
        );

        const financeReceivables = openRevenues
            .map((item: any) => {
                const outstanding = Math.max(0, Number(item.totalAmount || item.amountINR || item.amount || 0) - Number(item.receivedAmount || 0));
                const dueDate = item.dueDate ? getStartOfDay(new Date(item.dueDate)) : null;
                return {
                    id: String(item._id || ''),
                    client: String(item.client || 'Unknown client'),
                    description: String(item.description || item.invoiceNumber || 'Receivable'),
                    outstanding,
                    dueDate,
                    source: 'finance-revenue' as const,
                };
            });

        const mergedReceivables = [...financeReceivables, ...projectPhaseReceivables.items];

        const receivablesWithDueDate = mergedReceivables
            .filter((item: any) => item.outstanding > 0 && item.dueDate)
            .sort((a: any, b: any) => (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime());

        const totalOpenReceivables = mergedReceivables.reduce((acc: number, item: any) => acc + Number(item.outstanding || 0), 0);

        if (burnRateMonthly <= 0) {
            return {
                monthlyBurn: 0,
                burnBasisLabel,
                baseRunwayMonths: null,
                baseRunwayEndDate: null,
                projectedRunwayEndDate: null,
                projectedRunwayMonths: null,
                extensionMonths: null,
                extensionDays: null,
                totalOpenReceivables,
                phaseOpenReceivables: projectPhaseReceivables.total,
                receivablesAppliedAmount: 0,
                financeOpenReceivables: Math.max(0, totalOpenReceivables - projectPhaseReceivables.total),
                appliedReceivables: [] as Array<{ id: string; client: string; description: string; outstanding: number; dueDate: Date | null; source: 'finance-revenue' | 'phase-payment' }>,
            };
        }

        const dailyBurn = burnRateMonthly / DAYS_PER_MONTH;
        const baseRunwayMonths = cashInBank > 0 ? cashInBank / burnRateMonthly : 0;
        const baseRunwayDays = cashInBank > 0 ? cashInBank / dailyBurn : 0;
        const baseRunwayEndDate = cashInBank > 0 ? addDays(today, baseRunwayDays) : today;

        let remainingCash = Math.max(0, cashInBank);
        let cursorDate = today;
        const appliedReceivables: Array<{ id: string; client: string; description: string; outstanding: number; dueDate: Date | null; source: 'finance-revenue' | 'phase-payment' }> = [];

        for (const receivable of receivablesWithDueDate) {
            if (!receivable.dueDate || remainingCash <= 0) break;

            const daysUntilDue = diffDays(cursorDate, receivable.dueDate);
            const burnTillDue = daysUntilDue * dailyBurn;

            if (burnTillDue >= remainingCash) {
                // Cash depletes before reaching this due date.
                break;
            }

            remainingCash -= burnTillDue;
            remainingCash += receivable.outstanding;
            cursorDate = receivable.dueDate;
            appliedReceivables.push(receivable);
        }

        const projectedRunwayDaysFromCursor = remainingCash / dailyBurn;
        const projectedRunwayEndDate = addDays(cursorDate, projectedRunwayDaysFromCursor);
        const projectedRunwayTotalDays = diffDays(today, projectedRunwayEndDate);
        const projectedRunwayMonths = projectedRunwayTotalDays / DAYS_PER_MONTH;

        const extensionDays = Math.max(0, projectedRunwayTotalDays - Math.floor(baseRunwayDays));
        const extensionMonths = extensionDays / DAYS_PER_MONTH;
        const receivablesAppliedAmount = appliedReceivables.reduce((acc, item) => acc + item.outstanding, 0);

        return {
            monthlyBurn: burnRateMonthly,
            burnBasisLabel,
            baseRunwayMonths,
            baseRunwayEndDate,
            projectedRunwayEndDate,
            projectedRunwayMonths,
            extensionMonths,
            extensionDays,
            totalOpenReceivables,
            phaseOpenReceivables: projectPhaseReceivables.total,
            receivablesAppliedAmount,
            financeOpenReceivables: Math.max(0, totalOpenReceivables - projectPhaseReceivables.total),
            appliedReceivables,
        };
    }, [cashInBank, monthlyData, revenuesData, projectPhaseReceivables]);

    const receivablesAuditItems = useMemo(() => {
        const today = getStartOfDay(new Date());

        const financeItems = (revenuesData?.data?.revenues || [])
            .filter((item: any) => ['pending', 'partial', 'overdue'].includes(String(item?.status || '').toLowerCase()))
            .map((item: any) => {
                const expected = Number(item?.totalAmount || item?.amountINR || item?.amount || 0);
                const received = Number(item?.receivedAmount || 0);
                const outstanding = Math.max(0, expected - received);
                const dueDate = item?.dueDate ? getStartOfDay(new Date(item.dueDate)) : null;
                const status = dueDate && dueDate < today
                    ? 'overdue'
                    : (String(item?.status || 'pending').toLowerCase() === 'partial' ? 'partial' : 'pending');

                return {
                    id: `finance-${String(item?._id || '')}`,
                    source: 'finance-revenue',
                    sourceLabel: 'Finance Revenue',
                    party: String(item?.client || 'Unknown client'),
                    title: String(item?.description || item?.invoiceNumber || 'Receivable'),
                    dueDate,
                    status,
                    expected,
                    received,
                    outstanding,
                };
            })
            .filter((item: any) => item.outstanding > 0);

        const phaseItems = projectPhaseReceivables.items.map((item: any) => {
            const dueDate = item?.dueDate ? getStartOfDay(new Date(item.dueDate)) : null;
            const status = dueDate && dueDate < today ? 'overdue' : 'pending';
            return {
                id: `phase-${item.id}`,
                source: 'phase-payment',
                sourceLabel: 'Project Phase',
                party: item.client,
                title: item.description,
                dueDate,
                status,
                expected: Number(item.outstanding || 0),
                received: 0,
                outstanding: Number(item.outstanding || 0),
            };
        });

        return [...financeItems, ...phaseItems].sort((a: any, b: any) => {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.getTime() - b.dueDate.getTime();
        });
    }, [projectPhaseReceivables.items, revenuesData]);

    const ebidtaInsights = useMemo(() => {
        const rows = breakdownData || [];
        const totalRevenue = rows.reduce((acc: number, row: any) => acc + Number(row?.revenue || 0), 0);
        const totalExpense = rows.reduce((acc: number, row: any) => acc + Number(row?.expense || 0), 0);
        const totalEbidta = rows.reduce((acc: number, row: any) => acc + Number(row?.ebidta || 0), 0);
        const totalSalaries = rows.reduce((acc: number, row: any) => acc + Number(row?.salaries || 0), 0);
        const totalProjectCosts = rows.reduce((acc: number, row: any) => acc + Number(row?.projectCosts || 0), 0);
        const totalFixedCosts = rows.reduce((acc: number, row: any) => acc + Number(row?.fixedCosts || 0), 0);
        const marginPct = totalRevenue > 0 ? (totalEbidta / totalRevenue) * 100 : 0;

        const positiveMonths = rows.filter((row: any) => Number(row?.ebidta || 0) >= 0).length;
        const negativeMonths = rows.length - positiveMonths;

        return {
            totalRevenue,
            totalExpense,
            totalEbidta,
            totalSalaries,
            totalProjectCosts,
            totalFixedCosts,
            marginPct,
            positiveMonths,
            negativeMonths,
            rows,
        };
    }, [breakdownData]);

    useEffect(() => {
        if (!activeDrawer) {
            setIsDrawerVisible(false);
            if (!renderDrawer) return;
            const id = window.setTimeout(() => setRenderDrawer(false), 260);
            return () => window.clearTimeout(id);
        }

        setRenderDrawer(true);
        const id = window.setTimeout(() => setIsDrawerVisible(true), 12);
        return () => window.clearTimeout(id);
    }, [activeDrawer, renderDrawer]);

    useEffect(() => {
        if (!activeDrawer) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActiveDrawer(null);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [activeDrawer]);

    const runwayCardMonths = runwayInsights.baseRunwayMonths
        ?? (metrics.runwayLeft > 0 ? metrics.runwayLeft : null);
    const runwayCardValue = runwayCardMonths !== null && Number.isFinite(runwayCardMonths)
        ? `${Math.max(0, runwayCardMonths).toFixed(1)} mo`
        : 'N/A';
    const runwayCardFullValue = runwayCardMonths !== null && Number.isFinite(runwayCardMonths)
        ? `${Math.max(0, runwayCardMonths).toFixed(1)} months`
        : 'Not enough data';

    const metricCards = [
        {
            label: 'Cash in Bank',
            value: formatCurrency(cashInBank),
            fullValue: formatFullCurrency(cashInBank),
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
            value: formatCurrency(combinedReceivablesValue),
            fullValue: formatFullCurrency(combinedReceivablesValue),
            icon: Receipt,
            color: '#8B5CF6',
            bg: '#F5F3FF',
        },
        {
            label: 'Runway Left',
            value: runwayCardValue,
            fullValue: runwayCardFullValue,
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
        <>
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
                            cursor: card.label === 'Cash in Bank' || card.label === 'Total Revenue' || card.label === 'Total Expense' || card.label === 'Runway Left' || card.label === 'Receivables' || card.label === 'EBIDTA' ? 'pointer' : 'default',
                        }}
                        onClick={() => {
                            if (card.label === 'Cash in Bank') {
                                navigate('/finance/cash-in-bank');
                                return;
                            }
                            if (card.label === 'Total Revenue') {
                                navigate('/finance/revenue');
                                return;
                            }
                            if (card.label === 'Total Expense') {
                                navigate('/finance/expenses');
                                return;
                            }
                            if (card.label === 'Receivables') {
                                setActiveDrawer('receivables');
                                return;
                            }
                            if (card.label === 'EBIDTA') {
                                setActiveDrawer('ebidta');
                                return;
                            }
                            if (card.label === 'Runway Left') {
                                setActiveDrawer('runway');
                            }
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
        {renderDrawer && typeof document !== 'undefined' && createPortal(
            <>
                <div
                    className={`fixed inset-0 z-[70] transition-opacity duration-300 ${isDrawerVisible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ backgroundColor: 'rgba(15, 28, 20, 0.22)' }}
                    onClick={() => setActiveDrawer(null)}
                />
                <aside
                    className={`fixed top-0 right-0 z-[71] h-full w-full max-w-[620px] border-l shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isDrawerVisible ? 'translate-x-0' : 'translate-x-full'}`}
                    style={{
                        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAF9 100%)',
                        borderColor: 'var(--color-border-default)',
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Finance details"
                >
                    <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border-default)' }}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--color-primary-dark)' }}>
                                    Finance
                                </p>
                                <h2 className="text-lg font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                                    {activeDrawer === 'runway' ? 'Runway Left Breakdown' : activeDrawer === 'receivables' ? 'Receivables Breakdown' : 'EBIDTA Breakdown'}
                                </h2>
                                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                    {activeDrawer === 'runway' && 'Projection based on current cash, burn rate, and pending receivables.'}
                                    {activeDrawer === 'receivables' && 'Unified audit view of pending invoices and phase-wise due pipeline.'}
                                    {activeDrawer === 'ebidta' && 'Detailed profitability view synced with monthly financial breakdown data.'}
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveDrawer(null)}
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: 'var(--color-text-secondary)' }}
                                aria-label="Close finance details"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {activeDrawer === 'runway' && (
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Base Runway</p>
                                <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>
                                    {runwayInsights.baseRunwayMonths !== null ? `${Math.max(0, runwayInsights.baseRunwayMonths).toFixed(1)} mo` : 'N/A'}
                                </p>
                                <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                                    Lasts till {formatDateLong(runwayInsights.baseRunwayEndDate)}
                                </p>
                            </div>

                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#ECFDF5' }}>
                                <p className="text-xs font-medium" style={{ color: '#166534' }}>Projected Runway</p>
                                <p className="text-2xl font-semibold mt-1" style={{ color: '#14532D' }}>
                                    {runwayInsights.projectedRunwayMonths !== null ? `${Math.max(0, runwayInsights.projectedRunwayMonths).toFixed(1)} mo` : 'N/A'}
                                </p>
                                <p className="text-xs mt-2" style={{ color: '#166534' }}>
                                    Extends till {formatDateLong(runwayInsights.projectedRunwayEndDate)}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                                <Clock3 size={15} style={{ color: 'var(--color-warning)' }} />
                                Key Terms Used in Calculation
                            </h3>
                            <div className="mt-3 space-y-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                <p><strong>Burn Rate:</strong> {formatFullCurrency(runwayInsights.monthlyBurn)} per month ({runwayInsights.burnBasisLabel}).</p>
                                <p><strong>Base Runway End Date:</strong> Date when cash-in-bank is exhausted, without any additional inflow.</p>
                                <p><strong>Projected Runway:</strong> Base runway adjusted by receivables due before depletion.</p>
                                <p><strong>Extension:</strong> Extra days/months gained if expected receivables are realized on their due dates.</p>
                            </div>
                        </div>

                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Impact Summary</h3>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total open receivables</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatFullCurrency(runwayInsights.totalOpenReceivables)}</p>
                                    <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        Finance: {formatFullCurrency(runwayInsights.financeOpenReceivables)} | Phase: {formatFullCurrency(runwayInsights.phaseOpenReceivables)}
                                    </p>
                                </div>
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Receivables used in projection</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatFullCurrency(runwayInsights.receivablesAppliedAmount)}</p>
                                </div>
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Runway extension (days)</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{runwayInsights.extensionDays !== null ? Math.round(runwayInsights.extensionDays) : 'N/A'}</p>
                                </div>
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Runway extension (months)</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{runwayInsights.extensionMonths !== null ? runwayInsights.extensionMonths.toFixed(1) : 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Expected Receivables Timeline</h3>
                            {runwayInsights.appliedReceivables.length === 0 ? (
                                <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                                    No pending receivable with due-date could be applied before base runway depletion.
                                </p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {runwayInsights.appliedReceivables.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between rounded-lg border p-3"
                                            style={{ borderColor: '#E6F0EB', backgroundColor: '#F9FFFC' }}
                                        >
                                            <div>
                                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.client}</p>
                                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                                                    {item.description} ({item.source === 'phase-payment' ? 'Project Phase' : 'Finance Revenue'})
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-semibold" style={{ color: '#166534' }}>{formatFullCurrency(item.outstanding)}</p>
                                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{formatDateLong(item.dueDate)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {activeDrawer === 'receivables' && (
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Total Open Receivables</p>
                                <p className="text-2xl font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatFullCurrency(receivablesAuditItems.reduce((acc, item) => acc + item.outstanding, 0))}</p>
                            </div>
                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Overdue Amount</p>
                                <p className="text-2xl font-semibold mt-1" style={{ color: '#B91C1C' }}>
                                    {formatFullCurrency(receivablesAuditItems.filter((item) => item.status === 'overdue').reduce((acc, item) => acc + item.outstanding, 0))}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Pending Receivables Detail</h3>
                            {receivablesAuditItems.length === 0 ? (
                                <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>No pending receivables found.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {receivablesAuditItems.map((item) => (
                                        <div key={item.id} className="rounded-lg border p-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{item.party}</p>
                                                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.title}</p>
                                                    <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{item.sourceLabel}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-semibold" style={{ color: item.status === 'overdue' ? '#B91C1C' : '#166534' }}>{formatFullCurrency(item.outstanding)}</p>
                                                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{formatDateLong(item.dueDate)}</p>
                                                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                                                        backgroundColor: item.status === 'overdue' ? '#FEF2F2' : '#F0FDF4',
                                                        color: item.status === 'overdue' ? '#B91C1C' : '#166534',
                                                    }}>
                                                        {item.status === 'overdue' ? <AlertTriangle size={10} /> : <Clock3 size={10} />}
                                                        {item.status === 'overdue' ? 'Overdue' : item.status === 'partial' ? 'Partial' : 'Pending'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {activeDrawer === 'ebidta' && (
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Total EBIDTA</p>
                                <p className="text-2xl font-semibold mt-1" style={{ color: ebidtaInsights.totalEbidta >= 0 ? '#166534' : '#B91C1C' }}>
                                    {formatFullCurrency(ebidtaInsights.totalEbidta)}
                                </p>
                            </div>
                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>EBIDTA Margin</p>
                                <p className="text-2xl font-semibold mt-1" style={{ color: ebidtaInsights.marginPct >= 0 ? '#166534' : '#B91C1C' }}>
                                    {ebidtaInsights.marginPct.toFixed(1)}%
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cost Composition</h3>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p style={{ color: 'var(--color-text-muted)' }}>Total Revenue</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: '#166534' }}>{formatFullCurrency(ebidtaInsights.totalRevenue)}</p>
                                </div>
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p style={{ color: 'var(--color-text-muted)' }}>Total Expense</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: '#B91C1C' }}>{formatFullCurrency(ebidtaInsights.totalExpense)}</p>
                                </div>
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p style={{ color: 'var(--color-text-muted)' }}>Salaries</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatFullCurrency(ebidtaInsights.totalSalaries)}</p>
                                </div>
                                <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC' }}>
                                    <p style={{ color: 'var(--color-text-muted)' }}>Project + Fixed Costs</p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-primary)' }}>{formatFullCurrency(ebidtaInsights.totalProjectCosts + ebidtaInsights.totalFixedCosts)}</p>
                                </div>
                            </div>
                            <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
                                Positive months: {ebidtaInsights.positiveMonths} | Negative months: {ebidtaInsights.negativeMonths}
                            </p>
                        </div>

                        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--color-border-default)', backgroundColor: '#FFFFFF' }}>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Monthly EBIDTA Breakdown</h3>
                            {ebidtaInsights.rows.length === 0 ? (
                                <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>No monthly breakdown available for selected filter.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {ebidtaInsights.rows.map((row: any) => (
                                        <div key={row.month} className="rounded-lg border p-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{row.month}</p>
                                                <p className="text-xs font-semibold" style={{ color: Number(row.ebidta || 0) >= 0 ? '#166534' : '#B91C1C' }}>
                                                    {formatFullCurrency(Number(row.ebidta || 0))}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                                                <p>Revenue: {formatFullCurrency(Number(row.revenue || 0))}</p>
                                                <p className="text-right">Expense: {formatFullCurrency(Number(row.expense || 0))}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </aside>
            </>,
            document.body,
        )}
        </>
    );
}
