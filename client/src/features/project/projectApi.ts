import { api } from '@/services/api';
import type {
    Project,
    Task,
    TimeLog,
    Meeting,
    Credential,
} from './types/types';
import type {
    CreateProjectRequest,
    UpdateProjectRequest,
    AddAssigneeRequest,
    CreateTaskRequest,
    UpdateTaskRequest,
    CreateTimeLogRequest,
    UpdateTimeLogRequest,
    CreateMeetingRequest,
    UpdateMeetingRequest,
    CreateCredentialRequest,
    UpdateCredentialRequest,
    ApiResponse,
    UpdateAssigneePermissionsRequest,
} from './types/apiTypes';

export const projectApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // ============================================
        // PROJECT ENDPOINTS
        // ============================================
        getProjects: builder.query<ApiResponse<Project[]>, { status?: string; clientId?: string; priority?: string }>({
            query: (params) => ({
                url: '/projects',
                params,
            }),
            providesTags: ['Projects'],
        }),

        getProjectById: builder.query<ApiResponse<Project>, string>({
            query: (id) => `/projects/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Projects', id }],
        }),

        createProject: builder.mutation<ApiResponse<Project>, CreateProjectRequest>({
            query: (data) => ({
                url: '/projects',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Projects'],
        }),

        updateProject: builder.mutation<ApiResponse<Project>, { id: string; data: UpdateProjectRequest }>({
            query: ({ id, data }) => ({
                url: `/projects/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'Projects', id }, 'Projects'],
        }),

        deleteProject: builder.mutation<ApiResponse<Project>, string>({
            query: (id) => ({
                url: `/projects/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Projects'],
        }),

        addAssignee: builder.mutation<ApiResponse<Project>, { projectId: string; data: AddAssigneeRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/assignees`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }, 'Projects', 'User'],
        }),

        removeAssignee: builder.mutation<ApiResponse<Project>, { projectId: string; employeeId: string }>({
            query: ({ projectId, employeeId }) => ({
                url: `/projects/${projectId}/assignees/${employeeId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }, 'Projects', 'User'],
        }),

        updateAssigneePermissions: builder.mutation<ApiResponse<void>, { projectId: string; employeeId: string; data: UpdateAssigneePermissionsRequest }>({
            query: ({ projectId, employeeId, data }) => ({
                url: `/projects/${projectId}/assignees/${employeeId}/permissions`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }, 'Projects', 'User'],
        }),

        getAssigneePermissions: builder.query<ApiResponse<any>, { projectId: string; employeeId: string }>({
            query: ({ projectId, employeeId }) => `/projects/${projectId}/assignees/${employeeId}/permissions`,
            providesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }],
        }),

        uploadDocument: builder.mutation<ApiResponse<Project>, { projectId: string; file: File; name: string; type: string }>({
            query: ({ projectId, file, name, type }) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('name', name);
                formData.append('type', type);

                return {
                    url: `/projects/${projectId}/documents`,
                    method: 'POST',
                    body: formData,
                };
            },
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }],
        }),

        getDocumentUrl: builder.query<ApiResponse<{ url: string }>, { projectId: string; docId: string }>({
            query: ({ projectId, docId }) => `/projects/${projectId}/documents/${docId}`,
        }),

        deleteDocument: builder.mutation<ApiResponse<Project>, { projectId: string; docId: string }>({
            query: ({ projectId, docId }) => ({
                url: `/projects/${projectId}/documents/${docId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }],
        }),

        // ============================================
        // TASK ENDPOINTS
        // ============================================
        getTasks: builder.query<ApiResponse<Task[]>, { projectId: string; status?: string; assignee?: string }>({
            query: ({ projectId, ...params }) => ({
                url: `/projects/${projectId}/tasks`,
                params,
            }),
            providesTags: (_result, _error, { projectId }) => [{ type: 'Tasks', id: projectId }],
        }),

        getTaskById: builder.query<ApiResponse<Task>, { projectId: string; taskId: string }>({
            query: ({ projectId, taskId }) => `/projects/${projectId}/tasks/${taskId}`,
            providesTags: (_result, _error, { taskId }) => [{ type: 'Tasks', id: taskId }],
        }),

        createTask: builder.mutation<ApiResponse<Task>, { projectId: string; data: CreateTaskRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/tasks`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Tasks', id: projectId }],
        }),

        updateTask: builder.mutation<ApiResponse<Task>, { projectId: string; taskId: string; data: UpdateTaskRequest }>({
            query: ({ projectId, taskId, data }) => ({
                url: `/projects/${projectId}/tasks/${taskId}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId, taskId }) => [
                { type: 'Tasks', id: projectId },
                { type: 'Tasks', id: taskId },
            ],
        }),

        deleteTask: builder.mutation<ApiResponse, { projectId: string; taskId: string }>({
            query: ({ projectId, taskId }) => ({
                url: `/projects/${projectId}/tasks/${taskId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Tasks', id: projectId }],
        }),

        getSubtasks: builder.query<ApiResponse<Task[]>, { projectId: string; taskId: string }>({
            query: ({ projectId, taskId }) => `/projects/${projectId}/tasks/${taskId}/subtasks`,
            providesTags: (_result, _error, { taskId }) => [{ type: 'Tasks', id: `subtasks-${taskId}` }],
        }),

        createSubtask: builder.mutation<ApiResponse<Task>, { projectId: string; taskId: string; data: CreateTaskRequest }>({
            query: ({ projectId, taskId, data }) => ({
                url: `/projects/${projectId}/tasks/${taskId}/subtasks`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { taskId }) => [{ type: 'Tasks', id: `subtasks-${taskId}` }],
        }),

        // ============================================
        // TIME LOG ENDPOINTS
        // ============================================
        createTimeLog: builder.mutation<ApiResponse<TimeLog>, { projectId: string; taskId: string; data: CreateTimeLogRequest }>({
            query: ({ projectId, taskId, data }) => ({
                url: `/projects/${projectId}/tasks/${taskId}/timelogs`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['TimeLogs'],
        }),

        getProjectTimeLogs: builder.query<ApiResponse<TimeLog[]>, { projectId: string; userId?: string; startDate?: string; endDate?: string; billable?: string }>({
            query: ({ projectId, ...params }) => ({
                url: `/projects/${projectId}/timelogs`,
                params,
            }),
            providesTags: ['TimeLogs'],
        }),

        getTaskTimeLogs: builder.query<ApiResponse<TimeLog[]>, { projectId: string; taskId: string }>({
            query: ({ projectId, taskId }) => `/projects/${projectId}/tasks/${taskId}/timelogs`,
            providesTags: ['TimeLogs'],
        }),

        getMyTimeLogs: builder.query<ApiResponse<TimeLog[]>, { startDate?: string; endDate?: string; projectId?: string }>({
            query: (params) => ({
                url: '/projects/timelogs/my',
                params,
            }),
            providesTags: ['TimeLogs'],
        }),

        updateTimeLog: builder.mutation<ApiResponse<TimeLog>, { id: string; data: UpdateTimeLogRequest }>({
            query: ({ id, data }) => ({
                url: `/projects/timelogs/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: ['TimeLogs'],
        }),

        deleteTimeLog: builder.mutation<ApiResponse, string>({
            query: (id) => ({
                url: `/projects/timelogs/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['TimeLogs'],
        }),

        // ============================================
        // MEETING ENDPOINTS
        // ============================================
        createMeeting: builder.mutation<ApiResponse<Meeting>, { projectId: string; data: CreateMeetingRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/meetings`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Meetings'],
        }),

        getMeetings: builder.query<ApiResponse<Meeting[]>, { projectId: string; type?: string; startDate?: string; endDate?: string }>({
            query: ({ projectId, ...params }) => ({
                url: `/projects/${projectId}/meetings`,
                params,
            }),
            providesTags: ['Meetings'],
        }),

        getMeetingById: builder.query<ApiResponse<Meeting>, { projectId: string; id: string }>({
            query: ({ projectId, id }) => `/projects/${projectId}/meetings/${id}`,
            providesTags: (_result, _error, { id }) => [{ type: 'Meetings', id }],
        }),

        updateMeeting: builder.mutation<ApiResponse<Meeting>, { projectId: string; id: string; data: UpdateMeetingRequest }>({
            query: ({ projectId, id, data }) => ({
                url: `/projects/${projectId}/meetings/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'Meetings', id }, 'Meetings'],
        }),

        deleteMeeting: builder.mutation<ApiResponse, { projectId: string; id: string }>({
            query: ({ projectId, id }) => ({
                url: `/projects/${projectId}/meetings/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Meetings'],
        }),

        // ============================================
        // CREDENTIAL ENDPOINTS
        // ============================================
        createCredential: builder.mutation<ApiResponse<Credential>, { projectId: string; data: CreateCredentialRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/credentials`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Credentials'],
        }),

        getCredentials: builder.query<ApiResponse<Credential[]>, { projectId: string; type?: string }>({
            query: ({ projectId, ...params }) => ({
                url: `/projects/${projectId}/credentials`,
                params,
            }),
            providesTags: ['Credentials'],
        }),

        getCredentialById: builder.query<ApiResponse<Credential>, { projectId: string; id: string }>({
            query: ({ projectId, id }) => `/projects/${projectId}/credentials/${id}`,
            providesTags: (_result, _error, { id }) => [{ type: 'Credentials', id }],
        }),

        updateCredential: builder.mutation<ApiResponse<Credential>, { projectId: string; id: string; data: UpdateCredentialRequest }>({
            query: ({ projectId, id, data }) => ({
                url: `/projects/${projectId}/credentials/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { id }) => [{ type: 'Credentials', id }, 'Credentials'],
        }),

        deleteCredential: builder.mutation<ApiResponse, { projectId: string; id: string }>({
            query: ({ projectId, id }) => ({
                url: `/projects/${projectId}/credentials/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Credentials'],
        }),
    }),
    overrideExisting: false,
});

export const {
    // Projects
    useGetProjectsQuery,
    useGetProjectByIdQuery,
    useCreateProjectMutation,
    useUpdateProjectMutation,
    useDeleteProjectMutation,
    useAddAssigneeMutation,
    useRemoveAssigneeMutation,
    useUpdateAssigneePermissionsMutation,
    useGetAssigneePermissionsQuery,
    useLazyGetAssigneePermissionsQuery,
    useUploadDocumentMutation,
    useGetDocumentUrlQuery,
    useLazyGetDocumentUrlQuery,
    useDeleteDocumentMutation,

    // Tasks
    useGetTasksQuery,
    useGetTaskByIdQuery,
    useCreateTaskMutation,
    useUpdateTaskMutation,
    useDeleteTaskMutation,
    useGetSubtasksQuery,
    useCreateSubtaskMutation,

    // Time Logs
    useCreateTimeLogMutation,
    useGetProjectTimeLogsQuery,
    useGetTaskTimeLogsQuery,
    useGetMyTimeLogsQuery,
    useUpdateTimeLogMutation,
    useDeleteTimeLogMutation,

    // Meetings
    useCreateMeetingMutation,
    useGetMeetingsQuery,
    useGetMeetingByIdQuery,
    useUpdateMeetingMutation,
    useDeleteMeetingMutation,

    // Credentials
    useCreateCredentialMutation,
    useGetCredentialsQuery,
    useGetCredentialByIdQuery,
    useUpdateCredentialMutation,
    useDeleteCredentialMutation,
} = projectApi;
