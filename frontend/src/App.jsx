import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SearchProvider } from './context/SearchContext';
import { FilterProvider } from './context/FilterContext';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';

// Layouts & Pages
import MainLayout from './components/Layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Login from './components/Login';
import Signup from './components/Signup';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Team from './pages/Team';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

import GlobalLoader from './components/GlobalLoader';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <GlobalLoader open={true} message="Authenticating..." />;
  if (!user) return <Navigate to="/login" />;
  return children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <NotificationProvider>
            <SearchProvider>
              <FilterProvider>
                <Toaster 
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      borderRadius: '12px',
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                    },
                  }}
                />
                <Router>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<LoginWrapper />} />
                    <Route path="/signup" element={<SignupWrapper />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />

                    {/* Private Routes */}
                    <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                      <Route index element={<Dashboard />} />
                      <Route path="projects" element={<Projects />} />
                      <Route path="projects/:projectId" element={<ProjectDetail />} />
                      <Route path="team" element={<Team />} />
                      <Route path="profile" element={<Profile />} />
                      <Route path="settings" element={<Settings />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </Router>
              </FilterProvider>
            </SearchProvider>
          </NotificationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

// Wrappers to use useNavigate
const LoginWrapper = () => {
  const navigate = useNavigate();
  return <Login onToggleMode={() => navigate('/signup')} />;
};

const SignupWrapper = () => {
  const navigate = useNavigate();
  return <Signup onToggleMode={() => navigate('/login')} />;
};

export default App;
