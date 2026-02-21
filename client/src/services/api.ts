import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Base API configuration for RTK Query
 * 
 * This is the foundation for all API endpoints in the application.
 * Features can inject their endpoints using api.injectEndpoints()
 */

// Configure your base URL here
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';


const baseQuery = fetchBaseQuery({
  baseUrl: BASE_URL,
  credentials: 'include',
});


const baseQueryWithReauth = async (
  args: Parameters<typeof baseQuery>[0],
  api: Parameters<typeof baseQuery>[1],
  extraOptions: Parameters<typeof baseQuery>[2]
) => {
  let result = await baseQuery(args, api, extraOptions);

  const isLoginRequest = typeof args === 'string' ? args.includes('/auth/login') : args.url?.includes('/auth/login');

  if (result.error?.status === 401 && !isLoginRequest) {
    // Try calling refresh token endpoint (common)
    const refreshResult = await baseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions
    );

    if (refreshResult.data) {
      // Retry the original request again
      result = await baseQuery(args, api, extraOptions);
    } else {
      // Refresh failed — clear auth state
      api.dispatch({ type: 'auth/logout' });
    }
  }

  return result;
};


export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Clients', 'Projects', 'Tasks', 'TimeLogs', 'Meetings', 'Credentials', 'Leads', 'Proposals', 'Pipeline', 'Employees', 'Salary', 'Leaves', 'Payroll', 'AdminUsers', 'Roles', 'Permissions', 'AuditLogs', 'OrgSettings', 'Expenses', 'Invoices', 'Milestones', 'FinanceDashboard', 'CurrencyRates'],
  endpoints: () => ({}),
});

export default api;
