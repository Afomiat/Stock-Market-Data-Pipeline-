import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { Maximize2, Minimize2, MousePointer, PenTool, Type, Percent, Compass, Eraser, TrendingUp } from 'lucide-react';

const INTERVALS = [
  { label: '1m',  value: '1m',  yhInterval: '1m',  yhRange: '1d'  },
  { label: '5m',  value: '5m',  yhInterval: '5m',  yhRange: '5d'  },
  { label: '1h',  value: '1h',  yhInterval: '1h',  yhRange: '1mo' },
  { label: '1d',  value: '1d',  yhInterval: '1d',  yhRange: '1y'  },
];

// Helper to identify cryptocurrency tickers (open 24/7/365)
function isCryptoTicker(ticker) {
  if (!ticker) return false;
  const t = String(ticker).toUpperCase();
  const cryptoBaseSymbols = [
    'BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'LTC', 'DOGE', 'LINK', 'UNI', 'AVAX',
    'SHIB', 'MATIC', 'BCH', 'XLM', 'ATOM', 'ALGO', 'FIL', 'ICP', 'VET', 'XTZ'
  ];
  if (t.startsWith('CRYPTO:') || t.includes('/') || t.includes('-')) {
    return true;
  }
  for (const sym of cryptoBaseSymbols) {
    if (t.startsWith(sym)) {
      return true;
    }
  }
  return false;
}

// Helper to identify Forex currency pairs (open 24/5)
function isForexTicker(ticker) {
  if (!ticker) return false;
  const t = String(ticker).toUpperCase();
  const forexPairs = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'EURGBP',
    'EURJPY', 'GBPJPY', 'EURCHF', 'EURCAD', 'EURAUD', 'GBPCAD', 'AUDJPY'
  ];
  if (t.startsWith('FX:') || t.startsWith('OANDA:') || forexPairs.some(pair => t.includes(pair))) {
    return true;
  }
  if (t.length === 6 && (t.startsWith('EUR') || t.startsWith('USD') || t.startsWith('GBP') || t.startsWith('JPY') || t.startsWith('AUD') || t.startsWith('CAD') || t.startsWith('CHF') || t.startsWith('NZD'))) {
    return true;
  }
  return false;
}

// Helper to check if a Date (New York timezone) is a US Market Holiday
function isUSMarketHoliday(year, month, day) {
  const getDayOfWeek = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const getNthWeekdayOfMonth = (y, m, dayOfWeek, n) => {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      if (getDayOfWeek(y, m, d) === dayOfWeek) {
        count++;
        if (count === n) return d;
      }
    }
    return null;
  };
  const getLastMondayOfMonth = (y, m) => {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = lastDay; d >= 1; d--) {
      if (getDayOfWeek(y, m, d) === 1) return d;
    }
    return null;
  };
  const getThanksgivingDay = (y) => getNthWeekdayOfMonth(y, 11, 4, 4);
  const isObservedHoliday = (targetMonth, targetDay) => {
    const exactDayOfWeek = getDayOfWeek(year, targetMonth, targetDay);
    if (exactDayOfWeek >= 1 && exactDayOfWeek <= 5) {
      return month === targetMonth && day === targetDay;
    }
    if (exactDayOfWeek === 0) { // Sunday -> observed on Monday
      const obsDate = new Date(Date.UTC(year, targetMonth - 1, targetDay + 1));
      return month === (obsDate.getUTCMonth() + 1) && day === obsDate.getUTCDate();
    }
    if (exactDayOfWeek === 6) { // Saturday -> observed on Friday
      const obsDate = new Date(Date.UTC(year, targetMonth - 1, targetDay - 1));
      return month === (obsDate.getUTCMonth() + 1) && day === obsDate.getUTCDate();
    }
    return false;
  };

  if (isObservedHoliday(1, 1)) return true; // New Year's
  if (month === 1 && day === getNthWeekdayOfMonth(year, 1, 1, 3)) return true; // MLK
  if (month === 2 && day === getNthWeekdayOfMonth(year, 2, 1, 3)) return true; // Presidents'
  const goodFridays = {
    2024: { m: 3, d: 29 }, 2025: { m: 4, d: 18 }, 2026: { m: 4, d: 3 },
    2027: { m: 3, d: 26 }, 2028: { m: 4, d: 14 }, 2029: { m: 3, d: 30 }, 2030: { m: 4, d: 19 }
  };
  const gf = goodFridays[year];
  if (gf && month === gf.m && day === gf.d) return true; // Good Friday
  if (month === 5 && day === getLastMondayOfMonth(year, 5)) return true; // Memorial Day
  if (isObservedHoliday(6, 19)) return true; // Juneteenth
  if (isObservedHoliday(7, 4)) return true; // Independence Day
  if (month === 9 && day === getNthWeekdayOfMonth(year, 9, 1, 1)) return true; // Labor Day
  if (month === 11 && day === getThanksgivingDay(year)) return true; // Thanksgiving
  if (isObservedHoliday(12, 25)) return true; // Christmas
  return false;
}

// Helper to check if a Date (London timezone) is a UK Market Holiday
function isUKMarketHoliday(year, month, day) {
  const getDayOfWeek = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const getNthWeekdayOfMonth = (y, m, dayOfWeek, n) => {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      if (getDayOfWeek(y, m, d) === dayOfWeek) {
        count++;
        if (count === n) return d;
      }
    }
    return null;
  };
  const getLastMondayOfMonth = (y, m) => {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = lastDay; d >= 1; d--) {
      if (getDayOfWeek(y, m, d) === 1) return d;
    }
    return null;
  };
  const isObservedHoliday = (targetMonth, targetDay) => {
    const exactDayOfWeek = getDayOfWeek(year, targetMonth, targetDay);
    if (exactDayOfWeek >= 1 && exactDayOfWeek <= 5) {
      return month === targetMonth && day === targetDay;
    }
    if (exactDayOfWeek === 0) {
      const obsDate = new Date(Date.UTC(year, targetMonth - 1, targetDay + 1));
      return month === (obsDate.getUTCMonth() + 1) && day === obsDate.getUTCDate();
    }
    if (exactDayOfWeek === 6) {
      const obsDate = new Date(Date.UTC(year, targetMonth - 1, targetDay + 2)); // UK bank holiday rules
      return month === (obsDate.getUTCMonth() + 1) && day === obsDate.getUTCDate();
    }
    return false;
  };

  if (isObservedHoliday(1, 1)) return true; // New Year's
  const goodFridays = {
    2024: { m: 3, d: 29 }, 2025: { m: 4, d: 18 }, 2026: { m: 4, d: 3 },
    2027: { m: 3, d: 26 }, 2028: { m: 4, d: 14 }, 2029: { m: 3, d: 30 }, 2030: { m: 4, d: 19 }
  };
  const gf = goodFridays[year];
  if (gf && month === gf.m && day === gf.d) return true; // Good Friday
  const easterMondays = {
    2024: { m: 4, d: 1 }, 2025: { m: 4, d: 21 }, 2026: { m: 4, d: 6 },
    2027: { m: 3, d: 29 }, 2028: { m: 4, d: 17 }, 2029: { m: 4, d: 2 }, 2030: { m: 4, d: 22 }
  };
  const em = easterMondays[year];
  if (em && month === em.m && day === em.d) return true; // Easter Monday
  if (month === 5 && day === getNthWeekdayOfMonth(year, 5, 1, 1)) return true; // Early May
  if (month === 5 && day === getLastMondayOfMonth(year, 5)) return true; // Spring bank
  if (month === 8 && day === getLastMondayOfMonth(year, 8)) return true; // Summer bank
  if (isObservedHoliday(12, 25)) return true; // Christmas
  if (isObservedHoliday(12, 26)) return true; // Boxing Day
  return false;
}

