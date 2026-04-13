import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { useGetMeQuery } from './features/auth/authApi';
import { setInitialized, setUser } from './features/auth/slices/authSlice';
import ProtectedRoute from './components/ProtectedRoute';
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const ClientPortalLayout = lazy(() => import('./components/layout/ClientPortalLayout'));

const LoginPage = lazy(() => import('./pages/LoginPage'));
const PartnerLoginPage = lazy(() => import('./pages/PartnerLoginPage'));
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
const HrmsDashboardPage = lazy(() => import('./pages/HrmsDashboardPage'));
const HrmsEmployeesPage = lazy(() => import('./pages/HrmsEmployeesPage'));
const HrmsEmployeeFormPage = lazy(() => import('./pages/HrmsEmployeeFormPage'));
const HrmsEmployeeDetailPage = lazy(() => import('./pages/HrmsEmployeeDetailPage'));
const HrmsAttendancePage = lazy(() => import('./pages/HrmsAttendancePage'));
const HrmsLeavesPage = lazy(() => import('./pages/HrmsLeavesPage'));
const HrmsHolidaysPage = lazy(() => import('./pages/HrmsHolidaysPage'));
const HrmsPayrollPage = lazy(() => import('./pages/HrmsPayrollPage'));
const HrmsAnnouncementsPage = lazy(() => import('./pages/HrmsAnnouncementsPage'));
const EmployeeAttendancePage = lazy(() => import('./pages/EmployeeAttendancePage'));
const EmployeeLeavesPage = lazy(() => import('./pages/EmployeeLeavesPage'));
const EmployeeHolidaysPage = lazy(() => import('./pages/EmployeeHolidaysPage'));
const EmployeePayrollPage = lazy(() => import('./pages/EmployeePayrollPage'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const MyProfileChangePasswordPage = lazy(() => import('./pages/MyProfileChangePasswordPage'));
const EmployeeOnboardingFormPage = lazy(() => import('./pages/EmployeeOnboardingFormPage'));
const ClientOnboardingPage = lazy(() => import('./pages/ClientOnboardingPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminPermissionsPage = lazy(() => import('./pages/AdminPermissionsPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/AdminAuditLogsPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const PartnersDashboardPage = lazy(() => import('./pages/PartnersDashboardPage'));
const PartnerFormPage = lazy(() => import('./pages/PartnerFormPage'));
const PartnerDetailPage = lazy(() => import('./pages/PartnerDetailPage'));
const PartnerRegistrationPage = lazy(() => import('./pages/PartnerRegistrationPage'));
const PartnerEmployeesPage = lazy(() => import('./pages/PartnerEmployeesPage'));
const PartnerOnboardingPage = lazy(() => import('./pages/PartnerOnboardingPage'));
const PersonalizedPartnerLoginPage = lazy(() => import('./pages/PersonalizedPartnerLoginPage'));
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
const FinanceDashboardPage = lazy(() => import('./pages/FinanceDashboardPage'));
const FinanceRevenuePage = lazy(() => import('./pages/FinanceRevenuePage'));
const FinanceExpensesPage = lazy(() => import('./pages/FinanceExpensesPage'));
const FinanceCashInBankPage = lazy(() => import('./pages/FinanceCashInBankPage'));
const FinanceSalariesPayrollPage = lazy(() => import('./pages/FinanceSalariesPayrollPage'));

function RouteFallback() {
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 space-y-5 animate-pulse">
      {/* Page title + action button row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-64 rounded-md bg-gray-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>
      {/* Summary cards row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-gray-100 bg-gray-100" />
        ))}
      </div>
      {/* Main content block (table / list / chart) */}
      <div className="h-64 rounded-xl border border-gray-100 bg-gray-100" />
      {/* Secondary content block */}
      <div className="h-40 rounded-xl border border-gray-100 bg-gray-50" />
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

function getAuthenticatedHome(_user: any): string {
  return '/dashboard';
}

function hasPartnerEmployeeModuleAccess(
  user: any,
  moduleKey: 'projectManagement' | 'crm' | 'teamManagement'
): boolean {
  if (!user?.isPartnerEmployee) return true;
  return user?.modulePermissions?.[moduleKey]?.enabled === true;
}

function CrmRootRedirect() {
  const user = useAppSelector((state) => state.auth.user);

  if (!hasPartnerEmployeeModuleAccess(user, 'crm')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/crm/pipeline" replace />;
}

function PartnerEmployeeModuleRoute({
  moduleKey,
  children,
}: {
  moduleKey: 'projectManagement' | 'crm' | 'teamManagement';
  children: React.ReactNode;
}) {
  const user = useAppSelector((state) => state.auth.user);

  if (!hasPartnerEmployeeModuleAccess(user, moduleKey)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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

function AnnouncementRedirect() {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = getRoleNameFromUser(user);

  if (roleName === 'partner' || user?.isPartnerEmployee) {
    return <Navigate to="/dashboard" replace />;
  }

  const isAdminOrHr = ['super-admin', 'admin', 'super_admin', 'hr', 'hr-admin', 'hr_admin', 'hr-manager', 'hrmanager', 'human-resources'].includes(roleName);

  return <Navigate to={isAdminOrHr ? '/hrms/announcements' : '/my-hrms/announcements'} replace />;
}

function AppRoutes() {
  const location = useLocation();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const user = useAppSelector((state) => state.auth.user);
  const backgroundLocation = (location.state as { backgroundLocation?: typeof location } | null)?.backgroundLocation;

  return (
    <>
      <Routes location={backgroundLocation || location}>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to={getAuthenticatedHome(user)} replace /> : loadable(<LoginPage />)}
        />
        {/* Old partner login route - redirect to dashboard if authenticated */}
        <Route
          path="/partner/login"
          element={isAuthenticated ? <Navigate to={getAuthenticatedHome(user)} replace /> : loadable(<PartnerLoginPage />)}
        />
        {/* Personalized partner login with slug */}
        <Route
          path="/partner/:slug/login"
          element={isAuthenticated ? <Navigate to={getAuthenticatedHome(user)} replace /> : loadable(<PersonalizedPartnerLoginPage />)}
        />

        {/* Employee self-onboarding form — public, no login required */}
        <Route path="/employee-form/:token" element={loadable(<EmployeeOnboardingFormPage />)} />
        {/* Client onboarding form — public, no login required */}
        <Route path="/onboarding/:token" element={loadable(<ClientOnboardingPage />)} />
        {/* Partner registration form — public, no login required (legacy) */}
        <Route path="/partner-form/:token" element={loadable(<PartnerRegistrationPage />)} />
        {/* Partner onboarding form — new flow with password setup */}
        <Route path="/partner/onboarding/:token" element={loadable(<PartnerOnboardingPage />)} />
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
          <Route path="/projects" element={<PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectsPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/projects/new" element={<PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/projects/:id/edit" element={<PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/projects/:id" element={<PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectDetailPage />)}</PartnerEmployeeModuleRoute>}>
            <Route index element={loadable(<ProjectOverviewTab />)} />
            <Route path="tasks" element={loadable(<ProjectTasksTab />)} />
            <Route path="timelogs" element={loadable(<ProjectTimeLogsTab />)} />
            <Route path="meetings" element={loadable(<ProjectMeetingsTab />)} />
            <Route path="credentials" element={loadable(<ProjectCredentialsTab />)} />
            <Route path="documents" element={loadable(<ProjectDocumentsTab />)} />
            <Route path="notes" element={loadable(<ProjectNotesTab />)} />
          </Route>

          {/* CRM Module */}
          <Route path="/crm" element={<PartnerEmployeeModuleRoute moduleKey="crm"><CrmRootRedirect /></PartnerEmployeeModuleRoute>} />
          <Route path="/crm/pipeline" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmPipelinePage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/leads" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadsPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/leads/new" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/leads/:id" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadDetailPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/leads/:id/edit" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/proposals" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmProposalsPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/proposals/new" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmProposalFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/proposals/:id/edit" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmProposalFormPage />)}</PartnerEmployeeModuleRoute>} />
          {/* CRM Clients (moved from Project Management) */}
          <Route path="/crm/clients" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientsPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/clients/new" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/clients/:id" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientDetailPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/clients/:id/edit" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute>} />

          {/* Finance Module */}
          <Route path="/finance" element={<PartnerRestrictedRoute>{loadable(<FinanceDashboardPage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/cash-in-bank" element={<PartnerRestrictedRoute>{loadable(<FinanceCashInBankPage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/revenue" element={<PartnerRestrictedRoute>{loadable(<FinanceRevenuePage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/expenses" element={<PartnerRestrictedRoute>{loadable(<FinanceExpensesPage />)}</PartnerRestrictedRoute>} />
          <Route path="/finance/salaries-payrolls" element={<PartnerRestrictedRoute>{loadable(<FinanceSalariesPayrollPage />)}</PartnerRestrictedRoute>} />

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
          <Route path="/hrms/announcements" element={<HrmsRedirect>{loadable(<HrmsAnnouncementsPage />)}</HrmsRedirect>} />

          {/* Employee HRMS Module - All employees can access their own data */}
          <Route path="/my-hrms/profile" element={loadable(<MyProfilePage />)} />
          <Route path="/my-hrms/change-password" element={loadable(<MyProfileChangePasswordPage />)} />
          <Route path="/my-hrms/attendance" element={loadable(<EmployeeAttendancePage />)} />
          <Route path="/my-hrms/leaves" element={loadable(<EmployeeLeavesPage />)} />
          <Route path="/my-hrms/holidays" element={loadable(<EmployeeHolidaysPage />)} />
          <Route path="/my-hrms/payroll" element={loadable(<EmployeePayrollPage />)} />
          <Route path="/my-hrms/announcements" element={loadable(<HrmsAnnouncementsPage />)} />
          <Route path="/announcements" element={<AnnouncementRedirect />} />

          {/* Admin Module */}
          <Route path="/admin" element={<PartnerRestrictedRoute>{loadable(<AdminDashboardPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/users" element={<PartnerRestrictedRoute>{loadable(<AdminUsersPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/permissions" element={<PartnerRestrictedRoute>{loadable(<AdminPermissionsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/settings" element={<PartnerRestrictedRoute>{loadable(<AdminSettingsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/audit-logs" element={<PartnerRestrictedRoute>{loadable(<AdminAuditLogsPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners" element={<PartnerRestrictedRoute><Navigate to="/admin/partners/dashboard" replace /></PartnerRestrictedRoute>} />
          <Route path="/admin/partners/dashboard" element={<PartnerRestrictedRoute>{loadable(<PartnersDashboardPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners/manage" element={<PartnerRestrictedRoute>{loadable(<PartnersPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners/manage/new" element={<PartnerRestrictedRoute>{loadable(<PartnerFormPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners/manage/:id" element={<PartnerRestrictedRoute>{loadable(<PartnerDetailPage />)}</PartnerRestrictedRoute>} />
          <Route path="/admin/partners/manage/:id/edit" element={<PartnerRestrictedRoute>{loadable(<PartnerFormPage />)}</PartnerRestrictedRoute>} />

          {/* Partner Admin Module (for Partners to manage their own team) */}
          <Route path="/partner-admin" element={<PartnerEmployeeModuleRoute moduleKey="teamManagement"><Navigate to="/partner-admin/team" replace /></PartnerEmployeeModuleRoute>} />
          <Route path="/partner-admin/team" element={<PartnerEmployeeModuleRoute moduleKey="teamManagement">{loadable(<PartnerEmployeesPage />)}</PartnerEmployeeModuleRoute>} />

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
          element={<Navigate to={isAuthenticated ? getAuthenticatedHome(user) : '/login'} replace />}
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

      {backgroundLocation && (
        <Routes>
          <Route path="/crm/leads/new" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/leads/:id/edit" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/clients/new" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute>} />
          <Route path="/crm/clients/:id/edit" element={<PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute>} />
        </Routes>
      )}
    </>
  );
}


function App() {
  const dispatch = useAppDispatch();
  const { data: userData, isLoading: isAuthLoading } = useGetMeQuery();

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
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
