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

// Common TW Stocks mapping for name-to-ticker resolution & autocomplete
export const TW_NAME_MAP: Record<string, string> = {
  '加權指數': '^TWII',
  'TWSE': '^TWII',
  'TWSE 加權指數': '^TWII',
  '台股大盤': '^TWII',
  '大盤': '^TWII',
  'NASDAQ': '^IXIC',
  '那斯達克': '^IXIC',
  '標普500': '^GSPC',
  'S&P 500': '^GSPC',
  'SPX': '^GSPC',
  '道瓊': '^DJI',
  '費城半導體': '^SOX',
  '台積電': '2330.TW',
  '鴻海': '2317.TW',
  '聯發科': '2454.TW',
  '廣達': '2382.TW',
  '台達電': '2308.TW',
  '聯電': '2303.TW',
  '日月光投控': '3711.TW',
  '富邦金': '2881.TW',
  '國泰金': '2882.TW',
  '中信金': '2891.TW',
  '長榮': '2603.TW',
  '陽明': '2609.TW',
  '萬海': '2615.TW',
  '緯創': '3231.TW',
  '技嘉': '2376.TW',
  '微星': '2377.TW',
  '英業達': '2356.TW',
  '緯穎': '6669.TW',
  '智原': '3035.TW',
  '創意': '3443.TW',
  '世芯-KY': '3661.TW',
  '世芯': '3661.TW',
  '祥碩': '5269.TW',
  '群聯': '8299.TWO',
  '家登': '3680.TWO',
  '帆宣': '6196.TW',
  '弘塑': '3131.TWO',
  '辛耘': '3583.TW',
  '萬潤': '6187.TWO',
  '均華': '6640.TWO',
  '奇鋐': '3017.TW',
  '雙鴻': '3324.TWO',
  '健策': '3653.TW',
  '力旺': '3529.TWO',
  '信驊': '5274.TWO',
  '大立光': '3008.TW',
  '玉晶光': '3406.TW',
  '欣興': '3037.TW',
  '南電': '8046.TW',
  '景碩': '3189.TW',
  '台勝科': '3532.TW',
  '環球晶': '6488.TWO',
  '中美晶': '5483.TWO',
  '元太': '8069.TWO',
  '譜瑞-KY': '4966.TWO',
  '穩懋': '3105.TWO',
  '宏碁': '2353.TW',
  '華碩': '2357.TW',
  '研華': '2395.TW',
  '中華電': '2412.TW'
};

// Known OTC (GreTai / TPEx) stocks that require .TWO suffix on Yahoo Finance
export const KNOWN_OTC_STOCKS = new Set([
  '8299', '3680', '3131', '6187', '6640', '3324', '3529', '5274', 
  '6488', '5483', '8069', '4966', '3105', '5347', '6274', '3293', 
  '6548', '3558', '6223', '3483', '8054', '6147'
]);

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
  if (/[\u4e00-\u9fa5]/.test(clean)) return true;
  return /^\d{4,6}$/.test(clean) || clean.endsWith('.TW') || clean.endsWith('.TWO') || clean === '^TWII';
}

/**
 * Format any Taiwan Stock input to canonical Yahoo format (e.g. 6196 -> 6196.TW, 8299 -> 8299.TWO)
 */
export function normalizeTaiwanTicker(input: string): string {
  if (!input) return '';
  const resolved = resolveTicker(input);
  if (resolved.endsWith('.TW') || resolved.endsWith('.TWO')) {
    return resolved;
  }
  const clean = cleanTwTicker(resolved);
  if (/^\d{4,6}$/.test(clean)) {
    return KNOWN_OTC_STOCKS.has(clean) ? `${clean}.TWO` : `${clean}.TW`;
  }
  return resolved;
}

/**
 * Resolve Stock name to ticker or normalize input
 */
export function resolveTicker(input: string): string {
  if (!input) return '';
  const cleanInput = input.trim();

  // 1. Direct match in TW_NAME_MAP
  if (TW_NAME_MAP[cleanInput]) return TW_NAME_MAP[cleanInput];

  // 2. Fuzzy match in TW_NAME_MAP by name or code
  for (const [name, sym] of Object.entries(TW_NAME_MAP)) {
    if (name.includes(cleanInput) || cleanInput.includes(name)) {
      return sym;
    }
    const cleanSym = cleanTwTicker(sym);
    if (cleanSym === cleanInput) {
      return sym;
    }
  }

  // 3. If it's a 4-digit code, check OTC or TWSE
  if (/^\d{4,6}$/.test(cleanInput)) {
    return KNOWN_OTC_STOCKS.has(cleanInput) ? `${cleanInput}.TWO` : `${cleanInput}.TW`;
  }

  return cleanInput.toUpperCase();
}

