import React, { useState, useEffect } from 'react';
import { StrategyCondition } from '../types/trading';

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

// Transaction cost parameters (Taiwan Market Standard)
// Buy Fee: 0.1425% * 0.6 = ~0.0855%
// Sell Fee: 0.1425% * 0.6 = ~0.0855%
// Securities Transaction Tax (Sell): 0.3%
const BUY_FEE_RATE = 0.001425 * 0.6;
const SELL_FEE_RATE = 0.001425 * 0.6;
const SELL_TAX_RATE = 0.003;

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

  // PnL calculation function
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

    // Real Taiwan fees
    const buyFee = buyValue * BUY_FEE_RATE;
    const sellFee = sellValue * SELL_FEE_RATE;
    const sellTax = sellValue * SELL_TAX_RATE;
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

  // Tactical Advisory logic
  const getTacticalAdvisory = () => {
    if (cost <= 0 || shares <= 0) {
      return {
        title: '請輸入持股與成本',
        action: '輸入您的實際庫存股數與成本價，系統將自動啟動動態風控與利潤階梯試算。',
        color: 'text-slate-400',
        bg: 'bg-slate-800/40 border-slate-700'
      };
    }

    if (direction === 'LONG') {
      if (currentPrice >= target1) {
        return {
          title: '已突破目標一！啟動波段鎖利',
          action: `現價已達目標一 $${target1.toFixed(1)}，強烈建議分批獲利出清 50% 鎖住 NT$${(viewMode === 'NET' ? tp1Partial.netNTD : tp1Partial.grossNTD).toLocaleString()}，並將移動停損線上調至成本價 $${cost} 保本！`,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30'
        };
      } else if (currentPrice > cost * 1.05) {
        return {
          title: '獲利擴大中：推進保本線',
          action: `目前浮盈 +${currentPnL.pct}%，利潤空間已拉開。建議將停損由 $${stopLoss.toFixed(1)} 逐步推進至 $${(cost * 1.01).toFixed(1)}，確保這筆交易立於不敗之地！`,
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/10 border-indigo-500/30'
        };
      } else if (currentPrice < stopLoss) {
        return {
          title: '觸發破線停損警報！',
          action: `現價跌破關鍵停損線 $${stopLoss.toFixed(1)}，虧損已達 ${currentPnL.pct}%！切勿盲目凹單，請依交易計畫嚴格執行防守停損平倉。`,
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/30'
        };
      } else if (currentPrice < cost) {
        const gapToSL = ((currentPrice - stopLoss) / currentPrice) * 100;
        return {
          title: '拉回防守觀察期',
          action: `目前回檔浮虧 ${currentPnL.pct}%，距離停損防守線尚有 ${gapToSL.toFixed(1)}% 緩衝空間。嚴格以 $${stopLoss.toFixed(1)} 為底線，未跌破前可耐心觀察。`,
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/30'
        };
      } else {
        return {
          title: '多頭成本區整固',
          action: `股價在買進成本附近震盪。若帶量突破 $${(cost * 1.03).toFixed(1)} 可放手持股，目標看第一階段停利點 $${target1.toFixed(1)}。`,
          color: 'text-blue-400',
          bg: 'bg-blue-500/10 border-blue-500/30'
        };
      }
    } else {
      // SHORT direction
      if (currentPrice <= target1) {
        return {
          title: '已達回補目標一！建議部分回補',
          action: `空單已達第一目標價 $${target1.toFixed(1)}，建議回補 50% 股數鎖定 NT$${(viewMode === 'NET' ? tp1Partial.netNTD : tp1Partial.grossNTD).toLocaleString()} 獲利，剩餘空單防守點下移至成本價 $${cost}。`,
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30'
        };
      } else if (currentPrice > stopLoss) {
        return {
          title: '空單觸發停損警戒！',
          action: `股價反彈突破空單停損線 $${stopLoss.toFixed(1)}，空單虧損已達 ${currentPnL.pct}%！請立即執行融券回補停損以防軋空。`,
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/30'
        };
      } else {
        return {
          title: '空頭趨勢推進中',
          action: `空單浮盈中 (+${currentPnL.pct}%)，目標看波段回補點 $${target1.toFixed(1)}，防守點看 $${stopLoss.toFixed(1)}。`,
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/10 border-indigo-500/30'
        };
      }
    }
  };

  const advisory = getTacticalAdvisory();

  // Progress Bar Position (SL -> Cost -> TP1 -> TP2)
  const calculateProgress = () => {
    if (cost <= 0) return 50;
    const minVal = Math.min(stopLoss, currentPrice, cost);
    const maxVal = Math.max(target2, currentPrice, cost);
    if (maxVal === minVal) return 50;
    const pct = ((currentPrice - minVal) / (maxVal - minVal)) * 100;
    return Math.min(100, Math.max(0, pct));
  };

  const progressPct = calculateProgress();

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
          <button
            type="button"
            onClick={() => setViewMode(prev => prev === 'NET' ? 'GROSS' : 'NET')}
            title="切換純價差毛損益 vs 扣除手續費證交稅之淨損益"
            className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              viewMode === 'NET'
                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {viewMode === 'NET' ? '淨額 (扣稅費)' : '毛額 (純價差)'}
          </button>
        </div>
      </div>

      {/* 2. Position Inputs Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
        {/* Shares input with quick buttons */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>持有股數</span>
            <div className="flex gap-1">
              {[1000, 2000, 5000].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSharesInput(cnt.toString())}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition-colors cursor-pointer"
                >
                  {cnt / 1000}張
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex items-center">
            <input
              type="number"
              value={sharesInput}
              onChange={(e) => setSharesInput(e.target.value)}
              placeholder="如: 1000"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 transition-all"
            />
            <span className="absolute right-3 text-xs text-slate-500 font-bold">
              {shares >= 1000 ? `${(shares / 1000).toFixed(1)} 張` : '股'}
            </span>
          </div>
        </div>

        {/* Cost input with quick 'use current price' */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>平均買進成本</span>
            <button
              type="button"
              onClick={() => setCostInput(currentPrice.toString())}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              填入現價 ($ {currentPrice.toFixed(1)})
            </button>
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs text-slate-500 font-bold">$</span>
            <input
              type="number"
              step="0.1"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              placeholder="每股平均成本"
              className="w-full pl-7 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="md:col-span-2 flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>投入總本金:</span>
            <strong className="text-slate-200">
              $ {Math.round(cost * shares).toLocaleString()}
            </strong>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
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
                目前未實現損益 ({viewMode === 'NET' ? '預估淨額' : '毛額'})
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  isCurrentPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {isCurrentPositive ? '+' : ''}$ {(viewMode === 'NET' ? currentPnL.netNTD : currentPnL.grossNTD).toLocaleString()}
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
                目前現價: <strong className="text-slate-200 font-mono font-bold">$ {currentPrice.toFixed(1)}</strong>
              </span>
              <span className="text-xs text-slate-400 font-medium">
                買進成本: <strong className="text-slate-200 font-mono font-bold">$ {cost.toFixed(1)}</strong>
              </span>
            </div>
          </div>

          {/* Visual Progress Range (SL - Cost - Current - TP1 - TP2) */}
          <div className="flex flex-col gap-1.5 px-1">
            <div className="flex justify-between text-[10px] font-bold text-slate-400">
              <span className="text-rose-400">停損 $ {stopLoss.toFixed(1)}</span>
              <span className="text-slate-400">成本 $ {cost.toFixed(1)}</span>
              <span className="text-indigo-400">目標一 $ {target1.toFixed(1)}</span>
              <span className="text-emerald-400">目標二 $ {target2.toFixed(1)}</span>
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
            ({viewMode === 'NET' ? '已扣除 0.1425% 手續費與 0.3% 證券交易稅' : '純價差毛損益'})
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
                  $ {target1.toFixed(1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：建議達到時分批減碼 50%，入袋鎖利
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:text-right">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  全出: +$ {(viewMode === 'NET' ? tp1Full.netNTD : tp1Full.grossNTD).toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  (獲利 {viewMode === 'NET' ? tp1Full.netPct : tp1Full.pct}%)
                </span>
              </div>
              <div className="h-6 w-[1px] bg-slate-800"></div>
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-indigo-400">
                  出50%: +$ {(viewMode === 'NET' ? tp1Partial.netNTD : tp1Partial.grossNTD).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">分批出清 50%</span>
              </div>
            </div>
          </div>

          {/* Target 2 Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-slate-200">
                  {direction === 'LONG' ? '第二獲利目標 (TP2)' : '第二回補目標 (Cover 2)'}
                </strong>
                <span className="text-xs text-emerald-400 font-mono font-bold ml-2">
                  $ {target2.toFixed(1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：波段波幅延伸，目標達標全數出清
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:text-right">
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  全出: +$ {(viewMode === 'NET' ? tp2Full.netNTD : tp2Full.grossNTD).toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  (獲利 {viewMode === 'NET' ? tp2Full.netPct : tp2Full.pct}%)
                </span>
              </div>
              <div className="h-6 w-[1px] bg-slate-800"></div>
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  階梯總計: +$ {(viewMode === 'NET' ? stagedTotalNetNTD : stagedTotalGrossNTD).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">分批50/50總獲利</span>
              </div>
            </div>
          </div>

          {/* Trailing Stop / Chandelier Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-slate-200">
                  移動鎖利線 (Chandelier Exit)
                </strong>
                <span className="text-xs text-amber-400 font-mono font-bold ml-2">
                  $ {trailingStopPrice.toFixed(1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：跌破此線出場以鎖住波段利潤
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:text-right">
              <span className={`text-xs font-mono font-bold ${
                trailingPnL.netNTD >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {trailingPnL.netNTD >= 0 ? '+' : ''}$ {(viewMode === 'NET' ? trailingPnL.netNTD : trailingPnL.grossNTD).toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({trailingPnL.netNTD >= 0 ? '+' : ''}{viewMode === 'NET' ? trailingPnL.netPct : trailingPnL.pct}%)
              </span>
            </div>
          </div>

          {/* Stop Loss Row */}
          <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40 transition-colors bg-rose-500/5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
              <div>
                <strong className="text-sm font-bold text-rose-300">
                  {direction === 'LONG' ? '關鍵停損防守價 (Stop Loss)' : '放空回補停損價 (Stop Loss)'}
                </strong>
                <span className="text-xs text-rose-400 font-mono font-bold ml-2">
                  $ {stopLoss.toFixed(1)}
                </span>
                <p className="text-[11px] text-slate-400 m-0">
                  策略指引：有效破線請堅決停損，嚴禁凹單
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:text-right">
              <span className="text-xs font-mono font-bold text-rose-400">
                預估最大虧損: $ {(viewMode === 'NET' ? slPnL.netNTD : slPnL.grossNTD).toLocaleString()}
              </span>
              <span className="text-[11px] text-rose-400/80 font-mono font-bold">
                (虧損率 {viewMode === 'NET' ? slPnL.netPct : slPnL.pct}%)
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
