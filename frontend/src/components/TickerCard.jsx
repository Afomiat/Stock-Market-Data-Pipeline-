import React, { useRef, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Accept all real props — no mock data
const TickerCard = ({ ticker, price, volume, change = 0, changePercent = 0, open, high, low }) => {
  const prevPrice = useRef(price);
  const [flashClass, setFlashClass] = useState('');
  const [displayPrice, setDisplayPrice] = useState(price);

  useEffect(() => {
    if (price !== prevPrice.current && prevPrice.current !== null) {
      const direction = price > prevPrice.current ? 'price-up' : 'price-down';
      setFlashClass(direction);
      const timer = setTimeout(() => setFlashClass(''), 800);
      prevPrice.current = price;
      setDisplayPrice(price);
      return () => clearTimeout(timer);
    } else {
      prevPrice.current = price;
      setDisplayPrice(price);
    }
  }, [price]);

  const isPositive = changePercent >= 0;
  const isNeutral  = changePercent === 0 && change === 0;

  const fmt = (v, digits = 2) =>
    v != null ? Number(v).toFixed(digits) : '—';

  const formattedPrice = displayPrice != null
    ? displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

  const formattedVolume = volume != null
    ? volume >= 1_000_000
      ? `${(volume / 1_000_000).toFixed(1)}M`
      : volume >= 1_000
        ? `${(volume / 1_000).toFixed(0)}K`
        : volume.toString()
    : '—';

  return (
    <div className="glass-card p-5 cursor-default select-none" style={{ minHeight: '160px' }}>
      {/* Header Row */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-xs font-mono font-bold tracking-widest mb-0.5" style={{ color: '#00D4FF' }}>
            {ticker}
          </div>
          <div className="text-xs" style={{ color: '#4A6080' }}>NASDAQ</div>
        </div>
        <span className={isNeutral ? 'badge-neutral' : isPositive ? 'badge-gain' : 'badge-loss'}>
          {isPositive && !isNeutral ? '+' : ''}{fmt(changePercent)}%
        </span>
      </div>

      {/* Price */}
      <div className={`font-mono font-bold tracking-tight mb-2 ${flashClass}`}
        style={{ fontSize: '1.6rem', lineHeight: 1.1, color: '#E8F4FF' }}>
        ${formattedPrice}
      </div>

      {/* OHLC mini row */}
      {(open != null || high != null || low != null) && (
        <div className="flex items-center gap-3 mb-2">
          {[['O', open], ['H', high], ['L', low]].map(([label, val]) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-xs font-mono" style={{ color: '#4A6080' }}>{label}</span>
              <span className="text-xs font-mono font-semibold" style={{ color: '#8BAFC8' }}>
                {val != null ? `$${Number(val).toFixed(2)}` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5" style={{ color: '#8BAFC8' }}>
          <span className="text-xs font-mono">Vol</span>
          <span className="text-xs font-mono font-semibold text-white">{formattedVolume}</span>
        </div>
        <div className="flex items-center gap-1">
          {isNeutral ? (
            <Minus className="w-3.5 h-3.5" style={{ color: '#4A6080' }} />
          ) : isPositive ? (
            <TrendingUp className="w-3.5 h-3.5" style={{ color: '#00E5A0' }} />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" style={{ color: '#FF4D6D' }} />
          )}
          <span className="text-xs font-mono"
            style={{ color: isNeutral ? '#4A6080' : isPositive ? '#00E5A0' : '#FF4D6D' }}>
            {isPositive && !isNeutral ? '+' : ''}{fmt(change)}
          </span>
        </div>
      </div>

      {/* Color accent bar */}
      <div className="mt-3 h-0.5 rounded-full w-full"
        style={{
          background: isNeutral
            ? 'rgba(74,96,128,0.3)'
            : isPositive
              ? 'linear-gradient(90deg, rgba(0,229,160,0.6) 0%, rgba(0,229,160,0.1) 100%)'
              : 'linear-gradient(90deg, rgba(255,77,109,0.6) 0%, rgba(255,77,109,0.1) 100%)',
        }} />
    </div>
  );
};

export default TickerCard;
