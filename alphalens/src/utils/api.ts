import { Candle } from './strategyEngine';

// API Bases
const FINMIND_BASE = '/finmind';
const TWSE_BASE = '/twse';
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const TWELVEDATA_BASE = 'https://api.twelvedata.com';

// Cache for stock names and API responses
const twStockNames: Record<string, string> = {};
const apiCache = new Map<string, { data: any; time: number }>();

// Read API keys from Environment Variables
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const TWELVEDATA_API_KEY = import.meta.env.VITE_TWELVEDATA_API_KEY || '';

// Common TW Stocks mapping for name-to-ticker resolution
export const TW_NAME_MAP: Record<string, string> = {
  '台積電': '2330.TW',
  '鴻海': '2317.TW',
  '群聯': '8299.TWO',
  '聯發科': '2454.TW',
  '長榮': '2603.TW',
  '陽明': '2609.TW',
  '萬海': '2615.TW',
  '家登': '3680.TWO'
};

export interface StockQuote {
  c: number;   // Current price
  d: number;   // Change
  dp: number;  // Change percent
  h: number;   // High
  l: number;   // Low
  pc: number;  // Previous close
}

export interface StockProfile {
  name: string;
  marketCapitalization: number | null;
}

export interface StockDataResult {
  quote: StockQuote;
  candles: Candle[];
  profile: StockProfile;
}

export interface QuickQuoteResult {
  price: number;
  change: number;
  d: number;
  error?: string;
}

export interface MarketNewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  image?: string;
}

/**
 * Utility to format Date to YYYY-MM-DD
 */
export function formatDt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Utility to clean TW Ticker suffix
 */
export function cleanTwTicker(ticker: string): string {
  if (!ticker) return '';
  return ticker.trim().replace(/\.(TW|TWO)$/i, '');
}

/**
 * Check if the ticker represents a Taiwan Stock
 */
export function isTaiwanStock(ticker: string): boolean {
  if (!ticker) return false;
  const clean = ticker.trim();
  if (/[ \u4e00-\u9fa5]/.test(clean)) return true;
  return /^\d{4,6}$/.test(clean) || clean.endsWith('.TW') || clean.endsWith('.TWO');
}

/**
 * Resolve Stock name to ticker or trim input
 */
export function resolveTicker(input: string): string {
  if (!input) return '';
  const cleanInput = input.trim();
  if (TW_NAME_MAP[cleanInput]) return TW_NAME_MAP[cleanInput];
  return cleanInput;
}

/**
 * Proxy Fetch with local memory caching
 */
export async function fetchWithProxy(url: string, useCache = true): Promise<any> {
  if (useCache && apiCache.has(url)) {
    const cached = apiCache.get(url)!;
    if (Date.now() - cached.time < 300000) { // 5-minute cache TTL
      return cached.data;
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Received non-JSON response from server");
    }

    const data = await res.json();
    if (useCache) {
      apiCache.set(url, { data, time: Date.now() });
    }
    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

/**
 * Helper to aggregate daily candles into weekly, monthly, or yearly candles
 */
export function aggregateCandles(candles: Candle[], tf: string): Candle[] {
  if (!tf || tf === '1day' || !candles || candles.length === 0) return candles;

  const result: Candle[] = [];
  const groups: Record<string, Candle[]> = {};

  candles.forEach(candle => {
    let dateObj: Date;
    if (typeof candle.time === 'number') {
      dateObj = new Date(candle.time * 1000);
    } else {
      dateObj = new Date(candle.time);
    }

    let key = '';
    const year = dateObj.getFullYear();

    if (tf === '1week') {
      const day = dateObj.getDay();
      const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dateObj.setDate(diff));
      key = `${monday.getFullYear()}-W${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    } else if (tf === '1month') {
      key = `${year}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    } else if (tf === '1year') {
      key = `${year}`;
    } else {
      return;
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(candle);
  });

  for (const key in groups) {
    const group = groups[key];
    result.push({
      time: group[0].time,
      open: group[0].open,
      high: Math.max(...group.map(g => g.high)),
      low: Math.min(...group.map(g => g.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, g) => sum + (g.volume || 0), 0)
    });
  }

  return result;
}

/**
 * Yahoo Finance historical quote and info fetch
 */
export async function fetchYahooChart(ticker: string, interval = '1d', range = '3y'): Promise<{ yTicker: string; result: any }> {
  const cleanTicker = cleanTwTicker(ticker);
  let tickersToTry: string[] = [];

  if (ticker.endsWith('.TW') || ticker.endsWith('.TWO')) {
    tickersToTry = [ticker];
  } else {
    // Try both extensions sequentially
    tickersToTry = [`${cleanTicker}.TW`, `${cleanTicker}.TWO`];
  }

  for (const yTicker of tickersToTry) {
    try {
      console.log(`Trying Yahoo Finance endpoint for ${yTicker}...`);
      const url = `/yahoo/${yTicker}?interval=${interval}&range=${range}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Yahoo endpoint returned status ${res.status} for ${yTicker}`);
        continue;
      }
      const data = await res.json();
      if (data.chart && data.chart.result && data.chart.result[0]) {
        const result = data.chart.result[0];
        if (result.timestamp && result.timestamp.length > 0) {
          return { yTicker, result };
        }
      }
    } catch (err) {
      console.warn(`Yahoo fetch failed for ${yTicker}:`, err);
    }
  }
  throw new Error(`Yahoo Finance search failed for ticker ${ticker}`);
}

