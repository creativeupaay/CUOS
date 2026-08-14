import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { useGetMeQuery } from './features/auth/authApi';
import { setInitialized, setUser } from './features/auth/slices/authSlice';
import ProtectedRoute from './components/ProtectedRoute';
import { TimerProvider } from './hooks/useTaskTimer';
import { HydrationProvider } from './features/hydration/HydrationProvider';
import { HydrationOverlay } from './features/hydration/HydrationOverlay';
import {
  hasModuleAdminAccess,
  hasModuleViewAccess,
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
const ClientFormPage = lazy(() => import('./pages/crm/ClientFormPage'));
const CrmLeadFormPage = lazy(() => import('./pages/crm/CrmLeadFormPage'));
const EmployeeOnboardingFormPage = lazy(() => import('./pages/hrms/EmployeeOnboardingFormPage'));
const ClientOnboardingPage = lazy(() => import('./pages/crm/ClientOnboardingPage'));
const PartnerRegistrationPage = lazy(() => import('./pages/partners/PartnerRegistrationPage'));
const PartnerOnboardingPage = lazy(() => import('./pages/partners/PartnerOnboardingPage'));
const PersonalizedPartnerLoginPage = lazy(() => import('./pages/partners/PersonalizedPartnerLoginPage'));
const PublicJobApplyPage = lazy(() => import('./pages/hiring/PublicJobApplyPage'));
const PublicAssignmentSubmissionPage = lazy(() => import('./pages/hiring/PublicAssignmentSubmissionPage'));


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
          path="/*"
          element={
            <ProtectedRoute>
              {loadable(<DashboardLayout />)}
            </ProtectedRoute>
          }
        />

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

  // Block all routes until the auth check completes on first load.
  // This eliminates the ProtectedRoute spinner flash and the double-render
  // cycle where isInitialized flips false → true causing visible loading states.
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg-app)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <TimerProvider>
        <HydrationProvider>
          <AppRoutes />
          <HydrationOverlay />
        </HydrationProvider>
      </TimerProvider>
    </BrowserRouter>
  );
}

export default App;



