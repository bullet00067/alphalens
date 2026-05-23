import React from 'react';
import { StrategyCondition } from '../types/trading';

interface RiskControlTableProps {
  bullish: StrategyCondition;
  bearish: StrategyCondition;
}

export const RiskControlTable: React.FC<RiskControlTableProps> = ({ bullish, bearish }) => {
  const [capital, setCapital] = React.useState<number>(1000000);
  const [riskPercent, setRiskPercent] = React.useState<number>(1.0);
  
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
    const sl = strategy.stopLoss;
    
    // Calculate suggested shares based on risk formula:
    // Risk per share = Math.abs(entry - stopLoss)
    // Total risk capital = capital * (riskPercent / 100)
    // Suggested shares = Total risk capital / Risk per share
    const riskPerShare = Math.abs(entry - sl);
    const totalRiskCapital = capital * (riskPercent / 100);
    const suggestedShares = riskPerShare > 0 ? Math.floor(totalRiskCapital / riskPerShare) : 0;
    
    // Format suggested shares to "張 + 股"
    const suggestedText = suggestedShares > 0
      ? suggestedShares >= 1000
        ? `${Math.floor(suggestedShares / 1000)} 張 ${suggestedShares % 1000} 股`
        : `${suggestedShares} 股`
      : '0 股';

    const maxLossText = `最大虧損限制: $${Math.round(totalRiskCapital).toLocaleString()}`;
    
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
        <td className="px-6 py-4.5 whitespace-nowrap text-left">
          <div className="flex flex-col">
            <span className="text-sm font-black font-mono text-amber-400">
              {suggestedText}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              ({suggestedShares.toLocaleString()} 股 / {maxLossText})
            </span>
          </div>
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

      {/* Capital Allocation & Risk Parameters Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4.5 rounded-2xl bg-slate-950/40 border border-slate-850/60">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <i className="fa-solid fa-wallet text-amber-500"></i>
            交易帳戶總資金 (TWD)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm font-semibold">$</span>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono text-sm font-bold focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
              placeholder="請輸入總資金"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <i className="fa-solid fa-triangle-exclamation text-rose-500"></i>
            單筆交易最大承受風險 (%)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-mono text-sm font-bold focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
              placeholder="例如 1.0"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm font-semibold">%</span>
          </div>
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
                建議交易量 (Shares)
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
