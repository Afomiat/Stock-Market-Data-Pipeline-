import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle, Plus, Pencil, Trash2, TrendingUp, TrendingDown,
  RefreshCw, ShieldAlert, Search, Layers, HelpCircle
} from 'lucide-react';
import AlertModal from '../components/AlertModal';

const AlertsPage = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [searchTicker, setSearchTicker] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/alerts');
      setAlerts(res.data.alerts || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await axios.delete(`/api/alerts/${id}`);
      setAlerts(a => a.filter(alert => alert.id !== id));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete alert.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (alert) => {
    setEditingAlert(alert);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingAlert(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingAlert(null);
  };

  const filtered = alerts.filter(a =>
    searchTicker === '' || a.ticker?.toLowerCase().includes(searchTicker.toLowerCase())
  );

  return (
    <div className="min-h-screen grid-bg pt-16 flex" style={{ background: 'var(--deep-navy)' }}>
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 fade-in-up">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Alert Configuration</h1>
            <p className="text-sm mt-1" style={{ color: '#4A6080' }}>
              Manage price threshold triggers and notification targets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAlerts} disabled={loading}
              className="btn-ghost flex items-center gap-2" id="refresh-alerts-btn">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleCreate}
              className="btn-primary flex items-center gap-2" id="create-alert-btn">
              <Plus className="w-4 h-4" />
              New Alert
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-xs fade-in-up fade-in-up-delay-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: '#4A6080' }} />
          <input
            type="text"
            placeholder="Filter by ticker..."
            value={searchTicker}
            onChange={e => setSearchTicker(e.target.value)}
            className="input-field pl-9 font-mono text-sm"
            id="alert-search-input"
          />
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 fade-in-up">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}>
              <ShieldAlert className="w-8 h-8" style={{ color: '#4A6080' }} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">
                {searchTicker ? 'No alerts match your filter' : 'No alerts configured'}
              </p>
              <p className="text-sm mt-1" style={{ color: '#4A6080' }}>
                {searchTicker ? 'Try a different ticker symbol' : 'Create your first alert to monitor price boundaries'}
              </p>
            </div>
            {!searchTicker && (
              <button onClick={handleCreate} className="btn-primary flex items-center gap-2 mt-2">
                <Plus className="w-4 h-4" /> Create Alert
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 fade-in-up fade-in-up-delay-2">
            {filtered.map((alert) => (
              <div key={alert.id} className="glass-card p-5" id={`alert-card-${alert.id}`}>

                {/* Card Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                      <AlertCircle className="w-4 h-4" style={{ color: '#00D4FF' }} />
                    </div>
                    <div>
                      <div className="text-sm font-bold font-mono tracking-widest"
                        style={{ color: '#00D4FF' }}>{alert.ticker}</div>
                      <div className="text-xs" style={{ color: '#4A6080' }}>
                        ID: {alert.id?.toString().slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(alert)}
                      id={`edit-alert-${alert.id}`}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                      style={{ color: '#8BAFC8' }}
                      title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      id={`delete-alert-${alert.id}`}
                      disabled={deletingId === alert.id}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                      style={{ color: '#FF4D6D' }}
                      title="Delete">
                      {deletingId === alert.id
                        ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#FF4D6D', borderTopColor: 'transparent' }} />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>

                {/* Bounds / Target Price */}
                <div className="space-y-2.5 mb-4">
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{
                      background: alert.condition === 'above' ? 'rgba(0,229,160,0.06)' : 'rgba(255,77,109,0.06)',
                      border: alert.condition === 'above' ? '1px solid rgba(0,229,160,0.15)' : '1px solid rgba(255,77,109,0.15)'
                    }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#4A6080' }}>
                      {alert.condition === 'above' ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" style={{ color: '#00E5A0' }} />
                          Goes Above
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3.5 h-3.5" style={{ color: '#FF4D6D' }} />
                          Drops Below
                        </>
                      )}
                    </div>
                    <span className="text-sm font-bold font-mono" style={{ color: alert.condition === 'above' ? '#00E5A0' : '#FF4D6D' }}>
                      ${parseFloat(alert.target_price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-between text-xs" style={{ color: '#4A6080' }}>
                  <span>Status</span>
                  <span className="px-2 py-0.5 rounded-md font-semibold"
                    style={{
                      background: alert.is_active ? 'rgba(0,212,255,0.1)' : 'rgba(74,96,128,0.1)',
                      color: alert.is_active ? '#00D4FF' : '#4A6080',
                      border: alert.is_active ? '1px solid rgba(0,212,255,0.2)' : '1px solid rgba(74,96,128,0.2)'
                    }}>
                    {alert.is_active ? 'ACTIVE' : 'TRIGGERED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alert Modal */}
      {showModal && (
        <AlertModal
          alert={editingAlert}
          onClose={handleModalClose}
          onSaved={fetchAlerts}
        />
      )}
    </div>
  );
};

export default AlertsPage;
