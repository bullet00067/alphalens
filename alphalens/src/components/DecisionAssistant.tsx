import React, { useState, useRef, useEffect } from 'react';
import { callGeminiAPI } from '../utils/api';
import { TrendDiagnosis, KeyLevels, StrategyCondition } from '../types/trading';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface DecisionAssistantProps {
  ticker: string;
  tickerName: string;
  trend: TrendDiagnosis;
  levels: KeyLevels;
  watchlist: string[];
  bullishStrategy?: StrategyCondition;
  bearishStrategy?: StrategyCondition;
}

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', icon: 'fa-bolt', badge: '極速推薦', color: 'text-amber-400' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', icon: 'fa-brain', badge: '深度思維', color: 'text-purple-400' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', icon: 'fa-rocket', badge: '最新旗艦', color: 'text-cyan-400' },
  { id: 'local-quant', name: '本地量化引擎', icon: 'fa-shield-halved', badge: '離線零延遲', color: 'text-emerald-400' },
];

export const DecisionAssistant: React.FC<DecisionAssistantProps> = ({
  ticker,
  tickerName,
  trend,
  levels,
  watchlist,
  bullishStrategy,
  bearishStrategy
}) => {
  // Selected Model with LocalStorage persistence
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('alphalens_ai_model') || 'gemini-2.5-flash';
  });
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Listen to position changes across components and storage
  const [posUpdateCount, setPosUpdateCount] = useState(0);

  useEffect(() => {
    const handlePosChange = () => {
      setPosUpdateCount(c => c + 1);
    };
    window.addEventListener('alphalens_position_update', handlePosChange);
    window.addEventListener('storage', handlePosChange);
    return () => {
      window.removeEventListener('alphalens_position_update', handlePosChange);
      window.removeEventListener('storage', handlePosChange);
    };
  }, []);

  // Read saved user position data from localStorage with ticker normalization
  const getSavedPosition = (targetTicker: string) => {
    try {
      // 1. Primary: 'myPositions' JSON dictionary used by PositionPlanCard
      const rawMyPositions = localStorage.getItem('myPositions');
      if (rawMyPositions) {
        const parsed = JSON.parse(rawMyPositions);
        const cleanTarget = targetTicker.trim().toUpperCase();
        const baseTarget = cleanTarget.replace(/\.(TW|TWO)$/i, '');

        for (const [key, val] of Object.entries<any>(parsed)) {
          if (!val) continue;
          const cleanKey = key.trim().toUpperCase();
          const baseKey = cleanKey.replace(/\.(TW|TWO)$/i, '');
          if (cleanKey === cleanTarget || baseKey === baseTarget) {
            const qty = Number(val.qty ?? val.shares ?? 0);
            const cost = Number(val.cost ?? 0);
            if (qty > 0 && cost > 0) {
              return {
                shares: qty,
                cost,
                direction: (val.direction === 'SHORT' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT'
              };
            }
          }
        }
      }

      // 2. Fallback: single ticker storage key
      const rawSingle = localStorage.getItem(`alphalens_pos_${targetTicker}`);
      if (rawSingle) {
        const parsed = JSON.parse(rawSingle);
        const qty = Number(parsed.qty ?? parsed.shares ?? 0);
        const cost = Number(parsed.cost ?? 0);
        if (qty > 0 && cost > 0) {
          return {
            shares: qty,
            cost,
            direction: (parsed.direction === 'SHORT' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT'
          };
        }
      }
    } catch (e) {
      console.error("Error reading saved position in DecisionAssistant:", e);
    }
    return null;
  };

  const savedPos = getSavedPosition(ticker);
  const shares = savedPos?.shares ? Number(savedPos.shares) : 0;
  const cost = savedPos?.cost ? Number(savedPos.cost) : 0;
  const direction = savedPos?.direction || 'LONG';
  const isShort = direction === 'SHORT';

  // Calculate live position summary
  const pnlPct = cost > 0 
    ? (isShort ? (cost - levels.currentPrice) / cost * 100 : (levels.currentPrice - cost) / cost * 100) 
    : 0;
  const pnlAmount = cost > 0 && shares > 0 
    ? (isShort ? (cost - levels.currentPrice) * shares : (levels.currentPrice - cost) * shares) 
    : 0;

  // Build welcome intro message tailored to current stock and position
  const buildInitialMessage = (currentPos = savedPos): Message => {
    const activeShares = currentPos?.shares ? Number(currentPos.shares) : 0;
    const activeCost = currentPos?.cost ? Number(currentPos.cost) : 0;
    const isPositionSet = activeShares > 0 && activeCost > 0;
    const activeIsShort = currentPos?.direction === 'SHORT';
    const activePnlPct = activeCost > 0 
      ? (activeIsShort ? (activeCost - levels.currentPrice) / activeCost * 100 : (levels.currentPrice - activeCost) / activeCost * 100) 
      : 0;

    let posText = '';
    if (isPositionSet) {
      posText = `\n* 您的持倉：**${activeIsShort ? '空單' : '多單'} ${activeShares} 股**，成本 **$${activeCost.toFixed(2)}** (目前未實現損益: **${activePnlPct >= 0 ? '+' : ''}${activePnlPct.toFixed(2)}%**)`;
    } else {
      posText = `\n* 持倉狀態：*尚未在情境計畫卡設定持股，點擊輸入即可納入分析*`;
    }

    return {
      role: 'assistant',
      text: `您好！我是 **AlphaLens AI 智能決策助理**。

我已即時同步取得 **${tickerName} (${ticker})** 儀表板全盤數據：
* 現價：**$${levels.currentPrice.toFixed(2)}**
* 趨勢格局：**${trend.status || '震盪盤整'}**
* 關鍵防守：支撐 **$${levels.support1.toFixed(2)}** / 壓力 **$${levels.resistance1.toFixed(2)}**${posText}

您可以點擊下方快捷按鈕，或直接詢問我任何具體的交易佈局疑問！`
    };
  };

  const [messages, setMessages] = useState<Message[]>([buildInitialMessage()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync model selection to localStorage
  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('alphalens_ai_model', modelId);
    setShowModelDropdown(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update welcome message when ticker or position updates (if thread only has intro message)
  useEffect(() => {
    const current = getSavedPosition(ticker);
    setMessages(prev => {
      if (prev.length <= 1) {
        return [buildInitialMessage(current)];
      }
      return prev;
    });
  }, [ticker, posUpdateCount]);

  // Auto-scroll to bottom of conversation thread
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Basic Markdown parser for chat renders
  const formatMessageText = (txt: string) => {
    let html = txt.replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-white">$1</strong>');
    html = html.replace(/^\*\s(.*)$/gm, '<li class="ml-4 list-disc pl-1 mb-1 text-slate-300 text-sm">$1</li>');
    html = html.split('\n').map(line => {
      if (line.startsWith('<li') || line.startsWith('###')) {
        if (line.startsWith('###')) {
          return `<h4 class="text-sm font-black text-indigo-400 mt-2 mb-1">${line.replace('###', '').trim()}</h4>`;
        }
        return line;
      }
      return line ? `<p class="mb-2 leading-relaxed text-sm text-slate-300">${line}</p>` : '<div class="h-1.5"></div>';
    }).join('');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  // Build Comprehensive System Prompt with Live Dashboard Data
  const assembleSystemPrompt = () => {
    const portfolioContext = watchlist.length > 0 ? `Portfolio Watchlist: [${watchlist.join(', ')}]` : 'None';
    const pos = getSavedPosition(ticker);
    const activeShares = pos?.shares ? Number(pos.shares) : 0;
    const activeCost = pos?.cost ? Number(pos.cost) : 0;
    const activeDirection = pos?.direction || 'LONG';
    const isShortPos = activeDirection === 'SHORT';

    const livePnlPct = activeCost > 0 
      ? (isShortPos ? (activeCost - levels.currentPrice) / activeCost * 100 : (levels.currentPrice - activeCost) / activeCost * 100) 
      : 0;
    const livePnlAmount = activeCost > 0 && activeShares > 0 
      ? (isShortPos ? (activeCost - levels.currentPrice) * activeShares : (levels.currentPrice - activeCost) * activeShares) 
      : 0;

    const tp1 = bullishStrategy?.targets?.[0] || levels.resistance1;
    const tp2 = bullishStrategy?.targets?.[1] || levels.resistance2;
    const sl = bullishStrategy?.stopLoss || levels.support1;
    const trailingStop = bullishStrategy?.exitStrategies?.trailingStop || '依 ATR 吊燈動態移動';

    return `You are AlphaLens AI Assistant, an elite institutional trading strategist and hedge-fund risk manager.
Current Ticker in Focus: ${tickerName} (${ticker})
Current Price: ${levels.currentPrice.toFixed(2)}
Key Support Levels: S1: ${levels.support1.toFixed(2)}, S2: ${levels.support2.toFixed(2)}
Key Resistance Levels: R1: ${levels.resistance1.toFixed(2)}, R2: ${levels.resistance2.toFixed(2)}
Trend Diagnosis: Status: "${trend.status}", Position: "${trend.position}", Conclusion: "${trend.conclusion}"

【Strategy Engine Parameters】:
- Target 1 (TP1): ${typeof tp1 === 'number' ? tp1.toFixed(2) : tp1} (Suggested: Take 50% partial profit)
- Target 2 (TP2): ${typeof tp2 === 'number' ? tp2.toFixed(2) : tp2} (Suggested: Full wave runner profit target)
- Stop Loss (SL): ${typeof sl === 'number' ? sl.toFixed(2) : sl} (Suggested: Key structural invalidation level)
- Trailing Stop Rule: ${trailingStop}
- Bullish Condition: "${bullishStrategy?.condition || '突破關鍵阻力'}"
- Bearish Condition: "${bearishStrategy?.condition || '跌破關鍵支撐'}"

【User Live Position from Dashboard】:
- Position Set: ${activeShares > 0 && activeCost > 0 ? 'YES' : 'NO'}
- Direction: ${activeDirection} (${isShortPos ? '融券做空' : '現股/融資做多'})
- User Position Shares: ${activeShares}
- User Position Cost: ${activeCost.toFixed(2)}
- User Position Total Capital: ${(activeCost * activeShares).toFixed(2)}
- User Position PnL Pct: ${livePnlPct >= 0 ? '+' : ''}${livePnlPct.toFixed(2)}%
- User Position PnL Amount: ${livePnlAmount >= 0 ? '+' : ''}${livePnlAmount.toFixed(2)}
- User Portfolio Context: ${portfolioContext}

【Core Tactical Philosophy】:
1. "Ratcheting Stop-Loss (Never let a profit turn into a loss)": If user has profit >= 5%, always advise trailing/ratcheting the stop-loss upward to at least cost price or higher (e.g. into profit protection zone) to lock in gains.
2. Provide concise, high-conviction, practical advice in Traditional Chinese (繁體中文 zh-TW).
3. Use markdown bullet points and bold figures. Be direct, clear, and actionable. Avoid generic vague boilerplate.`;
  };

  const executeSend = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const systemPrompt = assembleSystemPrompt();
      const aiResponse = await callGeminiAPI(userText, systemPrompt, selectedModel);
      setMessages(prev => [...prev, { role: 'assistant', text: aiResponse }]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `❌ 決策助手暫時無法回應：${err.message || String(err)}。` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSend(input);
  };

  // Quick Action Chips
  const quickActions = [
    { label: '📊 全盤持倉戰術診斷', prompt: `請根據我目前在 ${tickerName} (${ticker}) 的持倉狀況、進場成本、浮動損益與目前現價，做一次全面的多空態勢與風控建議診斷。` },
    { label: '🛡️ 停利與防守推進指引', prompt: `我目前持有 ${tickerName}，請根據目前的盈利空間與支撐壓力，告訴我現在應該如何推進防守停損點？到達第一目標價 (TP1) 和第二目標 (TP2) 時應如何分批出場？` },
    { label: '⚖️ 盈虧比與加減碼評估', prompt: `以現價與當前形態來看，若現在想要加碼或減碼，剩餘上漲空間與下檔風險的盈虧比 (R:R Ratio) 划算嗎？` },
    { label: '🚨 破線結構風險應變', prompt: `如果接下來跌破關鍵支撐線，我持有的這筆部位最大風險暴露是多少？我該在什麼點位果斷執行停損？` },
  ];

  const currentModelObj = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  return (
    <div className="flex flex-col h-[560px] rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl overflow-hidden">
      {/* Assistant Header with Model Switcher */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/50 border-b border-slate-800/70 relative">
        <div className="flex items-center gap-3">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400 opacity-20"></span>
            <i className="fa-solid fa-robot text-sm"></i>
          </span>
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 leading-tight">AI 戰術交易助理</h3>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                數據已同步
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5">
              連線標的：{tickerName} ({ticker})
            </span>
          </div>
        </div>

        {/* Model Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowModelDropdown(prev => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-700/70 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <i className={`fa-solid ${currentModelObj.icon} ${currentModelObj.color}`}></i>
            <span className="text-slate-200">{currentModelObj.name}</span>
            <i className="fa-solid fa-chevron-down text-[10px] text-slate-400 ml-1"></i>
          </button>

          {showModelDropdown && (
            <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl z-50 overflow-hidden py-1.5 divide-y divide-slate-800/50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                選擇 AI 策略推論模型
              </div>
              <div className="py-1">
                {AVAILABLE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectModel(m.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
                      selectedModel === m.id
                        ? 'bg-indigo-600/15 text-indigo-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <i className={`fa-solid ${m.icon} ${m.color} text-xs w-4 text-center`}></i>
                      <span>{m.name}</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-400">
                      {m.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5 bg-transparent scrollbar-thin">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 max-w-[88%] ${
              msg.role === 'user'
                ? 'self-end flex-row-reverse text-right'
                : 'self-start text-left'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7.5 h-7.5 rounded-xl bg-slate-950 flex items-center justify-center text-slate-400 border border-slate-800 text-xs">
                <i className="fa-solid fa-robot"></i>
              </div>
            )}
            
            <div
              className={`p-4 rounded-2xl text-left border ${
                msg.role === 'user'
                  ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none shadow-md shadow-indigo-600/15'
                  : 'bg-slate-950/60 border-slate-800/80 text-slate-100 rounded-tl-none shadow-md'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              ) : (
                formatMessageText(msg.text)
              )}
            </div>
          </div>
        ))}

        {/* Pulsing loading skeletons */}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%] self-start text-left animate-pulse">
            <div className="flex-shrink-0 w-7.5 h-7.5 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 border border-slate-800 text-xs">
              <i className="fa-solid fa-robot"></i>
            </div>
            
            <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800/60 text-slate-100 rounded-tl-none w-72 flex flex-col gap-2.5">
              <div className="h-4 bg-slate-800 rounded-md w-2/5"></div>
              <div className="flex flex-col gap-2">
                <div className="h-3 bg-slate-800/80 rounded-md w-4/5"></div>
                <div className="h-3 bg-slate-800/80 rounded-md w-full"></div>
                <div className="h-3 bg-slate-800/80 rounded-md w-2/3"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips Bar */}
      <div className="px-4 py-2 bg-slate-950/30 border-t border-slate-800/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap shrink-0 flex items-center gap-1">
          <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i>
          快捷戰術：
        </span>
        <div className="flex items-center gap-1.5">
          {quickActions.map((action, i) => (
            <button
              key={i}
              type="button"
              disabled={isLoading}
              onClick={() => executeSend(action.prompt)}
              className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 text-[11px] font-bold text-slate-300 hover:text-white whitespace-nowrap transition-all cursor-pointer disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Tray Area */}
      <form onSubmit={handleFormSubmit} className="p-3.5 bg-slate-950/60 border-t border-slate-800/60 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder={`向 ${currentModelObj.name} 諮詢持倉診斷或戰術...`}
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-600/20"
        >
          <i className="fa-solid fa-paper-plane text-xs"></i>
        </button>
      </form>
    </div>
  );
};

