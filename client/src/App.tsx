import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { useGetMeQuery } from './features/auth/authApi';
import { setInitialized, setUser } from './features/auth/slices/authSlice';
import ProtectedRoute from './components/ProtectedRoute';
import {
  hasHrmsSelfSubmoduleAccess,
  hasModuleAdminAccess,
  hasModuleViewAccess,
  type HrmsSelfSubmodule,
  type ModuleKey,
} from './utils/modulePermissions';
import { useCheckJobManagerStatusQuery } from './features/hiring/hiringApi';
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const ClientPortalLayout = lazy(() => import('./components/layout/ClientPortalLayout'));


const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const PartnerLoginPage = lazy(() => import('./pages/partners/PartnerLoginPage'));
const SuperAdminDashboard = lazy(() => import('./pages/admin/SuperAdminDashboard'));
const ClientPortalAccessPage = lazy(() => import('./pages/client-portal/ClientPortalAccessPage'));
const ClientPortalProjectsPage = lazy(() => import('./pages/client-portal/ClientPortalProjectsPage'));
const ClientPortalProjectDetailPage = lazy(() => import('./pages/client-portal/ClientPortalProjectDetailPage'));
const ProjectsPage = lazy(() => import('./pages/projects/ProjectsPage'));
const ProjectFormPage = lazy(() => import('./pages/projects/ProjectFormPage'));
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'));
const ProjectOverviewTab = lazy(() => import('./pages/projects/ProjectOverviewTab'));
const ProjectTasksTab = lazy(() => import('./pages/projects/ProjectTasksTab'));
const ProjectTimeLogsTab = lazy(() => import('./pages/projects/ProjectTimeLogsTab'));
const ProjectMeetingsTab = lazy(() => import('./pages/projects/ProjectMeetingsTab'));
const ProjectCredentialsTab = lazy(() => import('./pages/projects/ProjectCredentialsTab'));
const ProjectDocumentsTab = lazy(() => import('./pages/projects/ProjectDocumentsTab'));
const ProjectNotesTab = lazy(() => import('./pages/projects/ProjectNotesTab'));
const ClientsPage = lazy(() => import('./pages/crm/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/crm/ClientDetailPage'));
const ClientFormPage = lazy(() => import('./pages/crm/ClientFormPage'));
const CrmLeadsPage = lazy(() => import('./pages/crm/CrmLeadsPage'));
const CrmLeadFormPage = lazy(() => import('./pages/crm/CrmLeadFormPage'));
const CrmPipelinePage = lazy(() => import('./pages/crm/CrmPipelinePage'));
const CrmLeadDetailPage = lazy(() => import('./pages/crm/CrmLeadDetailPage'));
const CrmProposalsPage = lazy(() => import('./pages/crm/CrmProposalsPage'));
const CrmProposalFormPage = lazy(() => import('./pages/crm/CrmProposalFormPage'));
const HrmsDashboardPage = lazy(() => import('./pages/hrms/HrmsDashboardPage'));
const HrmsEmployeesPage = lazy(() => import('./pages/hrms/HrmsEmployeesPage'));
const HrmsEmployeeFormPage = lazy(() => import('./pages/hrms/HrmsEmployeeFormPage'));
const HrmsEmployeeDetailPage = lazy(() => import('./pages/hrms/HrmsEmployeeDetailPage'));
const HrmsAttendancePage = lazy(() => import('./pages/hrms/HrmsAttendancePage'));
const HrmsLeavesPage = lazy(() => import('./pages/hrms/HrmsLeavesPage'));
const HrmsHolidaysPage = lazy(() => import('./pages/hrms/HrmsHolidaysPage'));
const HrmsPayrollPage = lazy(() => import('./pages/hrms/HrmsPayrollPage'));
const HrmsAnnouncementsPage = lazy(() => import('./pages/hrms/HrmsAnnouncementsPage'));
const EmployeeAttendancePage = lazy(() => import('./pages/hrms/EmployeeAttendancePage'));
const EmployeeLeavesPage = lazy(() => import('./pages/hrms/EmployeeLeavesPage'));
const EmployeeHolidaysPage = lazy(() => import('./pages/hrms/EmployeeHolidaysPage'));
const EmployeePayrollPage = lazy(() => import('./pages/hrms/EmployeePayrollPage'));
const HrmsReimbursementsPage = lazy(() => import('./pages/hrms/HrmsReimbursementsPage'));
const HrmsEmployeeReimbursementsPage = lazy(() => import('./pages/HrmsEmployeeReimbursementsPage'));
const HrmsEmployeeReimbursementHistoryPage = lazy(() => import('./pages/HrmsEmployeeReimbursementHistoryPage'));
const MyProfilePage = lazy(() => import('./pages/auth/MyProfilePage'));
const MyProfileChangePasswordPage = lazy(() => import('./pages/auth/MyProfileChangePasswordPage'));
const EmployeeOnboardingFormPage = lazy(() => import('./pages/hrms/EmployeeOnboardingFormPage'));
const ClientOnboardingPage = lazy(() => import('./pages/crm/ClientOnboardingPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminPermissionsPage = lazy(() => import('./pages/admin/AdminPermissionsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminAuditLogsPage = lazy(() => import('./pages/admin/AdminAuditLogsPage'));
const PartnersPage = lazy(() => import('./pages/partners/PartnersPage'));
const PartnersDashboardPage = lazy(() => import('./pages/partners/PartnersDashboardPage'));
const PartnerFormPage = lazy(() => import('./pages/partners/PartnerFormPage'));
const PartnerDetailPage = lazy(() => import('./pages/partners/PartnerDetailPage'));
const PartnerRegistrationPage = lazy(() => import('./pages/partners/PartnerRegistrationPage'));
const PartnerEmployeesPage = lazy(() => import('./pages/partners/PartnerEmployeesPage'));
const PartnerOnboardingPage = lazy(() => import('./pages/partners/PartnerOnboardingPage'));
const PersonalizedPartnerLoginPage = lazy(() => import('./pages/partners/PersonalizedPartnerLoginPage'));
const HiringJobsPage = lazy(() => import('./pages/hiring/HiringJobsPage'));
const HiringJobFormPage = lazy(() => import('./pages/hiring/HiringJobFormPage'));
const HiringApplicationsPage = lazy(() => import('./pages/hiring/HiringApplicationsPage'));
const HiringApplicationDetailPage = lazy(() => import('./pages/hiring/HiringApplicationDetailPage'));
const HiringReportsPage = lazy(() => import('./pages/hiring/HiringReportsPage'));
const PublicJobApplyPage = lazy(() => import('./pages/hiring/PublicJobApplyPage'));
const AssignmentReviewPage = lazy(() => import('./pages/hiring/AssignmentReviewPage'));
const PublicAssignmentSubmissionPage = lazy(() => import('./pages/hiring/PublicAssignmentSubmissionPage'));
const HiringInterviewsPage = lazy(() => import('./pages/hiring/HiringInterviewsPage'));
const HiringInterviewSchedulePage = lazy(() => import('./pages/hiring/HiringInterviewSchedulePage'));
const FinanceDashboardPage = lazy(() => import('./pages/finance/FinanceDashboardPage'));
const FinanceRevenuePage = lazy(() => import('./pages/finance/FinanceRevenuePage'));
const FinanceExpensesPage = lazy(() => import('./pages/finance/FinanceExpensesPage'));
const FinanceCashInBankPage = lazy(() => import('./pages/finance/FinanceCashInBankPage'));
const FinanceSalariesPayrollPage = lazy(() => import('./pages/finance/FinanceSalariesPayrollPage'));

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

function ModuleAccessRoute({
  moduleKey,
  requireAdmin = false,
  children,
}: {
  moduleKey: ModuleKey;
  requireAdmin?: boolean;
  children: React.ReactNode;
}) {
  const user = useAppSelector((state) => state.auth.user);
  const { data: jobManagerStatus } = useCheckJobManagerStatusQuery(undefined, {
    skip: moduleKey !== 'hiring',
  });
  const isJobManager = !!jobManagerStatus?.data?.isJobManager;
  const allowed = requireAdmin
    ? hasModuleAdminAccess(user, moduleKey)
    : hasModuleViewAccess(user, moduleKey, { isJobManager });

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function getHrmsSelfHome(user: any): string {
  const submodulePaths: Array<[HrmsSelfSubmodule, string]> = [
    ['attendance', '/my-hrms/attendance'],
    ['leaves', '/my-hrms/leaves'],
    ['holidays', '/my-hrms/holidays'],
    ['payroll', '/my-hrms/payroll'],
    ['announcements', '/my-hrms/announcements'],
    ['reimbursements', '/my-hrms/reimbursements'],
  ];
  return submodulePaths.find(([submodule]) => hasHrmsSelfSubmoduleAccess(user, submodule))?.[1] || '/my-hrms/profile';
}

/** Redirects regular employees away from /hrms/* to /my-hrms/attendance */
function HrmsRedirect({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = getRoleNameFromUser(user);

  if (roleName === 'partner') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!hasModuleAdminAccess(user, 'hrms')) {
    return <Navigate to={getHrmsSelfHome(user)} replace />;
  }
  return <>{children}</>;
}

function AnnouncementRedirect() {
  const user = useAppSelector((state) => state.auth.user);
  const roleName = getRoleNameFromUser(user);

  if (roleName === 'partner' || user?.isPartnerEmployee) {
    return <Navigate to="/dashboard" replace />;
  }

  if (hasModuleAdminAccess(user, 'hrms')) {
    return <Navigate to="/hrms/announcements" replace />;
  }

  return (
    <Navigate
      to={hasHrmsSelfSubmoduleAccess(user, 'announcements') ? '/my-hrms/announcements' : '/my-hrms/profile'}
      replace
    />
  );
}

function HrmsSelfRoute({
  submodule,
  children,
}: {
  submodule: HrmsSelfSubmodule;
  children: React.ReactNode;
}) {
  const user = useAppSelector((state) => state.auth.user);

  if (!hasHrmsSelfSubmoduleAccess(user, submodule)) {
    return <Navigate to={getHrmsSelfHome(user)} replace />;
  }

  return <>{children}</>;
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
          <Route path="/projects" element={<ModuleAccessRoute moduleKey="projectManagement"><PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectsPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/projects/new" element={<ModuleAccessRoute moduleKey="projectManagement" requireAdmin><PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/projects/:id/edit" element={<ModuleAccessRoute moduleKey="projectManagement" requireAdmin><PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/projects/:id" element={<ModuleAccessRoute moduleKey="projectManagement"><PartnerEmployeeModuleRoute moduleKey="projectManagement">{loadable(<ProjectDetailPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>}>
            <Route index element={loadable(<ProjectOverviewTab />)} />
            <Route path="tasks" element={loadable(<ProjectTasksTab />)} />
            <Route path="timelogs" element={loadable(<ProjectTimeLogsTab />)} />
            <Route path="meetings" element={loadable(<ProjectMeetingsTab />)} />
            <Route path="credentials" element={loadable(<ProjectCredentialsTab />)} />
            <Route path="documents" element={loadable(<ProjectDocumentsTab />)} />
            <Route path="notes" element={loadable(<ProjectNotesTab />)} />
          </Route>

          {/* CRM Module */}
          <Route path="/crm" element={<ModuleAccessRoute moduleKey="crm"><PartnerEmployeeModuleRoute moduleKey="crm"><CrmRootRedirect /></PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/pipeline" element={<ModuleAccessRoute moduleKey="crm"><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmPipelinePage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/leads" element={<ModuleAccessRoute moduleKey="crm"><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadsPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/leads/new" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/leads/:id" element={<ModuleAccessRoute moduleKey="crm"><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadDetailPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/leads/:id/edit" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/proposals" element={<ModuleAccessRoute moduleKey="crm"><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmProposalsPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/proposals/new" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmProposalFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/proposals/:id/edit" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmProposalFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          {/* CRM Clients (moved from Project Management) */}
          <Route path="/crm/clients" element={<ModuleAccessRoute moduleKey="crm"><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientsPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/clients/new" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/clients/:id" element={<ModuleAccessRoute moduleKey="crm"><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientDetailPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/clients/:id/edit" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />

          {/* Finance Module */}
          <Route path="/finance" element={<ModuleAccessRoute moduleKey="finance"><PartnerRestrictedRoute>{loadable(<FinanceDashboardPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/finance/cash-in-bank" element={<ModuleAccessRoute moduleKey="finance"><PartnerRestrictedRoute>{loadable(<FinanceCashInBankPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/finance/revenue" element={<ModuleAccessRoute moduleKey="finance"><PartnerRestrictedRoute>{loadable(<FinanceRevenuePage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/finance/expenses" element={<ModuleAccessRoute moduleKey="finance"><PartnerRestrictedRoute>{loadable(<FinanceExpensesPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/finance/salaries-payrolls" element={<ModuleAccessRoute moduleKey="finance"><PartnerRestrictedRoute>{loadable(<FinanceSalariesPayrollPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />

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
          <Route path="/hrms/reimbursements/employees/:id" element={<HrmsRedirect>{loadable(<HrmsEmployeeReimbursementHistoryPage />)}</HrmsRedirect>} />
          <Route path="/hrms/reimbursements/employees" element={<HrmsRedirect>{loadable(<HrmsEmployeeReimbursementsPage />)}</HrmsRedirect>} />
          <Route path="/hrms/reimbursements" element={<HrmsRedirect>{loadable(<HrmsReimbursementsPage />)}</HrmsRedirect>} />

          {/* Employee HRMS Module - All employees can access their own data */}
          <Route path="/my-hrms/profile" element={<ModuleAccessRoute moduleKey="hrms">{loadable(<MyProfilePage />)}</ModuleAccessRoute>} />
          <Route path="/my-hrms/change-password" element={<ModuleAccessRoute moduleKey="hrms">{loadable(<MyProfileChangePasswordPage />)}</ModuleAccessRoute>} />
          <Route path="/my-hrms/attendance" element={<ModuleAccessRoute moduleKey="hrms"><HrmsSelfRoute submodule="attendance">{loadable(<EmployeeAttendancePage />)}</HrmsSelfRoute></ModuleAccessRoute>} />
          <Route path="/my-hrms/leaves" element={<ModuleAccessRoute moduleKey="hrms"><HrmsSelfRoute submodule="leaves">{loadable(<EmployeeLeavesPage />)}</HrmsSelfRoute></ModuleAccessRoute>} />
          <Route path="/my-hrms/holidays" element={<ModuleAccessRoute moduleKey="hrms"><HrmsSelfRoute submodule="holidays">{loadable(<EmployeeHolidaysPage />)}</HrmsSelfRoute></ModuleAccessRoute>} />
          <Route path="/my-hrms/payroll" element={<ModuleAccessRoute moduleKey="hrms"><HrmsSelfRoute submodule="payroll">{loadable(<EmployeePayrollPage />)}</HrmsSelfRoute></ModuleAccessRoute>} />
          <Route path="/my-hrms/announcements" element={<ModuleAccessRoute moduleKey="hrms"><HrmsSelfRoute submodule="announcements">{loadable(<HrmsAnnouncementsPage />)}</HrmsSelfRoute></ModuleAccessRoute>} />
          <Route path="/my-hrms/reimbursements" element={<ModuleAccessRoute moduleKey="hrms"><HrmsSelfRoute submodule="reimbursements">{loadable(<HrmsReimbursementsPage />)}</HrmsSelfRoute></ModuleAccessRoute>} />
          <Route path="/announcements" element={<AnnouncementRedirect />} />

          {/* Admin Module */}
          <Route path="/admin" element={<ModuleAccessRoute moduleKey="overallAdmin"><PartnerRestrictedRoute>{loadable(<AdminDashboardPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/users" element={<ModuleAccessRoute moduleKey="overallAdmin" requireAdmin><PartnerRestrictedRoute>{loadable(<AdminUsersPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/permissions" element={<ModuleAccessRoute moduleKey="overallAdmin" requireAdmin><PartnerRestrictedRoute>{loadable(<AdminPermissionsPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/settings" element={<ModuleAccessRoute moduleKey="overallAdmin" requireAdmin><PartnerRestrictedRoute>{loadable(<AdminSettingsPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/audit-logs" element={<ModuleAccessRoute moduleKey="overallAdmin"><PartnerRestrictedRoute>{loadable(<AdminAuditLogsPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/partners" element={<ModuleAccessRoute moduleKey="partners"><PartnerRestrictedRoute><Navigate to="/admin/partners/dashboard" replace /></PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/partners/dashboard" element={<ModuleAccessRoute moduleKey="partners"><PartnerRestrictedRoute>{loadable(<PartnersDashboardPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/partners/manage" element={<ModuleAccessRoute moduleKey="partners" requireAdmin><PartnerRestrictedRoute>{loadable(<PartnersPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/partners/manage/new" element={<ModuleAccessRoute moduleKey="partners" requireAdmin><PartnerRestrictedRoute>{loadable(<PartnerFormPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/partners/manage/:id" element={<ModuleAccessRoute moduleKey="partners"><PartnerRestrictedRoute>{loadable(<PartnerDetailPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/admin/partners/manage/:id/edit" element={<ModuleAccessRoute moduleKey="partners" requireAdmin><PartnerRestrictedRoute>{loadable(<PartnerFormPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />

          {/* Partner Admin Module (for Partners to manage their own team) */}
          <Route path="/partner-admin" element={<PartnerEmployeeModuleRoute moduleKey="teamManagement"><Navigate to="/partner-admin/team" replace /></PartnerEmployeeModuleRoute>} />
          <Route path="/partner-admin/team" element={<PartnerEmployeeModuleRoute moduleKey="teamManagement">{loadable(<PartnerEmployeesPage />)}</PartnerEmployeeModuleRoute>} />

          {/* Hiring Module */}
          <Route path="/hiring" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute><Navigate to="/hiring/jobs" replace /></PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/jobs" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute>{loadable(<HiringJobsPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/jobs/new" element={<ModuleAccessRoute moduleKey="hiring" requireAdmin><PartnerRestrictedRoute>{loadable(<HiringJobFormPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/jobs/:id/edit" element={<ModuleAccessRoute moduleKey="hiring" requireAdmin><PartnerRestrictedRoute>{loadable(<HiringJobFormPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/applications" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute>{loadable(<HiringApplicationsPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/applications/:id" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute>{loadable(<HiringApplicationDetailPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/reports" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute>{loadable(<HiringReportsPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/assignments" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute>{loadable(<AssignmentReviewPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/assignments/review" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute><Navigate to="/hiring/assignments" replace /></PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/interviews" element={<ModuleAccessRoute moduleKey="hiring"><PartnerRestrictedRoute>{loadable(<HiringInterviewsPage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
          <Route path="/hiring/interviews/schedule" element={<ModuleAccessRoute moduleKey="hiring" requireAdmin><PartnerRestrictedRoute>{loadable(<HiringInterviewSchedulePage />)}</PartnerRestrictedRoute></ModuleAccessRoute>} />
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
          <Route path="/crm/leads/new" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/leads/:id/edit" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<CrmLeadFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/clients/new" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
          <Route path="/crm/clients/:id/edit" element={<ModuleAccessRoute moduleKey="crm" requireAdmin><PartnerEmployeeModuleRoute moduleKey="crm">{loadable(<ClientFormPage />)}</PartnerEmployeeModuleRoute></ModuleAccessRoute>} />
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

