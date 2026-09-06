import React, { useState } from 'react';
import { formatCurrency, searchStockSuggestions, resolveTicker } from '../utils/api';

interface DashboardHeaderProps {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  isObserved: boolean;
  onToggleObserve: () => void;
  onSearch: (ticker: string) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  ticker,
  name,
  price,
  change,
  changePercent,
  marketCap,
  isObserved,
  onToggleObserve,
  onSearch,
  isDarkTheme,
  onToggleTheme
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const resolved = resolveTicker(searchInput.trim());
      onSearch(resolved);
      setShowDropdown(false);
      setSearchInput('');
    }
  };

  const handleAutocompleteClick = (tickerSym: string) => {
    const resolved = resolveTicker(tickerSym);
    onSearch(resolved);
    setSearchInput('');
    setShowDropdown(false);
  };

  // Dynamic autocomplete results using multi-match searchStockSuggestions
  const searchSuggestions = searchStockSuggestions(searchInput);

  const isPositive = change >= 0;

  return (
    <header className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 md:p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-lg">
      {/* Left Area: Search & Ticker Details */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
        {/* Search Input Container */}
        <form onSubmit={handleSubmit} className="relative w-full md:w-84">
          <div className="relative flex items-center">
            {/* Clickable Search Button */}
            <button
              type="submit"
              title="執行搜尋"
              className="absolute left-1.5 p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50 transition-colors cursor-pointer border-0 flex items-center justify-center z-10"
            >
              <i className="fa-solid fa-magnifying-glass text-sm"></i>
            </button>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
              placeholder="搜尋代號或名稱 (如: 6196, 帆宣, 8299)"
              className="w-full pl-11 pr-10 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 text-slate-500 hover:text-slate-300 cursor-pointer p-1 text-xs"
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && (searchSuggestions.length > 0 || searchInput.trim().length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-900">
              {searchSuggestions.map((item) => (
                <button
                  key={`${item.ticker}-${item.name}`}
                  type="button"
                  onMouseDown={() => handleAutocompleteClick(item.ticker)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-900 transition-colors cursor-pointer group"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200 text-sm group-hover:text-indigo-300 transition-colors">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">點擊切換計畫與分析</span>
                  </div>
                  <span className="text-xs text-indigo-400 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    {item.ticker}
                  </span>
                </button>
              ))}

              {/* Direct query submit option */}
              {searchInput.trim() && (
                <button
                  type="button"
                  onMouseDown={() => handleSubmit({ preventDefault: () => {} } as any)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>直接搜尋代號/名稱："{searchInput.trim()}"</span>
                  <i className="fa-solid fa-arrow-turn-down fa-rotate-90"></i>
                </button>
              )}
            </div>
          )}
        </form>

        {/* Dynamic Quote & Ticker Summary details */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {name}
              <span className="text-xs font-mono font-normal px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                {ticker}
              </span>
            </h1>
          </div>

          <div className="h-6 w-[1px] bg-slate-800 hidden md:block" />

          {/* Price details */}
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {price > 0 ? price.toFixed(2) : '--'}
            </span>
            <span
              className={`text-sm font-bold flex items-center gap-1 ${
                isPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              <i className={`fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
              {change > 0 ? `+${change.toFixed(2)}` : change.toFixed(2)} ({changePercent > 0 ? `+${changePercent.toFixed(2)}` : changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Right Area: Market Cap & Watchlist toggler */}
      <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
        {marketCap && (
          <div className="flex flex-col text-left md:text-right">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              預估台股總市值
            </span>
            <span className="text-sm font-bold text-slate-200">
              {formatCurrency(marketCap, ticker)} 百萬
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Observation Toggle Button */}
          <button
            onClick={onToggleObserve}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all duration-300 ${
              isObserved
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-transparent text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <i className={`fa-solid ${isObserved ? 'fa-star text-amber-400' : 'fa-star'}`}></i>
            <span>{isObserved ? '觀察中' : '加入觀察'}</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 bg-transparent transition-colors cursor-pointer"
            aria-label="Toggle Theme"
          >
            <i className={`fa-solid ${isDarkTheme ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>
      </div>
    </header>
  );
};
