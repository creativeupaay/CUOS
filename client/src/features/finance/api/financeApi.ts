import { api } from '@/services/api';

// ── Types ─────────────────────────────────────────────────────────────────
export interface Revenue {
    _id: string;
    date: string;
    description: string;
    client: string;
    project?: string;
    amount: number;
    currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    exchangeRate: number;
    amountINR: number;
    gstApplicable: boolean;
    gstRate: number;
    gst: number;
    tdsDeducted: number;
    totalAmount: number;
    receivedAmount: number;
    source: 'manual' | 'invoice' | 'project';
    status: 'received' | 'pending' | 'partial' | 'overdue';
    invoiceNumber?: string;
    dueDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Expense {
    _id: string;
    date: string;
    description: string;
    category: string;
    level: 'company' | 'project';
    type: 'fixed' | 'variable';
    amount: number;
    projectId?: string;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    notes?: string;
    isRecurring: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
    createdAt: string;
    updatedAt: string;
}

export interface DashboardMetrics {
    totalRevenue: number;
    totalExpense: number;
    ebidta: number;
    runwayLeft: number;
    cashInBank: number;
    receivables: number;
}

export interface MonthlyData {
    month: string;
    revenue: number;
    expense: number;
    profit: number;
}

export interface BreakdownData {
    month: string;
    revenue: number;
    expense: number;
    ebidta: number;
    salaries: number;
    projectCosts: number;
    fixedCosts: number;
}

export interface DashboardResponse {
    metrics: DashboardMetrics;
    monthlyData: MonthlyData[];
    breakdownData: BreakdownData[];
}

// ── API Slice ─────────────────────────────────────────────────────────────
export const financeApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // Dashboard
        getFinanceDashboard: builder.query<{ data: DashboardResponse }, { startDate?: string; endDate?: string }>({
            query: (params) => ({
                url: '/finance/dashboard',
                params,
            }),
            providesTags: ['FinanceDashboard'],
        }),

        // Revenue CRUD
        getRevenues: builder.query<{ data: { revenues: Revenue[]; total: number } }, {
            status?: string;
            source?: string;
            search?: string;
            startDate?: string;
            endDate?: string;
            page?: number;
            limit?: number;
        }>({
            query: (params) => ({
                url: '/finance/revenues',
                params,
            }),
            providesTags: ['Revenues'],
        }),

        getRevenueById: builder.query<{ data: Revenue }, string>({
            query: (id) => `/finance/revenues/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Revenues', id }],
        }),

        createRevenue: builder.mutation<{ data: Revenue }, Partial<Revenue>>({
            query: (body) => ({
                url: '/finance/revenues',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Revenues', 'FinanceDashboard'],
        }),

        updateRevenue: builder.mutation<{ data: Revenue }, { id: string } & Partial<Revenue>>({
            query: ({ id, ...body }) => ({
                url: `/finance/revenues/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['Revenues', 'FinanceDashboard'],
        }),

        deleteRevenue: builder.mutation<void, string>({
            query: (id) => ({
                url: `/finance/revenues/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Revenues', 'FinanceDashboard'],
        }),

        // Expense CRUD
        getExpenses: builder.query<{ data: { expenses: Expense[]; total: number } }, {
            level?: string;
            type?: string;
            category?: string;
            search?: string;
            startDate?: string;
            endDate?: string;
            projectId?: string;
            page?: number;
            limit?: number;
        }>({
            query: (params) => ({
                url: '/finance/expenses',
                params,
            }),
            providesTags: ['Expenses'],
        }),

        getExpenseById: builder.query<{ data: Expense }, string>({
            query: (id) => `/finance/expenses/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Expenses', id }],
        }),

        createExpense: builder.mutation<{ data: Expense }, Partial<Expense>>({
            query: (body) => ({
                url: '/finance/expenses',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        updateExpense: builder.mutation<{ data: Expense }, { id: string } & Partial<Expense>>({
            query: ({ id, ...body }) => ({
                url: `/finance/expenses/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        deleteExpense: builder.mutation<void, string>({
            query: (id) => ({
                url: `/finance/expenses/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        // Salary Expense Sync (from HRMS)
        syncSalaryExpenses: builder.mutation<{ data: { synced: number } }, { month: number; year: number }>({
            query: (body) => ({
                url: '/finance/sync-salaries',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        // Project Expense Summary
        getProjectExpenseSummary: builder.query<{ data: { projectId: string; projectName: string; totalExpense: number; salaryExpense: number; otherExpense: number }[] }, { startDate?: string; endDate?: string }>({
            query: (params) => ({
                url: '/finance/project-expenses',
                params,
            }),
            providesTags: ['Expenses'],
        }),
    }),
});

export const {
    useGetFinanceDashboardQuery,
    useGetRevenuesQuery,
    useGetRevenueByIdQuery,
    useCreateRevenueMutation,
    useUpdateRevenueMutation,
    useDeleteRevenueMutation,
    useGetExpensesQuery,
    useGetExpenseByIdQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
    useSyncSalaryExpensesMutation,
    useGetProjectExpenseSummaryQuery,
} = financeApi;
