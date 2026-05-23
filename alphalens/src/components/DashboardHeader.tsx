import React, { useState } from 'react';
import { formatCurrency, TW_NAME_MAP } from '../utils/api';

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
      onSearch(searchInput.trim().toUpperCase());
      setShowDropdown(false);
    }
  };

  const handleAutocompleteClick = (tickerSym: string) => {
    onSearch(tickerSym);
    setSearchInput('');
    setShowDropdown(false);
  };

  // Filter autocomplete results based on search input
  const searchSuggestions = searchInput.trim()
    ? Object.entries(TW_NAME_MAP).filter(
        ([n, sym]) =>
          n.toLowerCase().includes(searchInput.toLowerCase()) ||
          sym.toLowerCase().includes(searchInput.toLowerCase())
      )
    : [];

  const isPositive = change >= 0;

  return (
    <header className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 md:p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-lg">
      {/* Left Area: Search & Ticker Details */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
        {/* Search Input Container */}
        <form onSubmit={handleSubmit} className="relative w-full md:w-80">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-400">
              <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="搜尋代號或名稱 (如: 3680, 家登)"
              className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-slate-700 transition-colors"
            />
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
              {searchSuggestions.map(([n, sym]) => (
                <button
                  key={sym}
                  type="button"
                  onMouseDown={() => handleAutocompleteClick(sym)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-900 transition-colors border-b border-slate-900 last:border-b-0 cursor-pointer"
                >
                  <span className="font-semibold text-slate-200 text-sm">{n}</span>
                  <span className="text-xs text-slate-400 font-mono">{sym}</span>
                </button>
              ))}
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
