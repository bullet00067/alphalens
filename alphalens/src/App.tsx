import React, { useState, useEffect } from 'react';
import { TradingPlanData, KeyLevels, TrendDiagnosis, StrategyCondition } from './types/trading';
import { DashboardHeader } from './components/DashboardHeader';
import { TradingChart } from './components/TradingChart';
import { TrendAndLevels } from './components/TrendAndLevels';
import { StrategyBoard } from './components/StrategyBoard';
import { RiskControlTable } from './components/RiskControlTable';
import { MarketDashboard } from './components/MarketDashboard';
import { DecisionAssistant } from './components/DecisionAssistant';
import {
  isTaiwanStock,
  resolveTicker,
  cleanTwTicker,
  fetchStockHistoryCached,
  getTaiwanStockName,
  getQuickQuote
} from './utils/api';
import { findPIPs, analyzeTrend, generatePIPSignal } from './utils/strategyEngine';

// Pre-defined plans
const PREDEFINED_PLANS: Record<string, TradingPlanData> = {
  '3680.TWO': {
    ticker: '3680.TWO',
    name: '家登',
    date: new Date().toLocaleDateString(),
    trend: {
      status: '多頭格局，短線突破回測',
      position: '回測上升趨勢線與前高支撐',
      conclusion: '回測 527 不破可於進場區間佈局多單，突破 585 加碼'
    },
    levels: {
      resistance2: 623,
      resistance1: 585,
      currentPrice: 585,
      support1: 527,
      support2: 468,
      strongSupport: 372
    },
    bullishStrategy: {
      condition: '突破 585 壓力站穩，成交量放大至 1.3 倍以上買進',
      entryRange: '585 - 592',
      stopLoss: 527,
      targets: [623, 700],
      exitStrategies: {
        takeProfit: '到達目標一 623 減碼一半，目標二 700 全出',
        trailingStop: '跌破 5MA 出場',
        timeExit: '5 日內未脫離成本區出場',
        reversalExit: '出現高檔爆量長上影線反轉訊號'
      }
    },
    bearishStrategy: {
      condition: '跌破 527 支撐，或於 585 壓力遇阻衰竭做空',
      entryRange: '520 - 527',
      stopLoss: 550,
      targets: [468, 372],
      exitStrategies: {
        takeProfit: '到達目標一 468 回補一半，目標二 372 全出',
        trailingStop: '突破 10MA 回補',
        timeExit: '3 日內未向下脫離成本區回補',
        reversalExit: '出現低檔爆量長下影線止跌訊號'
      }
    },
    confidence: 85
  },
  '3680': {
    ticker: '3680.TWO',
    name: '家登',
    date: new Date().toLocaleDateString(),
    trend: {
      status: '多頭格局，短線突破回測',
      position: '回測上升趨勢線與前高支撐',
      conclusion: '回測 527 不破可於進場區間佈局多單，突破 585 加碼'
    },
    levels: {
      resistance2: 623,
      resistance1: 585,
      currentPrice: 585,
      support1: 527,
      support2: 468,
      strongSupport: 372
    },
    bullishStrategy: {
      condition: '突破 585 壓力站穩，成交量放大至 1.3 倍以上買進',
      entryRange: '585 - 592',
      stopLoss: 527,
      targets: [623, 700],
      exitStrategies: {
        takeProfit: '到達目標一 623 減碼一半，目標二 700 全出',
        trailingStop: '跌破 5MA 出場',
        timeExit: '5 日內未脫離成本區出場',
        reversalExit: '出現高檔爆量長上影線反轉訊號'
      }
    },
    bearishStrategy: {
      condition: '跌破 527 支撐，或於 585 壓力遇阻衰竭做空',
      entryRange: '520 - 527',
      stopLoss: 550,
      targets: [468, 372],
      exitStrategies: {
        takeProfit: '到達目標一 468 回補一半，目標二 372 全出',
        trailingStop: '突破 10MA 回補',
        timeExit: '3 日內未向下脫離成本區回補',
        reversalExit: '出現低檔爆量長下影線止跌訊號'
      }
    },
    confidence: 85
  },
  '3481': {
    ticker: '8299.TWO',
    name: '群聯',
    date: new Date().toLocaleDateString(),
    trend: {
      status: '多頭格局，拉回測試均線',
      position: '回檔至季線與前低支撐帶',
      conclusion: '等待 540 支撐帶打底訊號，守住可分批佈局'
    },
    levels: {
      resistance2: 640,
      resistance1: 590,
      currentPrice: 540,
      support1: 540,
      support2: 495,
      strongSupport: 420
    },
    bullishStrategy: {
      condition: '回測 540 支撐有守，出現日線層級止跌紅K買進',
      entryRange: '540 - 550',
      stopLoss: 495,
      targets: [590, 640],
      exitStrategies: {
        takeProfit: '到達目標一 590 減碼，目標二 640 全出',
        trailingStop: '跌破 10MA 出場',
        timeExit: '4 日內未脫離成本區出場',
        reversalExit: '出現爆量長上影線或跌破關鍵支撐出場'
      }
    },
    bearishStrategy: {
      condition: '反彈遇阻 590 壓力衰竭，或有效跌破 540 支撐做空',
      entryRange: '530 - 540',
      stopLoss: 565,
      targets: [495, 420],
      exitStrategies: {
        takeProfit: '到達目標一 495 回補，目標二 420 全出',
        trailingStop: '突破 5MA 回補',
        timeExit: '3 日內未向下脫離成本區回補',
        reversalExit: '出現大成交量長下影線針狀K線止跌回補'
      }
    },
    confidence: 78
  },
  '8299.TWO': {
    ticker: '8299.TWO',
    name: '群聯',
    date: new Date().toLocaleDateString(),
    trend: {
      status: '多頭格局，拉回測試均線',
      position: '回檔至季線與前低支撐帶',
      conclusion: '等待 540 支撐帶打底訊號，守住可分批佈局'
    },
    levels: {
      resistance2: 640,
      resistance1: 590,
      currentPrice: 540,
      support1: 540,
      support2: 495,
      strongSupport: 420
    },
    bullishStrategy: {
      condition: '回測 540 支撐有守，出現日線層級止跌紅K買進',
      entryRange: '540 - 550',
      stopLoss: 495,
      targets: [590, 640],
      exitStrategies: {
        takeProfit: '到達目標一 590 減碼，目標二 640 全出',
        trailingStop: '跌破 10MA 出場',
        timeExit: '4 日內未脫離成本區出場',
        reversalExit: '出現爆量長上影線或跌破關鍵支撐出場'
      }
    },
    bearishStrategy: {
      condition: '反彈遇阻 590 壓力衰竭，或有效跌破 540 支撐做空',
      entryRange: '530 - 540',
      stopLoss: 565,
      targets: [495, 420],
      exitStrategies: {
        takeProfit: '到達目標一 495 回補，目標二 420 全出',
        trailingStop: '突破 5MA 回補',
        timeExit: '3 日內未向下脫離成本區回補',
        reversalExit: '出現大成交量長下影線針狀K線止跌回補'
      }
    },
    confidence: 78
  }
};