/**
 * Yahoo Fallback flow
 */
export async function fetchYahooFallbackCandles(ticker: string, tf = '1day'): Promise<StockDataResult> {
  const cleanTicker = cleanTwTicker(ticker);
  const { result } = await fetchYahooChart(ticker, '1d', '3y');

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const meta = result.meta;

  if (!timestamps || timestamps.length === 0) {
    throw new Error("Empty historical data from Yahoo Finance");
  }

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const timeVal = timestamps[i];
    const date = new Date(timeVal * 1000);
    const time = formatDt(date);

    const open = quote.open[i];
    const high = quote.high[i];
    const low = quote.low[i];
    const close = quote.close[i];
    const volume = quote.volume[i] || 0;

    if (open !== null && high !== null && low !== null && close !== null) {
      candles.push({ time, open, high, low, close, volume });
    }
  }

  if (candles.length === 0) {
    throw new Error("No valid data points found in Yahoo Finance response");
  }

  const latest = candles[candles.length - 1];
  const prevClose = candles[candles.length - 2]?.close || meta.chartPreviousClose || latest.open;
  const diff = latest.close - prevClose;
  const diffPercent = (diff / prevClose) * 100;

  const name = await getTaiwanStockName(cleanTicker) || cleanTicker;

  // Get outstanding shares dynamically
  let marketCapitalization = null;
  try {
    const shStart = new Date();
    shStart.setDate(shStart.getDate() - 30);
    const shUrl = `${FINMIND_BASE}?dataset=TaiwanStockShareholding&data_id=${cleanTicker}&start_date=${formatDt(shStart)}`;
    const shData = await fetchWithProxy(shUrl);
    if (shData && shData.data && shData.data.length > 0) {
      const validRecords = shData.data.filter((r: any) => r.NumberOfSharesIssued > 0);
      if (validRecords.length > 0) {
        const latestSh = validRecords[validRecords.length - 1];
        marketCapitalization = (latestSh.NumberOfSharesIssued * latest.close) / 1000000;
      }
    }
  } catch (shErr) {
    console.warn("Failed to fetch shareholding in Yahoo fallback:", shErr);
  }

  if (marketCapitalization === null) {
    const commonShares: Record<string, number> = {
      '2330': 25930000000,
      '2317': 13860000000,
      '8299': 207000000,
      '2454': 1599000000,
      '3680': 94000000 // 家登 approx
    };
    if (commonShares[cleanTicker]) {
      marketCapitalization = (commonShares[cleanTicker] * latest.close) / 1000000;
    }
  }

  return {
    quote: {
      c: latest.close,
      d: diff,
      dp: diffPercent,
      h: latest.high,
      l: latest.low,
      pc: prevClose
    },
    candles: aggregateCandles(candles, tf),
    profile: { name, marketCapitalization }
  };
}

/**
 * TWSE Fallback flow
 */
