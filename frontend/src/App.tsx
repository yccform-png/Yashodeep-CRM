import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import { MainLayout } from './components/layout/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Admissions } from './pages/Admissions';
import { StudentsList } from './pages/StudentsList';
import { StudentProfile } from './pages/StudentProfile';
import { AcademicConfig } from './pages/AcademicConfig';
import { FeesManagement } from './pages/FeesManagement';
import { StudyRoomVisualizer } from './pages/StudyRoomVisualizer';
import { HostelManagement } from './pages/HostelManagement';
import { AttendanceMarking } from './pages/AttendanceMarking';
import { Examinations } from './pages/Examinations';
import { Portals } from './pages/Portals';
import { FacilityPlans } from './pages/FacilityPlans';
import { InstituteSettings } from './pages/InstituteSettings';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles
}) => {
  const { user, isAuthenticated, hasRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    if (user?.user_type === 'STUDENT' || user?.user_type === 'PARENT') {
      const target = user.student_id ? `/students/${user.student_id}` : '/portals';
      return <Navigate to={target} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Role-Aware Home / Fallback Redirect
const RoleBasedHomeRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.user_type === 'STUDENT' || user?.user_type === 'PARENT') {
    const target = user.student_id ? `/students/${user.student_id}` : '/portals';
    return <Navigate to={target} replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AcademicYearProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Authenticated ERP Application */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
          {/* Default entry point: Role-based landing */}
          <Route index element={<RoleBasedHomeRedirect />} />

          {/* Operational Overview: STRICTLY SUPER_ADMIN & ADMIN ONLY */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="admissions"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <Admissions />
              </ProtectedRoute>
            }
          />

          <Route
            path="students"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <StudentsList />
              </ProtectedRoute>
            }
          />

          {/* Student Dossier: Accessible by SUPER_ADMIN, ADMIN, and the respective STUDENT or PARENT */}
          <Route
            path="students/:id"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STUDENT', 'PARENT']}>
                <StudentProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="academics"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <AcademicConfig />
              </ProtectedRoute>
            }
          />

          {/* Strict Financial Lockdown: SUPER_ADMIN Only */}
          <Route
            path="fees"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <FeesManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="facility-plans"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <FacilityPlans />
              </ProtectedRoute>
            }
          />

          {/* Operational Duties: ADMIN & SUPER_ADMIN */}
          <Route
            path="study-room"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <StudyRoomVisualizer />
              </ProtectedRoute>
            }
          />

          <Route
            path="hostel"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <HostelManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="attendance"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <AttendanceMarking />
              </ProtectedRoute>
            }
          />

          <Route
            path="examinations"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <Examinations />
              </ProtectedRoute>
            }
          />

          <Route
            path="institute-settings"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN']}>
                <InstituteSettings />
              </ProtectedRoute>
            }
          />

          {/* Dedicated Portals Hub */}
          <Route
            path="portals"
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'STUDENT', 'PARENT']}>
                <Portals />
              </ProtectedRoute>
            }
          />

          {/* Fallback route: Role-based landing */}
          <Route path="*" element={<RoleBasedHomeRedirect />} />
        </Route>
      </Routes>
      </AcademicYearProvider>
    </BrowserRouter>
  );
};

export default App;
