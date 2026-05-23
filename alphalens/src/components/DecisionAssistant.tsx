import React, { useState, useRef, useEffect } from 'react';
import { callGeminiAPI } from '../utils/api';
import { TrendDiagnosis, KeyLevels } from '../types/trading';

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
}

export const DecisionAssistant: React.FC<DecisionAssistantProps> = ({
  ticker,
  tickerName,
  trend,
  levels,
  watchlist
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: `您好！我是 **AlphaLens 智能交易決策助手**。

我已經為您分析了 **${tickerName} (${ticker})** 的最新戰術形態：
* 趨勢格局：**${trend.status || '尚未確認'}**
* 當前價格：**$${levels.currentPrice.toFixed(2)}**
* 關鍵支撐：**$${levels.support1.toFixed(2)}** / **$${levels.support2.toFixed(2)}**
* 關鍵壓力：**$${levels.resistance1.toFixed(2)}** / **$${levels.resistance2.toFixed(2)}**

有什麼我可以協助您的？例如：「多頭突破應如何配置資金？」或「此形態的最佳止損位在哪裡？」`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the conversation thread
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Very basic Markdown-like parser for clean rich-text chat renders
  const formatMessageText = (txt: string) => {
    // Replace strong marks **bold** with styled spans
    let html = txt.replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-white">$1</strong>');
    // Replace markdown bullets * list with bullets
    html = html.replace(/^\*\s(.*)$/gm, '<li class="ml-4 list-disc pl-1 mb-1 text-slate-300 text-sm">$1</li>');
    // Replace paragraphs/breaks
    html = html.split('\n').map(line => {
      if (line.startsWith('<li')) return line;
      return line ? `<p class="mb-2 leading-relaxed text-sm text-slate-300">${line}</p>` : '<div class="h-2"></div>';
    }).join('');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      // Assemble rich context package
      const portfolioContext = watchlist.length > 0 ? `Portfolio Tickers: [${watchlist.join(', ')}]` : 'None';
      const systemPrompt = `You are AlphaLens AI Assistant, an elite stock strategist.
Current Ticker in Focus: ${tickerName} (${ticker})
Current Price: ${levels.currentPrice.toFixed(2)}
S1: ${levels.support1.toFixed(2)}, S2: ${levels.support2.toFixed(2)}
R1: ${levels.resistance1.toFixed(2)}, R2: ${levels.resistance2.toFixed(2)}
Trend diagnosis status: ${trend.status}
Trend position: ${trend.position}
Trend conclusion: ${trend.conclusion}
User Portfolio context: ${portfolioContext}

Format your response in concise, professional traditional Chinese (zh-TW). Use markdown bullets and bold sections. Make it practical, insightful, and clear. Avoid lengthy paragraphs.`;

      const aiResponse = await callGeminiAPI(userText, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', text: aiResponse }]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `❌ 決策助手暫時無法回應：${err.message || String(err)}。請檢查 API 金鑰配置。` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[520px] rounded-3xl bg-slate-900/60 backdrop-blur-lg border border-slate-800/80 shadow-xl overflow-hidden">
      {/* Assistant Header */}
      <div className="flex items-center justify-between px-6 py-4.5 bg-slate-950/40 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <span className="relative flex h-8.5 w-8.5 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-indigo-400 opacity-20"></span>
            <i className="fa-solid fa-robot text-base"></i>
          </span>
          <div className="flex flex-col text-left">
            <h3 className="text-sm font-bold text-slate-100 leading-tight">AI 戰術交易助理</h3>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              連線中 • Gemini 1.5 Flash
            </span>
          </div>
        </div>
      </div>

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4 bg-transparent scrollbar-thin">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 max-w-[85%] ${
              msg.role === 'user'
                ? 'self-end flex-row-reverse text-right'
                : 'self-start text-left'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-slate-400 border border-slate-800 text-xs">
                <i className="fa-solid fa-robot"></i>
              </div>
            )}
            
            <div
              className={`p-4.5 rounded-2xl text-left border ${
                msg.role === 'user'
                  ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none shadow-md shadow-indigo-600/15'
                  : 'bg-slate-950/50 border-slate-800/80 text-slate-100 rounded-tl-none shadow-md'
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

        {/* Pulsing loading skeletons representing typical AI response layouts */}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%] self-start text-left animate-pulse">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-950 flex items-center justify-center text-slate-500 border border-slate-800 text-xs">
              <i className="fa-solid fa-robot"></i>
            </div>
            
            <div className="p-4.5 rounded-2xl bg-slate-950/30 border border-slate-800/50 text-slate-100 rounded-tl-none w-72 flex flex-col gap-3">
              {/* Short heading skeletal bar */}
              <div className="h-4 bg-slate-800 rounded-md w-1/3"></div>
              {/* Bullet line list skeletal bars */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                  <div className="h-3.5 bg-slate-800 rounded-md w-3/4"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                  <div className="h-3.5 bg-slate-800 rounded-md w-5/6"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                  <div className="h-3.5 bg-slate-800 rounded-md w-2/3"></div>
                </div>
              </div>
              {/* Footer skeletal bar */}
              <div className="h-3 bg-slate-800 rounded-md w-1/2 mt-1"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Tray Area */}
      <form onSubmit={handleSendMessage} className="p-4 bg-slate-950/40 border-t border-slate-800/60 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="詢問助理關於此標的的佈局疑問..."
          className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-slate-700 disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="w-10.5 h-10.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
        >
          <i className="fa-solid fa-paper-plane text-xs"></i>
        </button>
      </form>
    </div>
  );
};