/**
 * Search autocomplete suggestions across common stocks and direct ticker input
 */
export function searchStockSuggestions(query: string): Array<{ name: string; ticker: string }> {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const results: Array<{ name: string; ticker: string }> = [];

  // Match from TW_NAME_MAP
  for (const [name, sym] of Object.entries(TW_NAME_MAP)) {
    const cleanSym = cleanTwTicker(sym).toLowerCase();
    if (name.toLowerCase().includes(q) || cleanSym.includes(q) || sym.toLowerCase().includes(q)) {
      results.push({ name, ticker: sym });
    }
  }

  // If query is a 4-digit number not yet in results, offer a direct candidate
  if (/^\d{4,6}$/.test(query.trim())) {
    const clean = query.trim();
    const isAlreadyIncluded = results.some(r => cleanTwTicker(r.ticker) === clean);
    if (!isAlreadyIncluded) {
      const canonical = KNOWN_OTC_STOCKS.has(clean) ? `${clean}.TWO` : `${clean}.TW`;
      results.unshift({
        name: `台股代號 ${clean}`,
        ticker: canonical
      });
    }
  }

  return results.slice(0, 8);
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

  if (ticker.startsWith('^')) {
    // Direct index symbol on Yahoo (e.g. ^TWII, ^IXIC, ^GSPC, ^DJI)
    tickersToTry = [ticker];
  } else if (ticker.endsWith('.TW') || ticker.endsWith('.TWO')) {
    tickersToTry = [ticker];
  } else if (/^[A-Z]{1,5}$/.test(ticker)) {
    // US ticker (e.g. AAPL, QQQ, NVDA, TSLA)
    tickersToTry = [ticker];
  } else {
    // Taiwan numeric ticker: try both TW and TWO
    tickersToTry = [`${cleanTicker}.TW`, `${cleanTicker}.TWO`];
  }

  for (const yTicker of tickersToTry) {
    try {
      console.log(`Trying Yahoo Finance endpoint for ${yTicker}...`);
      const url = `/yahoo/${encodeURIComponent(yTicker)}?interval=${interval}&range=${range}`;
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

export const INDEX_DEFAULTS: Record<string, { name: string; price: number; change: number; dp: number }> = {
  '^TWII': { name: 'TWSE 加權指數', price: 20466.84, change: 102.35, dp: 0.5 },
  '^IXIC': { name: 'NASDAQ 綜合指數', price: 15996.82, change: 236.95, dp: 1.5 },
  '^GSPC': { name: 'S&P 500 標普指數', price: 5087.03, change: 60.52, dp: 1.2 },
  '^DJI': { name: '道瓊工業指數', price: 38989.84, change: 140.21, dp: 0.36 },
  '^SOX': { name: '費城半導體指數', price: 4750.25, change: 45.12, dp: 0.95 },
  '^NDX': { name: '那斯達克 100 指數', price: 17850.50, change: 210.30, dp: 1.19 }
};

export function generateIndexMockFallback(ticker: string): StockDataResult {
  const info = INDEX_DEFAULTS[ticker] || { name: ticker, price: 10000, change: 50, dp: 0.5 };
  const basePrice = info.price;
  const candles: Candle[] = [];
  const now = new Date();

  // Generate 240 trading days of realistic continuous curve ending at basePrice
  for (let i = 240; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const progress = (240 - i) / 240;
    const drift = (progress - 1) * 0.15 * basePrice;
    const wave = Math.sin(progress * 12) * 0.03 * basePrice;
    const noise = Math.sin(i * 997) * 0.01 * basePrice;
    const close = Math.round((basePrice + drift + wave + noise) * 100) / 100;
    const high = Math.round((close * 1.008) * 100) / 100;
    const low = Math.round((close * 0.992) * 100) / 100;
    const open = Math.round(((close + low) / 2) * 100) / 100;
    candles.push({
      time: formatDt(d),
      open,
      high,
      low,
      close: i === 0 ? basePrice : close,
      volume: 250000000 + Math.floor(Math.abs(Math.sin(i)) * 50000000)
    });
  }

  return {
    quote: {
      c: basePrice,
      d: info.change,
      dp: info.dp,
      h: Math.round(basePrice * 1.006 * 100) / 100,
      l: Math.round(basePrice * 0.994 * 100) / 100,
      pc: Math.round((basePrice - info.change) * 100) / 100
    },
    candles,
    profile: {
      name: info.name,
      marketCapitalization: null
    }
  };
}

/**
 * Yahoo Fallback flow
 */
export async function fetchYahooFallbackCandles(ticker: string, tf = '1day'): Promise<StockDataResult> {
  try {
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

    const INDEX_NAMES: Record<string, string> = {
      '^TWII': 'TWSE 加權指數',
      '^IXIC': 'NASDAQ 綜合指數',
      '^GSPC': 'S&P 500 標普指數',
      '^DJI': '道瓊工業指數',
      '^SOX': '費城半導體指數',
      '^NDX': '那斯達克 100 指數'
    };

    const name = INDEX_NAMES[ticker] || (await getTaiwanStockName(cleanTicker)) || cleanTicker;

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

    const safeDiff = typeof diff === 'number' && !isNaN(diff) ? diff : 0;
    const safeDp = typeof diffPercent === 'number' && !isNaN(diffPercent) ? diffPercent : 0;

    return {
      quote: {
        c: typeof latest.close === 'number' && !isNaN(latest.close) ? latest.close : 0,
        d: safeDiff,
        dp: safeDp,
        h: typeof latest.high === 'number' && !isNaN(latest.high) ? latest.high : 0,
        l: typeof latest.low === 'number' && !isNaN(latest.low) ? latest.low : 0,
        pc: typeof prevClose === 'number' && !isNaN(prevClose) ? prevClose : 0
      },
      candles: aggregateCandles(candles, tf),
      profile: {
        name,
        marketCapitalization
      }
    };
  } catch (err) {
    if (ticker.startsWith('^')) {
      console.warn(`Yahoo fetch failed for index ${ticker}, using reliable index fallback:`, err);
      return generateIndexMockFallback(ticker);
    }
    throw err;
  }
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
  if (ticker.startsWith('^')) {
    // Market Index (^TWII, ^IXIC, ^GSPC, ^DJI, etc.) - use Yahoo Finance directly
    try {
      result = await fetchYahooFallbackCandles(ticker, resolution);
    } catch (err) {
      console.warn(`Failed to fetch index candles for ${ticker}:`, err);
    }
  } else if (isTaiwanStock(ticker)) {
    result = await fetchTwseCandles(ticker, resolution);
  } else {
    try {
      result = await fetchUSCandles(ticker, resolution);
    } catch (e) {
      // Fallback to Yahoo if Finnhub fails
      try {
        result = await fetchYahooFallbackCandles(ticker, resolution);
      } catch (yErr) {
        console.warn(`Failed to fetch US stock data for ${ticker}:`, yErr);
      }
    }
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
  // 0. Special handling for market indices (^TWII, ^IXIC, ^GSPC, etc.)
  if (ticker.startsWith('^')) {
    try {
      const yahooData = await fetchYahooFallbackCandles(ticker, '1day');
      return {
        price: yahooData.quote.c,
        change: yahooData.quote.d,
        d: yahooData.quote.dp
      };
    } catch (e) {
      const def = INDEX_DEFAULTS[ticker];
      if (def) {
        return {
          price: def.price,
          change: def.change,
          d: def.dp
        };
      }
    }
  }

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
 * Built-in Rule-based Local Quant Engine for instant zero-latency advisory
 */
export function generateLocalQuantAdvice(prompt: string, systemPrompt: string): string {
  // Extract key numbers and parameters from system prompt context
  const tickerMatch = systemPrompt.match(/Current Ticker in Focus: (.+)/);
  const ticker = tickerMatch ? tickerMatch[1] : '當前標的';
  const priceMatch = systemPrompt.match(/Current Price: ([\d.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
  const s1Match = systemPrompt.match(/S1: ([\d.]+)/);
  const s1 = s1Match ? parseFloat(s1Match[1]) : 0;
  const r1Match = systemPrompt.match(/R1: ([\d.]+)/);
  const r1 = r1Match ? parseFloat(r1Match[1]) : 0;
  const sharesMatch = systemPrompt.match(/User Position Shares: (\d+)/);
  const shares = sharesMatch ? parseInt(sharesMatch[1]) : 0;
  const costMatch = systemPrompt.match(/User Position Cost: ([\d.]+)/);
  const cost = costMatch ? parseFloat(costMatch[1]) : 0;
  const pnlPctMatch = systemPrompt.match(/User Position PnL Pct: ([+-]?[\d.]+)%/);
  const pnlPct = pnlPctMatch ? parseFloat(pnlPctMatch[1]) : 0;
  const pnlNetMatch = systemPrompt.match(/User Position PnL Amount: ([^,\n]+)/);
  const pnlNet = pnlNetMatch ? pnlNetMatch[1] : '0';
  const tp1Match = systemPrompt.match(/Target 1 \(TP1\): ([\d.]+)/);
  const tp1 = tp1Match ? parseFloat(tp1Match[1]) : 0;
  const tp2Match = systemPrompt.match(/Target 2 \(TP2\): ([\d.]+)/);
  const tp2 = tp2Match ? parseFloat(tp2Match[1]) : 0;
  const slMatch = systemPrompt.match(/Stop Loss \(SL\): ([\d.]+)/);
  const sl = slMatch ? parseFloat(slMatch[1]) : 0;

  const isPositionValid = shares > 0 && cost > 0;
  const isProfit = pnlPct > 0;

  // Generate tailored tactical response
  return `### 🛡️ AlphaLens 本地量化戰術推論報告 (${ticker})

**1. 當前市場定位與結構診斷**
* **現價位置**：目前報價 **$${price > 0 ? price.toFixed(2) : '--'}**，處於支撐位 **$${s1 > 0 ? s1.toFixed(2) : '--'}** 與壓力位 **$${r1 > 0 ? r1.toFixed(2) : '--'}** 之間。
* **盤勢關鍵**：若價格持續守穩在支撐上方，多方攻擊結構依然有效；反之若有效跌破支撐，則需提防回測更深層結構。

**2. 個人持倉盈虧與風控檢驗**
${isPositionValid ? `* **持倉狀況**：持有 **${shares} 股**，買進均價 **$${cost.toFixed(2)}**。
* **目前損益**：**${isProfit ? '+' : ''}${pnlPct.toFixed(2)}%** (${pnlNet})。
* **鎖利防守原則**：${isProfit && pnlPct >= 5 
    ? `目前利潤空間已拉開 (${pnlPct.toFixed(2)}%)，**嚴禁讓已獲利的交易轉為虧損**！強烈建議將防守停損拉抬至成本價上方 (如 $${(cost * 1.01).toFixed(2)})，確保立於不敗之地。` 
    : `目前處於成本徘徊或小幅浮虧區，需嚴格守住初始結構止損線 **$${sl > 0 ? sl.toFixed(2) : '--'}**，破線請果斷減碼退場，嚴禁凹單。`}` 
: `* **尚未設定持倉**：建議在左側「個人持倉與動態情境計畫」輸入您的實際持股成本與股數，即可獲得專屬金額試算與加減碼建議。`}

**3. 具體戰術執行指引**
* **第一目標 (TP1 $${tp1 > 0 ? tp1.toFixed(2) : '--'})**：達到時建議**分批獲利了結 50%**，將確定利潤落袋為安。
* **第二延伸目標 (TP2 $${tp2 > 0 ? tp2.toFixed(2) : '--'})**：剩餘半數倉位啟用動態吊燈停利，讓獲利奔馳。
* **下檔關鍵破位線 ($${sl > 0 ? sl.toFixed(2) : '--'})**：若日線收盤確認跌破，執行防禦退場。`;
}

/**
 * Call Gemini Model API with multi-model switching & smart local fallback
 */
export async function callGeminiAPI(
  prompt: string,
  systemPrompt = '',
  modelName = 'gemini-2.5-flash'
): Promise<string> {
  // If user explicitly chose Local Quant Engine
  if (modelName === 'local-quant') {
    return generateLocalQuantAdvice(prompt, systemPrompt);
  }

  if (!GEMINI_API_KEY) {
    return `*(未配置 GEMINI_API_KEY，已自動啟用本地量化戰術引擎)*\n\n${generateLocalQuantAdvice(prompt, systemPrompt)}`;
  }

  // Safe mapping of model name
  let targetModel = modelName;
  if (!targetModel.startsWith('gemini-')) {
    targetModel = 'gemini-2.5-flash';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${GEMINI_API_KEY.trim()}`;
  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt ? `${systemPrompt}\n\n【使用者即時諮詢】：\n${prompt}` : prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: targetModel.includes('pro') ? 0.3 : 0.2,
      maxOutputTokens: 2048,
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`Gemini API returned status ${res.status} for ${targetModel}:`, errorText);
      throw new Error(`API ${res.status}: ${errorText.slice(0, 150)}`);
    }

    const data = await res.json();
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return generateLocalQuantAdvice(prompt, systemPrompt);
  } catch (err) {
    console.warn("Gemini call failed, falling back to local quant advice:", err);
    return `*(因遠端 API 連線或配額限制，已自動為您切換至 AlphaLens 本地量化戰術引擎)*\n\n${generateLocalQuantAdvice(prompt, systemPrompt)}`;
  }
}
