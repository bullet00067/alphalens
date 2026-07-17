import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
  CandlestickData,
  LineData,
  IPriceLine
} from 'lightweight-charts';
import { Candle, findPIPs, calculateATR, calculateADX } from '../utils/strategyEngine';
import { KeyLevels, StrategyCondition } from '../types/trading';
import { cleanTwTicker, formatCompactNumber } from '../utils/api';

interface TradingChartProps {
  ticker: string;
  candles: Candle[];
  levels: KeyLevels;
  bullishStrategy: StrategyCondition;
  bearishStrategy: StrategyCondition;
  isPipOverlayEnabled: boolean;
  isVolumeEnabled: boolean;
  activeProjection: 'none' | 'bullish' | 'bearish';
  onProjectionChange: (proj: 'none' | 'bullish' | 'bearish') => void;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  ticker,
  candles,
  levels,
  bullishStrategy,
  bearishStrategy,
  isPipOverlayEnabled,
  isVolumeEnabled,
  activeProjection,
  onProjectionChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const pipSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bullishProjSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bearishProjSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bullishUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bullishLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bearishUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bearishLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Active price lines tracking to prevent stacking and memory leaks
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Subchart type: 'none' | 'rsi' | 'pip'
  const [subchartType, setSubchartType] = useState<'none' | 'rsi' | 'pip'>('none');
  const subchartContainerRef = useRef<HTMLDivElement>(null);
  const subchartRef = useRef<IChartApi | null>(null);
  const subchartSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Synchronize visible logical ranges between main chart and subchart
  const isSyncingRef = useRef(false);

  // Helper to generate future dates for projections (supports both string dates and numeric timestamps)
  const getFutureDates = (lastDate: string | number, count: number): (string | number)[] => {
    const dates: (string | number)[] = [];
    let curr: Date;
    
    if (typeof lastDate === 'number') {
      curr = new Date(lastDate * 1000);
    } else {
      curr = new Date(lastDate);
      if (isNaN(curr.getTime())) {
        const num = Number(lastDate);
        if (!isNaN(num)) {
          curr = new Date(num * 1000);
        } else {
          curr = new Date();
        }
      }
    }

    const isNumeric = typeof lastDate === 'number';

    while (dates.length < count) {
      curr.setDate(curr.getDate() + 1);
      const day = curr.getDay();
      if (day !== 0 && day !== 6) { // skip weekends
        if (isNumeric) {
          dates.push(Math.floor(curr.getTime() / 1000));
        } else {
          dates.push(curr.toISOString().split('T')[0]);
        }
      }
    }
    return dates;
  };

  // 1. Primary Chart Creation and Update Lifecycle
  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    // Clean up previous chart if it exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = containerRef.current;
    const initialWidth = container.clientWidth || 800;
    
    // Explicit sizing with fallbacks to fully resolve mobile height collapse
    let initialHeight = container.clientHeight || 420;
    if (initialHeight <= 0 || initialHeight > 600) {
      if (window.innerWidth <= 768) {
        initialHeight = 280; // Mobile portrait
      } else if (window.innerWidth <= 1024) {
        initialHeight = window.innerHeight > window.innerWidth ? 320 : 240; // Mobile landscape
      } else {
        initialHeight = 420; // Desktop default
      }
    }

