import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { Mutex } from 'async-mutex';

/**
 * Base API configuration for RTK Query
 * 
 * This is the foundation for all API endpoints in the application.
 * Features can inject their endpoints using api.injectEndpoints()
 */

// Configure your base URL here
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Create a new mutex
const mutex = new Mutex();

const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: 'include',
});


const baseQueryWithReauth = async (
  args: Parameters<typeof baseQuery>[0],
  api: Parameters<typeof baseQuery>[1],
  extraOptions: Parameters<typeof baseQuery>[2]
) => {
  const wasAuthenticatedAtStart = Boolean((api.getState() as any)?.auth?.isAuthenticated);
  // wait until the mutex is available without locking it
  await mutex.waitForUnlock();

  let result = await baseQuery(args, api, extraOptions);

  // Exclude auth-own endpoints from re-auth loop
  const isAuthSelfRequest = typeof args === 'string'
    ? ['/auth/login', '/auth/refresh', '/auth/logout'].some(p => (args as string).includes(p))
    : ['/auth/login', '/auth/refresh', '/auth/logout'].some(p => args.url?.includes(p));

  if (result.error?.status === 401 && !isAuthSelfRequest) {
    if (!mutex.isLocked()) {
      const release = await mutex.acquire();
      try {
        // Try calling refresh token endpoint (common)
        const refreshResult = await baseQuery(
          { url: '/auth/refresh', method: 'POST' },
          api,
          extraOptions
        );

        if (refreshResult.data) {
          // Refresh succeeded — retry the original request
          result = await baseQuery(args, api, extraOptions);
        } else {
          // Only hard-logout when the refresh token itself is rejected (401/403)
          // Don't logout on transient network errors or server 5xx — session may still be valid
          const refreshErrStatus = (refreshResult.error as any)?.status;
          if ((refreshErrStatus === 401 || refreshErrStatus === 403) && wasAuthenticatedAtStart) {
            api.dispatch({ type: 'auth/logout' });
          }
        }
      } finally {
        release();
      }
    } else {
      // wait until the mutex is available without locking it
      await mutex.waitForUnlock();
      result = await baseQuery(args, api, extraOptions);
    }
  }

  return result;
};


export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Clients', 'Projects', 'Tasks', 'TimeLogs', 'Meetings', 'Credentials', 'Documents', 'Notes', 'Leads', 'Proposals', 'Pipeline', 'Employees', 'Salary', 'Leaves', 'Payroll', 'Holidays', 'Announcements', 'AdminUsers', 'Roles', 'Permissions', 'AuditLogs', 'OrgSettings', 'Jobs', 'Applications', 'Assignments', 'AssignmentSubmissions', 'Interviews', 'Partners', 'PartnerEmployees', 'Notifications', 'Revenues', 'Expenses', 'FixedExpenses', 'FinanceDashboard', 'BankTransactions'],
  endpoints: () => ({}),
  // Keep cached data for 5 minutes after the last component unmounts.
  // This means navigating back to a page within 5 min uses cached data instantly.
  keepUnusedDataFor: 300,
  // Do NOT refetch when the user alt-tabs back to the window — reduces unnecessary traffic.
  refetchOnFocus: false,
  // DO refetch when the network reconnects — ensures fresh data after connectivity loss.
  refetchOnReconnect: true,
});

export default api;
