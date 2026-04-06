// ── Revenue Types ───────────────────────────────────────────────────
export type RevenueSource = 'project' | 'manual' | 'interest' | 'refund' | 'other';
export type RevenueStatus = 'pending' | 'received' | 'partially_received';

export interface Revenue {
    _id: string;
    title: string;
    description?: string;
    source: RevenueSource;
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    gstApplicable: boolean;
    gstAmount: number;
    gstRate: number;
    amountWithoutGst: number;
    tdsApplicable: boolean;
    tdsAmount: number;
    tdsRate: number;
    amountReceived: number;
    receivedDate?: string;
    projectId?: { _id: string; name: string } | string;
    clientId?: { _id: string; name: string; companyName?: string } | string;
    invoiceId?: { _id: string; invoiceNumber: string } | string;
    accrualMonth: number;
    accrualYear: number;
    cashMonth?: number;
    cashYear?: number;
    status: RevenueStatus;
    notes?: string;
    attachments?: string[];
    createdBy: { _id: string; name: string } | string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateRevenuePayload {
    title: string;
    description?: string;
    source: RevenueSource;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    gstApplicable?: boolean;
    gstRate?: number;
    tdsApplicable?: boolean;
    tdsRate?: number;
    projectId?: string;
    clientId?: string;
    accrualMonth: number;
    accrualYear: number;
    notes?: string;
}

// ── Expense Types ───────────────────────────────────────────────────
export type ExpenseCategory =
    | 'salary'
    | 'fixed'
    | 'cac'
    | 'project'
    | 'overhead'
    | 'tax'
    | 'transaction-fee'
    | 'currency-loss';

export type CostType = 'fixed' | 'variable';
export type ExpenseLevel = 'company' | 'project';
export type ExpenseStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export interface Expense {
    _id: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    category: ExpenseCategory;
    costType: CostType;
    expenseLevel: ExpenseLevel;
    projectId?: { _id: string; name: string } | string;
    employeeId?: { _id: string; employeeId: string; designation: string } | string;
    date: string;
    recurring: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
    gstApplicable: boolean;
    gstAmount: number;
    tdsApplicable: boolean;
    tdsAmount: number;
    status: ExpenseStatus;
    approvedBy?: { _id: string; name: string } | string;
    approvedAt?: string;
    notes?: string;
    attachments?: string[];
    createdBy: { _id: string; name: string } | string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateExpensePayload {
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    category: ExpenseCategory;
    costType?: CostType;
    expenseLevel?: ExpenseLevel;
    projectId?: string;
    employeeId?: string;
    date: string;
    recurring?: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
    gstApplicable?: boolean;
    gstAmount?: number;
    tdsApplicable?: boolean;
    tdsAmount?: number;
    notes?: string;
}

// ── Invoice Types ───────────────────────────────────────────────────
export type InvoiceStatus =
    | 'draft'
    | 'sent'
    | 'partial'
    | 'paid'
    | 'overdue'
    | 'cancelled';

export interface InvoiceItem {
    _id?: string;
    description: string;
    quantity: number;
    rate: number;
    amount?: number;
}

export interface Invoice {
    _id: string;
    invoiceNumber: string;
    projectId: { _id: string; name: string } | string;
    clientId: { _id: string; name: string; companyName?: string } | string;
    items: InvoiceItem[];
    subtotal: number;
    gstRate: number;
    gstAmount: number;
    tdsRate: number;
    tdsAmount: number;
    total: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    status: InvoiceStatus;
    issueDate: string;
    dueDate: string;
    paidAmount: number;
    paidAt?: string;
    notes?: string;
    createdBy: { _id: string; name: string } | string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateInvoicePayload {
    projectId: string;
    clientId: string;
    items: { description: string; quantity: number; rate: number }[];
    gstRate?: number;
    tdsRate?: number;
    currency?: string;
    exchangeRate?: number;
    issueDate: string;
    dueDate: string;
    notes?: string;
}

// ── Milestone Types ─────────────────────────────────────────────────
export type MilestoneStatus = 'pending' | 'completed' | 'invoiced' | 'paid';

export interface PaymentMilestone {
    _id: string;
    projectId: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    exchangeRate: number;
    amountInBaseCurrency: number;
    dueDate?: string;
    status: MilestoneStatus;
    completedAt?: string;
    paidAt?: string;
    invoiceId?: { _id: string; invoiceNumber: string; status: string } | string;
    notes?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateMilestonePayload {
    projectId: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    dueDate?: string;
    notes?: string;
}

// ── Dashboard / Report Types ────────────────────────────────────────
export interface CompanyDashboardStats {
    // Revenue
    totalRevenue: number;
    revenueWithoutGst: number;
    totalGstCollected: number;
    totalPaid: number;
    totalPending: number;

    // Expenses
    payrollCost: number;
    fixedCosts: number;
    variableCosts: number;
    cac: number;
    projectCosts: number;
    overheadCosts: number;
    totalExpenses: number;
    depreciation: number;
    interestExpense: number;
    taxExpense: number;

    // Profitability
    grossProfit: number;
    grossMargin: number;
    ebitda: number;
    ebitdaMargin: number;
    netProfit: number;
    netMargin: number;

    // Cash Position
    cashInBank: number;
    receivables: number;
    payables: number;

    // Runway
    runwayMonths: number;
    avgMonthlyExpenses: number;

    // Counts
    totalProjects: number;
    activeProjects: number;
    totalInvoices: number;
    overdueInvoices: number;
}

export interface MonthlyReportEntry {
    month: number;
    fiscalMonthIndex?: number;
    calendarYear?: number;
    revenue: number;
    gst: number;
    revenueWithoutGst: number;
    cashReceived: number;
    expenses: number;
    payroll: number;
    totalExpenses: number;
    netProfit: number;
    netMargin: number;
}

export interface MonthlySalaryEntry {
    month: number;
    fiscalMonthIndex: number;
    calendarYear: number;
    totalSalary: number;
    employeeCount: number;
}

export interface ProjectProfitabilityEntry {
    projectId: string;
    projectName: string;
    clientName: string;
    status: string;
    startDate?: string;
    endDate?: string;
    budget: number;
    totalRevenue: number;
    totalExpenses: number;
    profit: number;
    profitMargin: number;
    isProfitable: boolean;
    monthlyBurnRate: number;
    monthlyRevenueRate: number;
    profitableUntil: string | null;
}

export interface MonthlyRevenueEntry {
    month: number;
    totalRevenue: number;
    revenueWithoutGst: number;
    gst: number;
    received: number;
    manualRevenue: number;
    invoiceRevenue: number;
}

export interface RevenueSummary {
    totalRevenue: number;
    revenueWithoutGst: number;
    gstCollected: number;
    received: number;
    pending: number;
    manualRevenue: number;
    invoiceRevenue: number;
}

export interface ProjectFinanceSummary {
    projectId: string;
    projectName: string;
    clientName: string;
    budget: number;
    currency: string;
    billingType: string;
    totalInvoiced: number;
    totalPaid: number;
    totalPending: number;
    gstCollected: number;
    revenueWithoutGst: number;
    developerCosts: {
        userId: string;
        userName: string;
        designation: string;
        totalHours: number;
        billableHours: number;
        hourlyRate: number;
        totalCost: number;
    }[];
    totalDeveloperCost: number;
    directExpenses: number;
    taxExpenses: number;
    transactionFees: number;
    currencyLosses: number;
    totalExpenses: number;
    milestones: {
        total: number;
        completed: number;
        paid: number;
        pending: number;
        totalAmount: number;
        completedAmount: number;
        paidAmount: number;
    };
    totalCost: number;
    grossProfit: number;
    grossMargin: number;
    budgetUtilization: number;
}

export interface ProjectFinanceOverview {
    projectId: string;
    projectName: string;
    clientName: string;
    budget: number;
    currency: string;
    status: string;
    totalInvoiced: number;
    totalPaid: number;
    totalExpenses: number;
    profit: number;
}

export interface AccrualVsCashEntry {
    month: number;
    accrualRevenue: number;
    cashRevenue: number;
}

// ── Currency Types ──────────────────────────────────────────────────
export interface CurrencyRateEntry {
    _id: string;
    rate: number;
    date: string;
}

export interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}
