import { api } from '@/services/api';
import type {
    Job,
    Application,
    Assignment,
    AssignmentSubmission,
    Interview,
} from './types/types';
import type {
    ApiResponse,
    CreateJobRequest,
    UpdateJobRequest,
    ListJobsParams,
    ListJobsResponse,
    ListApplicationsParams,
    ListApplicationsResponse,
    ApplicationDecisionRequest,
    ApplicationDecisionResponse,
    UpdateApplicationRequest,
    UpdateStatusRequest,
    TagRequest,
    PublicApplyRequest,
    AssignmentForApplicationResponse,
    AssignmentSubmissionsResponse,
    CreateAssignmentRequest,
    SubmitAssignmentRequest,
    UpdateAssignmentRequest,
    InterviewDetailsResponse,
    ListInterviewsParams,
    ListInterviewsResponse,
    SaveInterviewNoteRequest,
    SaveInterviewNoteResponse,
} from './types/apiTypes';

export const hiringApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // ============================================
        // JOB ENDPOINTS
        // ============================================
        getJobs: builder.query<ApiResponse<ListJobsResponse>, ListJobsParams>({
            query: (params) => ({
                url: '/hiring',
                params,
            }),
            providesTags: ['Jobs'],
        }),

        getPublicJobs: builder.query<ApiResponse<{ jobs: Job[] }>, void>({
            query: () => ({
                url: '/hiring/public/jobs',
            }),
            providesTags: ['Jobs'],
        }),

        getJobById: builder.query<ApiResponse<{ job: Job }>, string>({
            query: (id) => `/hiring/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Jobs', id }],
        }),

        createJob: builder.mutation<ApiResponse<{ job: Job }>, CreateJobRequest>({
            query: (data) => ({
                url: '/hiring',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Jobs'],
        }),

        updateJob: builder.mutation<
            ApiResponse<{ job: Job }>,
            { id: string; data: UpdateJobRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hiring/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Jobs', id },
                'Jobs',
            ],
        }),

        toggleJob: builder.mutation<ApiResponse<{ job: Job }>, string>({
            query: (id) => ({
                url: `/hiring/${id}/toggle`,
                method: 'PATCH',
            }),
            invalidatesTags: (_result, _error, id) => [
                { type: 'Jobs', id },
                'Jobs',
            ],
        }),

        deleteJob: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/hiring/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Jobs'],
        }),

        // ============================================
        // APPLICATION ENDPOINTS
        // ============================================
        getApplications: builder.query<
            ApiResponse<ListApplicationsResponse>,
            ListApplicationsParams
        >({
            query: (params) => ({
                url: '/hiring/applications',
                params,
            }),
            providesTags: ['Applications'],
        }),

        getApplicationById: builder.query<ApiResponse<{ application: Application }>, string>({
            query: (id) => `/hiring/applications/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Applications', id }],
        }),

        updateApplication: builder.mutation<
            ApiResponse<{ application: Application }>,
            { id: string; data: UpdateApplicationRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hiring/applications/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Applications', id },
                'Applications',
            ],
        }),

        updateApplicationStatus: builder.mutation<
            ApiResponse<{ application: Application }>,
            { id: string; data: UpdateStatusRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hiring/applications/${id}/status`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Applications', id },
                'Applications',
            ],
        }),

        applyFinalDecision: builder.mutation<
            ApiResponse<ApplicationDecisionResponse>,
            { id: string; data: ApplicationDecisionRequest }
        >({
            query: ({ id, data }) => {
                const formData = new FormData();
                formData.append('decision', data.decision);
                if (data.salary) formData.append('salary', data.salary);
                if (data.position) formData.append('position', data.position);
                if (data.offerLetter) formData.append('offerLetter', data.offerLetter);

                return {
                    url: `/hiring/applications/${id}/decision`,
                    method: 'PATCH',
                    body: formData,
                };
            },
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Applications', id },
                'Applications',
            ],
        }),

        addApplicationTag: builder.mutation<
            ApiResponse<{ application: Application }>,
            { id: string; data: TagRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hiring/applications/${id}/tag`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Applications', id },
                'Applications',
            ],
        }),

        removeApplicationTag: builder.mutation<
            ApiResponse<{ application: Application }>,
            { id: string; data: TagRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hiring/applications/${id}/tag`,
                method: 'DELETE',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Applications', id },
                'Applications',
            ],
        }),

        publicApply: builder.mutation<
            ApiResponse<{ applicationId: string; status: string }>,
            { jobId: string; data: PublicApplyRequest }
        >({
            query: ({ jobId, data }) => {
                const formData = new FormData();
                formData.append('name', data.name);
                formData.append('email', data.email);
                formData.append('phone', data.phone);
                if (data.portfolio) formData.append('portfolio', data.portfolio);
                if (data.linkedin) formData.append('linkedin', data.linkedin);
                if (data.experience) formData.append('experience', data.experience);
                if (data.coverLetter) formData.append('coverLetter', data.coverLetter);
                formData.append('resume', data.resume);

                return {
                    url: `/hiring/public/apply/${jobId}`,
                    method: 'POST',
                    body: formData,
                };
            },
        }),

        createAssignment: builder.mutation<
            ApiResponse<{ assignment: Assignment }>,
            CreateAssignmentRequest
        >({
            query: (data) => ({
                url: '/hiring/assignments',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Assignments'],
        }),

        getAssignmentsByJob: builder.query<ApiResponse<{ assignments: Assignment[] }>, string>({
            query: (jobId) => `/hiring/assignments/job/${jobId}`,
            providesTags: (_result, _error, jobId) => [
                { type: 'Assignments', id: jobId },
                'Assignments',
            ],
        }),

        updateAssignment: builder.mutation<
            ApiResponse<{ assignment: Assignment }>,
            { id: string; data: UpdateAssignmentRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hiring/assignments/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Assignments', id },
                'Assignments',
            ],
        }),

        deleteAssignment: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/hiring/assignments/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Assignments', 'AssignmentSubmissions'],
        }),

        getAssignmentSubmissions: builder.query<
            ApiResponse<AssignmentSubmissionsResponse>,
            string
        >({
            query: (assignmentId) => `/hiring/assignments/${assignmentId}/submissions`,
            providesTags: (_result, _error, assignmentId) => [
                { type: 'AssignmentSubmissions', id: assignmentId },
                'AssignmentSubmissions',
            ],
        }),

        getAssignmentForApplication: builder.query<
            ApiResponse<AssignmentForApplicationResponse>,
            string
        >({
            query: (applicationId) => `/hiring/assignment/${applicationId}`,
            providesTags: (_result, _error, applicationId) => [
                { type: 'Assignments', id: applicationId },
            ],
        }),

        submitAssignment: builder.mutation<
            ApiResponse<{ submission: AssignmentSubmission }>,
            { applicationId: string; data: SubmitAssignmentRequest }
        >({
            query: ({ applicationId, data }) => ({
                url: `/hiring/assignment/submit/${applicationId}`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { applicationId }) => [
                { type: 'Assignments', id: applicationId },
                'AssignmentSubmissions',
            ],
        }),

        sendInterviewInvite: builder.mutation<ApiResponse, string>({
            query: (applicationId) => ({
                url: `/hiring/interview/invite/${applicationId}`,
                method: 'POST',
            }),
            invalidatesTags: ['Applications', 'Interviews'],
        }),

        getInterviews: builder.query<ApiResponse<ListInterviewsResponse>, ListInterviewsParams>({
            query: (params) => ({
                url: '/hiring/interviews',
                params,
            }),
            providesTags: ['Interviews'],
        }),

        updateInterviewStatus: builder.mutation<
            ApiResponse<{ interview: Interview }>,
            { id: string; status: Interview['status'] }
        >({
            query: ({ id, status }) => ({
                url: `/hiring/interviews/${id}/status`,
                method: 'PATCH',
                body: { status },
            }),
            invalidatesTags: ['Interviews'],
        }),

        getInterviewDetails: builder.query<ApiResponse<InterviewDetailsResponse>, string>({
            query: (id) => `/hiring/interviews/${id}/details`,
            providesTags: (_result, _error, id) => [
                { type: 'Interviews', id },
                'Interviews',
            ],
        }),

        saveInterviewNote: builder.mutation<
            ApiResponse<SaveInterviewNoteResponse>,
            { id: string; data: SaveInterviewNoteRequest }
        >({
            query: ({ id, data }) => ({
                url: `/hiring/interviews/${id}/notes`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Interviews', id },
                'Interviews',
            ],
        }),
    }),
});

export const {
    useGetJobsQuery,
    useGetPublicJobsQuery,
    useGetJobByIdQuery,
    useCreateJobMutation,
    useUpdateJobMutation,
    useToggleJobMutation,
    useDeleteJobMutation,
    useGetApplicationsQuery,
    useGetApplicationByIdQuery,
    useUpdateApplicationMutation,
    useUpdateApplicationStatusMutation,
    useApplyFinalDecisionMutation,
    useAddApplicationTagMutation,
    useRemoveApplicationTagMutation,
    usePublicApplyMutation,
    useCreateAssignmentMutation,
    useGetAssignmentsByJobQuery,
    useUpdateAssignmentMutation,
    useDeleteAssignmentMutation,
    useGetAssignmentSubmissionsQuery,
    useGetAssignmentForApplicationQuery,
    useSubmitAssignmentMutation,
    useSendInterviewInviteMutation,
    useGetInterviewsQuery,
    useUpdateInterviewStatusMutation,
    useGetInterviewDetailsQuery,
    useSaveInterviewNoteMutation,
} = hiringApi;
