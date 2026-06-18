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

import { Bell } from 'lucide-react';

// ---- App Shell (authenticated layout) ----
const AppShell = () => {
  const { token } = useAuth();
  const { connected, lastPriceUpdate, lastAlert } = useWebSocket(token);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);

  // Trigger toast alert and increment unread notifications counter
  useEffect(() => {
    if (lastAlert && lastAlert.ticker) {
      setUnreadCount(c => c + 1);
      
      setToast({
        id: lastAlert.alert_id || Date.now(),
        ticker: lastAlert.ticker,
        price: lastAlert.price_at_trigger,
        time: new Date().toLocaleTimeString(),
      });

      // Automatically hide the toast alert after 6 seconds
      const timer = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(timer);
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

      {/* Real-time Breach Notification Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right glass-card p-4 flex items-start gap-4 max-w-sm"
          style={{
            border: '1px solid rgba(255, 215, 0, 0.35)',
            background: 'rgba(10, 22, 40, 0.95)',
            boxShadow: '0 8px 32px 0 rgba(255, 215, 0, 0.08)',
          }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
            <Bell className="w-4 h-4" style={{ color: '#FFD700' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold font-mono text-sm text-white">{toast.ticker}</span>
              <span className="text-[9px] tracking-wider uppercase font-extrabold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255, 215, 0, 0.15)', color: '#FFD700' }}>
                ALERT FIRED
              </span>
            </div>
            <p className="text-xs" style={{ color: '#8BAFC8' }}>
              Price breached threshold at <span className="font-mono text-white font-bold">${parseFloat(toast.price).toFixed(2)}</span>
            </p>
          </div>
          <button onClick={() => setToast(null)} className="text-xs font-mono text-[#4A6080] hover:text-white transition-colors">
            ✕
          </button>
        </div>
      )}
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
