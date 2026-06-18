import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWebSocket } from './hooks/useWebSocket';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AlertsPage from './pages/AlertsPage';
import NotificationsPage from './pages/NotificationsPage';

// ---- Protected Route ----
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: '#050B14' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(0,212,255,0.3)', borderTopColor: '#00D4FF' }} />
          <span className="text-xs font-mono tracking-widest" style={{ color: '#4A6080' }}>
            INITIALIZING TERMINAL...
          </span>
        </div>
      </div>
    );
  }
  return token ? children : <Navigate to="/login" replace />;
};

// ---- App Shell (authenticated layout) ----
const AppShell = () => {
  const { token } = useAuth();
  const { connected, lastPriceUpdate, lastAlert } = useWebSocket(token);
  const [unreadCount, setUnreadCount] = useState(0);

  // Only count real alert_triggered messages, not price ticks
  useEffect(() => {
    if (lastAlert) {
      setUnreadCount(c => c + 1);
    }
  }, [lastAlert]);

  const clearUnread = () => setUnreadCount(0);

  return (
    <>
      <Navbar connected={connected} alertCount={unreadCount} />
      <Routes>
        <Route path="/dashboard" element={
          <DashboardPage wsLastPriceUpdate={lastPriceUpdate} wsConnected={connected} />
        } />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/notifications" element={
          <NotificationsPage wsLastAlert={lastAlert} onView={clearUnread} />
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
};

// ---- Root App ----
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// Redirect to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? <Navigate to="/dashboard" replace /> : children;
};

export default App;
