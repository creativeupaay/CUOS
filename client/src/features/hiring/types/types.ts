// ============================================
// JOB TYPES
// ============================================
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';

export type InterviewScheduleSyncStatus =
    | 'not_configured'
    | 'pending'
    | 'synced'
    | 'failed';

export interface InterviewDailySlot {
    startTime: string;
    endTime: string;
}

export interface InterviewAvailabilityRange {
    startDate: string;
    endDate: string;
}

export interface InterviewDateOverride {
    date: string;
    slots: InterviewDailySlot[];
}

export interface InterviewSchedulingConfig {
    enabled: boolean;
    active: boolean;
    scheduleId?: number;
    timezone: string;
    organizerName: string;
    eventTypeId?: number;
    eventTypeSlug?: string;
    bookingUrl?: string;
    availableRanges: InterviewAvailabilityRange[];
    dateOverrides?: InterviewDateOverride[];
    weekdays: number[];
    dailySlots: InterviewDailySlot[];
    durationMinutes: number;
    beforeEventBufferMinutes: number;
    afterEventBufferMinutes: number;
    reminderMinutesBefore: number[];
    syncStatus: InterviewScheduleSyncStatus;
    syncError?: string;
    lastSyncedAt?: string;
    externalUpdatedAt?: string;
}

export interface Job {
    _id: string;
    title: string;
    department: string;
    locationType?: 'Remote' | 'In-Office';
    location: string;
    description: string;
    requirements: string;
    employmentType: EmploymentType;
    isHiring: boolean;
    assignmentRequired: boolean;
    interviewScheduling: InterviewSchedulingConfig;
    createdBy: string | { _id: string; name: string; email: string };
    createdAt: string;
    updatedAt: string;
}

export interface JobTemplate {
    _id: string;
    templateName: string;
    title: string;
    department: string;
    locationType: 'Remote' | 'In-Office';
    location: string;
    description: string;
    requirements: string;
    employmentType: EmploymentType;
    createdBy: string | { _id: string; name: string; email: string };
    createdAt: string;
    updatedAt: string;
}

export type ApplicationStatus =
    | 'new'
    | 'screening'
    | 'shortlisted'
    | 'assignment-round'
    | 'assignment-submitted'
    | 'interview'
    | 'interview-scheduled'
    | 'interview-cancelled'
    | 'rejected'
    | 'offered'
    | 'hired';

export interface JobSummary {
    _id: string;
    title: string;
    department?: string;
    location?: string;
    employmentType?: EmploymentType;
    isHiring?: boolean;
    interviewScheduling?: Partial<InterviewSchedulingConfig>;
}

export interface Application {
    _id: string;
    jobId: string | JobSummary;
    name: string;
    email: string;
    phone: string;
    resumeUrl: string;
    portfolio?: string;
    linkedin?: string;
    github?: string;
    experience?: string;
    coverLetter?: string;
    location?: string;
    yearsOfExperience?: number;
    status: ApplicationStatus;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

export interface ApplicationActivity {
    _id: string;
    applicationId: string;
    type: string;
    title: string;
    description: string;
    actorType: 'candidate' | 'user' | 'system';
    actorId?:
        | string
        | {
              _id: string;
              name?: string;
              email?: string;
          };
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface AssignmentSubmissionFields {
    githubLink: boolean;
    demoLink: boolean;
    videoLink: boolean;
    notes: boolean;
}

export interface Assignment {
    _id: string;
    jobId: string | JobSummary;
    title: string;
    description: string;
    instructions: string;
    timeLimitDays: number;
    submissionFields: AssignmentSubmissionFields;
    createdAt: string;
    updatedAt: string;
}

export interface AssignmentSubmission {
    _id: string;
    assignmentId: string | Assignment;
    applicationId:
        | string
        | {
              _id: string;
              name: string;
              email: string;
              phone?: string;
              status: ApplicationStatus;
          };
    githubLink?: string;
    demoLink?: string;
    videoLink?: string;
    notes?: string;
    submittedAt: string;
    deadlineAt?: string;
    submittedAfterDeadline: boolean;
    createdAt: string;
    updatedAt: string;
}

export type InterviewStatus =
    | 'scheduled'
    | 'completed'
    | 'cancelled'
    | 'rescheduled'
    | 'no-show';

export interface Interview {
    _id: string;
    applicationId:
        | string
        | {
              _id: string;
              name: string;
              email: string;
              status: ApplicationStatus;
              jobId?: string | JobSummary;
          };
    scheduledTime: string;
    meetLink: string;
    interviewer: string;
    status: InterviewStatus;
    createdAt: string;
    updatedAt: string;
}

export interface InterviewNote {
    _id: string;
    interviewId: string;
    applicationId: string;
    rating: number;
    technicalScore: number;
    communicationScore: number;
    notes: string;
    createdBy:
        | string
        | {
              _id: string;
              name: string;
              email: string;
          };
    createdAt: string;
    updatedAt: string;
}

export interface InterviewDetails {
    interview: Interview;
    assignmentSubmission:
        | (AssignmentSubmission & {
              assignmentId?:
                  | string
                  | {
                        _id: string;
                        title: string;
                        description?: string;
                        instructions?: string;
                        submissionFields?: AssignmentSubmissionFields;
                    };
          })
        | null;
    note: InterviewNote | null;
}

export type OfferStatus = 'sent' | 'accepted' | 'declined';

export interface Offer {
    _id: string;
    applicationId: string;
    salary: string;
    position: string;
    offerLetterUrl: string;
    status: OfferStatus;
    createdAt: string;
    updatedAt: string;
}

export interface HiringOverviewMetrics {
    totalApplications: number;
    activeJobs: number;
    hiredCount: number;
    offersCount: number;
    rejectedCount: number;
    rejectionRate: number;
}

export interface HiringPipelineMetric {
    status: ApplicationStatus;
    count: number;
    avgAgingDays: number;
    conversionFromPrevious: number | null;
}

export interface RecruiterPerformanceMetric {
    userId: string;
    name?: string;
    email?: string;
    totalActions: number;
    statusChanges: number;
    offersSent: number;
    rejections: number;
    interviewNotes: number;
    lastActiveAt: string;
}

export interface HiringReportSummary {
    overview: HiringOverviewMetrics;
    pipeline: HiringPipelineMetric[];
    recruiterPerformance: RecruiterPerformanceMetric[];
}