export async function fetchTwseFallbackCandles(ticker: string, tf = '1day'): Promise<StockDataResult> {
  const twTicker = cleanTwTicker(ticker);
  const today = new Date();

  // Fetch last 3 months to ensure enough data
  const months: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${y}${m}01`);
  }

  let allData: any[] = [];
  let title = '';

  const fetchPromises = months.map(async (dateStr) => {
    try {
      const url = `${TWSE_BASE}?response=json&date=${dateStr}&stockNo=${twTicker}`;
      return await fetchWithProxy(url);
    } catch (e) {
      console.warn(`Failed to fetch TWSE data for ${dateStr}`, e);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  results.reverse().forEach(json => {
    if (json && json.data && json.data.length > 0) {
      allData = [...allData, ...json.data];
      if (!title) title = json.title;
    }
  });

  if (allData.length === 0) throw new Error("No data from TWSE");

  const uniqueData = Array.from(new Set(allData.map(r => JSON.stringify(r)))).map((s: any) => JSON.parse(s));

  const candles = uniqueData.map((row: any) => {
    try {
      const dateParts = row[0].split('/');
      if (dateParts.length < 3) return null;
      const year = parseInt(dateParts[0]) + 1911;
      const month = dateParts[1];
      const day = dateParts[2];
      const time = `${year}-${month}-${day}`;

      const parseVal = (val: string) => {
        if (!val || val === '--') return null;
        const num = parseFloat(val.replace(/,/g, ''));
        return isNaN(num) ? null : num;
      };

      const open = parseVal(row[3]);
      const high = parseVal(row[4]);
      const low = parseVal(row[5]);
      const close = parseVal(row[6]);
      const volume = parseVal(row[1]) || 0;

      if (open === null || high === null || low === null || close === null) return null;

      return { time, open, high, low, close, volume };
    } catch (e) {
      return null;
    }
  }).filter((c): c is Candle => c !== null);

  if (candles.length === 0) throw new Error("No valid data points found in TWSE response");

  const latest = candles[candles.length - 1];

  let marketCapitalization = null;
  try {
    const shStart = new Date();
    shStart.setDate(shStart.getDate() - 30);
    const shUrl = `${FINMIND_BASE}?dataset=TaiwanStockShareholding&data_id=${twTicker}&start_date=${formatDt(shStart)}`;
    const shData = await fetchWithProxy(shUrl);
    if (shData && shData.data && shData.data.length > 0) {
      const validRecords = shData.data.filter((r: any) => r.NumberOfSharesIssued > 0);
      if (validRecords.length > 0) {
        const latestSh = validRecords[validRecords.length - 1];
        marketCapitalization = (latestSh.NumberOfSharesIssued * latest.close) / 1000000;
      }
    }
  } catch (shErr) {
    console.warn("Failed to fetch shareholding for fallback TW stock market cap:", shErr);
  }

  return {
    quote: {
      c: latest.close,
      d: 0,
      dp: 0,
      h: latest.high,
      l: latest.low,
      pc: candles[candles.length - 2]?.close || latest.open
    },
    candles: aggregateCandles(candles, tf),
    profile: { name: title ? title.split(' ')[2] : ticker, marketCapitalization }
  };
}

/**
 * TW Stock FinMind Master Flow with fallbacks
 */
export async function fetchTwseCandles(ticker: string, tf: string): Promise<StockDataResult> {
  // Prioritize Yahoo Finance for complete, up-to-date, untruncated daily K-lines
  try {
    return await fetchYahooFallbackCandles(ticker, tf);
  } catch (yahooErr) {
    console.warn("Yahoo Finance failed, falling back to FinMind:", yahooErr);
    try {
      const twTicker = cleanTwTicker(ticker);
      const end = new Date();
      const start = new Date();
      start.setFullYear(end.getFullYear() - 3);

      const url = `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${twTicker}&start_date=${formatDt(start)}&end_date=${formatDt(end)}`;
      const data = await fetchWithProxy(url);

      if (!data.data || data.data.length === 0 || data.status === 402) {
        throw new Error("FinMind rate limited or empty data");
      }

      const candles: Candle[] = data.data.map((d: any) => ({
        time: d.date,
        open: d.open,
        high: d.max,
        low: d.min,
        close: d.close,
        volume: d.Trading_Volume
      }));

      const name = await getTaiwanStockName(twTicker) || ticker;
      const latest = candles[candles.length - 1];
      const quote = {
        c: latest.close,
        d: 0,
        dp: 0,
        h: latest.high,
        l: latest.low,
        pc: candles[candles.length - 2]?.close || latest.open
      };

      let marketCapitalization = null;
      try {
        const shStart = new Date();
        shStart.setDate(shStart.getDate() - 30);
        const shUrl = `${FINMIND_BASE}?dataset=TaiwanStockShareholding&data_id=${twTicker}&start_date=${formatDt(shStart)}`;
        const shData = await fetchWithProxy(shUrl);
        if (shData && shData.data && shData.data.length > 0) {
          const validRecords = shData.data.filter((r: any) => r.NumberOfSharesIssued > 0);
          if (validRecords.length > 0) {
            const latestSh = validRecords[validRecords.length - 1];
            marketCapitalization = (latestSh.NumberOfSharesIssued * latest.close) / 1000000;
          }
        }
      } catch (shErr) {
        console.warn("Failed to fetch shareholding for TW stock market cap:", shErr);
      }

      return { quote, candles: aggregateCandles(candles, tf), profile: { name, marketCapitalization } };
    } catch (finmindErr) {
      console.error("FinMind failed too, trying TWSE fallback:", finmindErr);
      return await fetchTwseFallbackCandles(ticker, tf);
    }
  }
}


/**
 * Fetch US Stock data from Finnhub & Twelve Data
 */
export async function fetchUSCandles(ticker: string, tf: string): Promise<StockDataResult> {
  if (!FINNHUB_API_KEY) {
    throw new Error('VITE_FINNHUB_API_KEY not set in .env file');
  }

  const [quoteRes, profileRes] = await Promise.all([
    fetch(`${FINNHUB_BASE}/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`),
    fetch(`${FINNHUB_BASE}/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`)
  ]);

  if (quoteRes.status === 429 || profileRes.status === 429) {
    throw new Error("Fetch failed with status 429");
  }
  if (!quoteRes.ok || !profileRes.ok) {
    throw new Error(`Fetch failed with status ${quoteRes.status || profileRes.status}`);
  }

  const quoteData = await quoteRes.json();
  const profileData = await profileRes.json();

  if (quoteData.c === 0 && quoteData.d === null) throw new Error("Invalid ticker");

  let candles: Candle[] = [];
  if (TWELVEDATA_API_KEY) {
    try {
      const apiTf = tf === '1year' ? '1month' : tf;
      const outputSize = (tf === '15min' || tf === '1h') ? 500 : 2520;

      let twelveTicker = ticker;
      if (ticker === '^GSPC') twelveTicker = 'SPX';
      if (ticker === '^IXIC') twelveTicker = 'IXIC';
      if (ticker === '^NDX') twelveTicker = 'NDX';
      if (ticker === '^DJI') twelveTicker = 'DJI';

      const candleRes = await fetch(`${TWELVEDATA_BASE}/time_series?symbol=${twelveTicker}&interval=${apiTf}&outputsize=${outputSize}&apikey=${TWELVEDATA_API_KEY}`);
      const cData = await candleRes.json();

      if (cData.status === "ok") {
        candles = cData.values.map((v: any) => {
          const timestamp = Math.floor(new Date(v.datetime).getTime() / 1000);
          return {
            time: timestamp,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseInt(v.volume) || 0
          };
        }).reverse();

        if (tf === '1year') {
          candles = aggregateCandles(candles, '1year');
        }
      }
    } catch (e) {
      console.warn("Twelve Data fetch failed:", e);
    }
  }

  return {
    quote: {
      c: quoteData.c,
      d: quoteData.d,
      dp: quoteData.dp,
      h: quoteData.h,
      l: quoteData.l,
      pc: quoteData.pc
    },
    candles,
    profile: {
      name: profileData.name || ticker,
      marketCapitalization: profileData.marketCapitalization || null
    }
  };
}

/**
 * Master cached stock history fetcher
 */
export async function fetchStockHistoryCached(ticker: string, resolution = '1day'): Promise<StockDataResult> {
  const cacheKey = `history_cache_${ticker}_${resolution}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < 3600000) { // 1 hour TTL
        return parsed.data;
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  let result: StockDataResult | null = null;
  if (isTaiwanStock(ticker)) {
    result = await fetchTwseCandles(ticker, resolution);
  } else {
    result = await fetchUSCandles(ticker, resolution);
  }

  if (result && result.candles && result.candles.length > 0) {
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data: result
    }));
  }
  return result;
}

