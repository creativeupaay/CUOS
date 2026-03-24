import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { useGetMeQuery } from './features/auth/authApi';
import { setInitialized, setUser } from './features/auth/slices/authSlice';
import ProtectedRoute from './components/ProtectedRoute';
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const ClientPortalLayout = lazy(() => import('./components/layout/ClientPortalLayout'));

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const ClientPortalAccessPage = lazy(() => import('./pages/ClientPortalAccessPage'));
const ClientPortalProjectsPage = lazy(() => import('./pages/ClientPortalProjectsPage'));
const ClientPortalProjectDetailPage = lazy(() => import('./pages/ClientPortalProjectDetailPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectFormPage = lazy(() => import('./pages/ProjectFormPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const ProjectOverviewTab = lazy(() => import('./pages/ProjectOverviewTab'));
const ProjectTasksTab = lazy(() => import('./pages/ProjectTasksTab'));
const ProjectTimeLogsTab = lazy(() => import('./pages/ProjectTimeLogsTab'));
const ProjectMeetingsTab = lazy(() => import('./pages/ProjectMeetingsTab'));
const ProjectCredentialsTab = lazy(() => import('./pages/ProjectCredentialsTab'));
const ProjectDocumentsTab = lazy(() => import('./pages/ProjectDocumentsTab'));
const ProjectNotesTab = lazy(() => import('./pages/ProjectNotesTab'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const ClientFormPage = lazy(() => import('./pages/ClientFormPage'));
const CrmLeadsPage = lazy(() => import('./pages/CrmLeadsPage'));
const CrmLeadFormPage = lazy(() => import('./pages/CrmLeadFormPage'));
const CrmPipelinePage = lazy(() => import('./pages/CrmPipelinePage'));
const CrmLeadDetailPage = lazy(() => import('./pages/CrmLeadDetailPage'));
const CrmProposalsPage = lazy(() => import('./pages/CrmProposalsPage'));
const CrmProposalFormPage = lazy(() => import('./pages/CrmProposalFormPage'));
const FinanceDashboardPage = lazy(() => import('./pages/FinanceDashboardPage'));
const FinanceExpensesPage = lazy(() => import('./pages/FinanceExpensesPage'));
const FinanceInvoicesPage = lazy(() => import('./pages/FinanceInvoicesPage'));
const FinanceReportsPage = lazy(() => import('./pages/FinanceReportsPage'));
const ProjectFinancePage = lazy(() => import('./pages/ProjectFinancePage'));
const HrmsDashboardPage = lazy(() => import('./pages/HrmsDashboardPage'));
const HrmsEmployeesPage = lazy(() => import('./pages/HrmsEmployeesPage'));
const HrmsEmployeeFormPage = lazy(() => import('./pages/HrmsEmployeeFormPage'));
const HrmsEmployeeDetailPage = lazy(() => import('./pages/HrmsEmployeeDetailPage'));
const HrmsAttendancePage = lazy(() => import('./pages/HrmsAttendancePage'));
const HrmsLeavesPage = lazy(() => import('./pages/HrmsLeavesPage'));
const HrmsHolidaysPage = lazy(() => import('./pages/HrmsHolidaysPage'));
const HrmsPayrollPage = lazy(() => import('./pages/HrmsPayrollPage'));
const EmployeeAttendancePage = lazy(() => import('./pages/EmployeeAttendancePage'));
const EmployeeLeavesPage = lazy(() => import('./pages/EmployeeLeavesPage'));
const EmployeeHolidaysPage = lazy(() => import('./pages/EmployeeHolidaysPage'));
const EmployeePayrollPage = lazy(() => import('./pages/EmployeePayrollPage'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const EmployeeOnboardingFormPage = lazy(() => import('./pages/EmployeeOnboardingFormPage'));
const ClientOnboardingPage = lazy(() => import('./pages/ClientOnboardingPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminPermissionsPage = lazy(() => import('./pages/AdminPermissionsPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/AdminAuditLogsPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const PartnerFormPage = lazy(() => import('./pages/PartnerFormPage'));
const PartnerDetailPage = lazy(() => import('./pages/PartnerDetailPage'));
const PartnerRegistrationPage = lazy(() => import('./pages/PartnerRegistrationPage'));
const HiringJobsPage = lazy(() => import('./pages/HiringJobsPage'));
const HiringJobFormPage = lazy(() => import('./pages/HiringJobFormPage'));
const HiringApplicationsPage = lazy(() => import('./pages/HiringApplicationsPage'));
const HiringApplicationDetailPage = lazy(() => import('./pages/HiringApplicationDetailPage'));
const HiringReportsPage = lazy(() => import('./pages/HiringReportsPage'));
const PublicJobApplyPage = lazy(() => import('./pages/PublicJobApplyPage'));
const AssignmentReviewPage = lazy(() => import('./pages/AssignmentReviewPage'));
const PublicAssignmentSubmissionPage = lazy(() => import('./pages/PublicAssignmentSubmissionPage'));
const HiringInterviewsPage = lazy(() => import('./pages/HiringInterviewsPage'));
const HiringInterviewSchedulePage = lazy(() => import('./pages/HiringInterviewSchedulePage'));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
      Loading...
    </div>
  );
}

function loadable(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function getRoleNameFromUser(user: any): string {
  return user?.role
    ? typeof user.role === 'object'
      ? (user.role as any).name?.toLowerCase()
      : String(user.role).toLowerCase()
    : '';
}

function CrmRootRedirect() {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = getRoleNameFromUser(user);
  const isPartner = roleName === 'partner';

  return <Navigate to={isPartner ? '/crm/clients' : '/crm/pipeline'} replace />;
}

function PartnerRestrictedRoute({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = getRoleNameFromUser(user);

  if (roleName === 'partner') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** Redirects regular employees away from /hrms/* to /my-hrms/attendance */
function HrmsRedirect({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = getRoleNameFromUser(user);

  if (roleName === 'partner') {
    return <Navigate to="/dashboard" replace />;
  }

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
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : loadable(<LoginPage />)}
        />

        {/* Employee self-onboarding form — public, no login required */}
        <Route path="/employee-form/:token" element={loadable(<EmployeeOnboardingFormPage />)} />
        {/* Client onboarding form — public, no login required */}
        <Route path="/onboarding/:token" element={loadable(<ClientOnboardingPage />)} />
        {/* Partner registration form — public, no login required */}
        <Route path="/partner-form/:token" element={loadable(<PartnerRegistrationPage />)} />
        {/* Public candidate application form */}
        <Route path="/apply/:jobId" element={loadable(<PublicJobApplyPage />)} />
        <Route path="/assignment/:applicationId" element={loadable(<PublicAssignmentSubmissionPage />)} />

        {/* Dashboard - NO sidebar */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              {loadable(<SuperAdminDashboard />)}
            </ProtectedRoute>
          }
        />

        {/* Department routes - WITH sidebar */}
        <Route
          element={
            <ProtectedRoute>
              {loadable(<DashboardLayout />)}
            </ProtectedRoute>
          }
        >
          {/* Project Management Module */}
          {/* Projects */}
          <Route path="/projects" element={loadable(<ProjectsPage />)} />
          <Route path="/projects/new" element={loadable(<ProjectFormPage />)} />
          <Route path="/projects/:id/edit" element={loadable(<ProjectFormPage />)} />
          <Route path="/projects/:id" element={loadable(<ProjectDetailPage />)}>
            <Route index element={loadable(<ProjectOverviewTab />)} />
            <Route path="tasks" element={loadable(<ProjectTasksTab />)} />
            <Route path="timelogs" element={loadable(<ProjectTimeLogsTab />)} />
            <Route path="meetings" element={loadable(<ProjectMeetingsTab />)} />
            <Route path="credentials" element={loadable(<ProjectCredentialsTab />)} />
            <Route path="documents" element={loadable(<ProjectDocumentsTab />)} />
            <Route path="notes" element={loadable(<ProjectNotesTab />)} />
          </Route>

          {/* CRM Module */}
          <Route path="/crm" element={<CrmRootRedirect />} />
          <Route path="/crm/pipeline" element={loadable(<CrmPipelinePage />)} />
          <Route path="/crm/leads" element={loadable(<CrmLeadsPage />)} />
          <Route path="/crm/leads/new" element={loadable(<CrmLeadFormPage />)} />
          <Route path="/crm/leads/:id" element={loadable(<CrmLeadDetailPage />)} />
          <Route path="/crm/leads/:id/edit" element={loadable(<CrmLeadFormPage />)} />
          <Route path="/crm/proposals" element={loadable(<CrmProposalsPage />)} />
          <Route path="/crm/proposals/new" element={loadable(<CrmProposalFormPage />)} />
          <Route path="/crm/proposals/:id/edit" element={loadable(<CrmProposalFormPage />)} />
          {/* CRM Clients (moved from Project Management) */}
          <Route path="/crm/clients" element={loadable(<ClientsPage />)} />
          <Route path="/crm/clients/new" element={loadable(<ClientFormPage />)} />
          <Route path="/crm/clients/:id" element={loadable(<ClientDetailPage />)} />
          <Route path="/crm/clients/:id/edit" element={loadable(<ClientFormPage />)} />

          {/* Finance Module */}
          <Route path="/finance" element={<PartnerRestrictedRoute>{loadable(<FinanceDashboardPage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/expenses" element={<PartnerRestrictedRoute>{loadable(<FinanceExpensesPage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/invoices" element={<PartnerRestrictedRoute>{loadable(<FinanceInvoicesPage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/reports" element={<PartnerRestrictedRoute>{loadable(<FinanceReportsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/projects/:id" element={<PartnerRestrictedRoute>{loadable(<ProjectFinancePage />)}</PartnerRestrictedRoute>} />
          {/* HRMS Module — Admin/HR only */}
          <Route path="/hrms" element={<HrmsRedirect>{loadable(<HrmsDashboardPage />)}</HrmsRedirect>} />
          <Route path="/hrms/employees" element={<HrmsRedirect>{loadable(<HrmsEmployeesPage />)}</HrmsRedirect>} />
          <Route path="/hrms/employees/new" element={<HrmsRedirect>{loadable(<HrmsEmployeeFormPage />)}</HrmsRedirect>} />
          <Route path="/hrms/employees/:id" element={<HrmsRedirect>{loadable(<HrmsEmployeeDetailPage />)}</HrmsRedirect>} />
          <Route path="/hrms/employees/:id/edit" element={<HrmsRedirect>{loadable(<HrmsEmployeeFormPage />)}</HrmsRedirect>} />
          <Route path="/hrms/attendance" element={<HrmsRedirect>{loadable(<HrmsAttendancePage />)}</HrmsRedirect>} />
          <Route path="/hrms/leaves" element={<HrmsRedirect>{loadable(<HrmsLeavesPage />)}</HrmsRedirect>} />
          <Route path="/hrms/holidays" element={<HrmsRedirect>{loadable(<HrmsHolidaysPage />)}</HrmsRedirect>} />
          <Route path="/hrms/payroll" element={<HrmsRedirect>{loadable(<HrmsPayrollPage />)}</HrmsRedirect>} />

          {/* Employee HRMS Module */}
          <Route path="/my-hrms/profile" element={loadable(<MyProfilePage />)} />
          <Route path="/my-hrms/attendance" element={loadable(<EmployeeAttendancePage />)} />
          <Route path="/my-hrms/leaves" element={loadable(<EmployeeLeavesPage />)} />
          <Route path="/my-hrms/holidays" element={loadable(<EmployeeHolidaysPage />)} />
          <Route path="/my-hrms/payroll" element={loadable(<EmployeePayrollPage />)} />

          {/* Admin Module */}
          <Route path="/admin" element={<PartnerRestrictedRoute>{loadable(<AdminDashboardPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/users" element={<PartnerRestrictedRoute>{loadable(<AdminUsersPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/permissions" element={<PartnerRestrictedRoute>{loadable(<AdminPermissionsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/settings" element={<PartnerRestrictedRoute>{loadable(<AdminSettingsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/audit-logs" element={<PartnerRestrictedRoute>{loadable(<AdminAuditLogsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners" element={<PartnerRestrictedRoute>{loadable(<PartnersPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners/new" element={<PartnerRestrictedRoute>{loadable(<PartnerFormPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners/:id" element={<PartnerRestrictedRoute>{loadable(<PartnerDetailPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners/:id/edit" element={<PartnerRestrictedRoute>{loadable(<PartnerFormPage />)}</PartnerRestrictedRoute>} />

          {/* Hiring Module */}
          <Route path="/hiring" element={<PartnerRestrictedRoute><Navigate to="/hiring/jobs" replace /></PartnerRestrictedRoute>} />
          <Route path="/hiring/jobs" element={<PartnerRestrictedRoute>{loadable(<HiringJobsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/jobs/new" element={<PartnerRestrictedRoute>{loadable(<HiringJobFormPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/jobs/:id/edit" element={<PartnerRestrictedRoute>{loadable(<HiringJobFormPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/applications" element={<PartnerRestrictedRoute>{loadable(<HiringApplicationsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/applications/:id" element={<PartnerRestrictedRoute>{loadable(<HiringApplicationDetailPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/reports" element={<PartnerRestrictedRoute>{loadable(<HiringReportsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/assignments" element={<PartnerRestrictedRoute>{loadable(<AssignmentReviewPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/assignments/review" element={<PartnerRestrictedRoute><Navigate to="/hiring/assignments" replace /></PartnerRestrictedRoute>} />
          <Route path="/hiring/interviews" element={<PartnerRestrictedRoute>{loadable(<HiringInterviewsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/hiring/interviews/schedule" element={<PartnerRestrictedRoute>{loadable(<HiringInterviewSchedulePage />)}</PartnerRestrictedRoute>} />
        </Route>

        {/* Default redirect */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />

        {/* ── Client Portal (standalone — no admin auth required) ── */}
        {/* Unique access link: /portal/:clientId/:token — exchanges for a session cookie */}
        <Route path="/portal/:clientId/:token" element={loadable(<ClientPortalAccessPage />)} />
        <Route element={loadable(<ClientPortalLayout />)}>
          <Route path="/client-portal" element={<Navigate to="/client-portal/projects" replace />} />
          <Route path="/client-portal/projects" element={loadable(<ClientPortalProjectsPage />)} />
          <Route path="/client-portal/projects/:id" element={loadable(<ClientPortalProjectDetailPage />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
