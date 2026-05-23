import React from 'react';
import { KeyLevels, TrendDiagnosis } from '../types/trading';

interface TrendAndLevelsProps {
  levels: KeyLevels;
  trend: TrendDiagnosis;
  ticker: string;
}

export const TrendAndLevels: React.FC<TrendAndLevelsProps> = ({ levels, trend, ticker }) => {
  // Format numbers nicely
  const formatPrice = (p: number) => {
    return p.toFixed(2);
  };

  const getTrendBadgeColor = (status: string) => {
    if (status.includes('多頭') || status.includes('上漲') || status.includes('突破')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (status.includes('空頭') || status.includes('下跌') || status.includes('跌破')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* 1. Trend Diagnosis Card */}
      <div className="flex flex-col p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl justify-between">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400">
              <i className="fa-solid fa-chart-pie"></i>
            </span>
            <h3 className="text-lg font-bold text-slate-200">趨勢診斷分析</h3>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase ${getTrendBadgeColor(trend.status)}`}>
            {trend.status || '中性格局'}
          </span>
        </div>

        <div className="flex flex-col gap-5 flex-1 justify-center">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              當前位置
            </span>
            <p className="text-sm font-semibold text-slate-200 leading-relaxed">
              {trend.position || '確認中...'}
            </p>
          </div>

          <div className="h-[1px] bg-slate-800/60" />

          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              操作結論
            </span>
            <p className="text-sm font-semibold text-slate-300 leading-relaxed">
              {trend.conclusion || '觀望為主，靜待趨勢明朗。'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Key Levels Card */}
      <div className="flex flex-col p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-pink-500/10 text-pink-400">
            <i className="fa-solid fa-layer-group"></i>
          </span>
          <h3 className="text-lg font-bold text-slate-200">多空關鍵價位</h3>
        </div>

        <div className="flex flex-col gap-2">
          {/* Resistance 2 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/25 transition-all">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span className="text-sm font-semibold text-rose-300">壓力二 (R2)</span>
            </div>
            <span className="text-base font-bold font-mono text-rose-400">
              {formatPrice(levels.resistance2)}
            </span>
          </div>

          {/* Resistance 1 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/25 transition-all">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="text-sm font-semibold text-rose-300">壓力一 (R1)</span>
            </div>
            <span className="text-base font-bold font-mono text-rose-400">
              {formatPrice(levels.resistance1)}
            </span>
          </div>

          {/* Current Price (Glowing active center) */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center gap-2 relative z-10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-sm font-extrabold text-slate-100 uppercase tracking-wide">
                當前市價
              </span>
            </div>
            <span className="text-lg font-black font-mono text-indigo-400 relative z-10 animate-pulse">
              {formatPrice(levels.currentPrice)}
            </span>
          </div>

          {/* Support 1 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/25 transition-all">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-300">支撐一 (S1)</span>
            </div>
            <span className="text-base font-bold font-mono text-emerald-400">
              {formatPrice(levels.support1)}
            </span>
          </div>

          {/* Support 2 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/25 transition-all">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">支撐二 (S2)</span>
            </div>
            <span className="text-base font-bold font-mono text-emerald-400">
              {formatPrice(levels.support2)}
            </span>
          </div>

          {/* Strong Support */}
          {levels.strongSupport && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-teal-500/5 border border-teal-500/10 hover:border-teal-500/25 transition-all">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-sm font-semibold text-teal-300">強支撐價位</span>
              </div>
              <span className="text-base font-bold font-mono text-teal-400">
                {formatPrice(levels.strongSupport)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
