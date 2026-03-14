// ============================================
// JOB TYPES
// ============================================
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'internship';

export interface Job {
    _id: string;
    title: string;
    department: string;
    location: string;
    description: string;
    requirements: string;
    employmentType: EmploymentType;
    isHiring: boolean;
    assignmentRequired: boolean;
    createdBy: string | { _id: string; name: string; email: string };
    createdAt: string;
    updatedAt: string;
}

export type ApplicationStatus =
    | 'new'
    | 'screening'
    | 'shortlisted'
    | 'assignment-round'
    | 'interview'
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
    experience?: string;
    coverLetter?: string;
    status: ApplicationStatus;
    tags: string[];
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
    timeLimitHours: number;
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