    // Colors aligned with modern dark design system (harmonious charcoal/glass panel aesthetics)
    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { type: 'solid', color: '#0f172a' }, // Tailwind slate-900
        textColor: '#94a3b8', // Tailwind slate-400
      },
      grid: {
        vertLines: { color: 'rgba(51, 65, 85, 0.3)' }, // Tailwind slate-700/30
        horzLines: { color: 'rgba(51, 65, 85, 0.3)' },
      },
      crosshair: {
        mode: 1 // CrosshairMode.Normal
      },
      rightPriceScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        minimumWidth: 80,
      },
      timeScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        timeVisible: true,
        rightOffset: 12,
      },
    });

    chartRef.current = chart;

    // A. Candlestick Series using standard addSeries method
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', // Tailwind emerald-500
      downColor: '#ef4444', // Tailwind red-500
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Format and load data
    const chartData: CandlestickData[] = candles.map(c => ({
      time: c.time as string,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candlestickSeries.setData(chartData);

    // B. Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(148, 163, 184, 0.2)', // translucent slate
      priceFormat: { type: 'volume' },
      priceScaleId: '', // overlay
    });
    volumeSeriesRef.current = volumeSeries;

    // Position volume at the bottom 25% of the chart
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0,
      },
    });

    const volumeData = candles.map(c => ({
      time: c.time as string,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
    }));
    volumeSeries.setData(volumeData);

    // C. PIP Overlay Series (Yellow line connecting peaks & troughs)
    const pipSeries = chart.addSeries(LineSeries, {
      color: '#fbbf24', // Tailwind amber-400
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
    });
    pipSeriesRef.current = pipSeries;

    if (isPipOverlayEnabled) {
      const pips = findPIPs(candles);
      const pipData: LineData[] = pips.map(p => ({
        time: p.time as string,
        value: p.value,
      }));
      pipSeries.setData(pipData);

      // Add Series Markers for visual peak/trough arrows
      const markers = pips.map(p => {
        const isHigh = p.type === 'high';
        return {
          time: p.time as string,
          position: (isHigh ? 'aboveBar' : 'belowBar') as 'aboveBar' | 'belowBar',
          color: isHigh ? '#f87171' : '#34d399', // bright red / bright emerald
          shape: (isHigh ? 'arrowDown' : 'arrowUp') as 'arrowDown' | 'arrowUp',
          text: '', // Start empty to prevent visual blocking
        };
      });
      createSeriesMarkers(candlestickSeries, markers);
    } else {
      pipSeries.setData([]);
      createSeriesMarkers(candlestickSeries, []);
    }

    // D. Projections Setup
    const bullishProjSeries = chart.addSeries(LineSeries, {
      color: '#eab308', // Tailwind yellow-500
      lineWidth: 2,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bullishProjSeriesRef.current = bullishProjSeries;

    const bullishUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(234, 179, 8, 0.15)', // Tailwind yellow-500 at 15% opacity
      lineWidth: 1,
      lineStyle: 3, // Dotted
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bullishUpperSeriesRef.current = bullishUpperSeries;

    const bullishLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(234, 179, 8, 0.15)',
      lineWidth: 1,
      lineStyle: 3, // Dotted
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bullishLowerSeriesRef.current = bullishLowerSeries;

    const bearishProjSeries = chart.addSeries(LineSeries, {
      color: '#10b981', // Tailwind emerald-500
      lineWidth: 2,
      lineStyle: 2, // Dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bearishProjSeriesRef.current = bearishProjSeries;

    const bearishUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(16, 185, 129, 0.15)', // Tailwind emerald-500 at 15% opacity
      lineWidth: 1,
      lineStyle: 3, // Dotted
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bearishUpperSeriesRef.current = bearishUpperSeries;

    const bearishLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(16, 185, 129, 0.15)',
      lineWidth: 1,
      lineStyle: 3, // Dotted
      priceLineVisible: false,
      lastValueVisible: false,
    });
    bearishLowerSeriesRef.current = bearishLowerSeries;

    const lastCandle = candles[candles.length - 1];
    const futureTimes = getFutureDates(lastCandle.time, 12);

    // Calculate dynamic price-volume indicators for modulation
    const volPeriod = Math.min(20, candles.length);
    const avgVol = candles.slice(-volPeriod).reduce((sum, c) => sum + c.volume, 0) / volPeriod || 1;
    const rvol = lastCandle.volume / avgVol;
    const adx = calculateADX(candles, 14);
    const atr = calculateATR(candles, 14) || lastCandle.close * 0.02;

    // Standard deviation volatility baseline (scaled by rolling ATR)
    const sigma0 = Math.max(lastCandle.close * 0.015, atr * 1.2);

    // Helper functions to interpolate N-wave and inverted N-wave values dynamically
    const getBullishPriceAt = (t: number, startPrice: number, breakoutPrice: number, pullbackPrice: number, finalPrice: number): number => {
      if (t <= 2) {
        return startPrice + (breakoutPrice - startPrice) * ((t + 1) / 3);
      } else if (t <= 6) {
        return breakoutPrice + (pullbackPrice - breakoutPrice) * ((t - 2) / 4);
      } else {
        return pullbackPrice + (finalPrice - pullbackPrice) * ((t - 6) / 5);
      }
    };

    const getBearishPriceAt = (t: number, startPrice: number, breakdownPrice: number, bouncePrice: number, finalPrice: number): number => {
      if (t <= 2) {
        return startPrice + (breakdownPrice - startPrice) * ((t + 1) / 3);
      } else if (t <= 6) {
        return breakdownPrice + (bouncePrice - breakdownPrice) * ((t - 2) / 4);
      } else {
        return bouncePrice + (finalPrice - bouncePrice) * ((t - 6) / 5);
      }
    };

    if (activeProjection === 'bullish') {
      const startPrice = lastCandle.close;
      const breakoutPrice = bullishStrategy.targets[0] || levels.resistance1 || (startPrice * 1.05);
      
      // Pullback is shallow in high-volume breakouts, deeper in low-volume consolidations
      const isHighVolumeBreakout = adx > 22 && rvol > 1.3;
      let pullbackPrice = isHighVolumeBreakout 
        ? breakoutPrice - (breakoutPrice - startPrice) * 0.25 
        : breakoutPrice - (breakoutPrice - startPrice) * 0.618;
      
      // Guard pullbackPrice so it does not drop below key support levels
      const stopLossLimit = bullishStrategy.stopLoss || levels.support1 || (startPrice * 0.95);
      pullbackPrice = Math.max(stopLossLimit, pullbackPrice);

      const finalPrice = Math.max(bullishStrategy.targets[1] || levels.resistance2 * 1.08, breakoutPrice * 1.02);

      // Generate daily path data points for smooth line rendering and volatility cone overlay
      const bullishData: LineData[] = [{ time: lastCandle.time, value: startPrice }];
      const upperData: LineData[] = [{ time: lastCandle.time, value: startPrice }];
      const lowerData: LineData[] = [{ time: lastCandle.time, value: startPrice }];

      for (let t = 0; t < futureTimes.length; t++) {
        const centerPrice = getBullishPriceAt(t, startPrice, breakoutPrice, pullbackPrice, finalPrice);
        const halfWidth = sigma0 * Math.sqrt(t + 1) * 1.5; // +/- 1.5 standard deviation width
        
        bullishData.push({ time: futureTimes[t], value: centerPrice });
        upperData.push({ time: futureTimes[t], value: centerPrice + halfWidth });
        lowerData.push({ time: futureTimes[t], value: centerPrice - halfWidth });
      }

      bullishProjSeries.setData(bullishData);
      bullishUpperSeries.setData(upperData);
      bullishLowerSeries.setData(lowerData);

      bearishProjSeries.setData([]);
      bearishUpperSeries.setData([]);
      bearishLowerSeries.setData([]);
    } else if (activeProjection === 'bearish') {
      const startPrice = lastCandle.close;
      const breakdownPrice = bearishStrategy.targets[0] || levels.support1 || (startPrice * 0.95);
      
      // Bounce is shallow in strong bearish trends, higher in low-volume/consolidation trends
      const isStrongBearishTrend = adx > 22;
      let bouncePrice = isStrongBearishTrend 
        ? breakdownPrice + (startPrice - breakdownPrice) * 0.2 
        : breakdownPrice + (startPrice - breakdownPrice) * 0.5;

      // Guard bouncePrice from exceeding bearish stop loss levels
      const bearishStopLimit = bearishStrategy.stopLoss || levels.resistance1 || (startPrice * 1.05);
      bouncePrice = Math.min(bearishStopLimit, bouncePrice);

      const finalPrice = Math.min(bearishStrategy.targets[1] || levels.support2 * 0.92, breakdownPrice * 0.98);

      // Generate daily path data points for smooth line rendering and volatility cone overlay
      const bearishData: LineData[] = [{ time: lastCandle.time, value: startPrice }];
      const upperData: LineData[] = [{ time: lastCandle.time, value: startPrice }];
      const lowerData: LineData[] = [{ time: lastCandle.time, value: startPrice }];

      for (let t = 0; t < futureTimes.length; t++) {
        const centerPrice = getBearishPriceAt(t, startPrice, breakdownPrice, bouncePrice, finalPrice);
        const halfWidth = sigma0 * Math.sqrt(t + 1) * 1.5; // +/- 1.5 standard deviation width
        
        bearishData.push({ time: futureTimes[t], value: centerPrice });
        upperData.push({ time: futureTimes[t], value: centerPrice + halfWidth });
        lowerData.push({ time: futureTimes[t], value: centerPrice - halfWidth });
      }

      bearishProjSeries.setData(bearishData);
      bearishUpperSeries.setData(upperData);
      bearishLowerSeries.setData(lowerData);

      bullishProjSeries.setData([]);
      bullishUpperSeries.setData([]);
      bullishLowerSeries.setData([]);
    } else {
      bullishProjSeries.setData([]);
      bullishUpperSeries.setData([]);
      bullishLowerSeries.setData([]);
      bearishProjSeries.setData([]);
      bearishUpperSeries.setData([]);
      bearishLowerSeries.setData([]);
    }

    // E. Add Level price lines
    // Clear any existing lines
    priceLinesRef.current.forEach(line => {
      try {
        candlestickSeries.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // Draw Support & Resistance Lines
    const drawLine = (price: number, label: string, color: string, style: number) => {
      if (price > 0) {
        const line = candlestickSeries.createPriceLine({
          price: price,
          color: color,
          lineWidth: 1,
          lineStyle: style, // 1: Dashed, 2: Dotted, 0: Solid
          axisLabelVisible: true,
          title: label,
        });
        priceLinesRef.current.push(line);
      }
    };

    // Draw key levels
    drawLine(levels.resistance2, 'R2', '#f87171', 1);
    drawLine(levels.resistance1, 'R1', '#ef4444', 1);
    drawLine(levels.support1, 'S1', '#34d399', 1);
    drawLine(levels.support2, 'S2', '#10b981', 1);
    if (levels.strongSupport) {
      drawLine(levels.strongSupport, 'Strong Support', '#059669', 0);
    }

    // Satisfy 60 K-bars visible requirement: "Ｋ線圖預設使用60根K棒，例如日線圖就是60日K棒"
    const timeScale = chart.timeScale();
    const visibleCount = Math.min(60, candles.length);
    timeScale.setVisibleLogicalRange({
      from: candles.length - visibleCount,
      to: candles.length + (activeProjection !== 'none' ? 12 : 1),
    });

    // F. Interactive hover markers logic (Satisfies auto-hide and pointer-events constraints)
    const hoverTooltip = document.createElement('div');
    hoverTooltip.className = 'chart-hover-tooltip';
    hoverTooltip.style.position = 'absolute';
    hoverTooltip.style.display = 'none';
    hoverTooltip.style.padding = '6px 10px';
    hoverTooltip.style.background = 'rgba(15, 23, 42, 0.95)';
    hoverTooltip.style.border = '1px solid rgba(148, 163, 184, 0.15)';
    hoverTooltip.style.borderRadius = '6px';
    hoverTooltip.style.color = '#e2e8f0';
    hoverTooltip.style.fontFamily = 'Inter, sans-serif';
    hoverTooltip.style.fontSize = '12px';
    hoverTooltip.style.zIndex = '100';
    hoverTooltip.style.pointerEvents = 'none'; // CRITICAL: blocks pointer-events to prevent mouseleave bugs!
    hoverTooltip.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.5)';
    container.appendChild(hoverTooltip);

    const crosshairListener = (param: any) => {
      if (!param.time || !param.point) {
        hoverTooltip.style.display = 'none';
        return;
      }

      const candle = candles.find(c => c.time === param.time);
      if (candle) {
        const isUp = candle.close >= candle.open;
        hoverTooltip.style.display = 'block';
        hoverTooltip.style.left = `${param.point.x + 15}px`;
        hoverTooltip.style.top = `${param.point.y + 15}px`;
        hoverTooltip.style.borderColor = isUp ? '#10b981' : '#ef4444';
        hoverTooltip.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 2px;">${candle.time}</div>
          <div style="display: grid; grid-template-columns: auto auto; gap: x-4; column-gap: 8px;">
            <span>開盤:</span> <span style="text-align: right;">${candle.open.toFixed(2)}</span>
            <span>收盤:</span> <span style="text-align: right; font-weight:600; color:${isUp ? '#10b981' : '#ef4444'}">${candle.close.toFixed(2)}</span>
            <span>最高:</span> <span style="text-align: right;">${candle.high.toFixed(2)}</span>
            <span>最低:</span> <span style="text-align: right;">${candle.low.toFixed(2)}</span>
            <span>成交量:</span> <span style="text-align: right; color:#fbbf24">${formatCompactNumber(candle.volume)}</span>
          </div>
        `;
      } else {
        hoverTooltip.style.display = 'none';
      }
    };

    chart.subscribeCrosshairMove(crosshairListener);

    const mouseLeaveListener = () => {
      hoverTooltip.style.display = 'none';
    };
    container.addEventListener('mouseleave', mouseLeaveListener);

    // G. Sizing & Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.resize(width, height || initialHeight);
    });
    resizeObserver.observe(container);

    // Clean up
    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.unsubscribeCrosshairMove(crosshairListener);
        chartRef.current.remove();
        chartRef.current = null;
      }
      container.removeEventListener('mouseleave', mouseLeaveListener);
      if (hoverTooltip.parentNode) {
        hoverTooltip.parentNode.removeChild(hoverTooltip);
      }
    };
  }, [candles, levels, bullishStrategy, bearishStrategy, isPipOverlayEnabled, activeProjection]);

  // 2. Control Visibility of Volume overlay
  useEffect(() => {
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.applyOptions({
        visible: isVolumeEnabled,
      });
    }
  }, [isVolumeEnabled]);

  // 3. Subchart Rendering Logic (RSI or Standardized PIP)
  useEffect(() => {
    if (!subchartContainerRef.current || candles.length === 0 || subchartType === 'none') {
      if (subchartRef.current) {
        subchartRef.current.remove();
        subchartRef.current = null;
      }
      return;
    }

    const container = subchartContainerRef.current;
    
    // Explicit sizing for subchart to prevent mobile collapse
    let subHeight = 150;
    if (window.innerWidth <= 768) {
      subHeight = 120;
    }

    const subchart = createChart(container, {
      width: container.clientWidth || 800,
      height: subHeight,
      layout: {
        background: { type: 'solid', color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(51, 65, 85, 0.2)' },
        horzLines: { color: 'rgba(51, 65, 85, 0.2)' },
      },
      crosshair: {
        mode: 1 // Normal
      },
      rightPriceScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        minimumWidth: 80,
      },
      timeScale: {
        borderColor: 'rgba(51, 65, 85, 0.5)',
        timeVisible: true,
        rightOffset: 12,
      },
    });

    subchartRef.current = subchart;

    // A. Setup Subchart Data
    if (subchartType === 'rsi') {
      // Calculate 14-period RSI
      const rsiValues: LineData[] = [];
      const period = 14;
      let gains = 0;
      let losses = 0;

      for (let i = 1; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (i <= period) {
          if (diff > 0) gains += diff;
          else losses -= diff;

          if (i === period) {
            let avgGain = gains / period;
            let avgLoss = losses / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsi = 100 - 100 / (1 + rs);
            rsiValues.push({ time: candles[i].time as string, value: rsi });
          }
        } else {
          const avgGain = (gains * (period - 1) + (diff > 0 ? diff : 0)) / period;
          const avgLoss = (losses * (period - 1) + (diff < 0 ? -diff : 0)) / period;
          gains = avgGain * period;
          losses = avgLoss * period;

          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          const rsi = 100 - 100 / (1 + rs);
          rsiValues.push({ time: candles[i].time as string, value: rsi });
        }
      }

      const rsiSeries = subchart.addSeries(LineSeries, {
        color: '#a855f7', // Tailwind purple-500
        lineWidth: 2,
        priceLineVisible: false,
      });
      rsiSeries.setData(rsiValues);
      subchartSeriesRef.current = rsiSeries;

      // Add RSI Overbought (70) and Oversold (30) levels
      rsiSeries.createPriceLine({
        price: 70,
        color: 'rgba(239, 68, 68, 0.4)',
        lineWidth: 1,
        lineStyle: 1,
        title: 'Overbought (70)',
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: 'rgba(16, 185, 129, 0.4)',
        lineWidth: 1,
        lineStyle: 1,
        title: 'Oversold (30)',
      });

    } else if (subchartType === 'pip') {
      // Calculate PIP Z-scores
      const logPrices = candles.map(c => Math.log10(c.close));
      const mean = logPrices.reduce((a, b) => a + b, 0) / logPrices.length;
      const std = Math.sqrt(logPrices.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / logPrices.length) || 1;

      const pipSeries = subchart.addSeries(LineSeries, {
        color: '#fbbf24', // Tailwind amber-400
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'volume', // custom format to show decimal numbers cleanly
          precision: 2,
        }
      });
      subchartSeriesRef.current = pipSeries;

      const pips = findPIPs(candles);
      const pipData: LineData[] = candles.map(c => {
        const stdY = (Math.log10(c.close) - mean) / std;
        return {
          time: c.time as string,
          value: stdY,
        };
      });
      pipSeries.setData(pipData);


      // Add Z-score standard bounds lines
      pipSeries.createPriceLine({
        price: 1.5,
        color: 'rgba(239, 68, 68, 0.3)',
        lineWidth: 1,
        lineStyle: 2,
        title: '+1.5 Sigma',
      });
      pipSeries.createPriceLine({
        price: 0,
        color: 'rgba(148, 163, 184, 0.2)',
        lineWidth: 1,
        lineStyle: 1,
      });
      pipSeries.createPriceLine({
        price: -1.5,
        color: 'rgba(16, 185, 129, 0.3)',
        lineWidth: 1,
        lineStyle: 2,
        title: '-1.5 Sigma',
      });

      // Render tactical markers
      const tacticalMarkers = pips.map(p => {
        const isHigh = p.type === 'high';
        return {
          time: p.time as string,
          position: 'inBar' as 'inBar',
          color: isHigh ? '#f87171' : '#34d399',
          shape: 'circle' as 'circle',
          text: '', // Kept empty to satisfy auto-hide/not-blocking vision
        };
      });
      createSeriesMarkers(pipSeries, tacticalMarkers);
    }

    // B. Synchronization Listeners between Candlestick and Subchart
    const mainChart = chartRef.current;
    if (mainChart) {
      // Sync timescales
      const mainTimeScale = mainChart.timeScale();
      const subTimeScale = subchart.timeScale();

      const mainRangeListener = (range: any) => {
        if (isSyncingRef.current || !range) return;
        isSyncingRef.current = true;
        subTimeScale.setVisibleLogicalRange(range);
        isSyncingRef.current = false;
      };

      const subRangeListener = (range: any) => {
        if (isSyncingRef.current || !range) return;
        isSyncingRef.current = true;
        mainTimeScale.setVisibleLogicalRange(range);
        isSyncingRef.current = false;
      };

      mainTimeScale.subscribeVisibleLogicalRangeChange(mainRangeListener);
      subTimeScale.subscribeVisibleLogicalRangeChange(subRangeListener);

      // Sync visible logical ranges immediately on load
      const currentLogicalRange = mainTimeScale.getVisibleLogicalRange();
      if (currentLogicalRange) {
        subTimeScale.setVisibleLogicalRange(currentLogicalRange);
      }

      // Sync crosshair tracking
      const mainCrossListener = (param: any) => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        if (!param || !param.time) {
          subchart.clearCrosshairPosition();
        } else if (subchartSeriesRef.current) {
          subchart.setCrosshairPosition(0, param.time, subchartSeriesRef.current);
        }
        isSyncingRef.current = false;
      };

      const subCrossListener = (param: any) => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        if (!param || !param.time) {
          mainChart.clearCrosshairPosition();
        } else if (candlestickSeriesRef.current) {
          mainChart.setCrosshairPosition(0, param.time, candlestickSeriesRef.current);
        }
        isSyncingRef.current = false;
      };

      mainChart.subscribeCrosshairMove(mainCrossListener);
      subchart.subscribeCrosshairMove(subCrossListener);

      // Save references for cleanup
      (subchart as any)._cleanupSync = () => {
        mainTimeScale.unsubscribeVisibleLogicalRangeChange(mainRangeListener);
        subTimeScale.unsubscribeVisibleLogicalRangeChange(subRangeListener);
        mainChart.unsubscribeCrosshairMove(mainCrossListener);
        subchart.unsubscribeCrosshairMove(subCrossListener);
      };
    }

    // C. Resize Observer for Subchart
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !subchartRef.current) return;
      const { width } = entries[0].contentRect;
      subchartRef.current.resize(width, subHeight);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (subchartRef.current) {
        if ((subchartRef.current as any)._cleanupSync) {
          (subchartRef.current as any)._cleanupSync();
        }
        subchartRef.current.remove();
        subchartRef.current = null;
      }
    };

  }, [subchartType, candles]);

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Chart Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-300">副圖指標:</span>
          <button
            onClick={() => setSubchartType('none')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer ${
              subchartType === 'none'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            無
          </button>
          <button
            onClick={() => setSubchartType('rsi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer ${
              subchartType === 'rsi'
                ? 'bg-purple-600/30 text-purple-200 border-purple-500/50'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            RSI 強弱指標
          </button>
          <button
            onClick={() => setSubchartType('pip')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer ${
              subchartType === 'pip'
                ? 'bg-amber-600/30 text-amber-200 border-amber-500/50'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            PIP 戰術形態 (Z-Score)
          </button>
        </div>

        {/* Projection Switcher */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-300">路徑預測:</span>
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => onProjectionChange('none')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeProjection === 'none'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              關閉
            </button>
            <button
              onClick={() => onProjectionChange('bullish')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeProjection === 'bullish'
                  ? 'bg-yellow-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              多頭路徑 (黃)
            </button>
            <button
              onClick={() => onProjectionChange('bearish')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeProjection === 'bearish'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              空頭路徑 (綠)
            </button>
          </div>
        </div>
      </div>

      {/* Main Candlestick Chart */}
      <div className="relative w-full rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl shadow-slate-950/20">
        <div
          ref={containerRef}
          className="w-full h-[280px] sm:h-[350px] md:h-[420px]"
        />

        {/* Subchart rendering area */}
        {subchartType !== 'none' && (
          <div className="w-full border-t border-slate-800/80 bg-slate-950/20 p-2">
            <div
              ref={subchartContainerRef}
              className="w-full h-[120px] sm:h-[150px]"
            />
          </div>
        )}

        {/* Dynamic Watermark Indicator */}
        <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-1 z-10 select-none">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-wider text-slate-100">{cleanTwTicker(ticker)}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase font-semibold">1D 日線圖</span>
          </div>
          {isPipOverlayEnabled && (
            <div className="text-xs text-amber-400 flex items-center gap-1 font-medium bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              PIP 戰術形態辨識已啟用 (60根K棒)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
