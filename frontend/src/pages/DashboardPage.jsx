import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Bell, Clock, Settings, Search, Plus, Minus, X,
  Trash2, Briefcase, HelpCircle, Layers, CheckCircle, RefreshCw,
  Wifi, WifiOff, LayoutGrid, User, Volume2, VolumeX, AlertCircle
} from 'lucide-react';
import PriceChart from '../components/PriceChart';
import { useAuth } from '../context/AuthContext';

const TRACKED_TICKERS = ['AAPL', 'NVDA', 'TSLA'];

// Simple error boundary for the chart
class ChartBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#0A1628] rounded-xl"
          style={{ minHeight: '260px' }}>
          <span className="text-sm font-mono" style={{ color: '#4A6080' }}>Chart unavailable</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const DashboardPage = ({ 
  wsLastPriceUpdate, 
  wsConnected, 
  wsLastAlert, 
  soundEnabled, 
  onToggleSound,
  activeAlerts = [],
  notificationsList = [],
  fetchBackendData,
  handleCreateAlert: propCreateAlert,
  handleDeleteAlert: propDeleteAlert
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prices, setPrices]           = useState({});
  const [volumes, setVolumes]         = useState({});
  const [changes, setChanges]         = useState({});
  const [ohlc, setOhlc]               = useState({});
  const [historicalData, setHistoricalData] = useState({});
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [loading, setLoading]         = useState(true);
  const [lastUpdate, setLastUpdate]   = useState(null);

  // Exness states
  const [toastNotifications, setToastNotifications] = useState([]);
  const [showCreateAlertPopup, setShowCreateAlertPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('open_positions'); // open_positions, closed_history, active_alerts, triggered_alerts, ohlc_stats
  const [alertDirection, setAlertDirection] = useState('over'); // over, under
  const [alertPrice, setAlertPrice] = useState('');
  const [channels, setChannels] = useState({ in_app: true, email: false, webhook: false });

  // Derive triggeredAlerts from notificationsList passed in props
  const triggeredAlerts = notificationsList.map(n => {
    let hitPrice = n.price;
    if (hitPrice == null && typeof n.title === 'string') {
      const match = n.title.match(/\$[\d.]+/);
      if (match) hitPrice = parseFloat(match[0].replace('$', ''));
    }
    return {
      id: n.id,
      ticker: n.ticker,
      direction: 'hit',
      price: hitPrice || 0,
      hitPrice: hitPrice || 0,
      timestamp: n.timestamp instanceof Date ? n.timestamp : new Date(n.timestamp)
    };
  });
  const [tradeType, setTradeType] = useState('BUY'); // BUY or SELL
  const [tradeVolume, setTradeVolume] = useState('0.01'); // Size in Lots
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [activePositions, setActivePositions] = useState([]);
  const [closedHistory, setClosedHistory] = useState([]);
  const [isPendingOrder, setIsPendingOrder] = useState(false); // Market vs Pending

  // Persist demo balance in localStorage unique to user id (acts as fallback if server has no balance API)
  const [demoBalance, setDemoBalance] = useState(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`synexxus_balance_${user.id}`);
      if (saved) return parseFloat(saved);
    }
    return 10000.00;
  });

  // Keep demo balance updated when user object loads
  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`synexxus_balance_${user.id}`);
      if (saved) {
        setDemoBalance(parseFloat(saved));
      } else {
        setDemoBalance(10000.00);
      }
    }
  }, [user?.id]);

  // Persist demo balance to localStorage whenever it changes
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`synexxus_balance_${user.id}`, demoBalance.toString());
    }
  }, [demoBalance, user?.id]);

  // Sync alert target price to current selected ticker price whenever ticker or prices update
  useEffect(() => {
    const curPrice = prices[selectedTicker];
    if (curPrice != null) {
      setAlertPrice(curPrice.toFixed(2));
      // Prefill stop loss/take profit fields slightly off current price
      setTakeProfitPrice((curPrice + curPrice * 0.01).toFixed(2));
      setStopLossPrice((curPrice - curPrice * 0.01).toFixed(2));
    }
  }, [selectedTicker, prices[selectedTicker]]); // eslint-disable-line react-hooks/exhaustive-deps



  // Positions loading: hits backend API, falls back to localStorage if 404/error
  const fetchActivePositions = useCallback(async () => {
    try {
      const res = await axios.get('/api/trades/active');
      setActivePositions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (user?.id) {
        const saved = localStorage.getItem(`synexxus_positions_${user.id}`);
        setActivePositions(saved ? JSON.parse(saved) : []);
      }
    }
  }, [user?.id]);

  const fetchTradeHistory = useCallback(async () => {
    try {
      const res = await axios.get('/api/trades/history');
      setClosedHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (user?.id) {
        const saved = localStorage.getItem(`synexxus_history_${user.id}`);
        setClosedHistory(saved ? JSON.parse(saved) : []);
      }
    }
  }, [user?.id]);

  const fetchAccountBalance = useCallback(async () => {
    try {
      const res = await axios.get('/api/account/balance');
      if (res.data?.balance != null) {
        setDemoBalance(parseFloat(res.data.balance));
      }
    } catch (_) {
      // Keep using local state if endpoint doesn't exist
    }
  }, []);

  // Fetch initial backend state
  useEffect(() => {
    fetchBackendData();
    fetchActivePositions();
    fetchTradeHistory();
    fetchAccountBalance();
  }, [fetchBackendData, fetchActivePositions, fetchTradeHistory, fetchAccountBalance]);

  // Sync with live alert breaches from WebSocket
  useEffect(() => {
    if (wsLastAlert && wsLastAlert.ticker) {
      fetchBackendData();
    }
  }, [wsLastAlert, fetchBackendData]);

  // REST loader (optimised to fetch prices only and avoid heavy multi-ticker history requests on load)
  const fetchPrices = useCallback(async () => {
    setLoading(true);
    const results = {};
    const vols    = {};
    const chg     = {};

    await Promise.allSettled(
      TRACKED_TICKERS.map(async (ticker) => {
        try {
          const res = await axios.get(`/api/stocks/${ticker}/price`);
          results[ticker] = res.data.price;
          vols[ticker]    = res.data.volume ?? null;
          if (res.data.change != null) {
            chg[ticker] = {
              change: res.data.change,
              changePercent: res.data.change_percent,
            };
          }
        } catch (_) {}
      })
    );

    if (Object.keys(results).length > 0) {
      setPrices(p  => ({ ...p, ...results }));
      setVolumes(v => ({ ...v, ...vols }));
      setChanges(c => ({ ...c, ...chg }));
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, []);

  // Fetch daily session OHLC stats for the active selected ticker only
  const fetchOhlcStats = useCallback(async (ticker) => {
    try {
      const res = await axios.get(`/api/stocks/${ticker}/history?interval=1h`);
      const candles = Array.isArray(res.data) ? res.data : [];
      if (candles.length > 0) {
        const todayStr = new Date().toDateString();
        const todayCandles = candles.filter(c => new Date(c.timestamp).toDateString() === todayStr);

        let open, high, low;
        if (todayCandles.length > 0) {
          open = todayCandles[0].open;
          high = Math.max(...todayCandles.map(c => c.high));
          low  = Math.min(...todayCandles.map(c => c.low));
        } else {
          const last = candles[candles.length - 1];
          open = last.open;
          high = last.high;
          low  = last.low;
        }
        setOhlc(prev => ({
          ...prev,
          [ticker]: { open, high, low }
        }));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  useEffect(() => {
    if (selectedTicker) {
      fetchOhlcStats(selectedTicker);
    }
  }, [selectedTicker, fetchOhlcStats]);

  useEffect(() => {
    if (wsConnected) return;
    const id = setInterval(fetchPrices, 30_000);
    return () => clearInterval(id);
  }, [wsConnected, fetchPrices]);

  useEffect(() => {
    if (!wsLastPriceUpdate?.ticker) return;
    const { ticker, price, volume, change, change_percent } = wsLastPriceUpdate;
    setPrices(p  => ({ ...p, [ticker]: price }));
    setVolumes(v => ({ ...v, [ticker]: volume }));
    setChanges(c => ({
      ...c,
      [ticker]: { change, changePercent: change_percent },
    }));
    setOhlc(prev => {
      const cur = prev[ticker] ?? {};
      return {
        ...prev,
        [ticker]: {
          open: cur.open ?? price,
          high: Math.max(cur.high ?? price, price),
          low:  Math.min(cur.low  ?? price, price),
        },
      };
    });
    setLastUpdate(new Date());
  }, [wsLastPriceUpdate]);

  const handleDepositClick = () => {
    const inputRaw = window.prompt('Enter deposit amount (USD):', '10000');
    if (inputRaw === null) return; // cancelled
    const amount = parseFloat(inputRaw.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      window.alert('Invalid amount. Please enter a positive number.');
      return;
    }
    setDemoBalance(prev => prev + amount);
    const id = Date.now();
    setToastNotifications(prev => [...prev, { id, title: `Demo account credited with $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD successfully!`, type: 'info' }]);
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleCreateAlert = async () => {
    const priceVal = parseFloat(alertPrice);
    if (isNaN(priceVal) || priceVal <= 0) return;
    const conditionVal = alertDirection === 'over' ? 'above' : 'below';

    await propCreateAlert({
      ticker: selectedTicker,
      target_price: priceVal,
      condition: conditionVal
    });

    const id = Date.now();
    setToastNotifications(prev => [...prev, { id, title: `Alert created successfully for ${selectedTicker} at $${priceVal.toFixed(2)}`, type: 'info' }]);
    setTimeout(() => {
      setToastNotifications(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleDeleteAlert = async (id) => {
    await propDeleteAlert(id);
  };

  // Exness bid/ask spread generator (0.05% spread symmetric)
  const getQuotes = (ticker) => {
    const price = prices[ticker];
    if (price == null) return { bid: null, ask: null, spread: 0 };
    const spreadVal = price * 0.0005; // 0.05% spread
    const bid = price - spreadVal / 2;
    const ask = price + spreadVal / 2;
    return { bid, ask, spread: spreadVal };
  };

  const renderPriceDigits = (price) => {
    if (price == null || isNaN(price)) return '—';
    const str = price.toFixed(3);
    const dotIdx = str.indexOf('.');
    if (dotIdx === -1) return str;
    const whole = str.substring(0, dotIdx + 1);
    const decimals = str.substring(dotIdx + 1);
    const pips = decimals.substring(0, 2);
    const subPips = decimals.substring(2);
    return (
      <span className="price-digits">
        <span className="pips-small">{whole}</span>
        <span className="pips-large">{pips}</span>
        <span className="pips-super">{subPips}</span>
      </span>
    );
  };

  // Order Placement logic: BUY/SELL
  const handleOpenTrade = async () => {
    const volumeLots = parseFloat(tradeVolume);
    if (isNaN(volumeLots) || volumeLots <= 0) {
      alert("Please enter a valid volume size.");
      return;
    }

    const curPrice = prices[selectedTicker];
    if (curPrice == null) {
      alert("Live quote feed is unavailable.");
      return;
    }

    const { bid, ask } = getQuotes(selectedTicker);
    const entryPrice = tradeType === 'BUY' ? ask : bid;
    const sharesCount = volumeLots * 100.0; // 0.01 Lots = 1 share
    const leverage = 100.0;
    const marginRequired = (sharesCount * entryPrice) / leverage;

    if (demoBalance < marginRequired) {
      alert("Insufficient free balance to execute this trade.");
      return;
    }

    const payload = {
      ticker: selectedTicker,
      trade_type: tradeType,
      volume: volumeLots,
      stop_loss: stopLossEnabled ? parseFloat(stopLossPrice) : null,
      take_profit: takeProfitEnabled ? parseFloat(takeProfitPrice) : null
    };

    try {
      const res = await axios.post('/api/trades/open', payload);
      if (res.data?.new_balance != null) {
        setDemoBalance(parseFloat(res.data.new_balance));
      }
      await fetchActivePositions();

      const toastId = Date.now();
      setToastNotifications(prev => [...prev, { id: toastId, title: `Position Opened: ${tradeType} ${volumeLots} Lots of ${selectedTicker} at $${entryPrice.toFixed(2)}`, type: 'success' }]);
      setTimeout(() => setToastNotifications(prev => prev.filter(t => t.id !== toastId)), 4000);
    } catch (err) {
      // Backend fallback execution (LocalStorage)
      const newPos = {
        id: 'local_' + Date.now(),
        user_id: user?.id || 'demo_user',
        ticker: selectedTicker,
        trade_type: tradeType,
        volume: volumeLots,
        entry_price: entryPrice,
        stop_loss: stopLossEnabled ? parseFloat(stopLossPrice) : null,
        take_profit: takeProfitEnabled ? parseFloat(takeProfitPrice) : null,
        status: 'OPEN',
        entry_time: new Date().toISOString(),
        margin_held: marginRequired
      };

      const updated = [newPos, ...activePositions];
      setActivePositions(updated);
      if (user?.id) {
        localStorage.setItem(`synexxus_positions_${user.id}`, JSON.stringify(updated));
      }

      const nextBal = demoBalance - marginRequired;
      setDemoBalance(nextBal);

      const toastId = Date.now();
      setToastNotifications(prev => [...prev, { id: toastId, title: `Demo Position Opened: ${tradeType} ${volumeLots} Lots of ${selectedTicker} at $${entryPrice.toFixed(2)}`, type: 'success' }]);
      setTimeout(() => setToastNotifications(prev => prev.filter(t => t.id !== toastId)), 4000);
    }
  };

  // Close Position logic
  const handleClosePosition = async (pos) => {
    try {
      const res = await axios.post(`/api/trades/close/${pos.id}`);
      if (res.data?.new_balance != null) {
        setDemoBalance(parseFloat(res.data.new_balance));
      }
      await fetchActivePositions();
      await fetchTradeHistory();

      const toastId = Date.now();
      setToastNotifications(prev => [...prev, { id: toastId, title: `Closed Position: ${pos.ticker} ${pos.trade_type} returned $${res.data?.realized_pnl?.toFixed(2) || '0.00'}`, type: 'info' }]);
      setTimeout(() => setToastNotifications(prev => prev.filter(t => t.id !== toastId)), 4000);
    } catch (err) {
      // Backend fallback closure (LocalStorage)
      const curPrice = prices[pos.ticker];
      if (curPrice == null) {
        alert("Live quote feed is currently offline. Cannot close order.");
        return;
      }

      const { bid, ask } = getQuotes(pos.ticker);
      const closePrice = pos.trade_type === 'BUY' ? bid : ask;
      const sharesCount = pos.volume * 100.0;

      let realizedPnL = 0;
      if (pos.trade_type === 'BUY') {
        realizedPnL = (closePrice - pos.entry_price) * sharesCount;
      } else {
        realizedPnL = (pos.entry_price - closePrice) * sharesCount;
      }

      const nextBal = demoBalance + pos.margin_held + realizedPnL;
      setDemoBalance(nextBal);

      const updated = activePositions.filter(p => p.id !== pos.id);
      setActivePositions(updated);
      if (user?.id) {
        localStorage.setItem(`synexxus_positions_${user.id}`, JSON.stringify(updated));
      }

      const closed = {
        ...pos,
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        closed_price: closePrice,
        realized_pnl: realizedPnL
      };

      const updatedHist = [closed, ...closedHistory];
      setClosedHistory(updatedHist);
      if (user?.id) {
        localStorage.setItem(`synexxus_history_${user.id}`, JSON.stringify(updatedHist));
      }

      const toastId = Date.now();
      setToastNotifications(prev => [...prev, { id: toastId, title: `Demo Position Closed: ${pos.ticker} returned $${realizedPnL.toFixed(2)} USD`, type: 'info' }]);
      setTimeout(() => setToastNotifications(prev => prev.filter(t => t.id !== toastId)), 4000);
    }
  };

  // Derive floating financials
  const openPositionsWithPnL = activePositions.map(pos => {
    const { bid, ask } = getQuotes(pos.ticker);
    const closePrice = pos.trade_type === 'BUY' ? bid : ask;
    const sharesCount = pos.volume * 100.0;
    let pnl = 0;
    if (closePrice != null) {
      if (pos.trade_type === 'BUY') {
        pnl = (closePrice - pos.entry_price) * sharesCount;
      } else {
        pnl = (pos.entry_price - closePrice) * sharesCount;
      }
    }
    return { ...pos, close_price: closePrice, pnl };
  });

  const totalFloatingPnL = openPositionsWithPnL.reduce((acc, pos) => acc + pos.pnl, 0);
  const totalMarginHeld = activePositions.reduce((acc, pos) => acc + pos.margin_held, 0);
  const equity = demoBalance + totalFloatingPnL;
  const freeMargin = equity - totalMarginHeld;
  const marginLevel = totalMarginHeld > 0 ? (equity / totalMarginHeld) * 100 : 0;

  const currentQuotes = getQuotes(selectedTicker);
  const currentSpread = currentQuotes.spread;

  return (
    <div className="exness-layout">
      {/* 1. TOP NAVBAR */}
      <div className="exness-navbar">
        <div className="flex items-center gap-6">
          <div className="asset-tab-container">
            {TRACKED_TICKERS.map(t => {
              const price = prices[t];
              const changePct = changes[t]?.changePercent ?? 0;
              const isSelected = selectedTicker === t;
              return (
                <div 
                  key={t}
                  onClick={() => setSelectedTicker(t)}
                  className={`asset-tab ${isSelected ? 'active' : ''}`}
                >
                  <span className="font-bold">{t}/USD</span>
                  {price != null && (
                    <span className={`text-[10px] font-mono font-medium ${changePct >= 0 ? 'text-[#00E5A0]' : 'text-[#FF4D6D]'}`}>
                      ${price.toFixed(2)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!wsConnected && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded"
              style={{ background: 'rgba(255,215,0,0.08)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)' }}>
              <WifiOff className="w-3 h-3" />
              Polling Mode
            </span>
          )}
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-[9px] text-[#4A6080] font-black tracking-wide">
                DEMO · {user?.email ? user.email.split('@')[0].toUpperCase() : 'STANDARD'}
              </span>
              <span className="text-xs font-mono font-bold text-white">${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
            </div>
            <button className="btn-deposit" id="deposit-btn" onClick={handleDepositClick}>Deposit</button>
          </div>

          <button className="p-1.5 text-gray-400 hover:text-white rounded-lg" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div className="exness-workspace">

        {/* Instruments watch sidebar */}
        <div className="exness-instruments-panel">
          <div className="p-4 border-b border-[#1E2D4A] flex items-center justify-between bg-[#070F1C] flex-shrink-0">
            <span className="text-xs font-bold text-[#8BAFC8] tracking-wider uppercase">Instruments</span>
            <LayoutGrid className="w-4 h-4 text-gray-500" />
          </div>

          <div className="p-3 border-b border-[#1E2D4A] flex-shrink-0">
            <div className="flex items-center bg-[#050B14] rounded-lg px-2 py-1.5 border border-[#1E2D4A] text-xs">
              <Search className="w-4 h-4 text-[#4A6080] mr-2" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-white w-full font-mono placeholder:text-[#4A6080]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {TRACKED_TICKERS
              .filter(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(t => {
                const price = prices[t];
                const stats = changes[t];
                const changePct = stats?.changePercent ?? 0;
                const isSelected = selectedTicker === t;
                const isGain = changePct >= 0;

                return (
                  <div 
                    key={t}
                    onClick={() => setSelectedTicker(t)}
                    className={`flex items-center justify-between p-3 border-b border-[#1E2D4A]/50 cursor-pointer transition-all hover:bg-white/1 ${
                      isSelected ? 'bg-gradient-to-r from-yellow-500/5 to-transparent border-l-2 border-l-[#FFB800]' : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${isSelected ? 'text-[#FFB800]' : 'text-white'}`}>{t}/USD</span>
                      <span className="text-[9px] text-[#4A6080] font-mono mt-0.5">NASDAQ Equity</span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-xs font-mono font-bold text-white">
                        {price != null ? `$${price.toFixed(2)}` : '—'}
                      </span>
                      {price != null && (
                        <span className={`text-[9px] font-mono font-bold flex items-center gap-0.5 mt-0.5 ${isGain ? 'text-[#00E5A0]' : 'text-[#FF4D6D]'}`}>
                          {isGain ? '+' : ''}{changePct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Center Panel (Chart and bottom trade panel) */}
        <div className="exness-center-pane">
          <div className="flex-1 flex flex-col min-h-0 bg-[#050B14]">
            <ChartBoundary>
              <PriceChart
                ticker={selectedTicker}
                currentPrice={prices[selectedTicker]}
                wsLastPriceUpdate={wsLastPriceUpdate}
                onTickerChange={setSelectedTicker}
              />
            </ChartBoundary>
          </div>

          {/* Bottom active trades & logs tab bar drawer */}
          <div className="exness-bottom-log">
            <div className="flex items-center justify-between border-b border-[#1E2D4A] px-4 flex-shrink-0 bg-[#070F1C]">
              <div className="flex gap-2">
                {[
                  { id: 'open_positions', label: `Open Positions (${activePositions.length})` },
                  { id: 'closed_history', label: 'Trade History' },
                  { id: 'active_alerts', label: `Active Alerts (${activeAlerts.length})` },
                  { id: 'triggered_alerts', label: 'Triggered Log' },
                  { id: 'ohlc_stats', label: 'OHLC Stats' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-xs font-bold transition-all border-b-2 ${
                      activeTab === tab.id 
                        ? 'border-[#FFB800] text-white' 
                        : 'border-transparent text-[#4A6080] hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'open_positions' && (
                openPositionsWithPnL.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#4A6080]">
                    <Briefcase className="w-8 h-8 mb-2 opacity-40 text-gray-500" />
                    <span className="text-xs">No active positions. Execute Buy/Sell orders from the right trading panel.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-medium">
                    <thead>
                      <tr className="text-[#4A6080] border-b border-gray-800">
                        <th className="pb-2">Asset</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Lots (Volume)</th>
                        <th className="pb-2">Entry Price</th>
                        <th className="pb-2">Current Price</th>
                        <th className="pb-2">Held Margin</th>
                        <th className="pb-2">Floating PnL</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openPositionsWithPnL.map(pos => (
                        <tr key={pos.id} className="border-b border-gray-900/30 hover:bg-white/1 text-white">
                          <td className="py-2.5 font-bold font-mono">{pos.ticker}/USD</td>
                          <td className="py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              pos.trade_type === 'BUY' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {pos.trade_type}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono">{pos.volume}</td>
                          <td className="py-2.5 font-mono">${pos.entry_price.toFixed(2)}</td>
                          <td className="py-2.5 font-mono">
                            {pos.close_price != null ? `$${pos.close_price.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-2.5 font-mono">${pos.margin_held.toFixed(2)}</td>
                          <td className={`py-2.5 font-mono font-bold ${pos.pnl >= 0 ? 'text-[#00E5A0]' : 'text-[#FF4D6D]'}`}>
                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-right">
                            <button 
                              onClick={() => handleClosePosition(pos)}
                              className="text-[10px] font-bold text-red-400 hover:text-white hover:bg-red-500/20 px-2 py-1 rounded border border-red-500/30 transition-all"
                            >
                              Close Order
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTab === 'closed_history' && (
                closedHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#4A6080]">
                    <Briefcase className="w-8 h-8 mb-2 opacity-40 text-gray-500" />
                    <span className="text-xs">No closed positions in your historical ledger.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-medium">
                    <thead>
                      <tr className="text-[#4A6080] border-b border-gray-800">
                        <th className="pb-2">Close Time</th>
                        <th className="pb-2">Asset</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Lots</th>
                        <th className="pb-2">Entry</th>
                        <th className="pb-2">Exit Price</th>
                        <th className="pb-2">Realized PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedHistory.map(h => (
                        <tr key={h.id} className="border-b border-gray-900/30 hover:bg-white/1 text-gray-300">
                          <td className="py-2 font-mono text-[10px]">
                            {h.closed_at ? new Date(h.closed_at).toLocaleTimeString() : '—'}
                          </td>
                          <td className="py-2 font-bold text-white">{h.ticker}/USD</td>
                          <td className="py-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              h.trade_type === 'BUY' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {h.trade_type}
                            </span>
                          </td>
                          <td className="py-2 font-mono">{h.volume}</td>
                          <td className="py-2 font-mono">${h.entry_price.toFixed(2)}</td>
                          <td className="py-2 font-mono text-white">${h.closed_price?.toFixed(2) ?? '—'}</td>
                          <td className={`py-2 font-mono font-bold ${h.realized_pnl >= 0 ? 'text-[#00E5A0]' : 'text-[#FF4D6D]'}`}>
                            {h.realized_pnl >= 0 ? '+' : ''}${h.realized_pnl.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTab === 'active_alerts' && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <span className="text-xs text-[#8BAFC8] font-bold">Active price alert rules</span>
                    <button 
                      onClick={() => setShowCreateAlertPopup(true)}
                      className="text-[11px] text-[#FFB800] hover:text-[#FFD700] bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded font-bold transition-all"
                    >
                      + Create Alert
                    </button>
                  </div>
                  {activeAlerts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-[#4A6080] py-8">
                      <Clock className="w-8 h-8 mb-2 opacity-40 text-gray-500" />
                      <span className="text-xs">No active price alert rules set. Click "+ Create Alert" above to add new price triggers.</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs font-medium">
                      <thead>
                        <tr className="text-[#4A6080] border-b border-gray-800">
                          <th className="pb-2">Asset</th>
                          <th className="pb-2">Condition</th>
                          <th className="pb-2">Trigger Price</th>
                          <th className="pb-2">Channels</th>
                          <th className="pb-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeAlerts.map(rule => (
                          <tr key={rule.id} className="border-b border-gray-900/30 hover:bg-white/1 text-white">
                            <td className="py-2.5 font-bold font-mono">{rule.ticker}/USD</td>
                            <td className="py-2.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                rule.direction === 'over' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {rule.direction === 'over' ? 'CROSSES ABOVE' : 'CROSSES BELOW'}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono font-bold">${rule.price.toFixed(2)}</td>
                            <td className="py-2.5 text-[#8BAFC8] text-[10px]">{rule.channels.join(', ').toUpperCase()}</td>
                            <td className="py-2.5 text-right">
                              <button 
                                onClick={() => handleDeleteAlert(rule.id)}
                                className="text-gray-400 hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'triggered_alerts' && (
                triggeredAlerts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#4A6080]">
                    <Briefcase className="w-8 h-8 mb-2 opacity-40 text-gray-500" />
                    <span className="text-xs">No triggered alerts yet. Trigger history will log when market prices cross your active rules.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-medium">
                    <thead>
                      <tr className="text-[#4A6080] border-b border-gray-800">
                        <th className="pb-2">Trigger Time</th>
                        <th className="pb-2">Asset</th>
                        <th className="pb-2">Direction</th>
                        <th className="pb-2">Target</th>
                        <th className="pb-2">Value Crossed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {triggeredAlerts.map(t => (
                        <tr key={t.id} className="border-b border-gray-900/30 hover:bg-white/1 text-gray-300">
                          <td className="py-2 font-mono text-[10px]">{t.timestamp.toLocaleTimeString()}</td>
                          <td className="py-2 font-bold text-white">{t.ticker}/USD</td>
                          <td className="py-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              t.direction === 'over' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {t.direction === 'over' ? 'OVER' : 'UNDER'}
                            </span>
                          </td>
                          <td className="py-2 font-mono">${t.price.toFixed(2)}</td>
                          <td className="py-2 font-mono font-bold text-[#00E5A0]">${t.hitPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {activeTab === 'ohlc_stats' && (
                <div className="grid grid-cols-3 gap-6 py-2">
                  <div className="p-3 bg-[#050B14] rounded-lg border border-[#1E2D4A]">
                    <div className="text-[10px] text-[#4A6080] font-bold">24H OPEN</div>
                    <div className="text-sm font-bold font-mono text-white mt-1">${ohlc[selectedTicker]?.open?.toFixed(2) ?? '—'}</div>
                  </div>
                  <div className="p-3 bg-[#050B14] rounded-lg border border-[#1E2D4A]">
                    <div className="text-[10px] text-[#4A6080] font-bold text-[#00E5A0]">24H HIGH</div>
                    <div className="text-sm font-bold font-mono text-[#00E5A0] mt-1">${ohlc[selectedTicker]?.high?.toFixed(2) ?? '—'}</div>
                  </div>
                  <div className="p-3 bg-[#050B14] rounded-lg border border-[#1E2D4A]">
                    <div className="text-[10px] text-[#4A6080] font-bold text-[#FF4D6D]">24H LOW</div>
                    <div className="text-sm font-bold font-mono text-[#FF4D6D] mt-1">${ohlc[selectedTicker]?.low?.toFixed(2) ?? '—'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. RIGHT ORDER ENTRY & TRADING PANEL */}
        <div className="exness-right-panel">
          <div className="p-4 border-b border-[#1E2D4A] flex items-center justify-between flex-shrink-0 bg-[#070F1C]">
            <div className="flex flex-col">
              <span className="text-sm font-black text-white">{selectedTicker}/USD</span>
              <span className="text-[10px] text-[#4A6080] font-medium font-mono">Simulated Execution</span>
            </div>
            <span className="text-[9.5px] text-[#FFB800] bg-yellow-500/5 px-2 py-0.5 rounded border border-yellow-500/10 font-bold uppercase tracking-wider">
              1:100 Leverage
            </span>
          </div>

          <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
            {/* Bid / Ask execution triggers */}
            <div className="flex items-center gap-1.5 relative py-2">
              <div 
                onClick={() => setTradeType('SELL')}
                className={`exness-trade-button sell ${tradeType === 'SELL' ? 'active' : ''}`}
              >
                <span className="text-[9px] text-[#4A6080] font-bold tracking-wider mb-1 uppercase">SELL</span>
                {renderPriceDigits(currentQuotes.bid)}
              </div>

              <span className="spread-badge absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {currentSpread > 0 ? currentSpread.toFixed(3) : '0.000'}
              </span>

              <div 
                onClick={() => setTradeType('BUY')}
                className={`exness-trade-button buy ${tradeType === 'BUY' ? 'active' : ''}`}
              >
                <span className="text-[9px] text-[#4A6080] font-bold tracking-wider mb-1 uppercase">BUY</span>
                {renderPriceDigits(currentQuotes.ask)}
              </div>
            </div>

            {/* Buyer/Seller Sentiment Fluctuating Indicator */}
            {(() => {
              // Derive mock sentiment ratios based on price values
              const pct = prices[selectedTicker] ? Math.floor((prices[selectedTicker] % 1) * 30 + 35) : 50;
              return (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[9px] font-bold text-[#4A6080]">
                    <span>SELLERS {100 - pct}%</span>
                    <span>BUYERS {pct}%</span>
                  </div>
                  <div className="sentiment-bar-container">
                    <div className="sentiment-bar-segment sell" style={{ width: `${100 - pct}%` }} />
                    <div className="sentiment-bar-segment buy" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            <div className="h-px bg-gray-900 my-1" />

            {/* Market / Pending tab selectors */}
            <div className="flex bg-[#050B14] p-0.5 rounded-lg border border-[#1E2D4A]">
              <button 
                onClick={() => setIsPendingOrder(false)}
                className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded ${
                  !isPendingOrder ? 'bg-[#0E1E35] text-white shadow-sm' : 'text-[#4A6080] hover:text-gray-300'
                }`}
              >
                Market Order
              </button>
              <button 
                onClick={() => setIsPendingOrder(true)}
                className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded ${
                  isPendingOrder ? 'bg-[#0E1E35] text-white shadow-sm' : 'text-[#4A6080] hover:text-gray-300'
                }`}
              >
                Pending Order
              </button>
            </div>

            {/* Volume Lots Selector */}
            <div>
              <label className="text-[9px] text-[#4A6080] font-bold block mb-1 uppercase">Volume (Lots)</label>
              <div className="flex items-center bg-[#050B14] border border-[#1E2D4A] rounded-lg overflow-hidden">
                <button 
                  type="button" 
                  onClick={() => setTradeVolume(v => Math.max(0.01, parseFloat(v) - 0.01).toFixed(2))}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={tradeVolume}
                  onChange={(e) => setTradeVolume(e.target.value)}
                  className="flex-1 bg-transparent text-center text-xs font-bold font-mono outline-none text-white py-2"
                />
                <button 
                  type="button" 
                  onClick={() => setTradeVolume(v => (parseFloat(v) + 0.01).toFixed(2))}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex justify-between text-[9px] text-[#4A6080] font-mono mt-1 px-1">
                <span>0.01 Lots = 1 Share</span>
                <span>Max: {(demoBalance / ((prices[selectedTicker] || 1) / 1.0)).toFixed(2)} Lots</span>
              </div>
            </div>

            {/* Stop Loss & Take Profit Toggles */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 p-2 bg-[#050B14]/40 border border-gray-900 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer text-xs">
                  <span className="text-gray-300 font-bold text-[10px] uppercase">Take Profit (TP)</span>
                  <input 
                    type="checkbox" 
                    checked={takeProfitEnabled} 
                    onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                    className="accent-[#FFB800] w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
                {takeProfitEnabled && (
                  <div className="flex items-center bg-[#050B14] border border-[#1E2D4A] rounded-lg overflow-hidden mt-1">
                    <input
                      type="number"
                      step="0.01"
                      value={takeProfitPrice}
                      onChange={(e) => setTakeProfitPrice(e.target.value)}
                      className="w-full bg-transparent text-center text-xs font-bold font-mono outline-none text-white py-1.5"
                      placeholder="TP Trigger Price"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 p-2 bg-[#050B14]/40 border border-gray-900 rounded-lg">
                <label className="flex items-center justify-between cursor-pointer text-xs">
                  <span className="text-gray-300 font-bold text-[10px] uppercase">Stop Loss (SL)</span>
                  <input 
                    type="checkbox" 
                    checked={stopLossEnabled} 
                    onChange={(e) => setStopLossEnabled(e.target.checked)}
                    className="accent-[#FFB800] w-3.5 h-3.5 cursor-pointer"
                  />
                </label>
                {stopLossEnabled && (
                  <div className="flex items-center bg-[#050B14] border border-[#1E2D4A] rounded-lg overflow-hidden mt-1">
                    <input
                      type="number"
                      step="0.01"
                      value={stopLossPrice}
                      onChange={(e) => setStopLossPrice(e.target.value)}
                      className="w-full bg-transparent text-center text-xs font-bold font-mono outline-none text-white py-1.5"
                      placeholder="SL Exit Price"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Calculations summaries */}
            <div className="flex flex-col gap-2 p-3 bg-[#050B14] border border-[#1E2D4A] rounded-lg text-xs font-mono">
              <div className="flex justify-between items-center text-[#4A6080]">
                <span>Contract Size:</span>
                <span className="text-white">{(parseFloat(tradeVolume) * 100).toFixed(0)} Shares</span>
              </div>
              <div className="flex justify-between items-center text-[#4A6080]">
                <span>Required Margin:</span>
                <span className="text-[#FFB800] font-bold">
                  {prices[selectedTicker] != null
                    ? `$${((parseFloat(tradeVolume) * 100.0 * (tradeType === 'BUY' ? currentQuotes.ask : currentQuotes.bid)) / 100.0).toFixed(2)} USD`
                    : '—'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center text-[#4A6080] border-t border-[#1E2D4A] pt-1.5 mt-1">
                <span>Free Margin After:</span>
                <span className="text-white">
                  {prices[selectedTicker] != null
                    ? `$${(freeMargin - ((parseFloat(tradeVolume) * 100.0 * (tradeType === 'BUY' ? currentQuotes.ask : currentQuotes.bid)) / 100.0)).toFixed(2)}`
                    : '—'
                  }
                </span>
              </div>
            </div>

            {/* Place Trade Order Execution Button */}
            <button 
              onClick={handleOpenTrade}
              className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider text-black transition-all ${
                tradeType === 'BUY' 
                  ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                  : 'bg-gradient-to-r from-red-400 to-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]'
              }`}
            >
              {tradeType} {selectedTicker}/USD {isPendingOrder ? 'PENDING' : 'MARKET'}
            </button>
          </div>
        </div>
      </div>

      {/* 4. FOOTER STATUS BAR (Live margins & positions details) */}
      <div className="exness-status-bar">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            Balance: <strong className="text-white">${demoBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <span className="text-gray-700">|</span>
          <span className="flex items-center gap-1">
            Equity: <strong className="text-white">${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <span className="text-gray-700">|</span>
          <span className="flex items-center gap-1">
            Margin: <strong className="text-white">${totalMarginHeld.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <span className="text-gray-700">|</span>
          <span className="flex items-center gap-1">
            Free Margin: <strong className="text-white">${freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </span>
          <span className="text-gray-700">|</span>
          <span className="flex items-center gap-1">
            Margin Level: <strong className="text-white">{marginLevel > 0 ? `${marginLevel.toFixed(1)}%` : '0.0%'}</strong>
          </span>
          <span className="text-gray-700">|</span>
          <span>Floating PnL: 
            <strong className={`ml-1 ${totalFloatingPnL >= 0 ? 'text-[#00E5A0]' : 'text-[#FF4D6D]'}`}>
              {totalFloatingPnL >= 0 ? '+' : ''}${totalFloatingPnL.toFixed(2)}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Telemetry:
            <strong style={{ color: wsConnected ? '#00E5A0' : '#FF4D6D' }}> {wsConnected ? 'Live' : 'Offline'}</strong>
          </span>
          <span className="text-gray-700">|</span>
          <span>Last Tick: <strong className="text-white">{lastUpdate ? lastUpdate.toLocaleTimeString() : '—'}</strong></span>
        </div>
      </div>

      {/* CREATE ALERT MODAL POPUP DIALOG */}
      {showCreateAlertPopup && (
        <div className="alert-popup-overlay">
          <div className="alert-popup-content p-4 text-white">
            <div className="flex justify-between items-center pb-3 border-b border-[#1E2D4A] mb-4">
              <span className="text-xs font-bold uppercase text-[#FFB800] flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-[#FFB800]" />
                Create Price Alert
              </span>
              <button onClick={() => setShowCreateAlertPopup(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <button 
                  onClick={() => setAlertDirection('under')}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg border transition-all ${
                    alertDirection === 'under' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-transparent border-[#1E2D4A] text-[#4A6080]'
                  }`}
                >
                  Crosses Under
                </button>
                <button 
                  onClick={() => setAlertDirection('over')}
                  className={`flex-1 py-2 text-center text-xs font-bold rounded-lg border transition-all ${
                    alertDirection === 'over' ? 'bg-[#00D4FF]/10 border-[#00D4FF] text-[#00D4FF]' : 'bg-transparent border-[#1E2D4A] text-[#4A6080]'
                  }`}
                >
                  Crosses Over
                </button>
              </div>

              <div>
                <label className="text-[9px] text-[#4A6080] font-bold block mb-1 uppercase font-mono">Ticker Asset</label>
                <select
                  value={selectedTicker}
                  onChange={(e) => setSelectedTicker(e.target.value)}
                  className="w-full bg-[#050B14] border border-[#1E2D4A] rounded-lg p-2 text-xs text-white outline-none font-mono"
                >
                  {TRACKED_TICKERS.map(t => (
                    <option key={t} value={t}>{t}/USD</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] text-[#4A6080] font-bold block mb-1 uppercase font-mono">Target Trigger Price</label>
                <div className="flex items-center bg-[#050B14] border border-[#1E2D4A] rounded-lg overflow-hidden">
                  <button 
                    type="button" 
                    onClick={() => setAlertPrice(p => Math.max(0, parseFloat(p) - 0.5).toFixed(2))}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    step="0.01"
                    value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    className="flex-1 bg-transparent text-center text-xs font-bold font-mono outline-none text-white py-1.5"
                  />
                  <button 
                    type="button" 
                    onClick={() => setAlertPrice(p => (parseFloat(p) + 0.5).toFixed(2))}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <button 
                onClick={async () => {
                  await handleCreateAlert();
                  setShowCreateAlertPopup(false);
                }}
                className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider text-black transition-all ${
                  alertDirection === 'over' ? 'bg-[#00D4FF] hover:bg-[#0094B3]' : 'bg-red-400 hover:bg-red-500'
                }`}
              >
                Create Alert Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Toast Notifications Container */}
      <div className="exness-toast-container">
        {toastNotifications.map(toast => (
          <div key={toast.id} className={`exness-toast ${toast.type === 'success' ? 'success' : 'info'}`}>
            <div className="flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-wide ${
                toast.type === 'success' ? 'text-[#00E5A0]' : 'text-[#00D4FF]'
              }`}>
                {toast.type === 'success' ? 'Simulated Order Executed' : 'Telemetry Notification'}
              </div>
              <div className="text-[11px] text-white mt-1 font-medium leading-relaxed">{toast.title}</div>
            </div>
            <button 
              onClick={() => setToastNotifications(prev => prev.filter(t => t.id !== toast.id))}
              className="text-gray-400 hover:text-white transition-all flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
