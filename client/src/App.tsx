import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { useGetMeQuery } from './features/auth/authApi';
import { setInitialized, setUser } from './features/auth/slices/authSlice';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// Auth pages
import LoginPage from './pages/LoginPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

// Project pages
import ProjectsPage from './pages/ProjectsPage';
import ProjectFormPage from './pages/ProjectFormPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectOverviewTab from './pages/ProjectOverviewTab';
import ProjectTasksTab from './pages/ProjectTasksTab';
import ProjectTimeLogsTab from './pages/ProjectTimeLogsTab';
import ProjectMeetingsTab from './pages/ProjectMeetingsTab';
import ProjectCredentialsTab from './pages/ProjectCredentialsTab';
import ProjectDocumentsTab from './pages/ProjectDocumentsTab';

// Client pages
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import ClientFormPage from './pages/ClientFormPage';

// CRM pages
import CrmLeadsPage from './pages/CrmLeadsPage';
import CrmLeadFormPage from './pages/CrmLeadFormPage';
import CrmPipelinePage from './pages/CrmPipelinePage';
import CrmLeadDetailPage from './pages/CrmLeadDetailPage';
import CrmProposalsPage from './pages/CrmProposalsPage';
import CrmProposalFormPage from './pages/CrmProposalFormPage';

// Finance pages
import FinanceDashboardPage from './pages/FinanceDashboardPage';
import FinanceExpensesPage from './pages/FinanceExpensesPage';
import FinanceInvoicesPage from './pages/FinanceInvoicesPage';
import FinanceReportsPage from './pages/FinanceReportsPage';
import ProjectFinancePage from './pages/ProjectFinancePage';

// HRMS pages
import HrmsDashboardPage from './pages/HrmsDashboardPage';
import HrmsEmployeesPage from './pages/HrmsEmployeesPage';
import HrmsEmployeeFormPage from './pages/HrmsEmployeeFormPage';
import HrmsEmployeeDetailPage from './pages/HrmsEmployeeDetailPage';
import HrmsAttendancePage from './pages/HrmsAttendancePage';
import HrmsLeavesPage from './pages/HrmsLeavesPage';
import HrmsPayrollPage from './pages/HrmsPayrollPage';

// Admin pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminRolesPage from './pages/AdminRolesPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';

function App() {
  const dispatch = useAppDispatch();
  const { data: userData, isLoading: isAuthLoading } = useGetMeQuery();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (!isAuthLoading) {
      if (userData?.data) {
        dispatch(setUser(userData.data));
      }
      dispatch(setInitialized(true));
    }
  }, [userData, isAuthLoading, dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />

        {/* Dashboard - NO sidebar */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Department routes - WITH sidebar */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          {/* Project Management Module */}
          {/* Projects */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<ProjectFormPage />} />
          <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />}>
            <Route index element={<ProjectOverviewTab />} />
            <Route path="tasks" element={<ProjectTasksTab />} />
            <Route path="timelogs" element={<ProjectTimeLogsTab />} />
            <Route path="meetings" element={<ProjectMeetingsTab />} />
            <Route path="credentials" element={<ProjectCredentialsTab />} />
            <Route path="documents" element={<ProjectDocumentsTab />} />
          </Route>

          {/* CRM Module */}
          <Route path="/crm" element={<Navigate to="/crm/pipeline" replace />} />
          <Route path="/crm/pipeline" element={<CrmPipelinePage />} />
          <Route path="/crm/leads" element={<CrmLeadsPage />} />
          <Route path="/crm/leads/new" element={<CrmLeadFormPage />} />
          <Route path="/crm/leads/:id" element={<CrmLeadDetailPage />} />
          <Route path="/crm/leads/:id/edit" element={<CrmLeadFormPage />} />
          <Route path="/crm/proposals" element={<CrmProposalsPage />} />
          <Route path="/crm/proposals/new" element={<CrmProposalFormPage />} />
          <Route path="/crm/proposals/:id/edit" element={<CrmProposalFormPage />} />
          {/* CRM Clients (moved from Project Management) */}
          <Route path="/crm/clients" element={<ClientsPage />} />
          <Route path="/crm/clients/new" element={<ClientFormPage />} />
          <Route path="/crm/clients/:id" element={<ClientDetailPage />} />
          <Route path="/crm/clients/:id/edit" element={<ClientFormPage />} />

          {/* Finance Module */}
          <Route path="/finance" element={<FinanceDashboardPage />} />
          <Route path="/finance/expenses" element={<FinanceExpensesPage />} />
          <Route path="/finance/invoices" element={<FinanceInvoicesPage />} />
          <Route path="/finance/reports" element={<FinanceReportsPage />} />
          <Route path="/finance/projects/:id" element={<ProjectFinancePage />} />
          {/* HRMS Module */}
          <Route path="/hrms" element={<HrmsDashboardPage />} />
          <Route path="/hrms/employees" element={<HrmsEmployeesPage />} />
          <Route path="/hrms/employees/new" element={<HrmsEmployeeFormPage />} />
          <Route path="/hrms/employees/:id" element={<HrmsEmployeeDetailPage />} />
          <Route path="/hrms/employees/:id/edit" element={<HrmsEmployeeFormPage />} />
          <Route path="/hrms/attendance" element={<HrmsAttendancePage />} />
          <Route path="/hrms/leaves" element={<HrmsLeavesPage />} />
          <Route path="/hrms/payroll" element={<HrmsPayrollPage />} />
          {/* Admin Module */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/roles" element={<AdminRolesPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        </Route>

        {/* Default redirect */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;