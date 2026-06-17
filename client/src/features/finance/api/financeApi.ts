import { api } from '@/services/api';
import toast from 'react-hot-toast';

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
    exchangeRateDate?: string;
    exchangeRateProvider?: string;
    amountINR: number;
    gstApplicable: boolean;
    isGstInclusive?: boolean;
    gstRate: number;
    gst: number;
    tdsDeducted: number;
    totalAmount: number;
    receivedAmount: number;
    pendingAmount: number;
    source: 'manual' | 'invoice' | 'project';
    status: 'received' | 'pending' | 'partial' | 'overdue';
    invoiceNumber?: string;
    dueDate?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface FinanceReceivableItem {
    id: string;
    source: 'finance-revenue' | 'phase-payment';
    sourceLabel: string;
    party: string;
    title: string;
    status: 'pending' | 'partial' | 'overdue';
    dueDate: string | null;
    outstanding: number;
    expected: number;
    received: number;
    currency: 'INR';
    originalCurrency?: string;
    originalExpected?: number;
    exchangeRate?: number;
    exchangeRateDate?: string;
    exchangeRateProvider?: string;
}

export interface FinanceReceivablesResponse {
    items: FinanceReceivableItem[];
    summary: {
        totalOpen: number;
        overdueAmount: number;
        dueSoonAmount: number;
        phaseAmount: number;
        financeAmount: number;
    };
    warnings: Array<{
        code: 'FX_LOOKUP_FAILED' | 'FX_RATE_REQUIRED' | 'FX_FALLBACK_USED';
        message: string;
        source: 'finance-revenue' | 'phase-payment';
        projectId?: string;
        phaseId?: string;
        currency?: string;
        date?: string;
    }>;
    skippedCount: number;
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
    sourceAccountKey?: BankAccountKey;
    notes?: string;
    isRecurring: boolean;
    recurringFrequency?: 'monthly' | 'quarterly' | 'yearly';
    gstClaimable?: boolean;
    gstRate?: number;
    isAllocated?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FixedExpense {
    _id: string;
    title: string;
    description: string;
    category: string;
    level: 'company' | 'project';
    type: 'fixed';
    amount: number;
    expenseDate?: string;
    dueDay: number;
    frequency: 'monthly' | 'quarterly' | 'yearly';
    startDate: string;
    projectId?: string;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: BankAccountKey;
    notes?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FixedExpenseApproval {
    _id: string;
    fixedExpenseId: string;
    periodKey: string;
    dueDate: string;
    status: 'pending' | 'approved' | 'rejected';
    title: string;
    description: string;
    category: string;
    level: 'company' | 'project';
    type: 'fixed';
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'yearly';
    dueDay: number;
    projectId?: string;
    projectName?: string;
    vendor?: string;
    paidBy?: string;
    sourceAccountKey?: BankAccountKey;
    notes?: string;
    responseNotes?: string;
    paidDate?: string;
    approvedExpenseId?: string;
    actedBy?: string;
    actedAt?: string;
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
    moneyInBank: number;
    gstPayable: number;
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
    receivables: FinanceReceivablesResponse | null;
}

export type BankAccountKey = 'hdfc_gst' | 'sbi_non_gst' | 'cash';
export type BankTransactionType = 'credit' | 'debit';

export interface BankTransaction {
    _id: string;
    bankAccountId: string;
    accountKey: BankAccountKey;
    accountName: string;
    transactionType: BankTransactionType;
    amount: number;
    date: string;
    description: string;
    referenceNumber?: string;
    notes?: string;
    source: 'manual' | 'automatic';
    createdAt: string;
    updatedAt: string;
}

export interface BankTransactionSummary {
    totalCashInBank: number;
    totalCredit: number;
    totalDebit: number;
    accountBalances: Record<BankAccountKey, number>;
}

export interface BankAccountDetail {
    _id: string;
    accountKey?: BankAccountKey;
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode?: string;
    swiftCode?: string;
    accountType: 'current' | 'savings' | 'cash';
    currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    currentBalance: number;
    isActive: boolean;
    isPrimary: boolean;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface OtherBankAccountRequest {
    accountName: string;
    bankName: string;
    accountNumber: string;
    ifscCode?: string;
    swiftCode?: string;
    accountType: 'current' | 'savings' | 'cash';
    currency: 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';
    currentBalance?: number;
    isPrimary?: boolean;
    isActive?: boolean;
    notes?: string;
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

        getFinanceReceivables: builder.query<{ data: FinanceReceivablesResponse }, void>({
            query: () => '/finance/receivables',
            providesTags: ['Revenues', 'Projects'],
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
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                toast.promise(queryFulfilled, {
                    loading: 'Deleting revenue...',
                    success: 'Revenue deleted successfully',
                    error: 'Failed to delete revenue',
                });
                
                const patchResult = dispatch(
                    financeApi.util.updateQueryData('getRevenues', {}, (draft) => {
                       // We do our best to optimistically remove if possible
                       if (draft?.data?.revenues) {
                           draft.data.revenues = draft.data.revenues.filter((r) => r._id !== id);
                       }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
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
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                toast.promise(queryFulfilled, {
                    loading: 'Deleting expense...',
                    success: 'Expense deleted successfully',
                    error: 'Failed to delete expense',
                });
                
                const patchResult = dispatch(
                    financeApi.util.updateQueryData('getExpenses', {}, (draft) => {
                       if (draft?.data?.expenses) {
                           draft.data.expenses = draft.data.expenses.filter((e) => e._id !== id);
                       }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
            invalidatesTags: ['Expenses', 'FinanceDashboard'],
        }),

        getFixedExpenses: builder.query<{ data: FixedExpense[] }, { isActive?: boolean } | void>({
            query: (params) => ({
                url: '/finance/fixed-expenses',
                params: params || undefined,
            }),
            providesTags: ['FixedExpenses'],
        }),

        createFixedExpense: builder.mutation<{ data: FixedExpense }, Partial<FixedExpense>>({
            query: (body) => ({
                url: '/finance/fixed-expenses',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['FixedExpenses'],
        }),

        updateFixedExpense: builder.mutation<{ data: FixedExpense }, { id: string } & Partial<FixedExpense>>({
            query: ({ id, ...body }) => ({
                url: `/finance/fixed-expenses/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['FixedExpenses'],
        }),

        deleteFixedExpense: builder.mutation<void, string>({
            query: (id) => ({
                url: `/finance/fixed-expenses/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['FixedExpenses'],
        }),

        getFixedExpenseApprovals: builder.query<
            { data: { approvals: FixedExpenseApproval[]; pendingCount: number } },
            { status?: 'all' | 'pending' | 'approved' | 'rejected' } | void
        >({
            query: (params) => ({
                url: '/finance/fixed-expenses/approvals',
                params: params || undefined,
            }),
            providesTags: ['FixedExpenses', 'Expenses'],
        }),

        getFixedExpenseTransactions: builder.query<{ data: Expense[] }, void>({
            query: () => ({
                url: '/finance/fixed-expenses/transactions',
            }),
            providesTags: ['FixedExpenses', 'Expenses', 'BankTransactions'],
        }),

        approveFixedExpense: builder.mutation<
            { data: FixedExpenseApproval },
            {
                id: string;
                amount?: number;
                paidDate?: string;
                responseNotes?: string;
                description?: string;
                vendor?: string;
                paidBy?: string;
                sourceAccountKey?: BankAccountKey;
                notes?: string;
            }
        >({
            query: ({ id, ...body }) => ({
                url: `/finance/fixed-expenses/approvals/${id}/approve`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['FixedExpenses', 'Expenses', 'FinanceDashboard', 'BankTransactions'],
        }),

        rejectFixedExpense: builder.mutation<
            { data: FixedExpenseApproval },
            {
                id: string;
                amount?: number;
                paidDate?: string;
                responseNotes?: string;
                description?: string;
                vendor?: string;
                paidBy?: string;
                sourceAccountKey?: BankAccountKey;
                notes?: string;
            }
        >({
            query: ({ id, ...body }) => ({
                url: `/finance/fixed-expenses/approvals/${id}/reject`,
                method: 'POST',
                body,
            }),
            invalidatesTags: ['FixedExpenses', 'Expenses'],
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

        // Cash in Bank / Bank Transactions
        getBankTransactions: builder.query<{ data: { transactions: BankTransaction[]; total: number; summary: BankTransactionSummary } }, {
            accountKey?: BankAccountKey;
            transactionType?: BankTransactionType;
            search?: string;
            startDate?: string;
            endDate?: string;
            page?: number;
            limit?: number;
        }>({
            query: (params) => ({
                url: '/finance/bank-transactions',
                params,
            }),
            providesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        getBankAccounts: builder.query<{ data: BankAccountDetail[] }, void>({
            query: () => '/finance/bank-accounts',
            providesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        getOtherBankAccounts: builder.query<{ data: BankAccountDetail[] }, void>({
            query: () => '/finance/bank-accounts/other',
            providesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        createOtherBankAccount: builder.mutation<{ data: BankAccountDetail }, OtherBankAccountRequest>({
            query: (body) => ({
                url: '/finance/bank-accounts/other',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        updateOtherBankAccount: builder.mutation<{ data: BankAccountDetail }, { id: string } & Partial<OtherBankAccountRequest>>({
            query: ({ id, ...body }) => ({
                url: `/finance/bank-accounts/other/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        deleteOtherBankAccount: builder.mutation<void, string>({
            query: (id) => ({
                url: `/finance/bank-accounts/other/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        createBankTransaction: builder.mutation<{ data: BankTransaction }, Partial<BankTransaction>>({
            query: (body) => ({
                url: '/finance/bank-transactions',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        updateBankTransaction: builder.mutation<{ data: BankTransaction }, { id: string } & Partial<BankTransaction>>({
            query: ({ id, ...body }) => ({
                url: `/finance/bank-transactions/${id}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        updateBankAccount: builder.mutation<{ data: BankAccountDetail }, { accountKey: BankAccountKey } & Partial<BankAccountDetail>>({
            query: ({ accountKey, ...body }) => ({
                url: `/finance/bank-accounts/${accountKey}`,
                method: 'PUT',
                body,
            }),
            invalidatesTags: ['BankTransactions', 'FinanceDashboard'],
        }),

        deleteBankTransaction: builder.mutation<void, string>({
            query: (id) => ({
                url: `/finance/bank-transactions/${id}`,
                method: 'DELETE',
            }),
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                toast.promise(queryFulfilled, {
                    loading: 'Deleting transaction...',
                    success: 'Transaction deleted successfully',
                    error: 'Failed to delete transaction',
                });
                const patchResult = dispatch(
                    financeApi.util.updateQueryData('getBankTransactions', {}, (draft) => {
                       if (draft?.data?.transactions) {
                           draft.data.transactions = draft.data.transactions.filter((t) => t._id !== id);
                       }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
            invalidatesTags: ['BankTransactions', 'FinanceDashboard'],
        }),
        getExchangeRate: builder.query<{ data: { currency: string; rate: number; provider: string; date: string; isFallback: boolean } }, { currency: string; date?: string }>({
            query: ({ currency, date }) => {
                let url = `/finance/exchange-rate?currency=${currency}`;
                if (date) url += `&date=${date}`;
                return url;
            },
        }),

        resolveReceivableFxRates: builder.mutation<
            { success: boolean; message: string; data: Array<{ projectId: string; phaseId: string; success: boolean; error?: string }> },
            { resolutions: Array<{ projectId: string; phaseId: string; rate: number }> }
        >({
            query: (body) => ({
                url: '/finance/receivables/resolve-fx',
                method: 'POST',
                body,
            }),
            invalidatesTags: ['Revenues', 'Projects'],
        }),
    }),
});

export const {
    useGetFinanceDashboardQuery,
    useGetRevenuesQuery,
    useGetFinanceReceivablesQuery,
    useGetRevenueByIdQuery,
    useCreateRevenueMutation,
    useUpdateRevenueMutation,
    useDeleteRevenueMutation,
    useGetExpensesQuery,
    useGetExpenseByIdQuery,
    useCreateExpenseMutation,
    useUpdateExpenseMutation,
    useDeleteExpenseMutation,
    useGetFixedExpensesQuery,
    useCreateFixedExpenseMutation,
    useUpdateFixedExpenseMutation,
    useDeleteFixedExpenseMutation,
    useGetFixedExpenseApprovalsQuery,
    useGetFixedExpenseTransactionsQuery,
    useApproveFixedExpenseMutation,
    useRejectFixedExpenseMutation,
    useSyncSalaryExpensesMutation,
    useGetProjectExpenseSummaryQuery,
    useGetBankTransactionsQuery,
    useGetBankAccountsQuery,
    useGetOtherBankAccountsQuery,
    useCreateOtherBankAccountMutation,
    useUpdateOtherBankAccountMutation,
    useDeleteOtherBankAccountMutation,
    useCreateBankTransactionMutation,
    useUpdateBankTransactionMutation,
    useUpdateBankAccountMutation,
    useDeleteBankTransactionMutation,
    useGetExchangeRateQuery,
    useResolveReceivableFxRatesMutation,
} = financeApi;