// Helper to check if a Date (Paris/Frankfurt timezone) is a European Market Holiday
function isEUMarketHoliday(year, month, day) {
  const goodFridays = {
    2024: { m: 3, d: 29 }, 2025: { m: 4, d: 18 }, 2026: { m: 4, d: 3 },
    2027: { m: 3, d: 26 }, 2028: { m: 4, d: 14 }, 2029: { m: 3, d: 30 }, 2030: { m: 4, d: 19 }
  };
  const gf = goodFridays[year];
  if (gf && month === gf.m && day === gf.d) return true;
  const easterMondays = {
    2024: { m: 4, d: 1 }, 2025: { m: 4, d: 21 }, 2026: { m: 4, d: 6 },
    2027: { m: 3, d: 29 }, 2028: { m: 4, d: 17 }, 2029: { m: 4, d: 2 }, 2030: { m: 4, d: 22 }
  };
  const em = easterMondays[year];
  if (em && month === em.m && day === em.d) return true;

  if (month === 1 && day === 1) return true; // New Year's
  if (month === 5 && day === 1) return true; // Labour Day
  if (month === 12 && day === 25) return true; // Christmas
  if (month === 12 && day === 26) return true; // Boxing Day
  return false;
}

// Helper to check if a Date (Toronto timezone) is a Canadian Market Holiday
function isCanadianMarketHoliday(year, month, day) {
  const getDayOfWeek = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const getNthWeekdayOfMonth = (y, m, dayOfWeek, n) => {
    let count = 0;
    for (let d = 1; d <= 31; d++) {
      if (getDayOfWeek(y, m, d) === dayOfWeek) {
        count++;
        if (count === n) return d;
      }
    }
    return null;
  };
  const isObservedHoliday = (targetMonth, targetDay) => {
    const exactDayOfWeek = getDayOfWeek(year, targetMonth, targetDay);
    if (exactDayOfWeek >= 1 && exactDayOfWeek <= 5) {
      return month === targetMonth && day === targetDay;
    }
    if (exactDayOfWeek === 0) {
      const obsDate = new Date(Date.UTC(year, targetMonth - 1, targetDay + 1));
      return month === (obsDate.getUTCMonth() + 1) && day === obsDate.getUTCDate();
    }
    if (exactDayOfWeek === 6) {
      const obsDate = new Date(Date.UTC(year, targetMonth - 1, targetDay - 1));
      return month === (obsDate.getUTCMonth() + 1) && day === obsDate.getUTCDate();
    }
    return false;
  };

  if (isObservedHoliday(1, 1)) return true; // New Year's
  if (month === 2 && day === getNthWeekdayOfMonth(year, 2, 1, 3)) return true; // Family Day
  const goodFridays = {
    2024: { m: 3, d: 29 }, 2025: { m: 4, d: 18 }, 2026: { m: 4, d: 3 },
    2027: { m: 3, d: 26 }, 2028: { m: 4, d: 14 }, 2029: { m: 3, d: 30 }, 2030: { m: 4, d: 19 }
  };
  const gf = goodFridays[year];
  if (gf && month === gf.m && day === gf.d) return true; // Good Friday
  const getVictoriaDay = (y) => {
    for (let d = 24; d >= 18; d--) {
      if (getDayOfWeek(y, 5, d) === 1) return d;
    }
    return null;
  };
  if (month === 5 && day === getVictoriaDay(year)) return true; // Victoria Day
  if (isObservedHoliday(7, 1)) return true; // Canada Day
  if (month === 8 && day === getNthWeekdayOfMonth(year, 8, 1, 1)) return true; // Civic Holiday
  if (month === 9 && day === getNthWeekdayOfMonth(year, 9, 1, 1)) return true; // Labour Day
  if (month === 10 && day === getNthWeekdayOfMonth(year, 10, 1, 2)) return true; // Thanksgiving
  if (isObservedHoliday(12, 25)) return true; // Christmas
  if (isObservedHoliday(12, 26)) return true; // Boxing Day
  return false;
}

