import type {
    EmploymentType,
    Job,
    Application,
    ApplicationStatus,
    Assignment,
    AssignmentSubmission,
    AssignmentSubmissionFields,
    Interview,
    InterviewDetails,
    InterviewNote,
    InterviewStatus,
    Offer,
    ApplicationActivity,
    HiringReportSummary,
    InterviewDailySlot,
    InterviewAvailabilityRange,
    InterviewDateOverride,
} from './types';

// ============================================
// SHARED API RESPONSE WRAPPER
// ============================================
export interface ApiResponse<T = void> {
    status: 'success' | 'error';
    data: T;
}

// ============================================
// JOB LIST
// ============================================
export interface ListJobsResponse {
    jobs: Job[];
    total: number;
    page: number;
    totalPages: number;
}

export interface ListJobsParams {
    department?: string;
    employmentType?: EmploymentType;
    isHiring?: boolean;
    search?: string;
    page?: number;
    limit?: number;
}

// ============================================
// TEMPLATE
// ============================================
export interface CreateJobTemplateRequest {
    templateName: string;
    title: string;
    department: string;
    locationType: 'Remote' | 'In-Office';
    location?: string;
    description: string;
    requirements: string;
    employmentType: EmploymentType;
}

export interface UpdateJobTemplateRequest extends Partial<CreateJobTemplateRequest> {}

// ============================================
// CREATE / UPDATE
// ============================================
export interface CreateJobRequest {
    title: string;
    department: string;
    location: string;
    description: string;
    requirements: string;
    employmentType: EmploymentType;
    isHiring: boolean;
    assignmentRequired: boolean;
    interviewScheduling?: {
        enabled: boolean;
        active: boolean;
        timezone: string;
        organizerName: string;
        availableRanges: InterviewAvailabilityRange[];
        dateOverrides?: InterviewDateOverride[];
        weekdays: number[];
        dailySlots: InterviewDailySlot[];
        durationMinutes: number;
        beforeEventBufferMinutes: number;
        afterEventBufferMinutes: number;
        reminderMinutesBefore: number[];
    };
}

export interface UpdateJobRequest {
    title?: string;
    department?: string;
    location?: string;
    description?: string;
    requirements?: string;
    employmentType?: EmploymentType;
    isHiring?: boolean;
    assignmentRequired?: boolean;
    interviewScheduling?: {
        enabled?: boolean;
        active?: boolean;
        timezone?: string;
        organizerName?: string;
        availableRanges?: InterviewAvailabilityRange[];
        dateOverrides?: InterviewDateOverride[];
        weekdays?: number[];
        dailySlots?: InterviewDailySlot[];
        durationMinutes?: number;
        beforeEventBufferMinutes?: number;
        afterEventBufferMinutes?: number;
        reminderMinutesBefore?: number[];
    };
}

// ============================================
// APPLICATIONS
// ============================================
export interface ListApplicationsResponse {
    applications: Application[];
    total: number;
    page: number;
    totalPages: number;
}

export interface ListApplicationsParams {
    jobId?: string;
    status?: ApplicationStatus;
    tags?: string;
    search?: string;
    location?: string;
    minExperience?: number;
    page?: number;
    limit?: number;
}

export interface UpdateApplicationRequest {
    status?: ApplicationStatus;
    tags?: string[];
}

export interface UpdateStatusRequest {
    status: ApplicationStatus;
}

export interface TagRequest {
    tag: string;
}

export interface PublicApplyRequest {
    name: string;
    email: string;
    phone: string;
    location: string;
    yearsOfExperience: number;
    portfolio?: string;
    linkedin?: string;
    github?: string;
    experience?: string;
    coverLetter?: string;
    resume: File;
}

export interface CreateAssignmentRequest {
    jobId: string;
    title: string;
    description: string;
    instructions: string;
    timeLimitDays: number;
    submissionFields: AssignmentSubmissionFields;
}

export interface UpdateAssignmentRequest {
    title?: string;
    description?: string;
    instructions?: string;
    timeLimitDays?: number;
    submissionFields?: Partial<AssignmentSubmissionFields>;
}

export interface SubmitAssignmentRequest {
    githubLink?: string;
    demoLink?: string;
    videoLink?: string;
    notes?: string;
}

export interface AssignmentForApplicationResponse {
    assignment: Assignment;
    applicationId: string;
    hasSubmitted: boolean;
    expiresAt: string | null;
    isExpired: boolean;
}

export interface AssignmentSubmissionsResponse {
    submissions: AssignmentSubmission[];
}

export interface ListInterviewsParams {
    status?: InterviewStatus;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}

export interface ListInterviewsResponse {
    interviews: Interview[];
    total: number;
    page: number;
    totalPages: number;
}

export interface SaveInterviewNoteRequest {
    rating: number;
    technicalScore: number;
    communicationScore: number;
    notes: string;
}

export interface InterviewDetailsResponse extends InterviewDetails {}

export interface SaveInterviewNoteResponse {
    note: InterviewNote;
}

export interface ApplicationDecisionRequest {
    decision: 'rejected' | 'accepted';
    salary?: string;
    position?: string;
    offerLetter?: File;
}

export interface ApplicationDecisionResponse {
    application: Application;
    offer: Offer | null;
}

export interface ApplicationTimelineResponse {
    activities: ApplicationActivity[];
}

export interface HiringReportSummaryResponse extends HiringReportSummary {}
