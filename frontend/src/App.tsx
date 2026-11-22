import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
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
  const { isAuthenticated, hasRole } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Authenticated ERP Monolith Application */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="admissions" element={<Admissions />} />
          <Route path="students" element={<StudentsList />} />
          <Route path="students/:id" element={<StudentProfile />} />
          <Route path="academics" element={<AcademicConfig />} />
          <Route path="fees" element={<FeesManagement />} />
          <Route path="study-room" element={<StudyRoomVisualizer />} />
          <Route path="hostel" element={<HostelManagement />} />
          <Route path="facility-plans" element={<FacilityPlans />} />
          <Route path="attendance" element={<AttendanceMarking />} />
          <Route path="examinations" element={<Examinations />} />
          <Route path="institute-settings" element={<InstituteSettings />} />
          <Route path="portals" element={<Portals />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
export default App;
