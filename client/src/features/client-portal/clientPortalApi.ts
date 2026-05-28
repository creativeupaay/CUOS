import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Portal uses httpOnly cookie (portal_jwt) — credentials: 'include' sends it automatically
const portalBaseQuery = fetchBaseQuery({
    baseUrl: BASE_URL,
    credentials: 'include',
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortalProject {
    _id: string;
    name: string;
    description?: string;
    status: string;
    priority: string;
    startDate?: string;
    endDate?: string;
    deadline?: string;
    budget?: number;
    currency?: string;
    billingType?: string;
}

export interface PortalTask {
    _id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'paused' | 'completed';
    priority: string;
    startDate?: string;
    endDate?: string;
    deadline?: string;
    estimatedHours?: number;
    parentTaskId?: string;
}

export interface PortalMeeting {
    _id: string;
    title: string;
    description?: string;
    scheduledAt: string;
    duration?: number;
    location?: string;
    agenda?: string;
    notes?: string;
    actionItems?: Array<{ description: string; assignedTo?: string; dueDate?: string; completed: boolean }>;
}

export interface PortalCredential {
    _id: string;
    name: string;
    type: string;
    description?: string;
    credentials: Record<string, string>;
}

export interface PortalDocItem {
    _id: string;
    name: string;
    mimeType: string;
    size: number;
    uploadedBy?: { name: string; email: string } | string;
    createdAt: string;
}

export interface PortalComment {
    _id: string;
    content: string;
    authorType: 'user' | 'client';
    authorName: string;
    createdAt: string;
}

export interface PortalClientInfo {
    clientId: string;
    email: string;
    name: string;
    companyName?: string;
}


// ─── API ──────────────────────────────────────────────────────────────────────

export const clientPortalApi = createApi({
    reducerPath: 'clientPortalApi',
    baseQuery: portalBaseQuery,
    tagTypes: [
        'PortalProjects',
        'PortalTasks',
        'PortalMeetings',
        'PortalCredentials',
        'PortalDocuments',
        'PortalComments',
    ],
    endpoints: (builder) => ({
        // Auth
        exchangePortalToken: builder.mutation<
            { status: string; data: { client: PortalClientInfo } },
            { clientId: string; token: string }
        >({
            query: (body) => ({ url: '/client-portal/auth/exchange', method: 'POST', body }),
        }),

        logoutPortal: builder.mutation<{ status: string; message: string }, void>({
            query: () => ({ url: '/client-portal/auth/logout', method: 'POST' }),
        }),
        getPortalMe: builder.query<{ status: string; data: { client: PortalClientInfo } }, void>({

            query: () => '/client-portal/me',
        }),

        // Projects
        getPortalProjects: builder.query<{ status: string; data: { projects: PortalProject[] } }, void>({
            query: () => '/client-portal/projects',
            providesTags: ['PortalProjects'],
        }),


        getPortalProject: builder.query<{ status: string; data: { project: PortalProject } }, string>({
            query: (projectId) => `/client-portal/projects/${projectId}`,
            providesTags: (_r, _e, id) => [{ type: 'PortalProjects', id }],
        }),

        // Tasks
        getPortalTasks: builder.query<
            { status: string; data: { tasks: PortalTask[] } },
            { projectId: string; status?: string }
        >({
            query: ({ projectId, status }) => ({
                url: `/client-portal/projects/${projectId}/tasks`,
                params: status ? { status } : undefined,
            }),
            providesTags: (_r, _e, { projectId }) => [{ type: 'PortalTasks', id: projectId }],
        }),

        // Meetings
        getPortalMeetings: builder.query<
            { status: string; data: { meetings: PortalMeeting[] } },
            string
        >({
            query: (projectId) => `/client-portal/projects/${projectId}/meetings`,
            providesTags: (_r, _e, id) => [{ type: 'PortalMeetings', id }],
        }),

        // Credentials
        getPortalCredentials: builder.query<
            { status: string; data: { credentials: PortalCredential[] } },
            string
        >({
            query: (projectId) => `/client-portal/projects/${projectId}/credentials`,
            providesTags: (_r, _e, id) => [{ type: 'PortalCredentials', id }],
        }),

        // Documents
        getPortalDocuments: builder.query<
            { status: string; data: { folder: Record<string, unknown>; items: PortalDocItem[] } },
            string
        >({
            query: (projectId) => `/client-portal/projects/${projectId}/documents`,
            providesTags: (_r, _e, id) => [{ type: 'PortalDocuments', id }],
        }),


        getPortalDocumentUrl: builder.query<
            { status: string; data: { url: string } },
            { projectId: string; itemId: string }
        >({
            query: ({ projectId, itemId }) =>
                `/client-portal/projects/${projectId}/documents/${itemId}/url`,
        }),

        uploadPortalDocument: builder.mutation<
            { status: string; data: { item: PortalDocItem } },
            { projectId: string; formData: FormData }
        >({
            query: ({ projectId, formData }) => ({
                url: `/client-portal/projects/${projectId}/documents/upload`,
                method: 'POST',
                body: formData,
            }),
            invalidatesTags: (_r, _e, { projectId }) => [{ type: 'PortalDocuments', id: projectId }],
        }),

        // Comments
        getPortalComments: builder.query<
            { status: string; data: { comments: PortalComment[] } },
            { projectId: string; entityType: 'tasks' | 'meetings'; entityId: string }
        >({
            query: ({ projectId, entityType, entityId }) =>
                `/client-portal/projects/${projectId}/${entityType}/${entityId}/comments`,
            providesTags: (_r, _e, { entityId }) => [{ type: 'PortalComments', id: entityId }],
        }),

        addPortalComment: builder.mutation<
            { status: string; data: { comment: PortalComment } },
            { projectId: string; entityType: 'tasks' | 'meetings'; entityId: string; content: string }
        >({
            query: ({ projectId, entityType, entityId, content }) => ({
                url: `/client-portal/projects/${projectId}/${entityType}/${entityId}/comments`,
                method: 'POST',
                body: { content },
            }),
            invalidatesTags: (_r, _e, { entityId }) => [{ type: 'PortalComments', id: entityId }],
        }),
    }),
});

export const {
    useExchangePortalTokenMutation,
    useLogoutPortalMutation,
    useGetPortalMeQuery,
    useGetPortalProjectsQuery,
    useGetPortalProjectQuery,
    useGetPortalTasksQuery,
    useGetPortalMeetingsQuery,
    useGetPortalCredentialsQuery,
    useGetPortalDocumentsQuery,
    useGetPortalDocumentUrlQuery,
    useUploadPortalDocumentMutation,
    useGetPortalCommentsQuery,
    useAddPortalCommentMutation,
} = clientPortalApi;