/**
 * Fetch Taiwan Stock Name by ID
 */
export async function getTaiwanStockName(ticker: string): Promise<string> {
  if (!isTaiwanStock(ticker)) return '';
  const cleanTicker = cleanTwTicker(ticker);
  const hardcoded: Record<string, string> = {
    '2330': '台積電',
    '2317': '鴻海',
    '8299': '群聯',
    '2454': '聯發科',
    '2603': '長榮',
    '2609': '陽明',
    '2615': '萬海',
    '3680': '家登'
  };
  if (hardcoded[cleanTicker]) return hardcoded[cleanTicker];
  if (twStockNames[cleanTicker]) return twStockNames[cleanTicker];

  try {
    const url = `${FINMIND_BASE}?dataset=TaiwanStockInfo&data_id=${cleanTicker}`;
    const data = await fetchWithProxy(url);
    if (data && data.data && data.data.length > 0) {
      twStockNames[cleanTicker] = data.data[0].stock_name;
      return twStockNames[cleanTicker];
    }
  } catch (e) {
    console.error("Failed to fetch TW stock name:", e);
  }
  return '';
}

/**
 * Quick quote interface
 */
export async function getQuickQuote(ticker: string): Promise<QuickQuoteResult> {
  if (isTaiwanStock(ticker)) {
    // 1. Try Yahoo Finance First (for instant real-time price alignment)
    try {
      const yahooData = await fetchYahooFallbackCandles(ticker, '1day');
      return {
        price: yahooData.quote.c,
        change: yahooData.quote.d,
        d: yahooData.quote.dp
      };
    } catch (yahooErr) {
      console.warn("Yahoo failed in getQuickQuote, trying FinMind:", yahooErr);
    }

    const cleanTicker = cleanTwTicker(ticker);
    // 2. Try FinMind
    try {
      const url = `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${cleanTicker}&start_date=${new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0]}`;
      const data = await fetchWithProxy(url);
      if (data && data.data && data.data.length > 0 && data.status !== 402) {
        const latest = data.data[data.data.length - 1];
        return {
          price: latest.close,
          change: latest.spread,
          d: (latest.spread / (latest.close - latest.spread)) * 100
        };
      }
    } catch (e) {
      console.warn("FinMind failed in getQuickQuote:", e);
    }

    // 3. Try TWSE API
    try {
      const fallback = await fetchTwseFallbackCandles(ticker);
      return {
        price: fallback.quote.c,
        change: fallback.quote.d,
        d: fallback.quote.dp
      };
    } catch (twseErr) {
      console.warn("TWSE failed in getQuickQuote:", twseErr);
    }

    return { price: 0, change: 0, d: 0, error: "All data sources failed" };
  } else {
    if (!FINNHUB_API_KEY) return { price: 0, change: 0, d: 0, error: "Missing Finnhub API Key" };
    const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
    if (!res.ok) return { price: 0, change: 0, d: 0, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { price: data.c, change: data.d, d: data.dp };
  }
}


/**
 * Fetch general market news
 */
export async function fetchMarketNews(): Promise<MarketNewsItem[]> {
  if (!FINNHUB_API_KEY) return [];
  try {
    const res = await fetch(`${FINNHUB_BASE}/news?category=general&token=${FINNHUB_API_KEY}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch market news:", err);
    return [];
  }
}

/**
 * Format Currency Utility
 */
export function formatCurrency(value: number, ticker = ''): string {
  if (ticker && isTaiwanStock(ticker)) {
    return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/**
 * Format compact volume numbers
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * call Gemini Model API for trading ideas & decisions
 */
export async function callGeminiAPI(prompt: string, systemPrompt = ''): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "🚧 AI analysis is temporarily disabled (No GEMINI_API_KEY found in .env).";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt ? `${systemPrompt}\n\nUser Question:\n${prompt}` : prompt }
        ]
      }
    ]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY.trim()
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gemini API Error:", errorText);
      throw new Error(`API Error ${res.status}`);
    }

    const data = await res.json();
    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content.parts[0].text;
    }
    return "No response generated.";
  } catch (err) {
    console.error("Failed callGeminiAPI:", err);
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
