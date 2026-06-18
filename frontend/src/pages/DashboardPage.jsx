import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Activity, TrendingUp, TrendingDown, Zap, BarChart2,
  RefreshCw, ChevronDown, Wifi, WifiOff
} from 'lucide-react';
import TickerCard from '../components/TickerCard';
import PriceChart from '../components/PriceChart';
import LiveTicker from '../components/LiveTicker';

// Only tickers the backend actually subscribes to (see main.go)
const TRACKED_TICKERS = ['AAPL', 'NVDA', 'TSLA'];

// Simple error boundary for the chart so crash doesn't unmount whole page
class ChartBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(10,22,40,0.5)', minHeight: '260px' }}>
          <span className="text-sm" style={{ color: '#4A6080' }}>Chart unavailable</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="glass-card p-5 flex items-start gap-4">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <div className="min-w-0">
      <div className="text-xs font-semibold mb-1" style={{ color: '#4A6080' }}>{label}</div>
      <div className="text-xl font-bold font-mono text-white truncate">{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#4A6080' }}>{sub}</div>}
    </div>
  </div>
);

const DashboardPage = ({ wsLastPriceUpdate, wsConnected }) => {
  const [prices, setPrices]           = useState({});
  const [volumes, setVolumes]         = useState({});
  const [changes, setChanges]         = useState({});
  const [ohlc, setOhlc]               = useState({});   // { AAPL: { open, high, low } }
  const [historicalData, setHistoricalData] = useState({}); // { AAPL: [candles] }
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [loading, setLoading]         = useState(true);
  const [lastUpdate, setLastUpdate]   = useState(null);
  
  // Performance Benchmarking States
  const [latency, setLatency]         = useState(null);
  const [cacheStatus, setCacheStatus] = useState({});

  // One-shot initial REST load + fallback polling when WS is disconnected
  const fetchPrices = useCallback(async () => {
    setLoading(true);
    const results = {};
    const vols    = {};
    const chg     = {};
    const sessionOhlc = {};
    const currentHist = {};
    const currentCache = {};

    await Promise.allSettled(
      TRACKED_TICKERS.map(async (ticker) => {
        try {
          // Get current price/volume/change stats
          const res = await axios.get(`/api/stocks/${ticker}/price`);
          results[ticker] = res.data.price;
          vols[ticker]    = res.data.volume ?? null;
          currentCache[ticker] = res.data.source || 'relational_database';
          if (res.data.change != null) {
            chg[ticker] = {
              change: res.data.change,
              changePercent: res.data.change_percent,
            };
          }

          // Fetch historical 1h bars to pre-warm the open/high/low session stats
          try {
            const histRes = await axios.get(`/api/stocks/${ticker}/history?interval=1h`);
            const candles = Array.isArray(histRes.data) ? histRes.data : [];
            currentHist[ticker] = candles;
            if (candles.length > 0) {
              const todayStr = new Date().toDateString();
              const todayCandles = candles.filter(c => new Date(c.timestamp).toDateString() === todayStr);

              if (todayCandles.length > 0) {
                const open = todayCandles[0].open;
                const high = Math.max(...todayCandles.map(c => c.high));
                const low  = Math.min(...todayCandles.map(c => c.low));
                sessionOhlc[ticker] = { open, high, low };
              } else {
                // Off-hours / weekend fallback: use the last available candle
                const last = candles[candles.length - 1];
                sessionOhlc[ticker] = { open: last.open, high: last.high, low: last.low };
              }
            }
          } catch (_) {}
        } catch (_) {}
      })
    );

    if (Object.keys(results).length > 0) {
      setPrices(p  => ({ ...p, ...results }));
      setVolumes(v => ({ ...v, ...vols }));
      setChanges(c => ({ ...c, ...chg }));
      setOhlc(o    => ({ ...o, ...sessionOhlc }));
      setHistoricalData(h => ({ ...h, ...currentHist }));
      setCacheStatus(cs => ({ ...cs, ...currentCache }));
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, []);

  // Initial load on mount
  useEffect(() => {
    fetchPrices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ping endpoint periodically to benchmark network read latency
  useEffect(() => {
    const runPing = async () => {
      const start = performance.now();
      try {
        await axios.get('/api/ping');
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch (_) {
        setLatency(null);
      }
    };
    runPing();
    const intervalId = setInterval(runPing, 10_000);
    return () => clearInterval(intervalId);
  }, []);

  // Fallback polling every 30s when WebSocket is disconnected
  useEffect(() => {
    if (wsConnected) return;          // WS is alive — no need to poll
    const id = setInterval(fetchPrices, 30_000);
    return () => clearInterval(id);
  }, [wsConnected, fetchPrices]);

  // Apply real WS price_update ticks
  useEffect(() => {
    if (!wsLastPriceUpdate?.ticker) return;
    const { ticker, price, volume, change, change_percent } = wsLastPriceUpdate;
    setPrices(p  => ({ ...p, [ticker]: price }));
    setVolumes(v => ({ ...v, [ticker]: volume }));
    setChanges(c => ({
      ...c,
      [ticker]: { change, changePercent: change_percent },
    }));
    // Track intraday High/Low from live ticks
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

  // Compute top gainer from live changes state
  const topGainer = TRACKED_TICKERS
    .filter(t => changes[t])
    .sort((a, b) => (changes[b]?.changePercent ?? -Infinity) - (changes[a]?.changePercent ?? -Infinity))[0];

  const topGainerLabel = topGainer
    ? `${topGainer} ${changes[topGainer].changePercent >= 0 ? '+' : ''}${changes[topGainer].changePercent.toFixed(2)}%`
    : '—';

  const totalPortfolioValue = TRACKED_TICKERS.reduce((sum, t) => sum + (prices[t] || 0), 0);
  const activeCount = Object.keys(prices).length;

  return (
    <div className="min-h-screen grid-bg" style={{ background: 'var(--deep-navy)' }}>
      {/* Ticker Tape */}
      <div className="pt-16">
        <LiveTicker prices={prices} changes={changes} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 fade-in-up">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Market Overview</h1>
            <p className="text-sm mt-1" style={{ color: '#4A6080' }}>
              Real-time telemetry and threshold monitoring active
              {lastUpdate && (
                <span className="ml-2 font-mono text-xs">
                  · Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              {!wsConnected && (
                <span className="ml-2 font-mono text-xs" style={{ color: '#FFD700' }}>
                  · Polling fallback active
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!wsConnected && (
              <span className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-lg"
                style={{ background: 'rgba(255,215,0,0.08)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)' }}>
                <WifiOff className="w-3 h-3" />
                WS Reconnecting
              </span>
            )}
            <button
              onClick={fetchPrices}
              disabled={loading}
              className="btn-ghost flex items-center gap-2 self-start"
              id="refresh-prices-btn"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in-up fade-in-up-delay-1">
          <StatCard
            label="Portfolio Value"
            value={`$${totalPortfolioValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            icon={BarChart2}
            color="#00D4FF"
            sub="Sum of tracked assets"
          />
          <StatCard
            label="Active Feeds"
            value={`${activeCount} / ${TRACKED_TICKERS.length}`}
            icon={Activity}
            color="#00E5A0"
            sub="Live data streams"
          />
          <StatCard
            label="Top Gainer"
            value={topGainerLabel}
            icon={topGainer && changes[topGainer]?.changePercent < 0 ? TrendingDown : TrendingUp}
            color={topGainer && changes[topGainer]?.changePercent < 0 ? '#FF4D6D' : '#00E5A0'}
            sub="Session high performer"
          />
          <StatCard
            label="Alert Engine"
            value="ARMED"
            icon={Zap}
            color="#FFD700"
            sub="Threshold evaluation active"
          />
        </div>

        {/* Ticker Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 fade-in-up fade-in-up-delay-2">
          {TRACKED_TICKERS.map((ticker) => (
            <button
              key={ticker}
              id={`ticker-card-${ticker}`}
              onClick={() => setSelectedTicker(ticker)}
              className="text-left w-full focus:outline-none"
              style={{
                filter: selectedTicker === ticker
                  ? 'drop-shadow(0 0 12px rgba(0,212,255,0.2))'
                  : 'none',
                transform: selectedTicker === ticker ? 'scale(1.02)' : 'scale(1)',
                transition: 'transform 0.2s ease, filter 0.2s ease',
              }}
            >
              <TickerCard
                ticker={ticker}
                price={prices[ticker] ?? null}
                volume={volumes[ticker] ?? null}
                change={changes[ticker]?.change ?? 0}
                changePercent={changes[ticker]?.changePercent ?? 0}
                open={ohlc[ticker]?.open ?? null}
                high={ohlc[ticker]?.high ?? null}
                low={ohlc[ticker]?.low  ?? null}
                historyData={historicalData[ticker] || []}
              />
              {selectedTicker === ticker && (
                <div className="flex justify-center mt-2">
                  <ChevronDown className="w-4 h-4" style={{ color: '#00D4FF' }} />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Price Chart */}
        <div className="glass-card p-6 mb-8 fade-in-up fade-in-up-delay-3"
          style={{ height: '420px', display: 'flex', flexDirection: 'column' }}>
          <ChartBoundary>
            <PriceChart
              ticker={selectedTicker}
              currentPrice={prices[selectedTicker]}
              wsLastPriceUpdate={wsLastPriceUpdate}
            />
          </ChartBoundary>
        </div>

        {/* Live System Telemetry Footer */}
        <div className="glass-card p-6 fade-in-up fade-in-up-delay-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#FFD700] animate-pulse" />
            <h3 className="text-sm font-bold text-white tracking-wide">Live System Telemetry</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Read Latency', value: latency != null ? `${latency}ms` : 'calculating…', color: '#00E5A0' },
              { label: 'Cache Tier',   value: cacheStatus[selectedTicker] === 'cache_memory' ? 'Warm (Redis 7)' : 'Cold (Postgres DB)', color: '#00D4FF' },
              { label: 'Connection',   value: wsConnected ? 'WebSocket (Live)' : 'HTTP Polling', color: '#6B48FF' },
              { label: 'Node Health',  value: 'Operational', color: '#FFD700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center py-3 rounded-xl"
                style={{ background: 'rgba(5,11,20,0.5)', border: '1px solid rgba(0,212,255,0.03)' }}>
                <div className="text-sm font-bold font-mono" style={{ color }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: '#4A6080' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
