import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudyPlans from './pages/student/StudyPlans';
import PracticeTests from './pages/student/PracticeTests';
import DoubtChat from './pages/student/DoubtChat';
import StudentMaterials from './pages/student/StudentMaterials';
import TestHistory from './pages/student/TestHistory';

// Professor Pages
import ProfessorDashboard from './pages/professor/ProfessorDashboard';
import CourseMaterials from './pages/professor/CourseMaterials';
import LectureSchedule from './pages/professor/LectureSchedule';
import MaterialPrep from './pages/professor/MaterialPrep';
import Grading from './pages/professor/Grading';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Initializing EduCopilot...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={user.role === 'student' ? '/student/dashboard' : '/professor/dashboard'}
              replace
            />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/register"
        element={
          user ? (
            <Navigate
              to={user.role === 'student' ? '/student/dashboard' : '/professor/dashboard'}
              replace
            />
          ) : (
            <Register />
          )
        }
      />

      {/* Student Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route element={<Layout />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/study-plans" element={<StudyPlans />} />
          <Route path="/student/practice-tests" element={<PracticeTests />} />
          <Route path="/student/doubt-chat" element={<DoubtChat />} />
          <Route path="/student/materials-rag" element={<StudentMaterials />} />
          <Route path="/student/test-history" element={<TestHistory />} />
        </Route>
      </Route>

      {/* Professor Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={['professor']} />}>
        <Route element={<Layout />}>
          <Route path="/professor/dashboard" element={<ProfessorDashboard />} />
          <Route path="/professor/materials-rag" element={<CourseMaterials />} />
          <Route path="/professor/scheduling" element={<LectureSchedule />} />
          <Route path="/professor/material-prep" element={<MaterialPrep />} />
          <Route path="/professor/grading" element={<Grading />} />
        </Route>
      </Route>

      {/* Root redirect */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate
              to={user.role === 'student' ? '/student/dashboard' : '/professor/dashboard'}
              replace
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