// US/Global market session helper (Eastern Time or foreign local timezones based on ticker suffix)
function getMarketSession(ticker) {
  try {
    if (!ticker) return 'closed';
    const sym = String(ticker).toUpperCase();

    // 1. Crypto Assets (Always Open 24/7/365)
    if (isCryptoTicker(sym)) {
      return 'open';
    }

    // 2. Forex Assets (24/5 - Open Sunday 5pm ET to Friday 5pm ET)
    if (isForexTicker(sym)) {
      const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const day = nowET.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const hour = nowET.getHours();
      if (day === 6) return 'closed';
      if (day === 5 && hour >= 17) return 'closed';
      if (day === 0 && hour < 17) return 'closed';
      return 'open';
    }

    // 3. UK/London Stocks (.L suffix)
    if (sym.endsWith('.L')) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/London',
        hour12: false,
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
      const parts = formatter.formatToParts(new Date());
      const partVal = (type) => parts.find(p => p.type === type).value;
      const weekday = partVal('weekday');
      const year = parseInt(partVal('year'), 10);
      const month = parseInt(partVal('month'), 10);
      const day = parseInt(partVal('day'), 10);
      let hour = parseInt(partVal('hour'), 10);
      if (hour === 24) hour = 0;
      const minute = parseInt(partVal('minute'), 10);
      const mins = hour * 60 + minute;

      if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
      if (isUKMarketHoliday(year, month, day)) return 'closed';
      if (mins >= 480 && mins < 990) return 'open'; // 8:00 AM – 4:30 PM London Time
      return 'closed';
    }

    // 4. European Stocks (.DE, .PA suffixes)
    if (sym.endsWith('.DE') || sym.endsWith('.PA')) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Paris',
        hour12: false,
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
      const parts = formatter.formatToParts(new Date());
      const partVal = (type) => parts.find(p => p.type === type).value;
      const weekday = partVal('weekday');
      const year = parseInt(partVal('year'), 10);
      const month = parseInt(partVal('month'), 10);
      const day = parseInt(partVal('day'), 10);
      let hour = parseInt(partVal('hour'), 10);
      if (hour === 24) hour = 0;
      const minute = parseInt(partVal('minute'), 10);
      const mins = hour * 60 + minute;

      if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
      if (isEUMarketHoliday(year, month, day)) return 'closed';
      if (mins >= 540 && mins < 1050) return 'open'; // 9:00 AM – 5:30 PM CET/CEST
      return 'closed';
    }

    // 5. Canadian Stocks (.TO suffix)
    if (sym.endsWith('.TO')) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Toronto',
        hour12: false,
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      });
      const parts = formatter.formatToParts(new Date());
      const partVal = (type) => parts.find(p => p.type === type).value;
      const weekday = partVal('weekday');
      const year = parseInt(partVal('year'), 10);
      const month = parseInt(partVal('month'), 10);
      const day = parseInt(partVal('day'), 10);
      let hour = parseInt(partVal('hour'), 10);
      if (hour === 24) hour = 0;
      const minute = parseInt(partVal('minute'), 10);
      const mins = hour * 60 + minute;

      if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
      if (isCanadianMarketHoliday(year, month, day)) return 'closed';
      if (mins >= 570 && mins < 960) return 'open'; // 9:30 AM – 4:00 PM Eastern Time
      return 'closed';
    }

    // 6. US Stocks (Default fallback)
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
    const parts = formatter.formatToParts(new Date());
    const partVal = (type) => parts.find(p => p.type === type).value;
    
    const weekday = partVal('weekday');
    const year = parseInt(partVal('year'), 10);
    const month = parseInt(partVal('month'), 10);
    const day = parseInt(partVal('day'), 10);
    let hour = parseInt(partVal('hour'), 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(partVal('minute'), 10);
    const mins = hour * 60 + minute;

    const isWeekend = weekday === 'Sat' || weekday === 'Sun';
    if (isWeekend) return 'closed';

    if (isUSMarketHoliday(year, month, day)) return 'closed';

    if (mins >= 240  && mins < 570)  return 'pre';    // 4:00 AM – 9:30 AM ET
    if (mins >= 570  && mins < 960)  return 'open';   // 9:30 AM – 4:00 PM ET
    if (mins >= 960  && mins < 1200) return 'after';  // 4:00 PM – 8:00 PM ET
    return 'closed';
  } catch (e) {
    return 'closed';
  }
}

const SESSION_CONFIG = {
  open:   { label: 'MARKET OPEN',   color: '#00E5A0', pulse: true  },
  pre:    { label: 'PRE-MARKET',    color: '#FFD700', pulse: false },
  after:  { label: 'AFTER HOURS',   color: '#6B48FF', pulse: false },
  closed: { label: 'MARKET CLOSED', color: '#4A6080', pulse: false },
};

// Format seconds remaining as HH:MM:SS or MM:SS
function formatCountdown(secs) {
  if (secs <= 0) return '00:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

// Parse any lightweight-charts time value into standard Unix seconds
function getUnixTimestampVal(time) {
  if (typeof time === 'number') {
    return time;
  }
  if (typeof time === 'string') {
    const parts = time.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return Math.floor(Date.UTC(year, month - 1, day) / 1000);
    }
    const d = new Date(time);
    return Math.floor(d.getTime() / 1000);
  }
  if (time && typeof time === 'object') {
    if (time.year !== undefined && time.month !== undefined && time.day !== undefined) {
      return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
    }
  }
  return null;
}

