import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  createChart,
  ColorType,
  CrosshairMode,
  AreaSeries,
  CandlestickSeries,
} from 'lightweight-charts';

const INTERVALS = [
  { label: '1m',  value: '1m',  yhInterval: '1m',  yhRange: '1d'  },
  { label: '5m',  value: '5m',  yhInterval: '5m',  yhRange: '5d'  },
  { label: '1h',  value: '1h',  yhInterval: '1h',  yhRange: '1mo' },
  { label: '1d',  value: '1d',  yhInterval: '1d',  yhRange: '1y'  },
];

// US market session helper (Eastern Time)
function getMarketSession() {
  const now = new Date();
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day  = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  if (day === 0 || day === 6) return 'closed';
  if (mins >= 240  && mins < 570)  return 'pre';    // 4:00 AM – 9:30 AM ET
  if (mins >= 570  && mins < 960)  return 'open';   // 9:30 AM – 4:00 PM ET
  if (mins >= 960  && mins < 1200) return 'after';  // 4:00 PM – 8:00 PM ET
  return 'closed';
}

const SESSION_CONFIG = {
  open:   { label: 'MARKET OPEN',   color: '#00E5A0', pulse: true  },
  pre:    { label: 'PRE-MARKET',    color: '#FFD700', pulse: false },
  after:  { label: 'AFTER HOURS',   color: '#6B48FF', pulse: false },
  closed: { label: 'MARKET CLOSED', color: '#4A6080', pulse: false },
};

// Fetch from Yahoo Finance chart API (no auth, CORS-friendly via proxy or direct)
async function fetchYahooHistory(ticker, yhInterval, yhRange) {
  try {
    // Route through Vite proxy (/yahoo-finance → query1.finance.yahoo.com) to avoid CORS
    const res = await axios.get(
      `/yahoo-finance/v8/finance/chart/${ticker}`,
      { 
        baseURL: '', // Override global Axios baseURL so this goes to local proxy
        params: { interval: yhInterval, range: yhRange } 
      }
    );
    const result = res.data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp ?? [];
    const quote      = result.indicators?.quote?.[0] ?? {};
    const opens      = quote.open  ?? [];
    const highs      = quote.high  ?? [];
    const lows       = quote.low   ?? [];
    const closes     = quote.close ?? [];

    return timestamps
      .map((t, i) => ({
        time:  t,  // already Unix seconds
        open:  opens[i]  != null ? parseFloat(opens[i].toFixed(4))  : null,
        high:  highs[i]  != null ? parseFloat(highs[i].toFixed(4))  : null,
        low:   lows[i]   != null ? parseFloat(lows[i].toFixed(4))   : null,
        close: closes[i] != null ? parseFloat(closes[i].toFixed(4)) : null,
      }))
      .filter(d => d.open != null && d.close != null && d.high != null && d.low != null)
      .sort((a, b) => a.time - b.time)
      .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);
  } catch (_) {
    return [];
  }
}

