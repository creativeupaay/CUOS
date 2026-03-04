import { api } from '@/services/api';
import type {
    Employee, SalaryStructure, Leave, Payroll, LeaveBalance,
    DashboardStats, WorkingHoursAnalytics, TeamAnalyticsMember, IncentiveSummary, Attendance
} from './types/types';
import type {
    ApiResponse, PaginatedResponse,
    CreateEmployeeRequest, UpdateEmployeeRequest, ListEmployeesParams,
    CreateSalaryRequest, UpdateSalaryRequest,
    CreateLeaveRequest, UpdateLeaveStatusRequest,
    GeneratePayrollRequest, UpdatePayrollStatusRequest,
    CheckInRequest, CheckOutRequest,
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

        getLeaves: builder.query<PaginatedResponse<{ leaves: Leave[] }>, { employeeId?: string; status?: string; type?: string; page?: number; limit?: number }>({
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

        getMyPayrolls: builder.query<ApiResponse<{ payrolls: Payroll[] }>, void>({
            query: () => '/hrms/payroll/me',
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

        getUpcomingEvents: builder.query<ApiResponse<{
            events: Array<{
                type: 'birthday' | 'probation' | 'salary';
                title: string;
                subtitle: string;
                date: string;
                daysUntil: number;
                employeeId: string;
            }>
        }>, void>({
            query: () => '/hrms/analytics/events',
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

        // ══════════════════════════════════════════════════════════
        // ATTENDANCE ENDPOINTS
        // ══════════════════════════════════════════════════════════
        checkIn: builder.mutation<ApiResponse<{ attendance: Attendance }>, CheckInRequest>({
            query: (data) => ({
                url: '/hrms/attendance/check-in',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Employees'], // Refresh dashboard stats/today's attendance
        }),

        checkOut: builder.mutation<ApiResponse<{ attendance: Attendance }>, CheckOutRequest>({
            query: (data) => ({
                url: '/hrms/attendance/check-out',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Employees'],
        }),

        getMyAttendance: builder.query<ApiResponse<{ data: Attendance[], results: number }>, { startDate?: string; endDate?: string }>({
            query: (params) => ({
                url: '/hrms/attendance/me',
                params,
            }),
        }),

        getEmployeeAttendance: builder.query<ApiResponse<{ data: Attendance[], results: number }>, { id: string, startDate?: string; endDate?: string }>({
            query: ({ id, ...params }) => ({
                url: `/hrms/attendance/employee/${id}`,
                params,
            }),
        }),

        bulkMarkAttendance: builder.mutation<
            ApiResponse<{ saved: number }>,
            { date: string; records: Array<{ employeeId: string; status: string; notes?: string }> }
        >({
            query: (data) => ({
                url: '/hrms/attendance/bulk',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Employees'],
        }),

        getDailyOverview: builder.query<
            ApiResponse<{
                date: string;
                summary: { present: number; wfh: number; halfDay: number; onLeave: number; absent: number; holiday: number; total: number };
                employees: Array<{
                    employeeId: string; employeeCode: string; name: string; email: string;
                    department: string; designation: string; status: string;
                    checkIn: string | null; checkOut: string | null; totalHours: number; notes: string;
                }>;
            }>,
            { date?: string } | void
        >({
            query: (params) => ({
                url: '/hrms/attendance/overview',
                params: params || {},
            }),
            providesTags: ['Employees'],
        }),

        getMonthlyAttendance: builder.query<
            ApiResponse<{
                month: number; year: number; daysInMonth: number;
                grid: Array<{
                    employeeId: string; employeeCode: string; name: string; department: string;
                    days: Array<{ date: string; status: string | null }>;
                }>;
            }>,
            { month: number; year: number }
        >({
            query: (params) => ({
                url: '/hrms/attendance/monthly',
                params,
            }),
            providesTags: ['Employees'],
        }),
    }),
    overrideExisting: false,
});

// ── Holiday type ─────────────────────────────────────────────────────
export interface Holiday {
    _id: string;
    name: string;
    date: string;
    type: 'holiday' | 'half-day' | 'wfh';
    description?: string;
    isPaid: boolean;
    createdBy: string | { name: string };
    createdAt: string;
}

// ── Holiday endpoints (separate inject) ──────────────────────────────
const holidayApiExtension = hrmsApi.injectEndpoints({
    endpoints: (builder) => ({
        getHolidays: builder.query<
            { status: string; data: { holidays: Holiday[] } },
            { year?: number; month?: number; type?: string; upcoming?: boolean }
        >({
            query: (params) => ({ url: '/hrms/holidays', params }),
        }),

        createHoliday: builder.mutation<
            { status: string; data: { holiday: Holiday } },
            { name: string; date: string; type: string; description?: string; isPaid: boolean }
        >({
            query: (body) => ({ url: '/hrms/holidays', method: 'POST', body }),
        }),

        updateHoliday: builder.mutation<
            { status: string; data: { holiday: Holiday } },
            { id: string; data: Partial<Holiday> }
        >({
            query: ({ id, data }) => ({ url: `/hrms/holidays/${id}`, method: 'PATCH', body: data }),
        }),

        deleteHoliday: builder.mutation<{ status: string }, string>({
            query: (id) => ({ url: `/hrms/holidays/${id}`, method: 'DELETE' }),
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
    useGetMyPayrollsQuery,
    useGetPayrollByIdQuery,
    useUpdatePayrollStatusMutation,
    useGetDashboardStatsQuery,
    useGetUpcomingEventsQuery,
    useGetWorkingHoursQuery,
    useGetTeamAnalyticsQuery,
    useGetIncentiveSummaryQuery,
    // Attendance
    useCheckInMutation,
    useCheckOutMutation,
    useGetMyAttendanceQuery,
    useGetEmployeeAttendanceQuery,
    useBulkMarkAttendanceMutation,
    useGetDailyOverviewQuery,
    useGetMonthlyAttendanceQuery,
} = hrmsApi;

export const {
    useGetHolidaysQuery,
    useCreateHolidayMutation,
    useUpdateHolidayMutation,
    useDeleteHolidayMutation,
} = holidayApiExtension;
