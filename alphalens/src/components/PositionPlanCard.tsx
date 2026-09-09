import React, { useState, useEffect } from 'react';
import { StrategyCondition } from '../types/trading';
import {
  getMarketFriction,
  getTacticalDefenseAndAdvice,
  calculateDirectionalProgress
} from '../utils/tradingValidators';

interface PositionPlanCardProps {
  ticker: string;
  name: string;
  currentPrice: number;
  bullishStrategy: StrategyCondition;
  bearishStrategy: StrategyCondition;
}

interface StoredPosition {
  qty: number;
  cost: number;
  direction: 'LONG' | 'SHORT';
}

export const PositionPlanCard: React.FC<PositionPlanCardProps> = ({
  ticker,
  name,
  currentPrice,
  bullishStrategy,
  bearishStrategy
}) => {
  // Read / write positions from localStorage by ticker
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [sharesInput, setSharesInput] = useState<string>('1000');
  const [costInput, setCostInput] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'NET' | 'GROSS'>('NET');

  // Load market friction (TW vs US)
  const friction = getMarketFriction(ticker);
  const sym = friction.currencySymbol;

  // Safe number formatter
  const fmt = (val: number | undefined | null, dec = 1): string => {
    if (typeof val !== 'number' || isNaN(val)) return '--';
    return val.toFixed(dec);
  };

  // Load saved position whenever ticker changes
  useEffect(() => {
    const raw = localStorage.getItem('myPositions');
    if (raw) {
      try {
        const parsed: Record<string, StoredPosition> = JSON.parse(raw);
        if (parsed[ticker]) {
          const pos = parsed[ticker];
          setDirection(pos.direction || 'LONG');
          setSharesInput(pos.qty ? pos.qty.toString() : '1000');
          setCostInput(pos.cost ? pos.cost.toString() : currentPrice.toString());
          setIsSaved(true);
          return;
        }
      } catch (e) {
        console.error("Error reading myPositions:", e);
      }
    }
    // Default if not saved
    setDirection('LONG');
    setSharesInput('1000');
    setCostInput(currentPrice > 0 ? currentPrice.toString() : '');
    setIsSaved(false);
  }, [ticker, currentPrice]);

  // Parse numeric values
  const shares = Math.max(0, parseInt(sharesInput) || 0);
  const cost = Math.max(0, parseFloat(costInput) || 0);

  // Save changes to localStorage
  const handleSave = () => {
    const raw = localStorage.getItem('myPositions');
    let parsed: Record<string, StoredPosition> = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch (e) {}
    }
    parsed[ticker] = {
      qty: shares,
      cost,
      direction
    };
    localStorage.setItem('myPositions', JSON.stringify(parsed));
    setIsSaved(true);
  };

  const handleClear = () => {
    const raw = localStorage.getItem('myPositions');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        delete parsed[ticker];
        localStorage.setItem('myPositions', JSON.stringify(parsed));
      } catch (e) {}
    }
    setSharesInput('0');
    setCostInput('');
    setIsSaved(false);
  };

  // Select appropriate strategy targets according to direction
  const activeStrategy = direction === 'LONG' ? bullishStrategy : bearishStrategy;
  const target1 = activeStrategy.targets[0] || (direction === 'LONG' ? currentPrice * 1.08 : currentPrice * 0.92);
  const target2 = activeStrategy.targets[1] || (direction === 'LONG' ? currentPrice * 1.15 : currentPrice * 0.85);
  const stopLoss = activeStrategy.stopLoss || (direction === 'LONG' ? currentPrice * 0.93 : currentPrice * 1.07);

  // Parse Chandelier trailing stop price if mentioned in string
  let trailingStopPrice = direction === 'LONG' ? currentPrice * 0.97 : currentPrice * 1.03;
  const trailingMatch = activeStrategy.exitStrategies?.trailingStop?.match(/\$([0-9.]+)/);
  if (trailingMatch) {
    trailingStopPrice = parseFloat(trailingMatch[1]);
  }

  // PnL calculation function with market-specific friction
  const calcPnL = (exitPrice: number, targetShares: number) => {
    if (cost <= 0 || targetShares <= 0 || exitPrice <= 0) {
      return { grossNTD: 0, netNTD: 0, pct: 0, netPct: 0 };
    }

    const buyValue = cost * targetShares;
    const sellValue = exitPrice * targetShares;

    let priceDiff = 0;
    if (direction === 'LONG') {
      priceDiff = exitPrice - cost;
    } else {
      priceDiff = cost - exitPrice;
    }

    const grossNTD = priceDiff * targetShares;
    const grossPct = (priceDiff / cost) * 100;

    // Accurate market friction (TW broker 60% fee + 0.3% tax; US 0% fee + 0% tax)
    const buyFee = buyValue * friction.buyFeeRate;
    const sellFee = sellValue * friction.sellFeeRate;
    const sellTax = sellValue * friction.sellTaxRate;
    const totalFees = buyFee + sellFee + sellTax;

    const netNTD = grossNTD - totalFees;
    const netPct = (netNTD / buyValue) * 100;

    return {
      grossNTD: Math.round(grossNTD),
      netNTD: Math.round(netNTD),
      pct: Number(grossPct.toFixed(2)),
      netPct: Number(netPct.toFixed(2))
    };
  };

  // Current PnL
  const currentPnL = calcPnL(currentPrice, shares);
  const isCurrentPositive = currentPnL.netNTD >= 0;

  // Scenario 1: TP1 full exit vs partial 50%
  const tp1Full = calcPnL(target1, shares);
  const tp1Partial = calcPnL(target1, Math.floor(shares * 0.5));

  // Scenario 2: TP2 full exit vs remaining 50%
  const tp2Full = calcPnL(target2, shares);
  const tp2Partial = calcPnL(target2, Math.ceil(shares * 0.5));
  // Blended 50/50 Strategy Total
  const stagedTotalNetNTD = tp1Partial.netNTD + tp2Partial.netNTD;
  const stagedTotalGrossNTD = tp1Partial.grossNTD + tp2Partial.grossNTD;

  // Scenario 3: Stop Loss exit
  const slPnL = calcPnL(stopLoss, shares);

  // Scenario 4: Trailing stop exit
  const trailingPnL = calcPnL(trailingStopPrice, shares);

  // Tactical Advisory logic using domain invariant validator
  const advisory = getTacticalDefenseAndAdvice({
    ticker,
    direction,
    currentPrice,
    cost,
    shares,
    target1,
    target2,
    strategyStopLoss: stopLoss,
    trailingStopPrice,
    viewMode,
    pnlNet: currentPnL.netNTD,
    pnlGross: currentPnL.grossNTD,
    pnlPct: currentPnL.pct,
    tp1PartialGain: viewMode === 'NET' ? tp1Partial.netNTD : tp1Partial.grossNTD
  });

  // Progress Bar Position (Direction-aware)
  const progressPct = calculateDirectionalProgress(
    direction,
    currentPrice,
    cost,
    stopLoss,
    target2
  );

  const totalCapital = cost * shares;

  return (
    <div className="flex flex-col p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl gap-5">
      {/* 1. Header with Title and Mode Toggles */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400">
            <i className="fa-solid fa-calculator"></i>
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              個人持倉與動態情境計畫
              {isSaved && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  已儲存
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              自訂股數與成本，結合 AI 停利與停損即時試算情境收益
            </p>
          </div>
        </div>

        {/* Direction & Net/Gross Toggle */}
        <div className="flex items-center gap-2">
          {/* Long / Short Switch */}
          <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setDirection('LONG')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                direction === 'LONG'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              多單持有
            </button>
            <button
              type="button"
              onClick={() => setDirection('SHORT')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                direction === 'SHORT'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              空單融券
            </button>
          </div>

          {/* Net / Gross Switch */}
          <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('NET')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'NET'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={friction.isTaiwan ? "扣除手續費(6折)與證券交易稅0.3%" : "美股主流零手續費與零證交稅標準"}
            >
              預估淨額
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GROSS')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'GROSS'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="純價差毛損益"
            >
              純毛額
            </button>
          </div>
        </div>
      </div>

      {/* 2. Position Inputs Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
        {/* Shares Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 flex justify-between">
            <span>目前持有股數</span>
            <span className="text-slate-500 font-normal">
              {friction.isTaiwan ? `(${shares > 0 ? (shares / 1000).toFixed(1) : 0} 張)` : `(${shares} 股)`}
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={sharesInput}
              onChange={(e) => {
                setSharesInput(e.target.value);
                setIsSaved(false);
              }}
              placeholder="例如: 1000"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <span className="absolute right-3 top-2 text-xs font-bold text-slate-500 pointer-events-none">
              股
            </span>
          </div>

          {/* Quick Buttons */}
          <div className="flex gap-1.5 mt-1">
            {friction.isTaiwan ? (
              <>
                <button
                  type="button"
                  onClick={() => { setSharesInput('1000'); setIsSaved(false); }}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-400 cursor-pointer"
                >
                  1張
                </button>
                <button
                  type="button"
                  onClick={() => { setSharesInput('2000'); setIsSaved(false); }}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-400 cursor-pointer"
                >
                  2張
                </button>
                <button
                  type="button"
                  onClick={() => { setSharesInput('5000'); setIsSaved(false); }}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-400 cursor-pointer"
                >
                  5張
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setSharesInput('10'); setIsSaved(false); }}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-400 cursor-pointer"
                >
                  10股
                </button>
                <button
                  type="button"
                  onClick={() => { setSharesInput('50'); setIsSaved(false); }}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-400 cursor-pointer"
                >
                  50股
                </button>
                <button
                  type="button"
                  onClick={() => { setSharesInput('100'); setIsSaved(false); }}
                  className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-400 cursor-pointer"
                >
                  100股
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                const cur = parseInt(sharesInput) || 0;
                setSharesInput((cur + (friction.isTaiwan ? 1000 : 10)).toString());
                setIsSaved(false);
              }}
              className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-400 cursor-pointer"
            >
              {friction.isTaiwan ? '+1張' : '+10股'}
            </button>
          </div>
        </div>

        {/* Cost Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 flex justify-between">
            <span>買進平均成本</span>
            <span className="text-indigo-400 font-mono text-[11px]">
              現價: {sym} {fmt(currentPrice, 1)}
            </span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.1"
              value={costInput}
              onChange={(e) => {
                setCostInput(e.target.value);
                setIsSaved(false);
              }}
              placeholder={`例如: ${fmt(currentPrice, 1)}`}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <span className="absolute right-3 top-2 text-xs font-bold text-slate-500 pointer-events-none">
              元
            </span>
          </div>

          <div className="flex items-center justify-between mt-1">
            <button
              type="button"
              onClick={() => {
                if (currentPrice > 0) {
                  setCostInput(currentPrice.toFixed(1));
                  setIsSaved(false);
                }
              }}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              填入現價
            </button>

            <span className="text-[11px] text-slate-500">
              投入總本金: <strong className="text-slate-300 font-mono font-bold">{sym} {totalCapital.toLocaleString()}</strong>
            </span>
          </div>

          {/* Action Buttons: Clear & Save */}
          <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-800/60">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              清空
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
            >
              儲存此標的設定
            </button>
          </div>
        </div>
      </div>

      {/* 3. Real-time Status Card & PnL Bar */}
      {cost > 0 && shares > 0 && (
        <div className="flex flex-col gap-3">
          {/* Current PnL Banner */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isCurrentPositive
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                目前未實現損益 ({viewMode === 'NET' ? (friction.isTaiwan ? '預估淨額' : '淨額') : '毛額'})
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  isCurrentPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isCurrentPositive ? '+' : ''}{sym} {(viewMode === 'NET' ? currentPnL.netNTD : currentPnL.grossNTD).toLocaleString()}
                </span>
                <span className={`text-sm font-bold font-mono ${
                  isCurrentPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  ({isCurrentPositive ? '+' : ''}{viewMode === 'NET' ? currentPnL.netPct : currentPnL.pct}%)
                </span>
              </div>
            </div>

            <div className="flex flex-col text-left sm:text-right">
              <span className="text-xs text-slate-400 font-medium">
                目前現價: <strong className="text-slate-200 font-mono font-bold">{sym} {fmt(currentPrice, 1)}</strong>
              </span>
              <span className="text-xs text-slate-400 font-medium">
                買進成本: <strong className="text-slate-200 font-mono font-bold">{sym} {fmt(cost, 1)}</strong>
              </span>
            </div>
          </div>

          {/* Visual Progress Range (SL - Cost - Current - TP1 - TP2) */}
          <div className="flex flex-col gap-1.5 px-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-400">
              <span className="text-rose-400">{direction === 'LONG' ? '停損' : '壓力'} {sym} {fmt(stopLoss, 1)}</span>
              <span className="text-slate-400">成本 {sym} {fmt(cost, 1)}</span>
              <span className="text-indigo-400">{direction === 'LONG' ? '目標一' : '回補一'} {sym} {fmt(target1, 1)}</span>
              <span className="text-emerald-400">{direction === 'LONG' ? '目標二' : '回補二'} {sym} {fmt(target2, 1)}</span>
            </div>
            <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isCurrentPositive ? 'bg-gradient-to-r from-indigo-500 to-emerald-400' : 'bg-rose-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Strategic Target & Stop Matrix Table */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>建議價位損益試算矩陣</span>
          <span className="text-[10px] font-normal text-slate-500 lowercase">
            ({viewMode === 'NET' ? (friction.isTaiwan ? '已扣除台股手續費(6折)與 0.3% 證交稅' : '美股主流零佣金與零證交稅標準') : '純價差毛損益'})
          </span>
        </h4>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 divide-y divide-slate-800/80">
          {/* Target 1 Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-slate-200">
                  {direction === 'LONG' ? '第一獲利目標 (TP1)' : '第一回補目標 (Cover 1)'}
                </strong>
                <span className="text-xs text-indigo-400 font-mono font-bold ml-2">
                  {sym} {fmt(target1, 1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：建議達到時分批減碼 50%，入袋鎖利
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:text-right">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  全出: +{sym} {(viewMode === 'NET' ? tp1Full.netNTD : tp1Full.grossNTD).toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  半數分批: +{sym} {(viewMode === 'NET' ? tp1Partial.netNTD : tp1Partial.grossNTD).toLocaleString()}
                </span>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                +{viewMode === 'NET' ? tp1Full.netPct : tp1Full.pct}%
              </span>
            </div>
          </div>

          {/* Target 2 Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-slate-200">
                  {direction === 'LONG' ? '第二延伸目標 (TP2)' : '第二延伸回補 (Cover 2)'}
                </strong>
                <span className="text-xs text-emerald-400 font-mono font-bold ml-2">
                  {sym} {fmt(target2, 1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：波段主升段滿足區，建議全數出清
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:text-right">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  全出: +{sym} {(viewMode === 'NET' ? tp2Full.netNTD : tp2Full.grossNTD).toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  剩餘半數: +{sym} {(viewMode === 'NET' ? tp2Partial.netNTD : tp2Partial.grossNTD).toLocaleString()}
                </span>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                +{viewMode === 'NET' ? tp2Full.netPct : tp2Full.pct}%
              </span>
            </div>
          </div>

          {/* 50%/50% Ladder Summary Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-amber-300">
                  50% TP1 + 50% TP2 階梯獲利總結
                </strong>
                <p className="text-[11px] text-slate-400 m-0">
                  一半在第一目標獲利入袋，剩餘一半讓利潤奔馳至第二目標
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:text-right">
              <span className="text-sm font-mono font-black text-amber-300">
                預估總獲利: +{sym} {(viewMode === 'NET' ? stagedTotalNetNTD : stagedTotalGrossNTD).toLocaleString()}
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                +{(totalCapital > 0 ? ((viewMode === 'NET' ? stagedTotalNetNTD : stagedTotalGrossNTD) / totalCapital * 100).toFixed(2) : 0)}%
              </span>
            </div>
          </div>

          {/* Chandelier Trailing Stop Protection Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-slate-200">
                  Chandelier 吊燈移動停利 (鎖利防守線)
                </strong>
                <span className="text-xs text-cyan-400 font-mono font-bold ml-2">
                  {sym} {fmt(trailingStopPrice, 1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：動態跟蹤最高價回撤，保護既有獲利不回吐
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:text-right">
              <span className={`text-xs font-mono font-bold ${trailingPnL.netNTD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {trailingPnL.netNTD >= 0 ? '+' : ''}{sym} {(viewMode === 'NET' ? trailingPnL.netNTD : trailingPnL.grossNTD).toLocaleString()}
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                trailingPnL.netNTD >= 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {trailingPnL.netNTD >= 0 ? '+' : ''}{viewMode === 'NET' ? trailingPnL.netPct : trailingPnL.pct}%
              </span>
            </div>
          </div>

          {/* Stop Loss Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors bg-rose-500/5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-rose-300">
                  {direction === 'LONG' ? '關鍵結構停損防守價 (Stop Loss)' : '放空回補防守價 (Stop Loss)'}
                </strong>
                <span className="text-xs text-rose-400 font-mono font-bold ml-2">
                  {sym} {fmt(stopLoss, 1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：有效破線請堅決停損/鎖利，嚴禁盲目凹單
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:text-right">
              <span className={`text-xs font-mono font-bold ${slPnL.netNTD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {slPnL.netNTD >= 0 ? '跌破退場仍鎖利' : '預估最大虧損'}: {slPnL.netNTD >= 0 ? '+' : ''}{sym} {(viewMode === 'NET' ? slPnL.netNTD : slPnL.grossNTD).toLocaleString()}
              </span>
              <span className={`text-[11px] font-mono font-bold ${slPnL.netNTD >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                ({slPnL.netNTD >= 0 ? '鎖定獲利率' : '虧損率'} {slPnL.netNTD >= 0 ? '+' : ''}{viewMode === 'NET' ? slPnL.netPct : slPnL.pct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Real-time Tactical Action Advisory */}
      <div className={`p-4 rounded-2xl border flex flex-col gap-1.5 transition-all ${advisory.bg}`}>
        <div className="flex items-center gap-2">
          <i className={`fa-solid fa-lightbulb ${advisory.color}`}></i>
          <span className={`text-xs font-extrabold uppercase tracking-wider ${advisory.color}`}>
            AlphaLens 即時戰術指引：{advisory.title}
          </span>
        </div>
        <p className="text-xs text-slate-200 font-medium leading-relaxed m-0">
          {advisory.action}
        </p>
      </div>
    </div>
  );
};
