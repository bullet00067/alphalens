import React from 'react';
import { StrategyCondition } from '../types/trading';

interface RiskControlTableProps {
  bullish: StrategyCondition;
  bearish: StrategyCondition;
}

export const RiskControlTable: React.FC<RiskControlTableProps> = ({ bullish, bearish }) => {
  
  // Parse numeric trigger entry price from entry range string (e.g. "585 - 590" -> 585)
  const parseEntryPrice = (rangeStr: string): number => {
    if (!rangeStr) return 0;
    const match = rangeStr.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
  };

  const calculateRR = (strategy: StrategyCondition, isBullish: boolean): { rr: number; label: string } => {
    const entry = parseEntryPrice(strategy.entryRange);
    const sl = strategy.stopLoss;
    const target1 = strategy.targets[0] || 0;

    if (entry <= 0 || sl <= 0 || target1 <= 0) {
      return { rr: 0, label: 'N/A' };
    }

    let risk = 0;
    let reward = 0;

    if (isBullish) {
      risk = entry - sl;
      reward = target1 - entry;
    } else {
      risk = sl - entry;
      reward = entry - target1;
    }

    if (risk <= 0) {
      return { rr: 99, label: '極高比率 (>10)' };
    }

    const ratio = reward / risk;
    return {
      rr: ratio,
      label: `${ratio.toFixed(1)} : 1`
    };
  };

  const renderRow = (strategy: StrategyCondition, isBullish: boolean) => {
    const { rr, label } = calculateRR(strategy, isBullish);
    const entry = parseEntryPrice(strategy.entryRange);
    
    // High contrast badges: >= 2:1 gets high contrast emerald border, otherwise amber or slate
    const badgeStyle = rr >= 2
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-black animate-pulse'
      : rr >= 1.5
        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold'
        : 'bg-slate-800 text-slate-400 border border-slate-700';

    return (
      <tr className="border-b border-slate-800/60 hover:bg-slate-950/20 transition-colors last:border-b-0">
        <td className="px-6 py-4.5 whitespace-nowrap text-left">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isBullish ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-sm font-bold text-slate-200">
              {isBullish ? '多頭策略方案' : '空頭策略方案'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4.5 whitespace-nowrap text-slate-300 font-semibold font-mono text-sm text-left">
          {strategy.entryRange}
        </td>
        <td className="px-6 py-4.5 whitespace-nowrap text-rose-400 font-bold font-mono text-sm text-left">
          {strategy.stopLoss.toFixed(2)}
        </td>
        <td className="px-6 py-4.5 whitespace-nowrap text-left">
          <div className="flex items-center gap-1.5 flex-wrap">
            {strategy.targets.map((t, i) => (
              <span key={i} className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
                T{i + 1}: {t.toFixed(2)}
              </span>
            ))}
          </div>
        </td>
        <td className="px-6 py-4.5 whitespace-nowrap text-left">
          <span className={`text-xs px-3 py-1 rounded-full uppercase tracking-wider ${badgeStyle}`}>
            {label}
          </span>
        </td>
        <td className="px-6 py-4.5 text-left text-xs font-medium text-slate-400 leading-normal max-w-xs truncate">
          {strategy.exitStrategies.takeProfit}
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl w-full">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400">
            <i className="fa-solid fa-calculator"></i>
          </span>
          <h3 className="text-lg font-bold text-slate-200">策略風控與盈虧比評估</h3>
        </div>
        <div className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
          目標盈虧比建議 &ge; 2:1
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/20">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                策略方案
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                進場價格/區間
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                停損價格
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                目標價格 (Target 1/2)
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                預估盈虧比 (R:R Ratio)
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                出場停利說明
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-transparent">
            {renderRow(bullish, true)}
            {renderRow(bearish, false)}
          </tbody>
        </table>
      </div>
    </div>
  );
};
