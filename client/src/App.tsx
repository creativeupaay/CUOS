import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './app/hooks';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// Auth pages
import LoginPage from './pages/LoginPage';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import ComingSoonPage from './pages/ComingSoonPage';

// Project pages
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectOverviewTab from './pages/ProjectOverviewTab';
import ProjectTasksTab from './pages/ProjectTasksTab';
import ProjectTimeLogsTab from './pages/ProjectTimeLogsTab';
import ProjectMeetingsTab from './pages/ProjectMeetingsTab';
import ProjectCredentialsTab from './pages/ProjectCredentialsTab';
import ProjectDocumentsTab from './pages/ProjectDocumentsTab';

function App() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />

        {/* Protected routes — wrapped in DashboardLayout */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<SuperAdminDashboard />} />

          {/* Project Management Module */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />}>
            <Route index element={<ProjectOverviewTab />} />
            <Route path="tasks" element={<ProjectTasksTab />} />
            <Route path="timelogs" element={<ProjectTimeLogsTab />} />
            <Route path="meetings" element={<ProjectMeetingsTab />} />
            <Route path="credentials" element={<ProjectCredentialsTab />} />
            <Route path="documents" element={<ProjectDocumentsTab />} />
          </Route>

          {/* Coming Soon pages */}
          <Route path="/finance/*" element={<ComingSoonPage />} />
          <Route path="/crm/*" element={<ComingSoonPage />} />
          <Route path="/hrms/*" element={<ComingSoonPage />} />
          <Route path="/admin/*" element={<ComingSoonPage />} />
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