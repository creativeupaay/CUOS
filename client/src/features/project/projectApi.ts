import { api } from '@/services/api';
import toast from 'react-hot-toast';
import type {
    Project,
    Task,
    TimeLog,
    Meeting,
    Credential,
    DocFolder,
    DocItem,
    DocAdminUser,
    ProjectAssignee,
    Note,
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
    ShareCredentialsRequest,
    RevokeCredentialAccessRequest,
    UpdateCredentialAdminsRequest,
    CreateNoteRequest,
    UpdateNoteRequest,
    ApiResponse,
    UpdateAssigneePermissionsRequest,
} from './types/apiTypes';

export const projectApi = api.injectEndpoints({
    endpoints: (builder) => ({
        // ============================================
        // PROJECT ENDPOINTS
        // ============================================
        getProjects: builder.query<ApiResponse<Project[]>, { status?: string; clientId?: string; priority?: string; partnerId?: string }>({
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
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Projects', id },
                'Projects',
                'Revenues',
                'BankTransactions',
                'FinanceDashboard',
            ],
        }),

        deleteProject: builder.mutation<ApiResponse<Project>, string>({
            query: (id) => ({
                url: `/projects/${id}`,
                method: 'DELETE',
            }),
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                toast.promise(queryFulfilled, {
                    loading: 'Deleting project...',
                    success: 'Project deleted successfully',
                    error: 'Failed to delete project',
                });
                const patchResult = dispatch(
                    projectApi.util.updateQueryData('getProjects', {}, (draft) => {
                       if (draft?.data) {
                           draft.data = draft.data.filter((p: Project) => p._id !== id);
                       }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
            invalidatesTags: ['Projects', 'Revenues', 'BankTransactions', 'FinanceDashboard'],
        }),

        addAssignee: builder.mutation<ApiResponse<Project>, { projectId: string; data: AddAssigneeRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/assignees`,
                method: 'POST',
                body: data,
            }),
            // Only invalidate the specific project — not the whole 'Projects' list or 'User'.
            // Invalidating 'Projects' (list) would trigger a sidebar refetch on every assignee change.
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }],
        }),

        removeAssignee: builder.mutation<ApiResponse<Project>, { projectId: string; memberId: string }>({
            query: ({ projectId, memberId }) => ({
                url: `/projects/${projectId}/assignees/${memberId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }],
        }),

        updateAssigneePermissions: builder.mutation<ApiResponse<void>, { projectId: string; memberId: string; data: UpdateAssigneePermissionsRequest }>({
            query: ({ projectId, memberId, data }) => ({
                url: `/projects/${projectId}/assignees/${memberId}/permissions`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }],
        }),

        getAssigneePermissions: builder.query<ApiResponse<ProjectAssignee['subModules']>, { projectId: string; memberId: string }>({
            query: ({ projectId, memberId }) => `/projects/${projectId}/assignees/${memberId}/permissions`,
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
        getReportsDashboard: builder.query<ApiResponse<any>, { viewBy?: string; startDate?: string; endDate?: string } | void>({
            query: (params) => ({
                url: '/projects/reports/dashboard',
                params: params || {},
            }),
            providesTags: ['Tasks', 'TimeLogs'],
        }),
        
        getIndividualTasks: builder.query<ApiResponse<Task[]>, { date?: string } | void>({
            query: (params) => ({
                url: '/projects/tasks/individual',
                params: params || {},
            }),
            providesTags: [{ type: 'Tasks', id: 'INDIVIDUAL' }],
        }),

        createIndividualTask: builder.mutation<ApiResponse<Task>, CreateTaskRequest>({
            query: (data) => ({
                url: '/projects/tasks/individual',
                method: 'POST',
                body: data,
            }),
            async onQueryStarted(_, { dispatch, queryFulfilled }) {
                try {
                    const { data: result } = await queryFulfilled;
                    // Immediately patch the INDIVIDUAL task list cache with the new task
                    dispatch(
                        projectApi.util.updateQueryData('getIndividualTasks', undefined, (draft) => {
                            if (draft?.data && result?.data) {
                                draft.data.unshift(result.data as Task);
                            }
                        })
                    );
                } catch {
                    // invalidatesTags will handle refetch on error
                }
            },
            invalidatesTags: [{ type: 'Tasks', id: 'INDIVIDUAL' }],
        }),

        updateIndividualTask: builder.mutation<ApiResponse<Task>, { taskId: string; data: UpdateTaskRequest }>({
            query: ({ taskId, data }) => ({
                url: `/projects/tasks/individual/${taskId}`,
                method: 'PATCH',
                body: data,
            }),
            async onQueryStarted({ taskId, data }, { dispatch, queryFulfilled }) {
                // Optimistically update status/fields in the cache immediately
                const patchResult1 = dispatch(
                    projectApi.util.updateQueryData('getIndividualTasks', undefined, (draft) => {
                        if (draft?.data) {
                            const task = draft.data.find((t: Task) => t._id === taskId);
                            if (task) {
                                Object.assign(task, data);
                            }
                        }
                    })
                );
                const patchResult2 = dispatch(
                    projectApi.util.updateQueryData('getIndividualTasks', { date: new Date().toLocaleDateString('en-CA') }, (draft) => {
                        if (draft?.data) {
                            const task = draft.data.find((t: Task) => t._id === taskId);
                            if (task) {
                                Object.assign(task, data);
                            }
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult1.undo();
                    patchResult2.undo();
                }
            },
            invalidatesTags: (_result, _error, { data }) => [
                { type: 'Tasks', id: 'INDIVIDUAL' },
                ...(data.projectId ? [{ type: 'Tasks' as const, id: data.projectId }] : [])
            ],
        }),

        deleteIndividualTask: builder.mutation<ApiResponse, { taskId: string }>({
            query: ({ taskId }) => ({
                url: `/projects/tasks/individual/${taskId}`,
                method: 'DELETE',
            }),
            async onQueryStarted({ taskId }, { dispatch, queryFulfilled }) {
                const patchResult = dispatch(
                    projectApi.util.updateQueryData('getIndividualTasks', undefined, (draft) => {
                        if (draft?.data) {
                            draft.data = draft.data.filter((t: Task) => t._id !== taskId);
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
            invalidatesTags: [{ type: 'Tasks', id: 'INDIVIDUAL' }],
        }),


        getTasks: builder.query<ApiResponse<Task[]>, { projectId: string; status?: string; assignee?: string; includeSubtasks?: boolean }>({
            query: ({ projectId, status, assignee, includeSubtasks }) => {
                let url = `/projects/${projectId}/tasks?`;
                if (status) url += `status=${status}&`;
                if (assignee) url += `assignee=${assignee}&`;
                if (includeSubtasks) url += `includeSubtasks=true`;
                return url;
            },
            providesTags: (_result, _error, arg) => [{ type: 'Tasks', id: arg.projectId }],
        }),

        getAllTasks: builder.query<ApiResponse<Task[]>, { projectIds: string[] }>({
            query: ({ projectIds }) => `/projects/tasks/all?projectIds=${projectIds.join(',')}`,
            providesTags: ['Tasks'],
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
            async onQueryStarted({ projectId, taskId, data }, { dispatch, queryFulfilled }) {
                // Optimistically update the task in the cache
                const patchResult1 = dispatch(
                    projectApi.util.updateQueryData('getTasks', { projectId }, (draft) => {
                        if (draft?.data) {
                            const task = draft.data.find((t: Task) => t._id === taskId);
                            if (task) Object.assign(task, data);
                        }
                    })
                );
                const patchResult2 = dispatch(
                    projectApi.util.updateQueryData('getIndividualTasks', { date: new Date().toLocaleDateString('en-CA') }, (draft) => {
                        if (draft?.data) {
                            const task = draft.data.find((t: Task) => t._id === taskId);
                            if (task) Object.assign(task, data);
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult1.undo();
                    patchResult2.undo();
                }
            },
            invalidatesTags: (_result, _error, { projectId, taskId, data }) => [
                { type: 'Tasks', id: projectId },
                { type: 'Tasks', id: taskId },
                { type: 'Tasks', id: 'INDIVIDUAL' },
                ...(data.projectId && data.projectId !== projectId ? [{ type: 'Tasks' as const, id: data.projectId }] : []),
                // When a status change creates a TimeLog (pause/complete), invalidate time-log caches
                'TimeLogs',
            ],
        }),

        deleteTask: builder.mutation<ApiResponse, { projectId: string; taskId: string }>({
            query: ({ projectId, taskId }) => ({
                url: `/projects/${projectId}/tasks/${taskId}`,
                method: 'DELETE',
            }),
            async onQueryStarted({ projectId, taskId }, { dispatch, queryFulfilled }) {
                toast.promise(queryFulfilled, {
                    loading: 'Deleting task...',
                    success: 'Task deleted successfully',
                    error: 'Failed to delete task',
                });
                const patchResult = dispatch(
                    projectApi.util.updateQueryData('getTasks', { projectId }, (draft) => {
                       if (draft?.data) {
                           draft.data = draft.data.filter((t: Task) => t._id !== taskId);
                       }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patchResult.undo();
                }
            },
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Tasks', id: projectId }],
        }),

        getSubtasks: builder.query<ApiResponse<Task[]>, { projectId: string; taskId: string }>({
            query: ({ projectId, taskId }) => `/projects/${projectId}/tasks/${taskId}/subtasks`,
            providesTags: (_result, _error, { projectId, taskId }) => [
                { type: 'Tasks', id: `subtasks-${taskId}` },
                // Also tagged with projectId so when any task in this project mutates,
                // this subtask list automatically re-fetches (catches status changes)
                { type: 'Tasks', id: projectId },
            ],
        }),

        createSubtask: builder.mutation<ApiResponse<Task>, { projectId: string; taskId: string; data: CreateTaskRequest }>({
            query: ({ projectId, taskId, data }) => ({
                url: `/projects/${projectId}/tasks/${taskId}/subtasks`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId, taskId }) => [
                { type: 'Tasks', id: `subtasks-${taskId}` },
                { type: 'Tasks', id: projectId }, // refreshes board view (includeSubtasks query)
            ],
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
            invalidatesTags: ['TimeLogs', 'Tasks'],
        }),

        createIndividualTaskTimeLog: builder.mutation<ApiResponse<TimeLog>, { taskId: string; data: CreateTimeLogRequest }>({
            query: ({ taskId, data }) => ({
                url: `/projects/tasks/individual/${taskId}/timelogs`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['TimeLogs', { type: 'Tasks', id: 'INDIVIDUAL' }],
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

        getMeetings: builder.query<ApiResponse<Meeting[]>, { projectId: string; type?: 'internal' | 'external' }>({
            query: ({ projectId, type }) => {
                let url = `/projects/${projectId}/meetings`;
                if (type) url += `?type=${type}`;
                return url;
            },
            providesTags: (_result, _error, arg) => [{ type: 'Meetings', id: arg.projectId }],
        }),

        getAllMeetings: builder.query<ApiResponse<Meeting[]>, { projectIds: string[] }>({
            query: ({ projectIds }) => `/projects/meetings/all?projectIds=${projectIds.join(',')}`,
            providesTags: ['Meetings'],
        }),

        getIndividualMeetings: builder.query<ApiResponse<Meeting[]>, { type?: string; startDate?: string; endDate?: string } | void>({
            query: (params) => ({
                url: `/projects/meetings/individual`,
                params: params || {},
            }),
            providesTags: [{ type: 'Meetings', id: 'INDIVIDUAL' }],
        }),

        createIndividualMeeting: builder.mutation<ApiResponse<Meeting>, CreateMeetingRequest>({
            query: (data) => ({
                url: '/projects/meetings/individual',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: [{ type: 'Meetings', id: 'INDIVIDUAL' }],
        }),

        updateIndividualMeeting: builder.mutation<ApiResponse<Meeting>, { id: string; data: UpdateMeetingRequest }>({
            query: ({ id, data }) => ({
                url: `/projects/meetings/individual/${id}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: [{ type: 'Meetings', id: 'INDIVIDUAL' }, 'Meetings'],
        }),

        deleteIndividualMeeting: builder.mutation<ApiResponse, { id: string }>({
            query: ({ id }) => ({
                url: `/projects/meetings/individual/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [{ type: 'Meetings', id: 'INDIVIDUAL' }, 'Meetings'],
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
            async onQueryStarted({ projectId, id }, { dispatch, queryFulfilled }) {
                const credentialTypes: Array<string | undefined> = [undefined, 'env', 'ssh-key', 'test-user', 'account', 'other', '2fa'];
                const patches = credentialTypes.map((type) =>
                    dispatch(
                        projectApi.util.updateQueryData(
                            'getCredentials',
                            { projectId, ...(type ? { type } : {}) },
                            (draft) => {
                                if (draft?.data) {
                                    draft.data = draft.data.filter((cred: Credential) => cred._id !== id);
                                }
                            }
                        )
                    )
                );

                try {
                    await queryFulfilled;
                } catch {
                    patches.forEach((patch) => patch.undo());
                }
            },
            invalidatesTags: ['Credentials'],
        }),

        shareCredentials: builder.mutation<ApiResponse<void>, { projectId: string; data: ShareCredentialsRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/credentials/share`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Credentials'],
        }),

        revokeCredentialAccess: builder.mutation<ApiResponse<void>, { projectId: string; data: RevokeCredentialAccessRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/credentials/share`,
                method: 'DELETE',
                body: data,
            }),
            invalidatesTags: ['Credentials'],
        }),

        getCredentialAdmins: builder.query<ApiResponse<any[]>, { projectId: string }>({
            query: ({ projectId }) => `/projects/${projectId}/credential-admins`,
            providesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }],
        }),

        updateCredentialAdmins: builder.mutation<ApiResponse<void>, { projectId: string; data: UpdateCredentialAdminsRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/credential-admins`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Projects', id: projectId }, 'Projects'],
        }),

        // ============================================
        // DOC FOLDER ENDPOINTS
        // ============================================

        getDocFolders: builder.query<ApiResponse<DocFolder[]>, { projectId: string; parentId?: string | null }>({
            query: ({ projectId, parentId }) => ({
                url: `/projects/${projectId}/doc-folders`,
                params: parentId ? { parentId } : {},
            }),
            providesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: projectId }],
        }),

        createDocFolder: builder.mutation<ApiResponse<DocFolder>, { projectId: string; name: string; parentId?: string | null }>({
            query: ({ projectId, ...body }) => ({
                url: `/projects/${projectId}/doc-folders`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: projectId }],
        }),

        renameDocFolder: builder.mutation<ApiResponse<DocFolder>, { projectId: string; folderId: string; name: string }>({
            query: ({ projectId, folderId, name }) => ({
                url: `/projects/${projectId}/doc-folders/${folderId}`,
                method: 'PATCH',
                body: { name },
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: projectId }],
        }),

        deleteDocFolder: builder.mutation<ApiResponse<void>, { projectId: string; folderId: string }>({
            query: ({ projectId, folderId }) => ({
                url: `/projects/${projectId}/doc-folders/${folderId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: projectId }],
        }),

        updateDocFolderAccess: builder.mutation<ApiResponse<DocFolder>, { projectId: string; folderId: string; viewAccess: string[] }>({
            query: ({ projectId, folderId, viewAccess }) => ({
                url: `/projects/${projectId}/doc-folders/${folderId}/access`,
                method: 'PATCH',
                body: { viewAccess },
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: projectId }],
        }),

        // ============================================
        // DOC ITEM ENDPOINTS
        // ============================================

        getDocItems: builder.query<ApiResponse<DocItem[]>, { projectId: string; folderId?: string | null }>({
            query: ({ projectId, folderId }) => ({
                url: `/projects/${projectId}/doc-items`,
                params: folderId ? { folderId } : {},
            }),
            providesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: `${projectId}-items` }],
        }),

        uploadDocItem: builder.mutation<ApiResponse<DocItem>, { projectId: string; formData: FormData }>({
            query: ({ projectId, formData }) => ({
                url: `/projects/${projectId}/doc-items/upload`,
                method: 'POST',
                body: formData,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Documents', id: projectId },
                { type: 'Documents', id: `${projectId}-items` },
            ],
        }),

        getDocItemUrl: builder.query<ApiResponse<{ url: string }>, { projectId: string; itemId: string }>({
            query: ({ projectId, itemId }) => `/projects/${projectId}/doc-items/${itemId}/url`,
        }),

        renameDocItem: builder.mutation<ApiResponse<DocItem>, { projectId: string; itemId: string; name: string }>({
            query: ({ projectId, itemId, name }) => ({
                url: `/projects/${projectId}/doc-items/${itemId}`,
                method: 'PATCH',
                body: { name },
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: `${projectId}-items` }],
        }),

        deleteDocItem: builder.mutation<ApiResponse<void>, { projectId: string; itemId: string }>({
            query: ({ projectId, itemId }) => ({
                url: `/projects/${projectId}/doc-items/${itemId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: `${projectId}-items` }],
        }),

        updateDocItemAccess: builder.mutation<ApiResponse<DocItem>, { projectId: string; itemId: string; viewAccess: string[] }>({
            query: ({ projectId, itemId, viewAccess }) => ({
                url: `/projects/${projectId}/doc-items/${itemId}/access`,
                method: 'PATCH',
                body: { viewAccess },
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: `${projectId}-items` }],
        }),

        // ============================================
        // DOC ADMIN ENDPOINTS
        // ============================================

        getDocAdmins: builder.query<ApiResponse<DocAdminUser[]>, { projectId: string }>({
            query: ({ projectId }) => `/projects/${projectId}/doc-admins`,
            providesTags: (_result, _error, { projectId }) => [{ type: 'Documents', id: `${projectId}-admins` }],
        }),

        updateDocAdmins: builder.mutation<ApiResponse<void>, { projectId: string; userIds: string[] }>({
            query: ({ projectId, userIds }) => ({
                url: `/projects/${projectId}/doc-admins`,
                method: 'PATCH',
                body: { userIds },
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Documents', id: `${projectId}-admins` },
                { type: 'Projects', id: projectId },
            ],
        }),

        // ============================================
        // NOTE ENDPOINTS
        // ============================================

        getNotes: builder.query<ApiResponse<Note[]>, string>({
            query: (projectId) => `/projects/${projectId}/notes`,
            providesTags: (_result, _error, projectId) => [{ type: 'Notes' as const, id: projectId }],
        }),

        createNote: builder.mutation<ApiResponse<Note>, { projectId: string; data: CreateNoteRequest }>({
            query: ({ projectId, data }) => ({
                url: `/projects/${projectId}/notes`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Notes' as const, id: projectId }],
        }),

        updateNote: builder.mutation<ApiResponse<Note>, { projectId: string; noteId: string; data: UpdateNoteRequest }>({
            query: ({ projectId, noteId, data }) => ({
                url: `/projects/${projectId}/notes/${noteId}`,
                method: 'PATCH',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Notes' as const, id: projectId }],
        }),

        deleteNote: builder.mutation<ApiResponse<void>, { projectId: string; noteId: string }>({
            query: ({ projectId, noteId }) => ({
                url: `/projects/${projectId}/notes/${noteId}`,
                method: 'DELETE',
            }),
            invalidatesTags: (_result, _error, { projectId }) => [{ type: 'Notes' as const, id: projectId }],
        }),

        uploadNoteImage: builder.mutation<ApiResponse<{ cloudinaryId: string; url: string }>, { projectId: string; file: File }>({
            query: ({ projectId, file }) => {
                const formData = new FormData();
                formData.append('image', file);
                return {
                    url: `/projects/${projectId}/notes/upload-image`,
                    method: 'POST',
                    body: formData,
                };
            },
        }),

        // ============================================
        // PHASE PAYMENT ENDPOINTS
        // ============================================

        getProjectPaymentSummary: builder.query<ApiResponse<{
            totalExpectedPayment: number;
            totalReceivedPayment: number;
            totalPendingPayment: number;
            phasesWithPayment: number;
            phasesPaymentReceived: number;
            phaseDetails: Array<{
                phaseId: string;
                phaseName: string;
                expectedAmount: number;
                receivedAmount: number;
                pendingAmount: number;
                status: string;
                dueDate: string | undefined;
            }>;
        }>, string>({
            query: (projectId) => `/projects/${projectId}/payment-summary`,
            providesTags: (_result, _error, projectId) => [{ type: 'Projects', id: projectId }],
        }),

        markPhasePaymentReceived: builder.mutation<ApiResponse<{
            project: Project;
            revenue: any;
            bankTransaction: any;
        }>, {
            projectId: string;
            phaseId: string;
            receivedAmount: number;
            bankAccountKey: 'hdfc_gst' | 'sbi_non_gst' | 'cash';
            receivedDate?: string;
            notes?: string;
            manualExchangeRate?: number;
            markAsFullyPaid?: boolean;
            adjustPhaseValue?: boolean;
        }>({
            query: ({ projectId, phaseId, ...data }) => ({
                url: `/projects/${projectId}/phases/${phaseId}/mark-payment-received`,
                method: 'POST',
                body: data,
            }),
            invalidatesTags: (_result, _error, { projectId }) => [
                { type: 'Projects', id: projectId },
                'Projects',
                'Revenues',
                'BankTransactions',
                'FinanceDashboard',
            ],
        }),

        // ── Timer Status ────────────────────────────────────────────────────────
        getTimerStatuses: builder.query<ApiResponse<Record<string, 'running'>>, void>({
            query: () => '/projects/timer-status',
            providesTags: [{ type: 'Tasks', id: 'TIMER_STATUS' }],
        }),

        setTimerStatus: builder.mutation<ApiResponse<{ status: string }>, { status: 'running' | 'paused' }>({
            query: (body) => ({
                url: '/projects/timer-status',
                method: 'POST',
                body,
            }),
            invalidatesTags: [{ type: 'Tasks', id: 'TIMER_STATUS' }],
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
    useGetAllTasksQuery,
    useGetIndividualTasksQuery,
    useGetTaskByIdQuery,
    useCreateTaskMutation,
    useCreateIndividualTaskMutation,
    useUpdateTaskMutation,
    useUpdateIndividualTaskMutation,
    useDeleteTaskMutation,
    useDeleteIndividualTaskMutation,
    useGetSubtasksQuery,
    useCreateSubtaskMutation,

    // Time Logs
    useCreateTimeLogMutation,
    useCreateIndividualTaskTimeLogMutation,
    useGetProjectTimeLogsQuery,
    useGetTaskTimeLogsQuery,
    useGetMyTimeLogsQuery,
    useUpdateTimeLogMutation,
    useDeleteTimeLogMutation,

    // Meetings
    useCreateMeetingMutation,
    useGetMeetingsQuery,
    useGetAllMeetingsQuery,
    useGetMeetingByIdQuery,
    useUpdateMeetingMutation,
    useDeleteMeetingMutation,
    useGetIndividualMeetingsQuery,
    useCreateIndividualMeetingMutation,
    useUpdateIndividualMeetingMutation,
    useDeleteIndividualMeetingMutation,

    // Credentials
    useCreateCredentialMutation,
    useGetCredentialsQuery,
    useGetCredentialByIdQuery,
    useLazyGetCredentialByIdQuery,
    useUpdateCredentialMutation,
    useDeleteCredentialMutation,
    useShareCredentialsMutation,
    useRevokeCredentialAccessMutation,
    useGetCredentialAdminsQuery,
    useUpdateCredentialAdminsMutation,

    // Doc Folders
    useGetDocFoldersQuery,
    useCreateDocFolderMutation,
    useRenameDocFolderMutation,
    useDeleteDocFolderMutation,
    useUpdateDocFolderAccessMutation,

    // Doc Items
    useGetDocItemsQuery,
    useUploadDocItemMutation,
    useLazyGetDocItemUrlQuery,
    useRenameDocItemMutation,
    useDeleteDocItemMutation,
    useUpdateDocItemAccessMutation,

    // Doc Admins
    useGetDocAdminsQuery,
    useUpdateDocAdminsMutation,

    // Notes
    useGetNotesQuery,
    useCreateNoteMutation,
    useUpdateNoteMutation,
    useDeleteNoteMutation,
    useUploadNoteImageMutation,

    // Phase Payments
    useGetProjectPaymentSummaryQuery,
    useMarkPhasePaymentReceivedMutation,

    // Timer Status
    useGetTimerStatusesQuery,
    useSetTimerStatusMutation,
} = projectApi;
