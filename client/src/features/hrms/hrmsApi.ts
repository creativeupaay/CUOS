import { api } from '@/services/api';
import type {
    Employee, SalaryStructure, Leave, Payroll, LeaveBalance,
    DashboardStats, WorkingHoursAnalytics, TeamAnalyticsMember, IncentiveSummary,
} from './types/types';
import type {
    ApiResponse, PaginatedResponse,
    CreateEmployeeRequest, UpdateEmployeeRequest, ListEmployeesParams,
    CreateSalaryRequest, UpdateSalaryRequest,
    CreateLeaveRequest, UpdateLeaveStatusRequest,
    GeneratePayrollRequest, UpdatePayrollStatusRequest,
} from './types/apiTypes';

export const hrmsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // ══════════════════════════════════════════════════════════
        // EMPLOYEE ENDPOINTS
        // ══════════════════════════════════════════════════════════
        createEmployee: builder.mutation<ApiResponse<{ employee: Employee }>, CreateEmployeeRequest>({
            query: (data) => ({
                url: '/hrms/employees',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Employees'],
        }),

        getEmployees: builder.query<PaginatedResponse<{ employees: Employee[] }>, ListEmployeesParams>({
            query: (params) => ({
                url: '/hrms/employees',
                params,
            }),
            providesTags: ['Employees'],
        }),

        getEmployee: builder.query<ApiResponse<{ employee: Employee }>, string>({
            query: (id) => `/hrms/employees/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Employees', id }],
        }),

        getMyProfile: builder.query<ApiResponse<{ employee: Employee }>, void>({
            query: () => '/hrms/employees/me',
            providesTags: ['Employees'],
        }),

        updateEmployee: builder.mutation<
            ApiResponse<{ employee: Employee }>,
            { id: string; data: UpdateEmployeeRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hrms/employees/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Employees', id },
                'Employees',
            ],
        }),

        deleteEmployee: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/hrms/employees/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Employees'],
        }),

        getOnboardingEmployees: builder.query<ApiResponse<{ employees: Employee[] }>, void>({
            query: () => '/hrms/employees/onboarding',
            providesTags: ['Employees'],
        }),

        // ══════════════════════════════════════════════════════════
        // SALARY ENDPOINTS
        // ══════════════════════════════════════════════════════════
        createSalary: builder.mutation<ApiResponse<{ salary: SalaryStructure }>, CreateSalaryRequest>({
            query: (data) => ({
                url: '/hrms/salary',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Salary'],
        }),

        getSalaries: builder.query<PaginatedResponse<{ salaries: SalaryStructure[] }>, { page?: number; limit?: number }>({
            query: (params) => ({
                url: '/hrms/salary',
                params,
            }),
            providesTags: ['Salary'],
        }),

        getSalaryByEmployee: builder.query<ApiResponse<{ salary: SalaryStructure | null }>, string>({
            query: (employeeId) => `/hrms/salary/employee/${employeeId}`,
            providesTags: ['Salary'],
        }),

        updateSalary: builder.mutation<
            ApiResponse<{ salary: SalaryStructure }>,
            { id: string; data: UpdateSalaryRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hrms/salary/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Salary'],
        }),

        // ══════════════════════════════════════════════════════════
        // LEAVE ENDPOINTS
        // ══════════════════════════════════════════════════════════
        createLeave: builder.mutation<ApiResponse<{ leave: Leave }>, CreateLeaveRequest>({
            query: (data) => ({
                url: '/hrms/leaves',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Leaves'],
        }),

        getLeaves: builder.query<PaginatedResponse<{ leaves: Leave[] }>, { status?: string; page?: number; limit?: number }>({
            query: (params) => ({
                url: '/hrms/leaves',
                params,
            }),
            providesTags: ['Leaves'],
        }),

        getMyLeaves: builder.query<PaginatedResponse<{ leaves: Leave[] }>, { status?: string; page?: number }>({
            query: (params) => ({
                url: '/hrms/leaves/me',
                params,
            }),
            providesTags: ['Leaves'],
        }),

        getLeaveBalance: builder.query<ApiResponse<{ balance: LeaveBalance[] }>, { year?: number } | void>({
            query: (params) => ({
                url: '/hrms/leaves/balance',
                params: params || {},
            }),
            providesTags: ['Leaves'],
        }),

        updateLeaveStatus: builder.mutation<
            ApiResponse<{ leave: Leave }>,
            { id: string; data: UpdateLeaveStatusRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hrms/leaves/${id}/status`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Leaves'],
        }),

        // ══════════════════════════════════════════════════════════
        // PAYROLL ENDPOINTS
        // ══════════════════════════════════════════════════════════
        generatePayroll: builder.mutation<ApiResponse<{ payroll: Payroll }>, GeneratePayrollRequest>({
            query: (data) => ({
                url: '/hrms/payroll',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Payroll'],
        }),

        getPayrolls: builder.query<PaginatedResponse<{ payrolls: Payroll[] }>, { month?: number; year?: number; status?: string; page?: number }>({
            query: (params) => ({
                url: '/hrms/payroll',
                params,
            }),
            providesTags: ['Payroll'],
        }),

        getPayrollById: builder.query<ApiResponse<{ payroll: Payroll }>, string>({
            query: (id) => `/hrms/payroll/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Payroll', id }],
        }),

        updatePayrollStatus: builder.mutation<
            ApiResponse<{ payroll: Payroll }>,
            { id: string; data: UpdatePayrollStatusRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hrms/payroll/${id}/status`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['Payroll'],
        }),

        // ══════════════════════════════════════════════════════════
        // ANALYTICS ENDPOINTS
        // ══════════════════════════════════════════════════════════
        getDashboardStats: builder.query<ApiResponse<DashboardStats>, void>({
            query: () => '/hrms/analytics/dashboard',
            providesTags: ['Employees'],
        }),

        getWorkingHours: builder.query<
            ApiResponse<WorkingHoursAnalytics>,
            { userId?: string; startDate: string; endDate: string }
        >({
            query: (params) => ({
                url: '/hrms/analytics/working-hours',
                params,
            }),
        }),

        getTeamAnalytics: builder.query<
            ApiResponse<{ team: TeamAnalyticsMember[] }>,
            { managerId: string; month?: number; year?: number }
        >({
            query: ({ managerId, ...params }) => ({
                url: `/hrms/analytics/team/${managerId}`,
                params,
            }),
        }),

        getIncentiveSummary: builder.query<
            ApiResponse<IncentiveSummary>,
            { employeeId: string; month?: number; year?: number }
        >({
            query: ({ employeeId, ...params }) => ({
                url: `/hrms/analytics/incentives/${employeeId}`,
                params,
            }),
        }),
    }),
    overrideExisting: false,
});

export const {
    // Employees
    useCreateEmployeeMutation,
    useGetEmployeesQuery,
    useGetEmployeeQuery,
    useGetMyProfileQuery,
    useUpdateEmployeeMutation,
    useDeleteEmployeeMutation,
    useGetOnboardingEmployeesQuery,
    // Salary
    useCreateSalaryMutation,
    useGetSalariesQuery,
    useGetSalaryByEmployeeQuery,
    useUpdateSalaryMutation,
    // Leaves
    useCreateLeaveMutation,
    useGetLeavesQuery,
    useGetMyLeavesQuery,
    useGetLeaveBalanceQuery,
    useUpdateLeaveStatusMutation,
    // Payroll
    useGeneratePayrollMutation,
    useGetPayrollsQuery,
    useGetPayrollByIdQuery,
    useUpdatePayrollStatusMutation,
    // Analytics
    useGetDashboardStatsQuery,
    useGetWorkingHoursQuery,
    useGetTeamAnalyticsQuery,
    useGetIncentiveSummaryQuery,
} = hrmsApi;
