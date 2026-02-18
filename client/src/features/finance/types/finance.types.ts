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
    totalRevenue: number;
    revenueWithoutGst: number;
    totalGstCollected: number;
    totalPaid: number;
    totalPending: number;
    payrollCost: number;
    fixedCosts: number;
    cac: number;
    projectCosts: number;
    overheadCosts: number;
    totalExpenses: number;
    netProfit: number;
    netMargin: number;
    totalProjects: number;
    activeProjects: number;
    totalInvoices: number;
    overdueInvoices: number;
}

export interface MonthlyReportEntry {
    month: number;
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