const PriceChart = ({ ticker = 'AAPL', currentPrice }) => {
  const chartRef       = useRef(null);
  const chartInstance  = useRef(null);
  const [chartType, setChartType]       = useState('area');
  const [interval, setIntervalVal]      = useState('1h');
  const [historyData, setHistoryData]   = useState([]);
  const [fetchError, setFetchError]     = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [dataSource, setDataSource]     = useState('');
  const [session, setSession]           = useState(getMarketSession());

  // Update session badge every minute
  useEffect(() => {
    const id = setInterval(() => setSession(getMarketSession()), 60_000);
    return () => clearInterval(id);
  }, []);

  const intervalCfg = INTERVALS.find(i => i.value === interval) ?? INTERVALS[2];

  // Fetch history: local DB first → Yahoo Finance fallback
  useEffect(() => {
    let cancelled = false;
    setHistoryData([]);
    setFetchError(false);
    setFetchLoading(true);
    setDataSource('');

    (async () => {
      // 1️⃣ Try local backend (has real tick data once market is open)
      try {
        const res = await axios.get(`/api/stocks/${ticker}/history?interval=${interval}`);
        const raw = Array.isArray(res.data) ? res.data : [];

        if (raw.length > 0) {
          const candles = raw
            .map(d => ({
              time:  Math.floor(new Date(d.timestamp).getTime() / 1000),
              open:  d.open,
              high:  d.high,
              low:   d.low,
              close: d.close,
            }))
            .sort((a, b) => a.time - b.time)
            .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);

          if (!cancelled) { setHistoryData(candles); setDataSource('local'); setFetchLoading(false); }
          return;
        }
      } catch (_) {}

      // 2️⃣ Fallback: Yahoo Finance (always has data, even on weekends/off-hours)
      const yhBars = await fetchYahooHistory(ticker, intervalCfg.yhInterval, intervalCfg.yhRange);
      if (!cancelled) {
        if (yhBars.length > 0) {
          setHistoryData(yhBars);
          setDataSource('yahoo');
        } else {
          setFetchError(true);
        }
        setFetchLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [ticker, interval, intervalCfg.yhInterval, intervalCfg.yhRange]);

  // Build / rebuild lightweight-charts instance
  useEffect(() => {
    if (!chartRef.current) return;
    const el = chartRef.current;

    if (chartInstance.current) {
      try { chartInstance.current.remove(); } catch (_) {}
      chartInstance.current = null;
    }

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: '#0A1628' },
        textColor: '#4A6080',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(0,212,255,0.04)' },
        horzLines: { color: 'rgba(0,212,255,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(0,212,255,0.3)', labelBackgroundColor: '#0A1628' },
        horzLine: { color: 'rgba(0,212,255,0.3)', labelBackgroundColor: '#0A1628' },
      },
      rightPriceScale: { borderColor: 'rgba(0,212,255,0.1)' },
      timeScale: {
        borderColor: 'rgba(0,212,255,0.1)',
        timeVisible: true,
        secondsVisible: interval === '1m',
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
      width: el.clientWidth || 600,
      height: el.clientHeight || 300,
    });

    chartInstance.current = chart;

    if (historyData.length > 0) {
      if (chartType === 'candle') {
        const series = chart.addSeries(CandlestickSeries, {
          upColor: '#00E5A0', downColor: '#FF4D6D',
          borderUpColor: '#00E5A0', borderDownColor: '#FF4D6D',
          wickUpColor: '#00E5A0', wickDownColor: '#FF4D6D',
        });
        series.setData(historyData);
      } else {
        const areaData = historyData.map(d => ({ time: d.time, value: d.close }));
        const series = chart.addSeries(AreaSeries, {
          lineColor: '#00D4FF',
          topColor: 'rgba(0,212,255,0.22)',
          bottomColor: 'rgba(0,212,255,0.01)',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
        });
        series.setData(areaData);
      }
      chart.timeScale().fitContent();
    }

    const observer = new ResizeObserver(() => {
      if (el && chart) chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      try { chart.remove(); } catch (_) {}
      chartInstance.current = null;
    };
  }, [ticker, chartType, historyData, interval]);

  const sessionInfo = SESSION_CONFIG[session] ?? SESSION_CONFIG.closed;

  return (
    <div className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
      {/* Controls Row */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-mono font-bold tracking-widest" style={{ color: '#00D4FF' }}>
            {ticker}
          </span>
          {currentPrice != null && (
            <span className="text-lg font-mono font-bold text-white">
              ${typeof currentPrice === 'number' ? currentPrice.toFixed(2) : currentPrice}
            </span>
          )}

          {/* Market Session Badge */}
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold"
            style={{
              background: `${sessionInfo.color}15`,
              border: `1px solid ${sessionInfo.color}40`,
              color: sessionInfo.color,
            }}>
            {sessionInfo.pulse && (
              <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
                style={{ background: sessionInfo.color }} />
            )}
            {sessionInfo.label}
          </span>

          {fetchLoading && (
            <span className="text-xs font-mono animate-pulse" style={{ color: '#4A6080' }}>loading…</span>
          )}

          {/* Data source badge */}
          {dataSource === 'yahoo' && !fetchLoading && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: 'rgba(107,72,255,0.1)', color: '#6B48FF', border: '1px solid rgba(107,72,255,0.2)' }}>
              Yahoo Finance
            </span>
          )}
          {dataSource === 'local' && !fetchLoading && (
            <span className="text-xs font-mono px-2 py-0.5 rounded"
              style={{ background: 'rgba(0,229,160,0.08)', color: '#00E5A0', border: '1px solid rgba(0,229,160,0.2)' }}>
              Live DB
            </span>
          )}
          {fetchError && !fetchLoading && (
            <span className="text-xs font-mono" style={{ color: '#FF4D6D' }}>no data</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Interval selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(5,11,20,0.8)' }}>
            {INTERVALS.map(({ label, value }) => (
              <button key={value} onClick={() => setIntervalVal(value)}
                id={`chart-interval-${value}`}
                className="px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all"
                style={{
                  background: interval === value ? 'rgba(0,212,255,0.15)' : 'transparent',
                  color: interval === value ? '#00D4FF' : '#4A6080',
                  border: interval === value ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Chart type selector */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(5,11,20,0.8)' }}>
            {['area', 'candle'].map(t => (
              <button key={t} onClick={() => setChartType(t)}
                id={`chart-type-${t}`}
                className="px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all"
                style={{
                  background: chartType === t ? 'rgba(0,212,255,0.15)' : 'transparent',
                  color: chartType === t ? '#00D4FF' : '#4A6080',
                  border: chartType === t ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
                }}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={chartRef}
        style={{
          flex: 1,
          minHeight: '280px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#0A1628',
          position: 'relative',
        }}>
        {historyData.length === 0 && !fetchLoading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span className="text-sm font-mono" style={{ color: '#4A6080' }}>
              {fetchError ? 'Chart data unavailable' : 'Loading chart…'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceChart;