export const App: React.FC = () => {
  // Global View tab state: 'dashboard' | 'detail' | 'assistant'
  const [activeView, setActiveView] = useState<'dashboard' | 'detail' | 'assistant'>('dashboard');

  // Watchlist Tickers State
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const cached = localStorage.getItem('myWatchlist');
    return cached ? JSON.parse(cached) : ['2330.TW', '2317.TW', '3680.TWO', '8299.TWO', 'AAPL'];
  });

  // Active detail stock info
  const [currentTicker, setCurrentTicker] = useState('3680.TWO');
  const [currentPlan, setCurrentPlan] = useState<TradingPlanData>(PREDEFINED_PLANS['3680.TWO']);
  const [stockHistory, setStockHistory] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Layout features: theme and overlay controls
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [isPipOverlayEnabled, setIsPipOverlayEnabled] = useState(true);
  const [isVolumeEnabled, setIsVolumeEnabled] = useState(true);
  const [activeProjection, setActiveProjection] = useState<'none' | 'bullish' | 'bearish'>('none');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('myWatchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Fetch full details of target ticker when ticker state updates
  useEffect(() => {
    let active = true;
    const loadStockDetails = async () => {
      setLoadingDetail(true);
      setActiveProjection('none'); // Reset active projection

      try {
        const resolved = resolveTicker(currentTicker);
        const suffix = isTaiwanStock(resolved) && !resolved.includes('.') ? `${resolved}.TW` : resolved;
        const normalized = suffix.toUpperCase();

        // 1. If it's a predefined plan, load the core specifications out-of-the-box
        const cleanSym = cleanTwTicker(normalized);
        let plan = PREDEFINED_PLANS[cleanSym] || PREDEFINED_PLANS[normalized];

        // 2. Fetch candle data and quotes
        const result = await fetchStockHistoryCached(normalized, '1day');
        if (!active || !result) return;

        setStockHistory(result);

        const currentPrice = result.quote.c;

        if (plan) {
          // Preset plans will just dynamically update the current Price
          const updatedPlan = {
            ...plan,
            levels: {
              ...plan.levels,
              currentPrice
            }
          };
          setCurrentPlan(updatedPlan);
        } else {
          // Dynamic calculation: parse PIPs and auto-diagnose trend
          const pips = findPIPs(result.candles);
          const trendRes = analyzeTrend(pips, result.candles);

          // Find peaks & troughs to calculate support & resistance
          const peaks = pips.filter(p => p.type === 'high').map(p => p.value).sort((a, b) => b - a);
          const troughs = pips.filter(p => p.type === 'low').map(p => p.value).sort((a, b) => a - b);

          const r1 = peaks[0] || currentPrice * 1.05;
          const r2 = peaks[1] || r1 * 1.05;
          const s1 = troughs[0] || currentPrice * 0.95;
          const s2 = troughs[1] || s1 * 0.95;

          const trendDiag: TrendDiagnosis = {
            status: trendRes.status === 'BULLISH' ? '多頭格局，走勢偏強' : trendRes.status === 'BEARISH' ? '空頭格局，震盪築底' : '區間震盪，方向確認中',
            position: '處於中高檔震盪區間',
            conclusion: `支撐落在 ${s1.toFixed(1)}，壓力落在 ${r1.toFixed(1)}，建議區間操作。`
          };

          const levels: KeyLevels = {
            resistance2: r2,
            resistance1: r1,
            currentPrice,
            support1: s1,
            support2: s2
          };

          const bullishStrategy: StrategyCondition = {
            condition: `突破壓力一 $${r1.toFixed(1)} 站穩確立買進`,
            entryRange: `${r1.toFixed(1)} - ${(r1 * 1.02).toFixed(1)}`,
            stopLoss: s1,
            targets: [r2, r2 * 1.1],
            exitStrategies: {
              takeProfit: '目標一減碼，目標二全出',
              trailingStop: '跌破 5MA 出場',
              timeExit: '3 日內未脫離成本區出場'
            }
          };

          const bearishStrategy: StrategyCondition = {
            condition: `跌破支撐一 $${s1.toFixed(1)} 弱勢追空`,
            entryRange: `${(s1 * 0.98).toFixed(1)} - ${s1.toFixed(1)}`,
            stopLoss: r1,
            targets: [s2, s2 * 0.9],
            exitStrategies: {
              takeProfit: '目標一回補，目標二全出',
              trailingStop: '突破 10MA 回補',
              timeExit: '3 日內未脫離成本區出場'
            }
          };

          setCurrentPlan({
            ticker: normalized,
            name: result.profile.name || cleanTwTicker(normalized),
            date: new Date().toLocaleDateString(),
            trend: trendDiag,
            levels,
            bullishStrategy,
            bearishStrategy,
            confidence: Math.round(trendRes.confidence * 100)
          });
        }
      } catch (err) {
        console.error("Failed to load details for " + currentTicker, err);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadStockDetails();
    return () => {
      active = false;
    };
  }, [currentTicker]);

  const handleSearch = (tickerSym: string) => {
    setCurrentTicker(tickerSym);
    setActiveView('detail');
  };

  const handleAddWatchlist = (tickerSym: string) => {
    const resolved = resolveTicker(tickerSym);
    const suffix = isTaiwanStock(resolved) && !resolved.includes('.') ? `${resolved}.TW` : resolved;
    const normalized = suffix.toUpperCase();
    if (!watchlist.includes(normalized)) {
      setWatchlist(prev => [...prev, normalized]);
    }
  };

  const handleRemoveWatchlist = (tickerSym: string) => {
    setWatchlist(prev => prev.filter(t => t !== tickerSym));
  };

  const handleSelectTicker = (tickerSym: string) => {
    setCurrentTicker(tickerSym);
    setActiveView('detail');
  };

  const toggleObserve = () => {
    const resolved = resolveTicker(currentPlan.ticker);
    const suffix = isTaiwanStock(resolved) && !resolved.includes('.') ? `${resolved}.TW` : resolved;
    const normalized = suffix.toUpperCase();
    if (watchlist.includes(normalized)) {
      setWatchlist(prev => prev.filter(t => t !== normalized));
    } else {
      setWatchlist(prev => [...prev, normalized]);
    }
  };

  return (
    <div className={`flex min-h-screen ${isDarkTheme ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors duration-300 font-sans`}>
      {/* Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={`sidebar fixed inset-y-0 left-0 w-64 bg-slate-950/85 backdrop-blur-md border-r border-slate-900 z-50 transform lg:transform-none transition-transform duration-300 flex flex-col justify-between ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col">
          {/* Logo Area */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-900">
            <span className="flex items-center justify-center w-9 h-9 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/35">
              <i className="fa-solid fa-chart-line text-lg"></i>
            </span>
            <span className="text-lg font-black tracking-wider text-white">AlphaLens</span>
          </div>

          {/* Nav Links */}
          <ul className="flex flex-col gap-1.5 px-4 py-6 m-0 list-none text-left">
            <li>
              <button
                onClick={() => {
                  setActiveView('dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer border-0 text-left ${
                  activeView === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <i className="fa-solid fa-square-poll-vertical text-base"></i>
                <span>市場大盤 & 自選</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveView('detail');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer border-0 text-left ${
                  activeView === 'detail'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <i className="fa-solid fa-map-location-dot text-base"></i>
                <span>交易計畫儀表板</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setActiveView('assistant');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer border-0 text-left ${
                  activeView === 'assistant'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <i className="fa-solid fa-robot text-base"></i>
                <span>AI 決策助理</span>
              </button>
            </li>
          </ul>
        </div>

        {/* User profile footer area */}
        <div className="p-4 border-t border-slate-900/80 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-extrabold text-sm">
              BI
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-slate-200">Bullet Investor</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Premium Account</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top bar for mobile menu toggle */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-900 z-35">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-slate-400 hover:text-slate-200 cursor-pointer p-1"
          >
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
          <span className="text-base font-black text-white">AlphaLens</span>
          <div className="w-6"></div> {/* spacer */}
        </header>

        {/* Inner View Container */}
        <main className="flex-1 p-4 md:p-6 flex flex-col gap-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeView === 'dashboard' && (
            <MarketDashboard
              watchlist={watchlist}
              onAddWatchlist={handleAddWatchlist}
              onRemoveWatchlist={handleRemoveWatchlist}
              onSelectTicker={handleSelectTicker}
            />
          )}

          {activeView === 'detail' && (
            <div className="flex flex-col gap-6 w-full">
              {/* Header block with stock details */}
              <DashboardHeader
                ticker={currentPlan.ticker}
                name={currentPlan.name}
                price={currentPlan.levels.currentPrice}
                change={stockHistory ? stockHistory.quote.d : 0}
                changePercent={stockHistory ? stockHistory.quote.dp : 0}
                marketCap={stockHistory ? stockHistory.profile.marketCapitalization : null}
                isObserved={watchlist.includes(currentPlan.ticker)}
                onToggleObserve={toggleObserve}
                onSearch={handleSearch}
                isDarkTheme={isDarkTheme}
                onToggleTheme={() => setIsDarkTheme(prev => !prev)}
              />

              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-500 animate-spin"></i>
                  <span className="text-sm text-slate-400 font-bold">交易計畫載入中...</span>
                </div>
              ) : (
                /* Primary Details Dashboard Layout Grid */
                /* Mobile: 1 Column, Desktop: Left (Chart, S/R, Strategy) Right (AI, Risk) */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Left Main column (2/3 width on large screens) */}
                  <div className="lg:col-span-2 flex flex-col gap-6 w-full">
                    {/* Primary Technical Indicator and path visualization chart */}
                    {stockHistory && (
                      <TradingChart
                        ticker={currentPlan.ticker}
                        candles={stockHistory.candles}
                        levels={currentPlan.levels}
                        bullishStrategy={currentPlan.bullishStrategy}
                        bearishStrategy={currentPlan.bearishStrategy}
                        isPipOverlayEnabled={isPipOverlayEnabled}
                        isVolumeEnabled={isVolumeEnabled}
                        activeProjection={activeProjection}
                        onProjectionChange={setActiveProjection}
                      />
                    )}

                    {/* Chart visual controls panel */}
                    <div className="flex flex-wrap gap-4 items-center p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">形態重疊:</span>
                        <button
                          onClick={() => setIsPipOverlayEnabled(p => !p)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            isPipOverlayEnabled
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-transparent text-slate-500 border-slate-800'
                          }`}
                        >
                          PIP 戰術線條
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">指標開關:</span>
                        <button
                          onClick={() => setIsVolumeEnabled(v => !v)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            isVolumeEnabled
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                              : 'bg-transparent text-slate-500 border-slate-800'
                          }`}
                        >
                          成交量圖
                        </button>
                      </div>
                    </div>

                    {/* Trend Diagnosis analysis & color coded key levels */}
                    <TrendAndLevels
                      levels={currentPlan.levels}
                      trend={currentPlan.trend}
                      ticker={currentPlan.ticker}
                    />

                    {/* Strategy Board: Bullish and Bearish side by side comparisons */}
                    <StrategyBoard
                      bullish={currentPlan.bullishStrategy}
                      bearish={currentPlan.bearishStrategy}
                      ticker={currentPlan.ticker}
                    />
                  </div>

                  {/* Right Sidebar Column (1/3 width on large screens) */}
                  <div className="flex flex-col gap-6 w-full">
                    {/* Risk Control Table assessment details */}
                    <RiskControlTable
                      bullish={currentPlan.bullishStrategy}
                      bearish={currentPlan.bearishStrategy}
                    />

                    {/* Decision AI Chat Assistant tool */}
                    <DecisionAssistant
                      ticker={currentPlan.ticker}
                      tickerName={currentPlan.name}
                      trend={currentPlan.trend}
                      levels={currentPlan.levels}
                      watchlist={watchlist}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeView === 'assistant' && (
            <div className="w-full max-w-4xl mx-auto py-4">
              <DecisionAssistant
                ticker={currentPlan.ticker}
                tickerName={currentPlan.name}
                trend={currentPlan.trend}
                levels={currentPlan.levels}
                watchlist={watchlist}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
