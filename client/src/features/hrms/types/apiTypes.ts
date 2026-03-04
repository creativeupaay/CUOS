// API Request/Response types for HRMS module

// ── API Response ────────────────────────────────────────────────────
export interface ApiResponse<T = any> {
    status: string;
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    status: string;
    data: T & {
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    };
}

// ── Employee API Types ──────────────────────────────────────────────
export interface CreateEmployeeRequest {
    userId: string;
    employeeId: string;
    designation: string;
    department: string;
    employmentType?: string;
    joiningDate: string;
    probationEndDate?: string;
    status?: string;
    reportingTo?: string;
    workSchedule?: { workingDaysPerWeek?: number; hoursPerDay?: number };
    personalInfo?: any;
    bankDetails?: any;
    onboarding?: { status?: string; checklist?: { item: string; completed: boolean }[] };
}

export interface UpdateEmployeeRequest {
    designation?: string;
    department?: string;
    employmentType?: string;
    status?: string;
    reportingTo?: string | null;
    workSchedule?: { workingDaysPerWeek?: number; hoursPerDay?: number };
    personalInfo?: any;
    bankDetails?: any;
    onboarding?: any;
}

export interface ListEmployeesParams {
    department?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
}

// ── Salary API Types ────────────────────────────────────────────────
export interface CreateSalaryRequest {
    employeeId: string;
    basic: number;
    hra: number;
    da?: number;
    specialAllowance?: number;
    deductions?: { pf?: number; esi?: number; tax?: number; other?: number };
    currency?: string;
    effectiveFrom: string;
}

export interface UpdateSalaryRequest {
    basic?: number;
    hra?: number;
    da?: number;
    specialAllowance?: number;
    deductions?: { pf?: number; esi?: number; tax?: number; other?: number };
    effectiveFrom?: string;
}

// ── Leave API Types ─────────────────────────────────────────────────
export interface CreateLeaveRequest {
    type: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    isPaid?: boolean;
}


export interface UpdateLeaveStatusRequest {
    status: 'approved' | 'rejected' | 'cancelled';
    rejectionReason?: string;
}

// ── Payroll API Types ───────────────────────────────────────────────
export interface GeneratePayrollRequest {
    employeeId: string;
    month: number;
    year: number;
}

export interface UpdatePayrollStatusRequest {
    status: 'approved' | 'paid';
}

// ── Attendance API Types ──────────────────────────────────────────────
export interface CheckInRequest {
    projectId?: string;
    taskId?: string;
    notes?: string;
}

export interface CheckOutRequest {
    notes?: string;
}
