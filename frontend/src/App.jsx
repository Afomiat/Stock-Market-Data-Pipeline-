import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useWebSocket } from './hooks/useWebSocket';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GlobalAlertsModal from './components/GlobalAlertsModal';
import GlobalNotificationsModal from './components/GlobalNotificationsModal';
import { Bell } from 'lucide-react';

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

// ---- Web Audio API notification ping ----
function playAlertPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // First tone: 880Hz (A5) - short soft ping
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    
    gain1.gain.setValueAtTime(0.0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone: 1174.66Hz (D6) - main chime, slightly delayed
    const delay = 0.08;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + delay);
    
    gain2.gain.setValueAtTime(0.0, now + delay);
    gain2.gain.linearRampToValueAtTime(0.18, now + delay + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.start(now + delay);
    osc2.stop(now + delay + 0.4);

    // Auto-close context after the sound finishes
    setTimeout(() => ctx.close(), 600);
  } catch (_) {
    // AudioContext not supported — silently skip
  }
}

// ---- App Shell (authenticated layout) ----
const AppShell = () => {
  const { token, user } = useAuth();
  const { connected, connecting, lastPriceUpdate, lastAlert } = useWebSocket(token);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Alerts & Notifications state
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [notificationsList, setNotificationsList] = useState([]);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Sound preference — persisted in localStorage
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('synexxus_sound_enabled');
    return saved === null ? true : saved === 'true'; // default ON
  });

  const toggleSound = useCallback((val) => {
    const next = typeof val === 'boolean' ? val : !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('synexxus_sound_enabled', String(next));
  }, [soundEnabled]);

  // Load real alerts and notifications from backend (or localStorage fallbacks)
  const fetchBackendData = useCallback(async () => {
    try {
      const [alertsRes, notificationsRes] = await Promise.all([
        axios.get('/api/alerts'),
        axios.get('/api/notifications')
      ]);

      const alertsList = Array.isArray(alertsRes.data.alerts) ? alertsRes.data.alerts : [];
      const mappedAlerts = alertsList
        .filter(a => a.is_active)
        .map(a => ({
          id: a.id,
          ticker: a.ticker,
          direction: a.condition === 'above' ? 'over' : 'under',
          price: parseFloat(a.target_price),
          channels: ['in_app', 'email']
        }));
      setActiveAlerts(mappedAlerts);

      const notifsList = Array.isArray(notificationsRes.data) ? notificationsRes.data : [];
      const mappedNotifications = notifsList.map(n => ({
        id: n.alert_id + '_' + n.triggered_at,
        title: `${n.ticker} crossed threshold of $${parseFloat(n.price_at_trigger).toFixed(2)}`,
        ticker: n.ticker,
        timestamp: new Date(n.triggered_at),
        read: false
      }));
      setNotificationsList(mappedNotifications);
      
      // Save fallbacks
      if (user?.id) {
        localStorage.setItem(`synexxus_alerts_${user.id}`, JSON.stringify(mappedAlerts));
        localStorage.setItem(`synexxus_notifications_${user.id}`, JSON.stringify(mappedNotifications));
      }
    } catch (err) {
      console.error("Failed to load alerts/notifications from backend:", err);
      // Fallback
      if (user?.id) {
        const savedAlerts = localStorage.getItem(`synexxus_alerts_${user.id}`);
        if (savedAlerts) setActiveAlerts(JSON.parse(savedAlerts));
        const savedNotifs = localStorage.getItem(`synexxus_notifications_${user.id}`);
        if (savedNotifs) setNotificationsList(JSON.parse(savedNotifs));
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBackendData();
  }, [fetchBackendData]);

  // Fire toast + sound on every new alert from WS
  useEffect(() => {
    if (!lastAlert?.ticker) return;

    setUnreadCount(c => c + 1);

    // Refresh database alerts list on signal trigger
    fetchBackendData();

    // Play sound if enabled
    if (soundEnabled) playAlertPing();

    // Replace any existing toast (one at a time)
    clearTimeout(toastTimer.current);
    setToast({
      id: lastAlert.alert_id || Date.now(),
      ticker: lastAlert.ticker,
      price: lastAlert.price_at_trigger,
      time: new Date().toLocaleTimeString(),
    });

    toastTimer.current = setTimeout(() => setToast(null), 10000);
    return () => clearTimeout(toastTimer.current);
  }, [lastAlert]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateAlert = async (alertData) => {
    try {
      await axios.post('/api/alerts', {
        ticker: alertData.ticker,
        target_price: alertData.target_price,
        condition: alertData.condition
      });
      await fetchBackendData();
    } catch (err) {
      // Local fallback
      const newAlert = {
        id: 'local_' + Date.now(),
        ticker: alertData.ticker,
        direction: alertData.condition === 'above' ? 'over' : 'under',
        price: alertData.target_price,
        channels: ['in_app']
      };
      const updated = [newAlert, ...activeAlerts];
      setActiveAlerts(updated);
      if (user?.id) {
        localStorage.setItem(`synexxus_alerts_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handleDeleteAlert = async (id) => {
    try {
      await axios.delete(`/api/alerts/${id}`);
      await fetchBackendData();
    } catch (err) {
      // Local fallback
      const updated = activeAlerts.filter(a => a.id !== id);
      setActiveAlerts(updated);
      if (user?.id) {
        localStorage.setItem(`synexxus_alerts_${user.id}`, JSON.stringify(updated));
      }
    }
  };

  const handleClearLog = () => {
    setNotificationsList([]);
    if (user?.id) {
      localStorage.removeItem(`synexxus_notifications_${user.id}`);
    }
  };

  const clearUnread = () => setUnreadCount(0);

  return (
    <>
      <Navbar 
        connected={connected}
        connecting={connecting}
        alertCount={unreadCount} 
        onAlertsClick={() => setShowAlertsModal(true)}
        onNotificationsClick={() => {
          setShowNotificationsModal(true);
          clearUnread();
        }}
      />
      <Routes>
        <Route path="/dashboard" element={
          <DashboardPage
            wsLastPriceUpdate={lastPriceUpdate}
            wsConnected={connected}
            wsLastAlert={lastAlert}
            soundEnabled={soundEnabled}
            onToggleSound={toggleSound}
            activeAlerts={activeAlerts}
            notificationsList={notificationsList}
            fetchBackendData={fetchBackendData}
            handleCreateAlert={handleCreateAlert}
            handleDeleteAlert={handleDeleteAlert}
          />
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Modals */}
      <GlobalAlertsModal
        isOpen={showAlertsModal}
        onClose={() => setShowAlertsModal(false)}
        activeAlerts={activeAlerts}
        onCreateAlert={handleCreateAlert}
        onDeleteAlert={handleDeleteAlert}
      />

      <GlobalNotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        notifications={notificationsList}
        soundEnabled={soundEnabled}
        onToggleSound={() => toggleSound()}
        onClearLog={handleClearLog}
      />

      {/* ── Single real-time alert toast — top-right, below navbar ── */}
      {toast && (
        <div
          key={toast.id}
          className="fixed z-50 animate-slide-in-right"
          style={{ top: '76px', right: '24px', maxWidth: '340px', width: '100%' }}
        >
          <div
            className="glass-card p-4 flex items-start gap-3"
            style={{
              border: '1px solid rgba(255, 215, 0, 0.40)',
              background: 'rgba(7, 15, 28, 0.97)',
              boxShadow: '0 0 0 1px rgba(255,215,0,0.08), 0 16px 40px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Bell icon with pulse ring */}
            <div className="relative flex-shrink-0 mt-0.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)' }}
              >
                <Bell className="w-4 h-4" style={{ color: '#FFD700' }} />
              </div>
              {/* animated pulse ring */}
              <span
                className="absolute inset-0 rounded-xl animate-ping"
                style={{ background: 'rgba(255,215,0,0.15)', animationDuration: '1.2s', animationIterationCount: 2 }}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-black font-mono text-sm text-white tracking-widest">{toast.ticker}</span>
                <span
                  className="text-[9px] tracking-widest uppercase font-extrabold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}
                >
                  ALERT FIRED
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#8BAFC8' }}>
                Price breached threshold at{' '}
                <span className="font-mono font-bold text-white">
                  ${parseFloat(toast.price).toFixed(2)}
                </span>
              </p>
              <p className="text-[10px] font-mono mt-1" style={{ color: '#4A6080' }}>
                {toast.time}
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => { clearTimeout(toastTimer.current); setToast(null); }}
              className="flex-shrink-0 text-[#4A6080] hover:text-white transition-colors text-lg leading-none"
              title="Dismiss"
            >
              ×
            </button>
          </div>

          {/* countdown bar */}
          <div
            className="h-0.5 rounded-b-full mt-0"
            style={{
              background: 'rgba(255,215,0,0.5)',
              animation: 'shrink-width 10s linear forwards',
            }}
          />
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
