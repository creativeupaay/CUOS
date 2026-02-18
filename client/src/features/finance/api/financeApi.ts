import api from '@/services/api';
import type {
    Expense,
    CreateExpensePayload,
    Invoice,
    CreateInvoicePayload,
    PaymentMilestone,
    CreateMilestonePayload,
    CompanyDashboardStats,
    MonthlyReportEntry,
    ProjectFinanceSummary,
    ProjectFinanceOverview,
    AccrualVsCashEntry,
    CurrencyRateEntry,
    Pagination,
} from '../types/finance.types';

// ── Helper Types ────────────────────────────────────────────────────
interface ListResponse<T> {
    success: boolean;
    data: T[];
    pagination?: Pagination;
}

interface SingleResponse<T> {
    success: boolean;
    data: T;
}

export const financeApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // ═══════════════════════════════════════════════════════════
        // COMPANY DASHBOARD & REPORTS
        // ═══════════════════════════════════════════════════════════
        getFinanceDashboard: builder.query<CompanyDashboardStats, { startDate: string; endDate: string }>({
            query: ({ startDate, endDate }) => `/finance/dashboard?startDate=${startDate}&endDate=${endDate}`,
            transformResponse: (res: SingleResponse<CompanyDashboardStats>) => res.data,
            providesTags: ['FinanceDashboard'],
        }),

        getMonthlyReport: builder.query<MonthlyReportEntry[], number>({
            query: (year) => `/finance/reports/monthly/${year}`,
            transformResponse: (res: ListResponse<MonthlyReportEntry>) => res.data,
            providesTags: ['FinanceDashboard'],
        }),

        getAccrualVsCashflow: builder.query<AccrualVsCashEntry[], { startDate: string; endDate: string }>({
            query: ({ startDate, endDate }) => `/finance/reports/accrual-vs-cash?startDate=${startDate}&endDate=${endDate}`,
            transformResponse: (res: { success: boolean; data: AccrualVsCashEntry[] }) => res.data,
            providesTags: ['FinanceDashboard'],
        }),

        // ═══════════════════════════════════════════════════════════
        // PROJECT FINANCE
        // ═══════════════════════════════════════════════════════════
        getAllProjectsFinance: builder.query<ProjectFinanceOverview[], void>({
            query: () => '/finance/projects',
            transformResponse: (res: ListResponse<ProjectFinanceOverview>) => res.data,
            providesTags: ['FinanceDashboard'],
        }),

        getProjectFinanceSummary: builder.query<ProjectFinanceSummary, string>({
            query: (projectId) => `/finance/projects/${projectId}`,
            transformResponse: (res: SingleResponse<ProjectFinanceSummary>) => res.data,
            providesTags: ['FinanceDashboard'],
        }),

        // ═══════════════════════════════════════════════════════════
        // EXPENSES
        // ═══════════════════════════════════════════════════════════
        getExpenses: builder.query<
            { expenses: Expense[]; pagination: Pagination },
            Record<string, string | number | undefined>
        >({
            query: (params) => {
                const searchParams = new URLSearchParams();
                Object.entries(params).forEach(([key, val]) => {
                    if (val !== undefined) searchParams.set(key, String(val));
                });
                return `/finance/expenses?${searchParams.toString()}`;
            },
            transformResponse: (res: any) => ({
                expenses: res.data,
                pagination: res.pagination,
            }),
            providesTags: ['Expenses'],
        }),

        getExpenseById: builder.query<Expense, string>({
            query: (id) => `/finance/expenses/${id}`,
            transformResponse: (res: SingleResponse<Expense>) => res.data,
            providesTags: ['Expenses'],
        }),

        createExpense: builder.mutation<Expense, CreateExpensePayload>({
            query: (body) => ({ url: '/finance/expenses', method: 'POST', body }),
            transformResponse: (res: SingleResponse<Expense>) => res.data,
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        updateExpense: builder.mutation<Expense, { id: string; data: Partial<CreateExpensePayload> }>({
            query: ({ id, data }) => ({ url: `/finance/expenses/${id}`, method: 'PATCH', body: data }),
            transformResponse: (res: SingleResponse<Expense>) => res.data,
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        deleteExpense: builder.mutation<void, string>({
            query: (id) => ({ url: `/finance/expenses/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        approveExpense: builder.mutation<Expense, string>({
            query: (id) => ({ url: `/finance/expenses/${id}/approve`, method: 'PATCH' }),
            transformResponse: (res: SingleResponse<Expense>) => res.data,
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        // ═══════════════════════════════════════════════════════════
        // INVOICES
        // ═══════════════════════════════════════════════════════════
        getInvoices: builder.query<
            { invoices: Invoice[]; pagination: Pagination },
            Record<string, string | number | undefined>
        >({
            query: (params) => {
                const searchParams = new URLSearchParams();
                Object.entries(params).forEach(([key, val]) => {
                    if (val !== undefined) searchParams.set(key, String(val));
                });
                return `/finance/invoices?${searchParams.toString()}`;
            },
            transformResponse: (res: any) => ({
                invoices: res.data,
                pagination: res.pagination,
            }),
            providesTags: ['Invoices'],
        }),

        getInvoiceById: builder.query<Invoice, string>({
            query: (id) => `/finance/invoices/${id}`,
            transformResponse: (res: SingleResponse<Invoice>) => res.data,
            providesTags: ['Invoices'],
        }),

        getOverdueInvoices: builder.query<Invoice[], void>({
            query: () => '/finance/invoices/overdue',
            transformResponse: (res: ListResponse<Invoice>) => res.data,
            providesTags: ['Invoices'],
        }),

        createInvoice: builder.mutation<Invoice, CreateInvoicePayload>({
            query: (body) => ({ url: '/finance/invoices', method: 'POST', body }),
            transformResponse: (res: SingleResponse<Invoice>) => res.data,
            invalidatesTags: ['Invoices', 'FinanceDashboard'],
        }),

        updateInvoice: builder.mutation<Invoice, { id: string; data: Partial<CreateInvoicePayload> }>({
            query: ({ id, data }) => ({ url: `/finance/invoices/${id}`, method: 'PATCH', body: data }),
            transformResponse: (res: SingleResponse<Invoice>) => res.data,
            invalidatesTags: ['Invoices', 'FinanceDashboard'],
        }),

        deleteInvoice: builder.mutation<void, string>({
            query: (id) => ({ url: `/finance/invoices/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Invoices', 'FinanceDashboard'],
        }),

        recordPayment: builder.mutation<Invoice, { id: string; amount: number }>({
            query: ({ id, amount }) => ({
                url: `/finance/invoices/${id}/payment`,
                method: 'POST',
                body: { amount },
            }),
            transformResponse: (res: SingleResponse<Invoice>) => res.data,
            invalidatesTags: ['Invoices', 'FinanceDashboard'],
        }),

        // ═══════════════════════════════════════════════════════════
        // MILESTONES
        // ═══════════════════════════════════════════════════════════
        getProjectMilestones: builder.query<PaymentMilestone[], string>({
            query: (projectId) => `/finance/milestones/${projectId}`,
            transformResponse: (res: ListResponse<PaymentMilestone>) => res.data,
            providesTags: ['Milestones'],
        }),

        createMilestone: builder.mutation<PaymentMilestone, CreateMilestonePayload>({
            query: (body) => ({ url: '/finance/milestones', method: 'POST', body }),
            transformResponse: (res: SingleResponse<PaymentMilestone>) => res.data,
            invalidatesTags: ['Milestones', 'FinanceDashboard'],
        }),

        updateMilestone: builder.mutation<PaymentMilestone, { id: string; data: Partial<CreateMilestonePayload> }>({
            query: ({ id, data }) => ({ url: `/finance/milestones/${id}`, method: 'PATCH', body: data }),
            transformResponse: (res: SingleResponse<PaymentMilestone>) => res.data,
            invalidatesTags: ['Milestones', 'FinanceDashboard'],
        }),

        completeMilestone: builder.mutation<PaymentMilestone, string>({
            query: (id) => ({ url: `/finance/milestones/${id}/complete`, method: 'PATCH' }),
            transformResponse: (res: SingleResponse<PaymentMilestone>) => res.data,
            invalidatesTags: ['Milestones', 'FinanceDashboard'],
        }),

        markMilestonePaid: builder.mutation<PaymentMilestone, string>({
            query: (id) => ({ url: `/finance/milestones/${id}/paid`, method: 'PATCH' }),
            transformResponse: (res: SingleResponse<PaymentMilestone>) => res.data,
            invalidatesTags: ['Milestones', 'FinanceDashboard'],
        }),

        deleteMilestone: builder.mutation<void, string>({
            query: (id) => ({ url: `/finance/milestones/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Milestones', 'FinanceDashboard'],
        }),

        // ═══════════════════════════════════════════════════════════
        // CURRENCY RATES
        // ═══════════════════════════════════════════════════════════
        getLatestRates: builder.query<CurrencyRateEntry[], string | void>({
            query: (base) => `/finance/currency/rates${base ? `?base=${base}` : ''}`,
            transformResponse: (res: ListResponse<CurrencyRateEntry>) => res.data,
            providesTags: ['CurrencyRates'],
        }),

        setCurrencyRate: builder.mutation<
            CurrencyRateEntry,
            { fromCurrency: string; toCurrency: string; rate: number; date: string }
        >({
            query: (body) => ({ url: '/finance/currency/rates', method: 'POST', body }),
            invalidatesTags: ['CurrencyRates'],
        }),
    }),
});

export const {
    // Dashboard & Reports
    useGetFinanceDashboardQuery,
    useGetMonthlyReportQuery,
    useGetAccrualVsCashflowQuery,
    // Project Finance
    useGetAllProjectsFinanceQuery,
    useGetProjectFinanceSummaryQuery,
    // Expenses
    useGetExpensesQuery,
    useGetExpenseByIdQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
    useApproveExpenseMutation,
    // Invoices
    useGetInvoicesQuery,
    useGetInvoiceByIdQuery,
    useGetOverdueInvoicesQuery,
    useCreateInvoiceMutation,
    useUpdateInvoiceMutation,
    useDeleteInvoiceMutation,
    useRecordPaymentMutation,
    // Milestones
    useGetProjectMilestonesQuery,
    useCreateMilestoneMutation,
    useUpdateMilestoneMutation,
    useCompleteMilestoneMutation,
    useMarkMilestonePaidMutation,
    useDeleteMilestoneMutation,
    // Currency
    useGetLatestRatesQuery,
    useSetCurrencyRateMutation,
} = financeApi;
