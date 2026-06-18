import React, { useState } from 'react';
import { X, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import axios from 'axios';

const AlertModal = ({ alert = null, onClose, onSaved }) => {
  const isEdit = !!alert;
  const [form, setForm] = useState({
    ticker: alert?.ticker || 'AAPL',
    condition: alert?.condition || 'above',
    target_price: alert?.target_price || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tracked tickers from DashboardPage / main.go
  const TICKERS = ['AAPL', 'NVDA', 'TSLA'];

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        ticker: form.ticker,
        condition: form.condition,
        target_price: parseFloat(form.target_price),
      };
      if (isEdit) {
        await axios.put(`/api/alerts/${alert.id}`, {
          condition: form.condition,
          target_price: parseFloat(form.target_price),
          is_active: alert.is_active ?? true,
        });
      } else {
        await axios.post('/api/alerts', payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save alert. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card w-full max-w-md p-6"
        style={{ border: '1px solid rgba(0,212,255,0.2)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)' }}>
              <AlertCircle className="w-5 h-5" style={{ color: '#00D4FF' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? 'Edit Alert' : 'Create Alert'}
              </h2>
              <p className="text-xs" style={{ color: '#4A6080' }}>
                Set price threshold boundaries
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: '#4A6080' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ticker */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#8BAFC8' }}>
              Asset Symbol
            </label>
            <select
              name="ticker"
              value={form.ticker}
              onChange={handleChange}
              disabled={isEdit}
              className="input-field font-mono"
              style={{ background: 'rgba(5,11,20,0.8)' }}
            >
              {TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Condition and Target Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#8BAFC8' }}>
                Condition
              </label>
              <select
                name="condition"
                value={form.condition}
                onChange={handleChange}
                className="input-field"
                style={{ background: 'rgba(5,11,20,0.8)' }}
              >
                <option value="above">Goes Above</option>
                <option value="below">Drops Below</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: '#8BAFC8' }}>
                Target Price ($)
              </label>
              <input
                type="number"
                name="target_price"
                value={form.target_price}
                onChange={handleChange}
                required
                placeholder="e.g. 250.00"
                step="0.01"
                className="input-field font-mono text-sm"
                style={{ border: '1px solid rgba(0,212,255,0.2)' }}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg p-3 text-sm"
              style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.25)', color: '#FF4D6D' }}>
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Saving...' : isEdit ? 'Update Alert' : 'Create Alert'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertModal;
