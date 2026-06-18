import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  createChart,
  ColorType,
  CrosshairMode,
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
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
    const volumes    = quote.volume ?? [];

    return timestamps
      .map((t, i) => ({
        time:  t,  // already Unix seconds
        open:  opens[i]  != null ? parseFloat(opens[i].toFixed(4))  : null,
        high:  highs[i]  != null ? parseFloat(highs[i].toFixed(4))  : null,
        low:   lows[i]   != null ? parseFloat(lows[i].toFixed(4))   : null,
        close: closes[i] != null ? parseFloat(closes[i].toFixed(4)) : null,
        volume: volumes[i] != null ? volumes[i] : 0,
      }))
      .filter(d => d.open != null && d.close != null && d.high != null && d.low != null)
      .sort((a, b) => a.time - b.time)
      .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);
  } catch (_) {
    return [];
  }
}

const PriceChart = ({ ticker = 'AAPL', currentPrice, wsLastPriceUpdate }) => {
  const chartRef       = useRef(null);
  const chartInstance  = useRef(null);
  const [chartType, setChartType]       = useState('area');
  const [interval, setIntervalVal]      = useState('1h');
  const [historyData, setHistoryData]   = useState([]);
  const [fetchError, setFetchError]     = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [dataSource, setDataSource]     = useState('');
  const [session, setSession]           = useState(getMarketSession());

  // Real-time hover details
  const [hoveredBar, setHoveredBar]     = useState(null);

  // Keep references to series for live WebSocket updating
  const mainSeriesRef   = useRef(null);
  const volumeSeriesRef = useRef(null);

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
              volume: d.volume,
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
        attributionLogo: false, // Hide TradingView branding logo
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
      let mainSeries;
      if (chartType === 'candle') {
        mainSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#00E5A0', downColor: '#FF4D6D',
          borderUpColor: '#00E5A0', borderDownColor: '#FF4D6D',
          wickUpColor: '#00E5A0', wickDownColor: '#FF4D6D',
        });
        mainSeries.setData(historyData);
      } else {
        const areaData = historyData.map(d => ({ time: d.time, value: d.close }));
        mainSeries = chart.addSeries(AreaSeries, {
          lineColor: '#00D4FF',
          topColor: 'rgba(0,212,255,0.22)',
          bottomColor: 'rgba(0,212,255,0.01)',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
        });
        mainSeries.setData(areaData);
      }

      // Add Volume Histogram Series overlay
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '', // overlay inside main pane
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8, // 80% empty from top, volume takes bottom 20%
          bottom: 0,
        },
      });

      const volumeData = historyData.map(d => {
        const isUp = d.close >= d.open;
        return {
          time: d.time,
          value: d.volume || 0,
          color: isUp ? 'rgba(0, 229, 160, 0.35)' : 'rgba(255, 77, 109, 0.35)',
        };
      });
      volumeSeries.setData(volumeData);

      // Keep tracking references for WS updates
      mainSeriesRef.current   = mainSeries;
      volumeSeriesRef.current = volumeSeries;

      // Subscribe to crosshair movement to capture hover data metrics
      chart.subscribeCrosshairMove(param => {
        if (
          param.point === undefined ||
          !param.time ||
          param.point.x < 0 ||
          param.point.x > el.clientWidth ||
          param.point.y < 0 ||
          param.point.y > el.clientHeight
        ) {
          setHoveredBar(null);
        } else {
          const hoveredPrices = param.seriesData.get(mainSeries);
          if (hoveredPrices) {
            const hoveredVol = param.seriesData.get(volumeSeries);
            setHoveredBar({
              time: param.time,
              open: hoveredPrices.open ?? null,
              high: hoveredPrices.high ?? null,
              low: hoveredPrices.low ?? null,
              close: hoveredPrices.close ?? hoveredPrices.value ?? null,
              volume: hoveredVol ? hoveredVol.value : null,
            });
          }
        }
      });

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
      mainSeriesRef.current   = null;
      volumeSeriesRef.current = null;
    };
  }, [ticker, chartType, historyData, interval]);

  // Hook 2: Listen to live WebSocket tick updates and append/update the chart series live
  useEffect(() => {
    if (!wsLastPriceUpdate || wsLastPriceUpdate.ticker !== ticker) return;
    if (!mainSeriesRef.current || !volumeSeriesRef.current) return;

    const tick = wsLastPriceUpdate;
    const price = tick.price;
    const volume = tick.volume || 0;
    const time = Math.floor(new Date(tick.timestamp).getTime() / 1000);

    // Calculate bucket time based on selected interval
    let bucketSize = 3600; // 1h default
    if (interval === '1m') bucketSize = 60;
    else if (interval === '5m') bucketSize = 300;
    else if (interval === '1d') bucketSize = 86400;

    const bucketTime = Math.floor(time / bucketSize) * bucketSize;

    setHistoryData(prev => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const lastIndex = copy.length - 1;
      const lastBar = copy[lastIndex];

      let updatedBar;
      if (lastBar.time === bucketTime) {
        // Update the last candle
        updatedBar = {
          ...lastBar,
          high: Math.max(lastBar.high, price),
          low: Math.min(lastBar.low, price),
          close: price,
          volume: lastBar.volume + volume, // accumulate volume
        };
        copy[lastIndex] = updatedBar;
      } else if (bucketTime > lastBar.time) {
        // Start a new candle
        updatedBar = {
          time: bucketTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
        };
        copy.push(updatedBar);
      } else {
        // Out of order, ignore
        return prev;
      }

      // Update lightweight-charts series directly
      if (chartType === 'candle') {
        mainSeriesRef.current.update(updatedBar);
      } else {
        mainSeriesRef.current.update({ time: updatedBar.time, value: updatedBar.close });
      }

      volumeSeriesRef.current.update({
        time: updatedBar.time,
        value: updatedBar.volume,
        color: updatedBar.close >= updatedBar.open ? 'rgba(0, 229, 160, 0.35)' : 'rgba(255, 77, 109, 0.35)',
      });

      return copy;
    });
  }, [wsLastPriceUpdate, ticker, interval, chartType]);

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
        
        {/* Dynamic Hover Details Legend Overlay */}
        {(() => {
          const activeBar = hoveredBar || (historyData.length > 0 ? historyData[historyData.length - 1] : null);
          if (!activeBar) return null;
          return (
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-x-3 gap-y-1 bg-[#050B14]/85 p-2 rounded-lg border border-white/5 backdrop-blur-md text-[10px] font-mono text-[#8BAFC8] pointer-events-none select-none">
              <div>
                <span className="text-[#4A6080]">O: </span>
                <span className="font-bold text-white">${activeBar.open != null ? activeBar.open.toFixed(2) : '—'}</span>
              </div>
              <div>
                <span className="text-[#4A6080]">H: </span>
                <span className="font-bold text-[#00E5A0]">${activeBar.high != null ? activeBar.high.toFixed(2) : '—'}</span>
              </div>
              <div>
                <span className="text-[#4A6080]">L: </span>
                <span className="font-bold text-[#FF4D6D]">${activeBar.low != null ? activeBar.low.toFixed(2) : '—'}</span>
              </div>
              <div>
                <span className="text-[#4A6080]">C: </span>
                <span className="font-bold text-white">${activeBar.close != null ? activeBar.close.toFixed(2) : '—'}</span>
              </div>
              {activeBar.volume != null && (
                <div>
                  <span className="text-[#4A6080]">V: </span>
                  <span className="font-bold text-[#00D4FF]">
                    {activeBar.volume >= 1_000_000
                      ? `${(activeBar.volume / 1_000_000).toFixed(1)}M`
                      : activeBar.volume >= 1_000
                        ? `${(activeBar.volume / 1_000).toFixed(0)}K`
                        : activeBar.volume.toString()}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

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