const PriceChart = ({
  ticker = 'AAPL',
  currentPrice,
  wsLastPriceUpdate,
  onTickerChange,
}) => {
  const chartRef       = useRef(null);
  const chartInstance  = useRef(null);
  const [chartType, setChartType]       = useState('area');
  const [interval, setIntervalVal]      = useState('1h');
  const [historyData, setHistoryData]   = useState([]);
  const [fetchError, setFetchError]     = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [dataSource, setDataSource]     = useState('');
  const [session, setSession]           = useState(() => getMarketSession(ticker));

  // Native Fullscreen Support
  const chartWrapperRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleNativeFullscreen = () => {
    const container = chartWrapperRef.current;
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable native fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Real-time hover details
  const [hoveredBar, setHoveredBar]     = useState(null);

  // Drawing states
  const overlayRef = useRef(null);
  const [activeTool, setActiveTool] = useState('crosshair');
  const [drawings, setDrawings] = useState([]);
  const [tempDrawing, setTempDrawing] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [visibleRangeUpdated, setVisibleRangeUpdated] = useState(0);
  const [textInput, setTextInput] = useState(null); // { x, y, pt }
  const [hoveredDeleteId, setHoveredDeleteId] = useState(null);
  const [mouseDownPos, setMouseDownPos] = useState(null);
  const [draggedDrawingId, setDraggedDrawingId] = useState(null);
  const [dragStartCoords, setDragStartCoords] = useState(null); // { mouse, start, end, point, points }
  const cachedRectRef = useRef(null);

  const handleDeleteDrawing = (id, e) => {
    e.stopPropagation();
    setDrawings(prev => prev.filter(item => item.id !== id));
    if (hoveredDeleteId === id) {
      setHoveredDeleteId(null);
    }
  };

  const handleDrawingMouseDown = (id, e) => {
    if (activeTool !== 'crosshair') return;
    e.stopPropagation();
    e.preventDefault();
    if (!overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    cachedRectRef.current = rect;
    const mousePixel = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const drawing = drawings.find(d => d.id === id);
    if (!drawing) return;
    setDraggedDrawingId(id);
    if (drawing.type === 'trendline' || drawing.type === 'fibonacci' || drawing.type === 'ruler') {
      setDragStartCoords({
        mousePixel,
        startPixel: getCoordinates(drawing.start),
        endPixel: getCoordinates(drawing.end)
      });
    } else if (drawing.type === 'text') {
      setDragStartCoords({
        mousePixel,
        pointPixel: getCoordinates(drawing.point)
      });
    } else if (drawing.type === 'brush') {
      setDragStartCoords({
        mousePixel,
        pointsPixels: drawing.points.map(p => getCoordinates(p))
      });
    }
  };

  const renderDeleteButton = (id, x, y) => {
    const isHovered = hoveredDeleteId === id;
    return (
      <g 
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseEnter={() => setHoveredDeleteId(id)}
        onMouseLeave={() => setHoveredDeleteId(null)}
        onClick={(e) => handleDeleteDrawing(id, e)}
      >
        <circle 
          cx={x} 
          cy={y} 
          r="7.5" 
          fill={isHovered ? "#FF4D6D" : "rgba(10, 22, 40, 0.85)"} 
          stroke={isHovered ? "#FFFFFF" : "rgba(255, 184, 0, 0.4)"} 
          strokeWidth="1.2" 
        />
        <line 
          x1={x - 3.5} 
          y1={y - 3.5} 
          x2={x + 3.5} 
          y2={y + 3.5} 
          stroke={isHovered ? "#FFFFFF" : "rgba(255, 184, 0, 0.8)"} 
          strokeWidth="1.2" 
          strokeLinecap="round" 
        />
        <line 
          x1={x + 3.5} 
          y1={y - 3.5} 
          x2={x - 3.5} 
          y2={y + 3.5} 
          stroke={isHovered ? "#FFFFFF" : "rgba(255, 184, 0, 0.8)"} 
          strokeWidth="1.2" 
          strokeLinecap="round" 
        />
      </g>
    );
  };

  // Keep references to series for live WebSocket updating
  const mainSeriesRef   = useRef(null);
  const volumeSeriesRef = useRef(null);
  const candlesRef      = useRef([]);
  const priceLineRef    = useRef(null);

  // Latest candle state
  const [latestCandle, setLatestCandle] = useState(null);

  // Candle close countdown state
  const [timeLeft, setTimeLeft]         = useState(0);

  // Update session badge every minute or when ticker changes
  useEffect(() => {
    setSession(getMarketSession(ticker));
    const id = setInterval(() => setSession(getMarketSession(ticker)), 60_000);
    return () => clearInterval(id);
  }, [ticker]);

  // Tick timer countdown before active candle closes
  useEffect(() => {
    let bucketSize = 3600; // default 1h
    if (interval === '1m') bucketSize = 60;
    else if (interval === '5m') bucketSize = 300;
    else if (interval === '1d') bucketSize = 86400;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const nextBucketStart = (Math.floor(now / bucketSize) * bucketSize) + bucketSize;
      setTimeLeft(Math.max(0, nextBucketStart - now));
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [interval]);

  const intervalCfg = INTERVALS.find(i => i.value === interval) ?? INTERVALS[2];

  // Fetch history: local DB ONLY
  useEffect(() => {
    let cancelled = false;
    setHistoryData([]);
    candlesRef.current = [];
    setLatestCandle(null);
    setFetchError(false);
    setFetchLoading(true);
    setDataSource('');

    (async () => {
      try {
        const res = await axios.get(`/api/stocks/${ticker}/history?interval=${interval}`);
        const raw = Array.isArray(res.data) ? res.data : [];

        if (!cancelled) {
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

            setHistoryData(candles);
            candlesRef.current = candles;
            setLatestCandle(candles[candles.length - 1]);
            setDataSource('local');
          } else {
            setFetchError(true);
          }
          setFetchLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(true);
          setFetchLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [ticker, interval]);

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

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      setVisibleRangeUpdated(v => v + 1);
    });

    let mainSeries;
    if (chartType === 'candle') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00E5A0', downColor: '#FF4D6D',
        borderUpColor: '#00E5A0', borderDownColor: '#FF4D6D',
        wickUpColor: '#00E5A0', wickDownColor: '#FF4D6D',
        priceLineVisible: false,
        lastValueVisible: false,
      });
    } else {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: '#00D4FF',
        topColor: 'rgba(0,212,255,0.22)',
        bottomColor: 'rgba(0,212,255,0.01)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
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
        // Look up the full candle data in our historical array by time
        const timeVal = getUnixTimestampVal(param.time);
        let localCandle = null;
        if (timeVal !== null && candlesRef.current.length > 0) {
          let minDiff = Infinity;
          let closest = null;
          for (const c of candlesRef.current) {
            const diff = Math.abs(c.time - timeVal);
            if (diff < minDiff) {
              minDiff = diff;
              closest = c;
            }
          }
          let maxAllowedDiff = 3600; // default 1 hour
          if (interval === '1m') maxAllowedDiff = 90;
          else if (interval === '5m') maxAllowedDiff = 450;
          else if (interval === '1h') maxAllowedDiff = 5400;
          else if (interval === '1d') maxAllowedDiff = 86400 * 2;
          
          if (minDiff <= maxAllowedDiff) {
            localCandle = closest;
          }
        }

        if (localCandle) {
          setHoveredBar(localCandle);
        } else {
          // Fallback if not found locally
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
      }
    });

    // Render initial data if already present
    if (candlesRef.current.length > 0) {
      if (chartType === 'candle') {
        mainSeries.setData(candlesRef.current);
      } else {
        const areaData = candlesRef.current.map(d => ({ time: d.time, value: d.close }));
        mainSeries.setData(areaData);
      }

      const volumeData = candlesRef.current.map(d => {
        const isUp = d.close >= d.open;
        return {
          time: d.time,
          value: d.volume || 0,
          color: isUp ? 'rgba(0, 229, 160, 0.35)' : 'rgba(255, 77, 109, 0.35)',
        };
      });
      volumeSeries.setData(volumeData);
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
      priceLineRef.current    = null;
    };
  }, [ticker, chartType, interval]);

  // Set historical data updates to chart series without recreating the chart instance
  useEffect(() => {
    if (!mainSeriesRef.current || !volumeSeriesRef.current || historyData.length === 0) return;

    if (chartType === 'candle') {
      mainSeriesRef.current.setData(historyData);
    } else {
      const areaData = historyData.map(d => ({ time: d.time, value: d.close }));
      mainSeriesRef.current.setData(areaData);
    }

    const volumeData = historyData.map(d => {
      const isUp = d.close >= d.open;
      return {
        time: d.time,
        value: d.volume || 0,
        color: isUp ? 'rgba(0, 229, 160, 0.35)' : 'rgba(255, 77, 109, 0.35)',
      };
    });
    volumeSeriesRef.current.setData(volumeData);

    if (chartInstance.current) {
      chartInstance.current.timeScale().fitContent();
    }
  }, [historyData, chartType]);

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

    const currentCandles = candlesRef.current;
    if (currentCandles.length === 0) return;

    const lastIndex = currentCandles.length - 1;
    const lastBar = currentCandles[lastIndex];

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
      currentCandles[lastIndex] = updatedBar;
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
      currentCandles.push(updatedBar);
    } else {
      // Out of order, ignore
      return;
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

    setLatestCandle(updatedBar);
  }, [wsLastPriceUpdate, ticker, interval, chartType]);

  // Hook 3: Manage custom price line countdown timer in vertical axis with dynamic green/red coloring
  useEffect(() => {
    const mainSeries = mainSeriesRef.current;
    if (!mainSeries) {
      priceLineRef.current = null;
      return;
    }

    let priceVal = currentPrice;
    if (priceVal == null && candlesRef.current.length > 0) {
      priceVal = candlesRef.current[candlesRef.current.length - 1].close;
    }

    if (priceVal == null) {
      if (priceLineRef.current) {
        try {
          mainSeries.removePriceLine(priceLineRef.current);
        } catch (_) {}
        priceLineRef.current = null;
      }
      return;
    }

    // Determine color based on time left before next bucket closes
    let isRed = false;
    if (interval === '1m') isRed = timeLeft < 10;
    else if (interval === '5m') isRed = timeLeft < 10;
    else if (interval === '1h') isRed = timeLeft < 300;
    else if (interval === '1d') isRed = timeLeft < 300;

    const color = isRed ? '#FF4D6D' : '#00E5A0';
    const title = '';

    if (!priceLineRef.current) {
      try {
        priceLineRef.current = mainSeries.createPriceLine({
          price: priceVal,
          color: color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: title,
        });
      } catch (e) {
        console.error("Error creating custom price line:", e);
      }
    } else {
      try {
        priceLineRef.current.applyOptions({
          price: priceVal,
          color: color,
          title: title,
        });
      } catch (_) {
        try {
          priceLineRef.current = mainSeries.createPriceLine({
            price: priceVal,
            color: color,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: title,
          });
        } catch (e) {
          console.error("Error recreating custom price line:", e);
        }
      }
    }
  }, [currentPrice, timeLeft, interval, chartType]);

  const getCoordinates = (point) => {
    if (!chartInstance.current || !mainSeriesRef.current || !point) return { x: 0, y: 0 };
    let x = chartInstance.current.timeScale().timeToCoordinate(point.time);
    const y = mainSeriesRef.current.priceToCoordinate(point.price);
    
    if (x === null && candlesRef.current && candlesRef.current.length > 0) {
      const lastCandle = candlesRef.current[candlesRef.current.length - 1];
      if (point.time > lastCandle.time) {
        let intervalSecs = 3600;
        if (interval === '1m') intervalSecs = 60;
        else if (interval === '5m') intervalSecs = 300;
        else if (interval === '1d') intervalSecs = 86400;
        
        const lastX = chartInstance.current.timeScale().timeToCoordinate(lastCandle.time);
        if (lastX !== null) {
          const lastLogical = chartInstance.current.timeScale().coordinateToLogical(lastX);
          if (lastLogical !== null) {
            const diffLogical = (point.time - lastCandle.time) / intervalSecs;
            x = chartInstance.current.timeScale().logicalToCoordinate(lastLogical + diffLogical);
          }
        }
      }
    }
    
    return { x: x ?? 0, y: y ?? 0 };
  };

  const getChartCoordinatesFromEvent = (e) => {
    if (!overlayRef.current || !chartInstance.current || !mainSeriesRef.current) return null;
    const rect = cachedRectRef.current || overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let time = chartInstance.current.timeScale().coordinateToTime(x);
    const price = mainSeriesRef.current.coordinateToPrice(y);
    
    if (time === null && candlesRef.current && candlesRef.current.length > 0) {
      const logical = chartInstance.current.timeScale().coordinateToLogical(x);
      if (logical !== null) {
        const lastCandle = candlesRef.current[candlesRef.current.length - 1];
        const lastX = chartInstance.current.timeScale().timeToCoordinate(lastCandle.time);
        if (lastX !== null) {
          const lastLogical = chartInstance.current.timeScale().coordinateToLogical(lastX);
          if (lastLogical !== null && logical > lastLogical) {
            let intervalSecs = 3600;
            if (interval === '1m') intervalSecs = 60;
            else if (interval === '5m') intervalSecs = 300;
            else if (interval === '1d') intervalSecs = 86400;
            
            time = lastCandle.time + Math.floor((logical - lastLogical) * intervalSecs);
          }
        }
      }
    }
    
    if (time === null || price === null) return null;
    return { time, price };
  };

  const handleMouseDown = (e) => {
    if (activeTool === 'crosshair') return;
    if (textInput) return;
    e.preventDefault();
    
    if (overlayRef.current) {
      cachedRectRef.current = overlayRef.current.getBoundingClientRect();
    }
    
    const pt = getChartCoordinatesFromEvent(e);
    if (!pt) return;
    
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setIsDrawing(true);
    const id = Date.now();
    
    if (activeTool === 'trendline' || activeTool === 'fibonacci' || activeTool === 'ruler') {
      setTempDrawing({
        id,
        type: activeTool,
        start: pt,
        end: pt
      });
    } else if (activeTool === 'brush') {
      setTempDrawing({
        id,
        type: 'brush',
        points: [pt]
      });
    } else if (activeTool === 'text') {
      // Don't open input on mouseDown, handle on mouseUp if it's a quick click!
    }
  };

  const handleMouseMove = (e) => {
    if (draggedDrawingId && dragStartCoords) {
      if (!overlayRef.current || !chartInstance.current || !mainSeriesRef.current) return;
      const rect = cachedRectRef.current || overlayRef.current.getBoundingClientRect();
      const currentMouseX = e.clientX - rect.left;
      const currentMouseY = e.clientY - rect.top;
      
      const deltaX = currentMouseX - dragStartCoords.mousePixel.x;
      const deltaY = currentMouseY - dragStartCoords.mousePixel.y;

      const convertPixelToChart = (px, py) => {
        let time = chartInstance.current.timeScale().coordinateToTime(px);
        const price = mainSeriesRef.current.coordinateToPrice(py);
        
        if (time === null && candlesRef.current && candlesRef.current.length > 0) {
          const logical = chartInstance.current.timeScale().coordinateToLogical(px);
          if (logical !== null) {
            const lastCandle = candlesRef.current[candlesRef.current.length - 1];
            const lastX = chartInstance.current.timeScale().timeToCoordinate(lastCandle.time);
            if (lastX !== null) {
              const lastLogical = chartInstance.current.timeScale().coordinateToLogical(lastX);
              if (lastLogical !== null && logical > lastLogical) {
                let intervalSecs = 3600;
                if (interval === '1m') intervalSecs = 60;
                else if (interval === '5m') intervalSecs = 300;
                else if (interval === '1d') intervalSecs = 86400;
                time = lastCandle.time + Math.floor((logical - lastLogical) * intervalSecs);
              }
            }
          }
        }
        
        if (time === null || price === null) return null;
        return { time, price };
      };

      setDrawings(prev => prev.map(d => {
        if (d.id !== draggedDrawingId) return d;
        if (d.type === 'trendline' || d.type === 'fibonacci' || d.type === 'ruler') {
          const newStart = convertPixelToChart(dragStartCoords.startPixel.x + deltaX, dragStartCoords.startPixel.y + deltaY);
          const newEnd = convertPixelToChart(dragStartCoords.endPixel.x + deltaX, dragStartCoords.endPixel.y + deltaY);
          if (!newStart || !newEnd) return d;
          return {
            ...d,
            start: newStart,
            end: newEnd
          };
        } else if (d.type === 'text') {
          const newPt = convertPixelToChart(dragStartCoords.pointPixel.x + deltaX, dragStartCoords.pointPixel.y + deltaY);
          if (!newPt) return d;
          return {
            ...d,
            point: newPt
          };
        } else if (d.type === 'brush') {
          const newPoints = [];
          for (let i = 0; i < dragStartCoords.pointsPixels.length; i++) {
            const origPix = dragStartCoords.pointsPixels[i];
            const pt = convertPixelToChart(origPix.x + deltaX, origPix.y + deltaY);
            if (!pt) return d;
            newPoints.push(pt);
          }
          return {
            ...d,
            points: newPoints
          };
        }
        return d;
      }));
      return;
    }

    if (!isDrawing || !tempDrawing) return;
    
    const pt = getChartCoordinatesFromEvent(e);
    if (!pt) return;
    
    if (tempDrawing.type === 'trendline' || tempDrawing.type === 'fibonacci' || tempDrawing.type === 'ruler') {
      setTempDrawing(prev => ({
        ...prev,
        end: pt
      }));
    } else if (tempDrawing.type === 'brush') {
      setTempDrawing(prev => ({
        ...prev,
        points: [...prev.points, pt]
      }));
    }
  };

  const handleMouseUp = (e) => {
    if (draggedDrawingId) {
      setDraggedDrawingId(null);
      setDragStartCoords(null);
      cachedRectRef.current = null;
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    
    const mouseUpX = e.clientX;
    const mouseUpY = e.clientY;
    
    if (activeTool === 'text' && mouseDownPos) {
      const dist = Math.hypot(mouseUpX - mouseDownPos.x, mouseUpY - mouseDownPos.y);
      if (dist < 5) {
        // Simple click! Open inline text input box.
        const rect = overlayRef.current.getBoundingClientRect();
        const x = mouseDownPos.x - rect.left;
        const y = mouseDownPos.y - rect.top;
        const pt = getChartCoordinatesFromEvent(e);
        if (pt) {
          setTextInput({ x, y, pt });
        }
      } else {
        // Panned the chart, cancel drawing state
        setActiveTool('crosshair');
      }
      setMouseDownPos(null);
      cachedRectRef.current = null;
      return;
    }
    
    const finalPt = getChartCoordinatesFromEvent(e) || (tempDrawing ? tempDrawing.end : null);
    
    if (tempDrawing && finalPt) {
      const finalDrawing = {
        ...tempDrawing,
        end: finalPt
      };
      
      let isTooSmall = false;
      if (finalDrawing.type === 'trendline' || finalDrawing.type === 'fibonacci' || finalDrawing.type === 'ruler') {
        const startCoords = getCoordinates(finalDrawing.start);
        const endCoords = getCoordinates(finalDrawing.end);
        const distance = Math.hypot(endCoords.x - startCoords.x, endCoords.y - startCoords.y);
        if (distance < 5) {
          isTooSmall = true;
        }
      }
      
      if (!isTooSmall) {
        setDrawings(prev => [...prev, finalDrawing]);
      }
    }
    
    setTempDrawing(null);
    setMouseDownPos(null);
    cachedRectRef.current = null;
    setActiveTool('crosshair'); // Reset to crosshair select tool after drawing!
  };
  const handleEraserClick = () => {
    setDrawings([]);
    setTempDrawing(null);
    setActiveTool('crosshair');
  };

  const renderDrawing = (d) => {
    if (d.type === 'trendline') {
      const start = getCoordinates(d.start);
      const end = getCoordinates(d.end);
      const buttonX = (start.x + end.x) / 2;
      const buttonY = (start.y + end.y) / 2 - 12;
      return (
        <g key={d.id}>
          {/* Transparent interactive line for easier grabbing */}
          <line 
            x1={start.x} y1={start.y} x2={end.x} y2={end.y} 
            stroke="#FFB800" strokeWidth="8" strokeOpacity="0" 
            style={{ pointerEvents: 'auto', cursor: 'grab' }}
            onMouseDown={(e) => handleDrawingMouseDown(d.id, e)}
          />
          <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#FFB800" strokeWidth="2" style={{ pointerEvents: 'none' }} />
          <circle cx={start.x} cy={start.y} r="3" fill="#FFB800" style={{ pointerEvents: 'none' }} />
          <circle cx={end.x} cy={end.y} r="3" fill="#FFB800" style={{ pointerEvents: 'none' }} />
          {renderDeleteButton(d.id, buttonX, buttonY)}
        </g>
      );
    }
    if (d.type === 'brush') {
      if (!d.points || d.points.length === 0) return null;
      let pathData = '';
      d.points.forEach((p, index) => {
        const coords = getCoordinates(p);
        if (index === 0) pathData += `M ${coords.x} ${coords.y}`;
        else pathData += ` L ${coords.x} ${coords.y}`;
      });
      const firstCoord = getCoordinates(d.points[0]);
      return (
        <g key={d.id}>
          {/* Transparent path for easier grabbing */}
          <path
            d={pathData}
            fill="none"
            stroke="#00E5A0"
            strokeWidth="12"
            strokeOpacity="0"
            style={{ pointerEvents: 'auto', cursor: 'grab' }}
            onMouseDown={(e) => handleDrawingMouseDown(d.id, e)}
          />
          <path
            d={pathData}
            fill="none"
            stroke="#00E5A0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'none' }}
          />
          {renderDeleteButton(d.id, firstCoord.x, firstCoord.y - 12)}
        </g>
      );
    }
    if (d.type === 'text') {
      const pos = getCoordinates(d.point);
      const textWidth = d.text.length * 6 + 16;
      const buttonX = pos.x + textWidth / 2 + 10;
      const buttonY = pos.y - 14;
      return (
        <g key={d.id}>
          <rect
            x={pos.x - textWidth / 2}
            y={pos.y - 22}
            width={textWidth}
            height={16}
            rx="3"
            fill="rgba(7, 15, 28, 0.95)"
            stroke="rgba(255, 184, 0, 0.4)"
            strokeWidth="1"
            style={{ pointerEvents: 'auto', cursor: 'grab' }}
            onMouseDown={(e) => handleDrawingMouseDown(d.id, e)}
          />
          <text
            x={pos.x}
            y={pos.y - 10}
            fill="#FFFFFF"
            fontSize="9.5px"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {d.text}
          </text>
          <circle cx={pos.x} cy={pos.y} r="2.5" fill="#FFB800" style={{ pointerEvents: 'none' }} />
          {renderDeleteButton(d.id, buttonX, buttonY)}
        </g>
      );
    }
    if (d.type === 'fibonacci') {
      const start = getCoordinates(d.start);
      const end = getCoordinates(d.end);
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
      const diff = end.y - start.y;
      const priceDiff = d.end.price - d.start.price;
      const width = overlayRef.current ? overlayRef.current.clientWidth : 2000;
      
      const isCollapsed = Math.abs(diff) < 2;
      const levelsToDraw = isCollapsed ? [0] : levels;

      const y0 = start.y;
      const p0 = d.start.price;
      const l0 = `0.0% ($${p0.toFixed(2)})`;
      const w0 = l0.length * 6 + 10;
      const buttonX = 10 + w0 + 12;
      const buttonY = y0 - 5;

      return (
        <g key={d.id}>
          {levelsToDraw.map(level => {
            const y = start.y + diff * level;
            const price = d.start.price + priceDiff * level;
            const pct = (level * 100).toFixed(1);
            const labelText = `${pct}% ($${price.toFixed(2)})`;
            const textWidth = labelText.length * 6 + 10;
            return (
              <g key={level}>
                <line
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke="rgba(0, 212, 255, 0.4)"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                  style={{ pointerEvents: 'none' }}
                />
                {/* Rect labels are interactive for grabbing */}
                <rect
                  x={10}
                  y={y - 12}
                  width={textWidth}
                  height={15}
                  rx="3"
                  fill="rgba(5, 11, 20, 0.85)"
                  stroke="rgba(0, 212, 255, 0.2)"
                  strokeWidth="1"
                  style={{ pointerEvents: 'auto', cursor: 'grab' }}
                  onMouseDown={(e) => handleDrawingMouseDown(d.id, e)}
                />
                <text
                  x={15}
                  y={y - 1}
                  fill="#00D4FF"
                  fontSize="9.5px"
                  fontFamily="monospace"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {labelText}
                </text>
              </g>
            );
          })}
          {!isCollapsed && (
            <>
              {/* Transparent path for trendline grabbing */}
              <line 
                x1={start.x} y1={start.y} x2={end.x} y2={end.y} 
                stroke="#00D4FF" strokeWidth="6" strokeOpacity="0" 
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                onMouseDown={(e) => handleDrawingMouseDown(d.id, e)}
              />
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#00D4FF" strokeWidth="1" strokeDasharray="2,2" style={{ pointerEvents: 'none' }} />
            </>
          )}
          {renderDeleteButton(d.id, buttonX, buttonY)}
        </g>
      );
    }
    if (d.type === 'ruler') {
      const start = getCoordinates(d.start);
      const end = getCoordinates(d.end);
      const priceDiff = d.end.price - d.start.price;
      const pctDiff = (priceDiff / d.start.price) * 100;
      
      const timeStart = d.start.time;
      const timeEnd = d.end.time;
      const barCount = candlesRef.current.filter(
        c => c.time >= Math.min(timeStart, timeEnd) && c.time <= Math.max(timeStart, timeEnd)
      ).length;

      const rectX = Math.min(start.x, end.x);
      const rectY = Math.min(start.y, end.y);
      const rectW = Math.abs(end.x - start.x);
      const rectH = Math.abs(end.y - start.y);

      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;

      const labelPriceText = `${priceDiff >= 0 ? '+' : ''}$${priceDiff.toFixed(2)} (${priceDiff >= 0 ? '+' : ''}${pctDiff.toFixed(2)}%)`;
      const labelBarsText = `${barCount} bar${barCount > 1 ? 's' : ''}`;

      const boxWidth = 140;
      const boxHeight = 36;
      const boxX = centerX - boxWidth / 2;
      const boxY = centerY - boxHeight / 2;

      const buttonX = boxX + boxWidth + 10;
      const buttonY = centerY;

      return (
        <g key={d.id}>
          {/* Main selection rectangle is grabbable */}
          <rect
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            fill="rgba(0, 212, 255, 0.05)"
            stroke="rgba(0, 212, 255, 0.45)"
            strokeWidth="1.5"
            strokeDasharray="4,4"
            style={{ pointerEvents: 'auto', cursor: 'grab' }}
            onMouseDown={(e) => handleDrawingMouseDown(d.id, e)}
          />
          {/* Measurement box is grabbable */}
          <rect
            x={boxX}
            y={boxY}
            width={boxWidth}
            height={boxHeight}
            rx="4"
            fill="rgba(5, 11, 20, 0.95)"
            stroke="rgba(0, 212, 255, 0.6)"
            strokeWidth="1.5"
            style={{ pointerEvents: 'auto', cursor: 'grab' }}
            onMouseDown={(e) => handleDrawingMouseDown(d.id, e)}
          />
          <text
            x={centerX}
            y={centerY - 4}
            fill={priceDiff >= 0 ? '#00E5A0' : '#FF4D6D'}
            fontSize="10px"
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {labelPriceText}
          </text>
          <text
            x={centerX}
            y={centerY + 10}
            fill="#8BAFC8"
            fontSize="9.5px"
            fontFamily="monospace"
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {labelBarsText}
          </text>
          {renderDeleteButton(d.id, buttonX, buttonY)}
        </g>
      );
    }
    return null;
  };

  // Recalculate current price Y coordinate dynamically for overlay timer
  let timerY = null;
  let priceVal = currentPrice;
  if (priceVal == null && candlesRef.current && candlesRef.current.length > 0) {
    priceVal = candlesRef.current[candlesRef.current.length - 1].close;
  }
  if (mainSeriesRef.current && priceVal != null) {
    timerY = mainSeriesRef.current.priceToCoordinate(priceVal);
  }

  let priceScaleWidth = 55;
  if (chartInstance.current) {
    try {
      priceScaleWidth = chartInstance.current.priceScale('right').width();
    } catch (_) {}
  }

  const sessionInfo = SESSION_CONFIG[session] ?? SESSION_CONFIG.closed;

  return (
    <div ref={chartWrapperRef} className={`flex flex-col ${isFullscreen ? 'w-full h-full p-6 bg-[#050B14]' : 'h-full w-full'}`} style={isFullscreen ? {} : { flex: 1, minHeight: 0 }}>
      {/* Controls Row */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white font-mono">{ticker}/USD</span>
            <span className="text-[10px] text-[#4A6080] font-mono font-bold">· {interval.toUpperCase()} · Live Telemetry</span>
          </div>
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
            <button 
              onClick={() => setChartType('area')}
              id="chart-type-area"
              className="p-1 rounded transition-all flex items-center justify-center"
              style={{
                background: chartType === 'area' ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: chartType === 'area' ? '#00D4FF' : '#4A6080',
                border: chartType === 'area' ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
              }}
              title="Line Chart"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3" />
              </svg>
            </button>
            <button 
              onClick={() => setChartType('candle')}
              id="chart-type-candle"
              className="p-1 rounded transition-all flex items-center justify-center"
              style={{
                background: chartType === 'candle' ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: chartType === 'candle' ? '#00D4FF' : '#4A6080',
                border: chartType === 'candle' ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
              }}
              title="Candlestick Chart"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3v18M18 3v18M12 2v20" />
                <rect x="9" y="6" width="6" height="12" rx="1" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* Fullscreen toggle button */}
          <button
            onClick={toggleNativeFullscreen}
            id="chart-fullscreen-btn"
            className="p-1.5 rounded-lg text-xs font-mono font-semibold transition-all hover:bg-white/10"
            style={{
              background: 'rgba(5, 11, 20, 0.8)',
              color: isFullscreen ? '#00E5A0' : '#4A6080',
              border: '1px solid rgba(0,212,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chart Workspace Area */}
      <div className="flex-grow flex flex-row min-h-0 relative">
        {/* Drawing Toolbar on the Left */}
        <div className="chart-drawing-toolbar rounded-l-xl">
          <button 
            className={`drawing-tool-btn ${activeTool === 'crosshair' ? 'active' : ''}`} 
            onClick={() => setActiveTool('crosshair')}
            title="Crosshair / Select"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>
          <button 
            className={`drawing-tool-btn ${activeTool === 'trendline' ? 'active' : ''}`} 
            onClick={() => setActiveTool('trendline')}
            title="Trend Line"
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </button>
          <button 
            className={`drawing-tool-btn ${activeTool === 'brush' ? 'active' : ''}`} 
            onClick={() => setActiveTool('brush')}
            title="Brush / Pen"
          >
            <PenTool className="w-3.5 h-3.5" />
          </button>
          <button 
            className={`drawing-tool-btn ${activeTool === 'text' ? 'active' : ''}`} 
            onClick={() => setActiveTool('text')}
            title="Text Annotation"
          >
            <Type className="w-3.5 h-3.5" />
          </button>
          <button 
            className={`drawing-tool-btn ${activeTool === 'fibonacci' ? 'active' : ''}`} 
            onClick={() => setActiveTool('fibonacci')}
            title="Fibonacci Retracement"
          >
            <Percent className="w-3.5 h-3.5" />
          </button>
          <button 
            className={`drawing-tool-btn ${activeTool === 'ruler' ? 'active' : ''}`} 
            onClick={() => setActiveTool('ruler')}
            title="Ruler / Measure"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
          <button 
            className="drawing-tool-btn text-gray-500 hover:text-red-400" 
            onClick={handleEraserClick}
            title="Clear All Drawings"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Chart canvas */}
        <div ref={chartRef}
          style={{
            flex: 1,
            minHeight: isFullscreen ? 'calc(100vh - 120px)' : '200px',
            borderRadius: '0 12px 12px 0',
            overflow: 'hidden',
            background: '#0A1628',
            position: 'relative',
          }}>
          
          {/* Overlay SVG for custom drawings */}
          <svg
            ref={overlayRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              width: '100%',
              height: '100%',
              pointerEvents: (activeTool === 'crosshair' && !draggedDrawingId) ? 'none' : 'auto',
              cursor: draggedDrawingId ? 'grabbing' : (activeTool === 'crosshair' ? 'default' : 'crosshair'),
            }}
          >
            {drawings.map(d => renderDrawing(d))}
            {tempDrawing && renderDrawing(tempDrawing)}
          </svg>
          
          {/* Overlay countdown timer below the green price label on the right price scale */}
          {session === 'open' && timerY !== null && (
            <div
              style={{
                position: 'absolute',
                right: '0px', // flush with the right boundary, matching lightweight-charts price scale
                width: `${priceScaleWidth}px`, // exact width of the price scale dynamically
                height: '18px', // same height
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                top: `${timerY + 9}px`, // attached directly below the price label
                zIndex: 6,
                pointerEvents: 'none',
                background: '#00E5A0',
                color: '#0A1628',
                fontSize: '11px',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 'bold',
                // Keep left corners rounded (matching lightweight-charts price label), right corners flat
                borderTopLeftRadius: '0px',
                borderTopRightRadius: '0px',
                borderBottomLeftRadius: '4px',
                borderBottomRightRadius: '0px',
              }}
            >
              {formatCountdown(timeLeft)}
            </div>
          )}
          
          {/* Inline Text Input overlay */}
          {textInput && (
            <input
              type="text"
              autoFocus
              placeholder="Type annotation..."
              defaultValue=""
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                } else if (e.key === 'Escape') {
                  e.target.value = '';
                  e.target.blur();
                }
              }}
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val) {
                  setDrawings(prev => [...prev, {
                    id: Date.now(),
                    type: 'text',
                    point: textInput.pt,
                    text: val
                  }]);
                }
                setTextInput(null);
                setActiveTool('crosshair');
              }}
              style={{
                position: 'absolute',
                left: `${textInput.x}px`,
                top: `${textInput.y - 10}px`,
                transform: 'translate(-50%, -50%)',
                background: 'rgba(7, 15, 28, 0.95)',
                border: '1px solid #FFB800',
                borderRadius: '4px',
                color: '#FFFFFF',
                fontSize: '11px',
                padding: '4px 8px',
                outline: 'none',
                zIndex: 50,
                width: '120px',
                fontFamily: 'sans-serif',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              }}
            />
          )}
          
          {/* Dynamic Hover Details Legend Overlay */}
          {(() => {
            const activeBar = hoveredBar || latestCandle;
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
    </div>
  );
};

export default PriceChart;
