import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, TrendingUp, TrendingDown, RefreshCw, Inbox, CheckCircle2, Layers, HelpCircle } from 'lucide-react';

const TYPE_STYLES = {
  alert_triggered: {
    color: '#FFD700',
    bg: 'rgba(255,215,0,0.04)',
    border: 'rgba(255,215,0,0.15)',
    icon: Bell,
    label: 'Alert Triggered',
  },
  upper_breach: {
    color: '#00E5A0',
    bg: 'rgba(0,229,160,0.06)',
    border: 'rgba(0,229,160,0.15)',
    icon: TrendingUp,
    label: 'Upper Breach',
  },
  lower_breach: {
    color: '#FF4D6D',
    bg: 'rgba(255,77,109,0.06)',
    border: 'rgba(255,77,109,0.15)',
    icon: TrendingDown,
    label: 'Lower Breach',
  },
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const NotificationsPage = ({ wsLastAlert }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/notifications');
      setNotifications(res.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Prepend live WS alerts
  useEffect(() => {
    if (wsLastAlert && wsLastAlert.ticker) {
      setNotifications(prev => [{
        id: wsLastAlert.alert_id || `live-${Date.now()}`,
        ticker: wsLastAlert.ticker,
        alert_type: wsLastAlert.alert_type || 'alert_triggered',
        price_at_trigger: wsLastAlert.price_at_trigger,
        threshold: wsLastAlert.threshold,
        triggered_at: wsLastAlert.triggered_at || new Date().toISOString(),
        isLive: true,
      }, ...prev]);
    }
  }, [wsLastAlert]);

  const paginated = notifications.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(notifications.length / PER_PAGE);

  return (
    <div className="min-h-screen grid-bg pt-16 flex" style={{ background: 'var(--deep-navy)' }}>
      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 fade-in-up">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Notification Log</h1>
            <p className="text-sm mt-1" style={{ color: '#4A6080' }}>
              Historical alert events, ordered by latest trigger
              {notifications.length > 0 && (
                <span className="ml-2 font-mono">
                  · {notifications.length} total events
                </span>
              )}
            </p>
          </div>
          <button onClick={fetchNotifications} disabled={loading}
            className="btn-ghost flex items-center gap-2 self-start" id="refresh-notifications-btn">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-4 mb-6 text-sm"
            style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', color: '#FF4D6D' }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'rgba(0,212,255,0.3)', borderTopColor: '#00D4FF' }} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 fade-in-up">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
              <Inbox className="w-8 h-8" style={{ color: '#4A6080' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">No notifications yet</p>
              <p className="text-sm mt-1" style={{ color: '#4A6080' }}>
                Alerts will appear here once price thresholds are breached
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Notifications List */}
            <div className="space-y-3 fade-in-up fade-in-up-delay-1">
              {paginated.map((notif, idx) => {
                const style = TYPE_STYLES[notif.alert_type] || TYPE_STYLES.alert_triggered;
                const Icon = style.icon;
                const price = notif.price_at_trigger ?? notif.triggered_price;
                const time = notif.triggered_at ?? notif.sent_at;
                return (
                  <div
                    key={notif.id || idx}
                    className="glass-card p-4 flex items-start gap-4"
                    id={`notification-${notif.id || idx}`}
                    style={{
                      border: `1px solid ${style.border}`,
                      background: style.bg,
                    }}
                  >
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${style.color}18`, border: `1px solid ${style.color}30` }}>
                      <Icon className="w-4 h-4" style={{ color: style.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold font-mono text-sm tracking-widest"
                          style={{ color: style.color }}>
                          {notif.ticker}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                          style={{ background: `${style.color}18`, color: style.color }}>
                          {style.label}
                        </span>
                        {notif.isLive && (
                          <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                            style={{ background: 'rgba(0,212,255,0.15)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.3)' }}>
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs" style={{ color: '#8BAFC8' }}>
                        {price != null && (
                          <span>
                            Triggered at{' '}
                            <span className="font-mono font-bold text-white">
                              ${parseFloat(price).toFixed(2)}
                            </span>
                          </span>
                        )}
                        {notif.threshold != null && (
                          <span>
                            Threshold{' '}
                            <span className="font-mono font-bold text-white">
                              ${parseFloat(notif.threshold).toFixed(2)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono" style={{ color: '#4A6080' }}>
                        {formatDate(time)}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <CheckCircle2 className="w-3 h-3" style={{ color: '#00E5A0' }} />
                        <span className="text-xs" style={{ color: '#00E5A0' }}>Delivered</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
                  id="notifications-prev-btn"
                >
                  Previous
                </button>
                <span className="text-sm font-mono px-4 py-2 rounded-lg"
                  style={{ color: '#8BAFC8', background: 'rgba(10,22,40,0.6)' }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
                  id="notifications-next-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
