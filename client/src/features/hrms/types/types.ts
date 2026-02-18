// ── Employee Types ──────────────────────────────────────────────────

export interface WorkSchedule {
    workingDaysPerWeek: number;
    hoursPerDay: number;
}

export interface PersonalInfo {
    dob?: string;
    gender?: 'male' | 'female' | 'other';
    phone?: string;
    emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
    };
    bloodGroup?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    };
}

export interface BankDetails {
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    panNumber?: string;
}

export interface OnboardingChecklist {
    _id?: string;
    item: string;
    completed: boolean;
    completedAt?: string;
}

export interface Onboarding {
    status: 'not-started' | 'in-progress' | 'completed';
    checklist: OnboardingChecklist[];
    startedAt?: string;
    completedAt?: string;
}

export interface Employee {
    _id: string;
    userId: {
        _id: string;
        name: string;
        email: string;
    };
    employeeId: string;
    designation: string;
    department: 'engineering' | 'design' | 'marketing' | 'finance' | 'hr' | 'admin';
    employmentType: 'full-time' | 'part-time' | 'contract' | 'intern';
    joiningDate: string;
    probationEndDate?: string;
    status: 'active' | 'on-notice' | 'relieved' | 'terminated';
    reportingTo?: {
        _id: string;
        employeeId: string;
        designation: string;
    };
    workSchedule: WorkSchedule;
    personalInfo: PersonalInfo;
    bankDetails: BankDetails;
    onboarding: Onboarding;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

// ── Salary Types ────────────────────────────────────────────────────

export interface SalaryDeductions {
    pf: number;
    esi: number;
    tax: number;
    other: number;
}

export interface SalaryRevision {
    _id: string;
    basic: number;
    hra: number;
    da: number;
    specialAllowance: number;
    effectiveFrom: string;
    revisedBy: string;
}

export interface SalaryStructure {
    _id: string;
    employeeId: Employee | string;
    basic: number;
    hra: number;
    da: number;
    specialAllowance: number;
    deductions: SalaryDeductions;
    currency: string;
    effectiveFrom: string;
    revisionHistory: SalaryRevision[];
    createdAt: string;
    updatedAt: string;
}

// ── Leave Types ─────────────────────────────────────────────────────

export interface Leave {
    _id: string;
    employeeId: Employee | string;
    type: 'casual' | 'sick' | 'earned' | 'unpaid' | 'maternity' | 'paternity';
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approvedBy?: { _id: string; name: string };
    rejectionReason?: string;
    createdAt: string;
    updatedAt: string;
}

export interface LeaveBalance {
    type: string;
    total: number;
    used: number;
    remaining: number;
    count: number;
}

// ── Payroll Types ───────────────────────────────────────────────────

export interface PayrollDeductions {
    pf: number;
    esi: number;
    tax: number;
    leaves: number;
    penalties: number;
    other: number;
}

export interface Payroll {
    _id: string;
    employeeId: Employee | string;
    month: number;
    year: number;
    workingDays: number;
    presentDays: number;
    totalHoursWorked: number;
    overtime: number;
    grossSalary: number;
    incentiveAmount: number;
    penaltyAmount: number;
    deductions: PayrollDeductions;
    netSalary: number;
    status: 'draft' | 'approved' | 'paid';
    generatedBy: string;
    approvedBy?: string;
    paidAt?: string;
    createdAt: string;
    updatedAt: string;
}

// ── Incentive Types ─────────────────────────────────────────────────

export interface Incentive {
    _id: string;
    employeeId: string;
    taskId?: { _id: string; title: string };
    projectId?: { _id: string; name: string };
    month: number;
    year: number;
    type: 'bonus' | 'penalty';
    score: number;
    amount: number;
    reason: string;
    calculatedAt: string;
}

// ── Analytics Types ─────────────────────────────────────────────────

export interface DashboardStats {
    totalEmployees: number;
    activeEmployees: number;
    onNotice: number;
    departments: { _id: string; count: number }[];
    pendingLeaves: number;
    onboardingCount: number;
}

export interface WorkingHoursAnalytics {
    employee: {
        id: string;
        employeeId: string;
        name: string;
    };
    summary: {
        totalHours: number;
        daysLogged: number;
        avgHoursPerDay: number;
        expectedHoursPerDay: number;
        efficiency: number;
    };
    dailyBreakdown: {
        date: string;
        hours: number;
        entries: number;
    }[];
}

export interface TeamAnalyticsMember {
    employee: {
        id: string;
        employeeId: string;
        name: string;
        designation: string;
    };
    totalHours: number;
    daysWorked: number;
    leaveDays: number;
}

export interface IncentiveSummary {
    incentives: Incentive[];
    summary: {
        totalBonusScore: number;
        totalBonusAmount: number;
        totalPenaltyScore: number;
        totalPenaltyAmount: number;
        netScore: number;
        taskCount: number;
    };
}
