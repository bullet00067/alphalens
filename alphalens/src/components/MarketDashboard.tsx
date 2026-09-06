import React, { useEffect, useState } from 'react';
import {
  isTaiwanStock,
  getQuickQuote,
  getTaiwanStockName,
  fetchMarketNews,
  formatCurrency,
  searchStockSuggestions,
  resolveTicker,
  MarketNewsItem
} from '../utils/api';

interface MarketDashboardProps {
  watchlist: string[];
  onAddWatchlist: (ticker: string) => void;
  onRemoveWatchlist: (ticker: string) => void;
  onSelectTicker: (ticker: string) => void;
}

interface IndexData {
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
  ticker: string;
}

export const MarketDashboard: React.FC<MarketDashboardProps> = ({
  watchlist,
  onAddWatchlist,
  onRemoveWatchlist,
  onSelectTicker
}) => {
  // Mock fallback indices
  const [indices, setIndices] = useState<IndexData[]>([
    { name: 'S&P 500', price: '5,087.03', change: '+1.2%', isPositive: true, ticker: '^GSPC' },
    { name: 'NASDAQ', price: '15,996.82', change: '+1.5%', isPositive: true, ticker: '^IXIC' },
    { name: 'TWSE 加權指數', price: '20,466.84', change: '+0.5%', isPositive: true, ticker: '^TWII' }
  ]);

  const [activeTab, setActiveTab] = useState<'ALL' | 'US' | 'TW'>('ALL');
  const [addInput, setAddInput] = useState('');
  const [news, setNews] = useState<MarketNewsItem[]>([]);
  const [watchlistData, setWatchlistData] = useState<Record<string, { name: string; price: string; change: string; isPositive: boolean }>>({});
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);

  // Fetch News and quick index values on mount
  useEffect(() => {
    // 1. Fetch Market news
    fetchMarketNews().then((data) => {
      if (data && data.length > 0) {
        setNews(data.slice(0, 5));
      }
    });

    // 2. Refresh Indices from Yahoo proxy if possible
    const fetchIndices = async () => {
      const updated = await Promise.all(
        indices.map(async (idx) => {
          try {
            const quote = await getQuickQuote(idx.ticker);
            if (quote && quote.price > 0) {
              const sign = quote.change >= 0 ? '+' : '';
              return {
                ...idx,
                price: quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 }),
                change: `${sign}${quote.change.toFixed(2)} (${quote.d.toFixed(2)}%)`,
                isPositive: quote.change >= 0
              };
            }
          } catch (e) {
            // ignore
          }
          return idx;
        })
      );
      setIndices(updated);
    };

    fetchIndices();
  }, []);

  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // Fetch Watchlist details concurrently when list changes or market tab changes
  useEffect(() => {
    let active = true;
    const fetchWatchlistDetails = async () => {
      setLoadingWatchlist(true);

      try {
        const entries = await Promise.all(
          watchlist.map(async (ticker) => {
            try {
              let name = ticker;
              let price = '...';
              let change = '...';
              let isPositive = true;

              if (isTaiwanStock(ticker)) {
                const twName = await getTaiwanStockName(ticker);
                name = twName ? `${ticker} ${twName}` : ticker;
                const quote = await getQuickQuote(ticker);
                if (quote && quote.price > 0) {
                  price = formatCurrency(quote.price, ticker);
                  isPositive = quote.change >= 0;
                  change = `${isPositive ? '+' : ''}${quote.change.toFixed(2)} (${quote.d.toFixed(2)}%)`;
                }
              } else {
                const quote = await getQuickQuote(ticker);
                if (quote && quote.price > 0) {
                  price = formatCurrency(quote.price, ticker);
                  isPositive = quote.change >= 0;
                  change = `${isPositive ? '+' : ''}${quote.change.toFixed(2)} (${quote.d.toFixed(2)}%)`;
                }
              }

              return [ticker, { name, price, change, isPositive }] as const;
            } catch (e) {
              return [ticker, { name: ticker, price: 'Error', change: 'Failed to fetch', isPositive: false }] as const;
            }
          })
        );

        if (active) {
          setWatchlistData(Object.fromEntries(entries));
          setLoadingWatchlist(false);
        }
      } catch (err) {
        console.error("Failed to load watchlist details:", err);
        if (active) setLoadingWatchlist(false);
      }
    };

    fetchWatchlistDetails();
    return () => {
      active = false;
    };
  }, [watchlist]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (addInput.trim()) {
      const resolved = resolveTicker(addInput.trim());
      onAddWatchlist(resolved);
      setAddInput('');
      setShowAddDropdown(false);
    }
  };

  const handleAddSuggestionClick = (ticker: string) => {
    const resolved = resolveTicker(ticker);
    onAddWatchlist(resolved);
    setAddInput('');
    setShowAddDropdown(false);
  };

  const addSuggestions = searchStockSuggestions(addInput);

  // Filter watchlist according to the tab
  const filteredWatchlist = watchlist.filter((ticker) => {
    if (activeTab === 'US') return !isTaiwanStock(ticker);
    if (activeTab === 'TW') return isTaiwanStock(ticker);
    return true;
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. Market Indices Section */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold text-slate-200 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400">
            <i className="fa-solid fa-globe"></i>
          </span>
          市場大盤指數
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {indices.map((idx) => (
            <div
              key={idx.ticker}
              onClick={() => onSelectTicker(idx.ticker)}
              className="flex flex-col p-5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-md hover:border-slate-700/80 transition-all cursor-pointer text-left"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">
                <span>{idx.name}</span>
                <i className={`fa-solid ${idx.isPositive ? 'fa-arrow-trend-up text-emerald-400' : 'fa-arrow-trend-down text-rose-400'}`}></i>
              </div>
              <span className="text-xl font-extrabold text-white font-mono tracking-tight">{idx.price}</span>
              <span className={`text-xs font-bold font-mono mt-1 ${idx.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {idx.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Main Dashboard Panel Grid (Watchlist Left + News Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Watchlist Panel (Left 2-Columns wide on XL screen) */}
        <div className="xl:col-span-2 flex flex-col p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400">
                <i className="fa-solid fa-star"></i>
              </span>
              <h3 className="text-lg font-bold text-slate-200">投資自選清單</h3>
            </div>

            {/* Watchlist Tabs */}
            <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 self-start sm:self-auto">
              {(['ALL', 'US', 'TW'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    activeTab === t ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t === 'ALL' ? '全部' : t === 'US' ? '美股' : '台股'}
                </button>
              ))}
            </div>
          </div>

          {/* Add Ticker Form */}
          <form onSubmit={handleAddSubmit} className="relative flex gap-2 mb-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={addInput}
                onChange={(e) => {
                  setAddInput(e.target.value);
                  setShowAddDropdown(true);
                }}
                onFocus={() => setShowAddDropdown(true)}
                onBlur={() => setTimeout(() => setShowAddDropdown(false), 250)}
                placeholder="新增自選代號或名稱 (如: 6196, 帆宣, TSLA, 2330)"
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500/60 transition-colors"
              />

              {/* Add Autocomplete Dropdown */}
              {showAddDropdown && (addSuggestions.length > 0 || addInput.trim().length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-900">
                  {addSuggestions.map((item) => (
                    <button
                      key={`${item.ticker}-${item.name}`}
                      type="button"
                      onMouseDown={() => handleAddSuggestionClick(item.ticker)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-900 transition-colors cursor-pointer group"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-200 text-sm group-hover:text-indigo-300">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">點擊加入自選追蹤</span>
                      </div>
                      <span className="text-xs text-indigo-400 font-mono font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                        {item.ticker}
                      </span>
                    </button>
                  ))}

                  {/* Direct Add Option */}
                  {addInput.trim() && (
                    <button
                      type="button"
                      onMouseDown={() => handleAddSubmit({ preventDefault: () => {} } as any)}
                      className="w-full flex items-center justify-between px-4 py-2 text-left bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <span>直接新增代號/名稱："{addInput.trim()}"</span>
                      <i className="fa-solid fa-plus text-xs"></i>
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <i className="fa-solid fa-plus"></i>
              <span>新增</span>
            </button>
          </form>

          {/* Watchlist List Items */}
          <div className="overflow-y-auto max-h-[350px] rounded-2xl border border-slate-800 bg-slate-950/20">
            {loadingWatchlist && Object.keys(watchlistData).length === 0 ? (
              <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                <i className="fa-solid fa-spinner fa-spin animate-spin"></i>
                <span className="text-xs">載入中...</span>
              </div>
            ) : filteredWatchlist.length === 0 ? (
              <div className="text-center py-10 text-xs font-semibold text-slate-500">
                無自選標的，請於上方輸入新增。
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/60 m-0 p-0 list-none">
                {filteredWatchlist.map((ticker) => {
                  const data = watchlistData[ticker] || {
                    name: ticker,
                    price: '...',
                    change: '...',
                    isPositive: true
                  };
                  return (
                    <li
                      key={ticker}
                      onClick={() => onSelectTicker(ticker)}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-900/35 transition-colors cursor-pointer group"
                    >
                      <div className="flex flex-col text-left">
                        <strong className="text-sm font-bold text-slate-200 tracking-tight group-hover:text-indigo-400 transition-colors">
                          {data.name}
                        </strong>
                        <span className="text-[10px] font-bold font-mono tracking-wider text-slate-500 uppercase mt-0.5">
                          {isTaiwanStock(ticker) ? 'TWSE / OTC' : 'NYSE / NASDAQ'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col text-right">
                          <strong className="text-sm font-extrabold text-slate-100 font-mono tracking-tight">
                            {data.price}
                          </strong>
                          <span className={`text-xs font-bold font-mono ${data.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {data.change}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveWatchlist(ticker);
                          }}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 bg-transparent border-0 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Market News Section (Right 1-Column wide on XL screen) */}
        <div className="flex flex-col p-6 rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl text-left">
          <div className="flex items-center gap-2 mb-6">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400">
              <i className="fa-solid fa-newspaper"></i>
            </span>
            <h3 className="text-lg font-bold text-slate-200">即時市場焦點</h3>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto max-h-[390px] pr-1">
            {news.length === 0 ? (
              <div className="text-center py-10 text-xs font-semibold text-slate-500">
                無新聞資訊 (Finnhub API 額度或權限受限)。
              </div>
            ) : (
              news.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 p-3 rounded-2xl bg-slate-950/20 border border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/10 transition-all text-left decoration-transparent"
                >
                  <h4 className="text-xs font-extrabold text-slate-200 leading-snug line-clamp-2">
                    {item.headline}
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500">
                    {item.source} • {new Date(item.datetime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
