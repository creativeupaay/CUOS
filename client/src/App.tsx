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
import HrmsHolidaysPage from './pages/HrmsHolidaysPage';
import HrmsPayrollPage from './pages/HrmsPayrollPage';

// Employee HRMS pages
import EmployeeAttendancePage from './pages/EmployeeAttendancePage';
import EmployeeLeavesPage from './pages/EmployeeLeavesPage';
import EmployeeHolidaysPage from './pages/EmployeeHolidaysPage';
import EmployeePayrollPage from './pages/EmployeePayrollPage';
// Public self-onboarding form (no login required)
import EmployeeOnboardingFormPage from './pages/EmployeeOnboardingFormPage';


// Admin pages
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminPermissionsPage from './pages/AdminPermissionsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';

/** Redirects regular employees away from /hrms/* to /my-hrms/attendance */
function HrmsRedirect({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = user?.role
    ? typeof user.role === 'object' ? (user.role as any).name?.toLowerCase() : String(user.role).toLowerCase()
    : '';
  const isAdminOrHr = ['super-admin', 'admin', 'super_admin', 'hr', 'hr-admin', 'hr_admin', 'hr-manager', 'hrmanager', 'human-resources'].includes(roleName);
  if (!isAdminOrHr) {
    return <Navigate to="/my-hrms/attendance" replace />;
  }
  return <>{children}</>;
}

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

        {/* Employee self-onboarding form — public, no login required */}
        <Route path="/employee-form/:token" element={<EmployeeOnboardingFormPage />} />

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
          {/* HRMS Module — Admin/HR only */}
          <Route path="/hrms" element={<HrmsRedirect><HrmsDashboardPage /></HrmsRedirect>} />
          <Route path="/hrms/employees" element={<HrmsRedirect><HrmsEmployeesPage /></HrmsRedirect>} />
          <Route path="/hrms/employees/new" element={<HrmsRedirect><HrmsEmployeeFormPage /></HrmsRedirect>} />
          <Route path="/hrms/employees/:id" element={<HrmsRedirect><HrmsEmployeeDetailPage /></HrmsRedirect>} />
          <Route path="/hrms/employees/:id/edit" element={<HrmsRedirect><HrmsEmployeeFormPage /></HrmsRedirect>} />
          <Route path="/hrms/attendance" element={<HrmsRedirect><HrmsAttendancePage /></HrmsRedirect>} />
          <Route path="/hrms/leaves" element={<HrmsRedirect><HrmsLeavesPage /></HrmsRedirect>} />
          <Route path="/hrms/holidays" element={<HrmsRedirect><HrmsHolidaysPage /></HrmsRedirect>} />
          <Route path="/hrms/payroll" element={<HrmsRedirect><HrmsPayrollPage /></HrmsRedirect>} />

          {/* Employee HRMS Module */}
          <Route path="/my-hrms/attendance" element={<EmployeeAttendancePage />} />
          <Route path="/my-hrms/leaves" element={<EmployeeLeavesPage />} />
          <Route path="/my-hrms/holidays" element={<EmployeeHolidaysPage />} />
          <Route path="/my-hrms/payroll" element={<EmployeePayrollPage />} />

          {/* Admin Module */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/permissions" element={<AdminPermissionsPage />} />
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