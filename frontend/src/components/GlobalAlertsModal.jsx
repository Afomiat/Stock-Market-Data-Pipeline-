import React, { useState, useEffect } from 'react';
import { X, Clock, Trash2, Search, Plus, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import axios from 'axios';

const GlobalAlertsModal = ({ isOpen, onClose, activeAlerts, onCreateAlert, onDeleteAlert }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [alertDirection, setAlertDirection] = useState('over'); // over (above), under (below)
  const [alertPrice, setAlertPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tickerPrice, setTickerPrice] = useState(null);

  // Sync alert target price to selected ticker's current price
  useEffect(() => {
    if (!isOpen) return;
    axios.get(`/api/stocks/${selectedTicker}/price`)
      .then(res => {
        const price = res.data.price;
        setTickerPrice(price);
        setAlertPrice(price.toFixed(2));
      })
      .catch(() => {
        const fallbacks = { AAPL: 180.25, NVDA: 450.50, TSLA: 220.10 };
        const price = fallbacks[selectedTicker];
        setTickerPrice(price);
        setAlertPrice(price.toFixed(2));
      });
  }, [selectedTicker, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const priceVal = parseFloat(alertPrice);
    if (isNaN(priceVal) || priceVal <= 0) {
      alert("Please enter a valid target price.");
      return;
    }
    onCreateAlert({
      ticker: selectedTicker,
      target_price: priceVal,
      condition: alertDirection === 'over' ? 'above' : 'below'
    });
    setShowCreateForm(false);
  };

  const filteredAlerts = activeAlerts.filter(a => 
    a.ticker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="glass-card w-full max-w-lg mx-4 flex flex-col overflow-hidden text-white animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(10, 22, 40, 0.95)',
          border: '1px solid rgba(255, 184, 0, 0.25)',
          boxShadow: '0 0 30px rgba(255, 184, 0, 0.08), 0 20px 50px rgba(0, 0, 0, 0.8)',
          maxHeight: '85vh'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1E2D4A] bg-[#070F1C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-yellow-500/10 border border-yellow-500/20">
              <Clock className="w-4 h-4 text-[#FFB800]" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wider uppercase text-[#FFB800]">Alerts Configuration</h2>
              <p className="text-[10px] text-[#8BAFC8]">Manage active price boundary triggers</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form to Create Alert (Collapsible/Inline) */}
        {showCreateForm ? (
          <form onSubmit={handleSubmit} className="p-5 border-b border-[#1E2D4A] bg-[#050B14] flex flex-col gap-4 animate-slide-down">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Configure New Price Trigger</span>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)}
                className="text-[10px] text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Asset Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#4A6080] uppercase">Symbol</label>
                <select 
                  value={selectedTicker}
                  onChange={(e) => setSelectedTicker(e.target.value)}
                  className="input-field py-2 text-xs font-mono"
                >
                  <option value="AAPL">AAPL (Apple Inc.)</option>
                  <option value="NVDA">NVDA (NVIDIA Corp.)</option>
                  <option value="TSLA">TSLA (Tesla Inc.)</option>
                </select>
              </div>

              {/* Condition Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#4A6080] uppercase">Condition</label>
                <select 
                  value={alertDirection}
                  onChange={(e) => setAlertDirection(e.target.value)}
                  className="input-field py-2 text-xs"
                >
                  <option value="over">Crosses Above</option>
                  <option value="under">Crosses Below</option>
                </select>
              </div>
            </div>

            {/* Target Price & Current Price indicator */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-[#4A6080] uppercase">
                <span>Target Price (USD)</span>
                {tickerPrice !== null && (
                  <span className="font-mono text-[#8BAFC8] normal-case">
                    Current: ${tickerPrice.toFixed(2)}
                  </span>
                )}
              </div>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                required
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                className="input-field py-2 font-mono text-sm"
                placeholder="0.00"
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary py-2 text-xs flex items-center justify-center gap-2 mt-1"
              style={{ background: 'linear-gradient(135deg, #FFB800 0%, #CC9300 100%)', color: '#050B14' }}
            >
              <Plus className="w-4 h-4" /> Create Alert Signal
            </button>
          </form>
        ) : (
          <div className="p-4 border-b border-[#1E2D4A] bg-[#070F1C] flex items-center justify-between gap-4">
            {/* Search Box */}
            <div className="flex-1 flex items-center bg-[#050B14] rounded-lg px-2 py-1.5 border border-[#1E2D4A] text-xs">
              <Search className="w-4 h-4 text-[#4A6080] mr-2" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-white w-full font-mono placeholder:text-[#4A6080]"
              />
            </div>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #FFB800 0%, #CC9300 100%)', color: '#050B14' }}
            >
              <Plus className="w-3.5 h-3.5" /> New Alert
            </button>
          </div>
        )}

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[350px] min-h-[180px]">
          {filteredAlerts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#4A6080] py-8">
              <AlertCircle className="w-8 h-8 mb-2 opacity-40 text-gray-500" />
              <span className="text-xs">
                {searchQuery ? "No alerts match your search." : "No active price alert rules."}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {filteredAlerts.map(rule => (
                <div 
                  key={rule.id} 
                  className="flex items-center justify-between p-3 rounded-lg border border-[#1E2D4A] bg-[#070F1C]/40 hover:bg-[#070F1C]/80 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-sm text-white font-mono">{rule.ticker}/USD</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md self-start ${
                      rule.direction === 'over' 
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {rule.direction === 'over' ? 'Crosses Above' : 'Crosses Below'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono font-black text-sm text-[#FFB800]">
                      ${parseFloat(rule.price || 0).toFixed(2)}
                    </span>
                    <button 
                      onClick={() => onDeleteAlert(rule.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalAlertsModal;
