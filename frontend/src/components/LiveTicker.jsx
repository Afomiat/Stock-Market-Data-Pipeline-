import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const TRACKED = ['AAPL', 'NVDA', 'TSLA'];

const LiveTicker = ({ prices = {}, changes = {} }) => {
  // Build items only from real tracked tickers, doubled for infinite scroll effect
  const items = [...TRACKED, ...TRACKED].map(symbol => ({
    symbol,
    price:  prices[symbol] ?? null,
    change: changes[symbol]?.changePercent ?? 0,
  }));

  return (
    <div className="ticker-tape-wrapper h-10 flex items-center border-b border-white/5"
      style={{ background: 'rgba(10,22,40,0.6)' }}>
      <div className="ticker-tape flex items-center gap-8 px-8">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-bold tracking-widest"
              style={{ color: '#00D4FF' }}>
              {item.symbol}
            </span>
            <span className="text-xs font-mono font-semibold text-white">
              {item.price != null
                ? `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-mono"
              style={{ color: item.change >= 0 ? '#00E5A0' : '#FF4D6D' }}>
              {item.change >= 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
            </span>
            <span className="text-white/10">│</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveTicker;
