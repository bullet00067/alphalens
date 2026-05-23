import React from 'react';
import { StrategyCondition } from '../types/trading';

interface StrategyBoardProps {
  bullish: StrategyCondition;
  bearish: StrategyCondition;
  ticker: string;
}

export const StrategyBoard: React.FC<StrategyBoardProps> = ({ bullish, bearish, ticker }) => {
  const formatPrice = (p: number) => {
    return p.toFixed(2);
  };

  const renderStrategyCard = (
    strategy: StrategyCondition,
    isBullish: boolean
  ) => {
    const themeColor = isBullish ? 'emerald' : 'rose';
    const title = isBullish ? '多頭策略 (BULLISH)' : '空頭策略 (BEARISH)';
    const cardBorder = isBullish ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-rose-500';
    const entryLabel = isBullish ? '買進進場區間' : '做空進場區間';
    const targetLabel = isBullish ? '獲利目標' : '回補目標';

    return (
      <div className={`flex flex-col p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl ${cardBorder} transition-all duration-300 hover:translate-y-[-2px]`}>
        {/* Title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`flex items-center justify-center w-8 h-8 rounded-xl ${
              isBullish ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}>
              <i className={`fa-solid ${isBullish ? 'fa-circle-arrow-up' : 'fa-circle-arrow-down'}`}></i>
            </span>
            <h3 className="text-base font-black text-slate-200 tracking-wide uppercase">{title}</h3>
          </div>
        </div>

        {/* Condition description */}
        <div className="mb-5 p-3 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-left">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block mb-1">
            觸發條件
          </span>
          <p className="text-sm font-semibold text-slate-200 leading-relaxed">
            {strategy.condition}
          </p>
        </div>

        {/* Entry / StopLoss / Targets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {/* Entry Range */}
          <div className="flex flex-col p-3 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-left">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
              {entryLabel}
            </span>
            <span className={`text-base font-extrabold font-mono ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
              {strategy.entryRange}
            </span>
          </div>

          {/* Stop Loss */}
          <div className="flex flex-col p-3 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-left">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
              停損價位
            </span>
            <span className="text-base font-extrabold font-mono text-rose-400">
              {formatPrice(strategy.stopLoss)}
            </span>
          </div>

          {/* Targets */}
          <div className="flex flex-col p-3 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-left">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
              {targetLabel}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {strategy.targets.map((t, idx) => (
                <span
                  key={idx}
                  className={`text-sm font-extrabold font-mono px-2 py-0.5 rounded ${
                    isBullish
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  T{idx + 1}: {formatPrice(t)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 4D Exit strategies */}
        <div className="flex flex-col text-left">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">
            四維防守/出場計畫
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Take Profit */}
            <div className="flex gap-2.5 p-3 rounded-2xl bg-slate-950/20 border border-slate-900/80">
              <span className="text-sm text-emerald-400 mt-0.5"><i className="fa-solid fa-square-check"></i></span>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-bold">1. 停利出場 (TP)</span>
                <span className="text-xs font-semibold text-slate-300 leading-normal mt-0.5">{strategy.exitStrategies.takeProfit}</span>
              </div>
            </div>

            {/* Trailing Stop */}
            <div className="flex gap-2.5 p-3 rounded-2xl bg-slate-950/20 border border-slate-900/80">
              <span className="text-sm text-yellow-400 mt-0.5"><i className="fa-solid fa-arrow-trend-down"></i></span>
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-bold">2. 移動停利 (Trailing)</span>
                <span className="text-xs font-semibold text-slate-300 leading-normal mt-0.5">{strategy.exitStrategies.trailingStop}</span>
              </div>
            </div>

            {/* Time Exit */}
            {strategy.exitStrategies.timeExit && (
              <div className="flex gap-2.5 p-3 rounded-2xl bg-slate-950/20 border border-slate-900/80">
                <span className="text-sm text-sky-400 mt-0.5"><i className="fa-solid fa-hourglass-half"></i></span>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-bold">3. 時間停損/出場 (Time)</span>
                  <span className="text-xs font-semibold text-slate-300 leading-normal mt-0.5">{strategy.exitStrategies.timeExit}</span>
                </div>
              </div>
            )}

            {/* Reversal Exit */}
            {strategy.exitStrategies.reversalExit && (
              <div className="flex gap-2.5 p-3 rounded-2xl bg-slate-950/20 border border-slate-900/80">
                <span className="text-sm text-rose-400 mt-0.5"><i className="fa-solid fa-triangle-exclamation"></i></span>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-bold">4. 形態反轉出場 (Reversal)</span>
                  <span className="text-xs font-semibold text-slate-300 leading-normal mt-0.5">{strategy.exitStrategies.reversalExit}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
      {renderStrategyCard(bullish, true)}
      {renderStrategyCard(bearish, false)}
    </div>
  );
};
