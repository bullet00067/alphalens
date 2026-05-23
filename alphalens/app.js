import { createChart, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import { generatePIPSignal, findPIPs, analyzeTrend, evaluateEntry, evaluateExit } from './strategyEngine.js';

import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

let firebaseApp = null;
let auth = null;
let db = null;

try {
    if (firebaseConfig.apiKey) {
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
    } else {
        console.warn("Firebase API Key missing. Firebase Auth/DB will be disabled.");
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

let currentUser = null;

// State
const defaultWatchlist = ['AAPL', 'TSLA', '2330', 'NVDA'];
let currentWatchlist = []; // Loaded from Firebase or local
let currentStockChart = null;
let candlestickSeries = null;
let volumeSeries = null;
let pipSeries = null;
let smaSeriesList = [];
let currentChartData = []; // Store OHLC data for indicator calculation
let currentTimeframe = '1day';
let isAxisLocked = true;
let currentTicker = null;
let currentPortfolio = []; // Will be loaded from Firebase
let currentMarketTab = 'ALL'; // 'ALL', 'US', 'TW'
const twStockNames = {}; // Cache for Taiwan stock names
let pipChartInstance = null;
let pipLineSeries = null;
let pipHighlightSeries = null; // New for pattern line highlighting
let isSyncing = false; // Add sync lock to prevent feedback loops
let isPipTacticalEnabled = false;
let isPipOverlayEnabled = false;
let mainPipSeries = null;
let patternOverlaySeries = null; // For Triangle/MW legs in tactical chart
let structureLabelSeries = null; // For HH/HL markers
let patternLabelSeries = null; // For Resistance/Support markers
let patternUpperSeries = null;
let patternLowerSeries = null;
let pipPatternUpperSeries = null;
let pipPatternLowerSeries = null;
let pipGhostSeries = null; // Transparent series to force time-scale alignment
let pipTargetLines = []; // Holds createPriceLine references for 1x/2x amplitude targets
window.tacticalStdMean = 0;  // log10(price) mean used for Z-Score ↔ price conversion
window.tacticalStdDev = 1;   // log10(price) std used for Z-Score ↔ price conversion
window.allTacticalPips = []; // Global reference for tactical markers
window.mainPipMarkers = [];   // Global reference for main markers

// API Keys (from .env via Vite)
const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const TWELVEDATA_API_KEY = import.meta.env.VITE_TWELVEDATA_API_KEY || '';

// API Bases
const PROXY_BASE = ''; // Using relative paths to hit Express/Vite proxy
const FINMIND_BASE = '/finmind';
const TWSE_BASE = '/twse';

// Helper for date formatting
const formatDt = (d) => d.toISOString().split('T')[0];

// Simple in-memory cache to speed up repeated requests
const apiCache = new Map();
let validationStatus = { status: 'PENDING', diff: 0, ticker: null };

async function verifyWithYahoo(ticker, localPrice) {
    if (!ticker) return { status: 'ERROR' };
    
    // Convert ticker to Yahoo format if needed (e.g. 2330 -> 2330.TW)
    let yTicker = ticker;
    if (/^\d{4}$/.test(ticker)) yTicker = `${ticker}.TW`;
    
    try {
        console.log(`[ACL] Verifying ${ticker} price against Yahoo Finance...`);
        const url = `/yahoo/${yTicker}?interval=1m&range=1d`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Yahoo Finance unreachable');
        
        const data = await res.json();
        const meta = data.chart.result[0].meta;
        const yahooPrice = meta.regularMarketPrice;
        const diff = Math.abs(localPrice - yahooPrice) / yahooPrice;
        
        const status = diff < 0.005 ? 'SUCCESS' : 'WARNING';
        validationStatus = { status, diff, ticker, yahooPrice };
        
        console.log(`[ACL] Verification ${status}: Local=${localPrice}, Yahoo=${yahooPrice}, Diff=${(diff*100).toFixed(2)}%`);
        return validationStatus;
    } catch (e) {
        console.warn(`[ACL] Verification failed for ${ticker}:`, e);
        validationStatus = { status: 'ERROR', ticker };
        return validationStatus;
    }
}

async function fetchWithProxy(url) {
    // Check cache first
    if (apiCache.has(url)) {
        const cached = apiCache.get(url);
        if (Date.now() - cached.time < 300000) { // 5 minute cache
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
        
        // Save to cache
        apiCache.set(url, { data, time: Date.now() });
        return data;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error;
    }
}

async function fetchYahooChart(ticker, interval = '1d', range = '3y') {
    const cleanTicker = cleanTwTicker(ticker);
    let tickersToTry = [];
    if (ticker.endsWith('.TW')) {
        tickersToTry = [ticker];
    } else if (ticker.endsWith('.TWO')) {
        tickersToTry = [ticker];
    } else {
        // Try both `.TW` and `.TWO` sequentially if no suffix is specified
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

async function fetchYahooFallbackCandles(ticker, tf = '1day') {
    const cleanTicker = cleanTwTicker(ticker);
    
    // Fetch 3 years of daily data ('1d') to ensure we have enough for timeframe aggregates
    const { yTicker, result } = await fetchYahooChart(ticker, '1d', '3y');
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const meta = result.meta;
    
    if (!timestamps || timestamps.length === 0) {
        throw new Error("Empty historical data from Yahoo Finance");
    }
    
    const candles = [];
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
    
    // Get market capitalization from FinMind shareholding if available
    let marketCapitalization = null;
    try {
        const shStart = new Date();
        shStart.setDate(shStart.getDate() - 30);
        const shUrl = `${FINMIND_BASE}?dataset=TaiwanStockShareholding&data_id=${cleanTicker}&start_date=${formatDt(shStart)}`;
        const shData = await fetchWithProxy(shUrl);
        if (shData && shData.data && shData.data.length > 0) {
            const validRecords = shData.data.filter(r => r.NumberOfSharesIssued > 0);
            if (validRecords.length > 0) {
                const latestSh = validRecords[validRecords.length - 1];
                marketCapitalization = (latestSh.NumberOfSharesIssued * latest.close) / 1000000;
            }
        }
    } catch (shErr) {
        console.warn("Failed to fetch shareholding in Yahoo fallback:", shErr);
    }
    
    // Estimate if still null
    if (marketCapitalization === null) {
        const commonShares = {
            '2330': 25930000000,
            '2317': 13860000000,
            '8299': 207000000,
            '2454': 1599000000
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

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const TWELVEDATA_BASE = 'https://api.twelvedata.com';

const CHART_UPDATE_DEBOUNCE_MS = 300;
let currentStopLossLine = null;
let currentTp1Line = null;
let currentTp2Line = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    const safeInit = (fn, name) => {
        try {
            fn();
        } catch (e) {
            console.error(`Error during ${name}:`, e);
        }
    };

    safeInit(initGlobalEventListeners, 'GlobalEventListeners');
    safeInit(initAuth, 'Auth');
    safeInit(initNavigation, 'Navigation');
    safeInit(initSettings, 'Settings');
    safeInit(initWatchlist, 'Watchlist');
    safeInit(populateDashboard, 'Dashboard');
    safeInit(initChat, 'Chat');
    safeInit(setupSearch, 'Search');
    safeInit(initIndicators, 'Indicators');
    safeInit(initTimeframeSwitcher, 'TimeframeSwitcher');
    safeInit(initPortfolio, 'Portfolio');
    safeInit(initResponsiveNavigation, 'ResponsiveNavigation');
    safeInit(initAxisLock, 'AxisLock');
    safeInit(initChartTabs, 'ChartTabs');
    safeInit(initTheme, 'Theme');
    
    const bannerBtn = document.getElementById('ask-ai-banner-btn');
    if (bannerBtn) {
        bannerBtn.addEventListener('click', () => {
            switchView('assistant-view');
            addAiMessage("I can analyze the current market for you. Overall, the market is bullish today driven by tech stocks. What specific sector would you like me to look into?");
        });
    }
    
    const deepDiveBtn = document.getElementById('deep-dive-btn');
    if (deepDiveBtn) {
        deepDiveBtn.addEventListener('click', () => {
            const tickerEl = document.getElementById('detail-ticker');
            const ticker = tickerEl ? tickerEl.textContent : 'selected stock';
            switchView('assistant-view');
            addAiMessage(`Let's take a deep dive into ${ticker}. You can ask me to draw technical indicators like "Draw 20 MA" or "Draw 5 MA".`);
        });
    }
});

function initGlobalEventListeners() {
    // Market Tab switching
    document.querySelectorAll('[data-market-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.getAttribute('data-market-tab');
            setMarketTab(tab);
        });
    });

    // Portfolio Tab switching
    document.querySelectorAll('[data-portfolio-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.currentTarget.getAttribute('data-portfolio-tab');
            switchPortfolioTab(tab);
        });
    });

    // Add Holding toggle
    document.querySelectorAll('[data-action="toggle-add-form"]').forEach(el => {
        el.addEventListener('click', toggleAddForm);
    });

    // Add Holding submit
    const addHoldingBtn = document.getElementById('add-holding-submit-btn');
    if (addHoldingBtn) {
        addHoldingBtn.addEventListener('click', addToPortfolioFromForm);
    }

    // Event Delegation for dynamic elements
    document.body.addEventListener('click', (e) => {
        const target = e.target;
        
        // Find closest element with data-action
        const actionEl = target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.getAttribute('data-action');
        const ticker = actionEl.getAttribute('data-ticker');
        const index = actionEl.getAttribute('data-index');

        switch (action) {
            case 'view-detail':
                if (ticker) loadStockDetail(ticker);
                break;
            case 'remove-observation':
                if (ticker) removeFromObservation(ticker);
                break;
            case 'remove-portfolio':
                if (index !== null) removeFromPortfolio(parseInt(index), e);
                break;
            case 'remove-watchlist':
                if (ticker) removeFromWatchlist(ticker, e);
                break;
            case 'add-observation':
                if (ticker) addToObservation(ticker);
                break;
        }
    });
}

// Settings Logic - show status of .env keys
function initSettings() {
    const finnhubStatus = document.getElementById('finnhub-key-status');
    const geminiStatus = document.getElementById('gemini-key-status');
    if (finnhubStatus) {
        if (FINNHUB_API_KEY) {
            finnhubStatus.innerHTML = '<span class="positive"><i class="fa-solid fa-circle-check"></i> Key loaded from .env</span>';
        } else {
            finnhubStatus.innerHTML = '<span class="negative"><i class="fa-solid fa-circle-xmark"></i> Not set — Taiwan stocks still work!</span>';
        }
    }
    if (geminiStatus) {
        if (GEMINI_API_KEY) {
            geminiStatus.innerHTML = '<span class="positive"><i class="fa-solid fa-circle-check"></i> Key loaded from .env</span>';
        } else {
            geminiStatus.innerHTML = '<span class="negative"><i class="fa-solid fa-circle-xmark"></i> Not set — AI will use mock responses</span>';
        }
    }
}

// Theme Switcher Logic
function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) return;

    // Load active theme from localStorage
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        const icon = themeBtn.querySelector('i');
        if (icon) {
            icon.className = 'fa-solid fa-sun';
        }
    }

    themeBtn.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-theme');
        const icon = themeBtn.querySelector('i');
        
        if (isLight) {
            localStorage.setItem('app-theme', 'light');
            if (icon) icon.className = 'fa-solid fa-sun';
            showToast('已切換為明亮主題 ☀️');
        } else {
            localStorage.setItem('app-theme', 'dark');
            if (icon) icon.className = 'fa-solid fa-moon';
            showToast('已切換為深色主題 🌙');
        }
        
        // Dynamic chart options update
        applyThemeToCharts();
    });
}

function applyThemeToCharts() {
    const isLight = document.body.classList.contains('light-theme');
    const textColor = isLight ? '#4B5563' : '#9CA3AF';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)';
    const borderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';

    const options = {
        layout: { textColor },
        grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor }
        },
        rightPriceScale: { borderColor },
        timeScale: { borderColor }
    };

    if (currentStockChart) {
        currentStockChart.applyOptions(options);
    }
    if (rsiChart) {
        rsiChart.applyOptions(options);
    }
    if (pipChartInstance) {
        pipChartInstance.applyOptions(options);
    }
}

// Navigation Logic
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-target');
            if(targetId) switchView(targetId);
        });
    });
}

function initResponsiveNavigation() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const navLinks = document.querySelectorAll('.nav-links li');

    if (menuToggle && sidebar && overlay) {
        const toggleSidebar = () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        };

        const closeSidebar = () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        };

        menuToggle.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', closeSidebar);

        navLinks.forEach(link => {
            link.addEventListener('click', closeSidebar);
        });
    }
}

// Ensure toggleAddForm is truly global and functional
function toggleAddForm() {
    const panel = document.getElementById('add-holding-panel');
    if (panel) {
        panel.classList.toggle('expanded');
    }
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active-view');
    }
    
    document.querySelectorAll('.nav-links li').forEach(l => {
        if(l.getAttribute('data-target') === viewId) l.classList.add('active');
        else l.classList.remove('active');
    });

    // Close sidebar on mobile after navigation
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (viewId === 'stock-detail-view') {
        setTimeout(resizeAllCharts, 100);
    }
}

// Common TW Stocks mapping for name-to-ticker resolution
const TW_NAME_MAP = {
    '台積電': '2330.TW',
    '鴻海': '2317.TW',
    '群聯': '8299.TWO',
    '聯發科': '2454.TW',
    '長榮': '2603.TW',
    '陽明': '2609.TW',
    '萬海': '2615.TW'
};

// Check if ticker is TW
function isTaiwanStock(ticker) {
    if (!ticker) return false;
    const cleanTicker = ticker.trim();
    if (/[ \u4e00-\u9fa5]/.test(cleanTicker)) return true;
    return /^\d{4,6}$/.test(ticker) || cleanTicker.endsWith('.TW') || cleanTicker.endsWith('.TWO');
}

function resolveTicker(input) {
    if (!input) return '';
    const cleanInput = input.trim();
    
    // Check if it's a known name
    if (TW_NAME_MAP[cleanInput]) return TW_NAME_MAP[cleanInput];
    
    // If it's a 4-digit number, auto-append .TW or .TWO logic can be added, 
    // but for now, we'll keep it as is if it's already a ticker format.
    return cleanInput;
}

function cleanTwTicker(ticker) {
    if (!ticker) return '';
    return ticker.replace(/\.(TW|TWO)$/i, '');
}

async function getQuickQuote(ticker) {
    if (isTaiwanStock(ticker)) {
        const cleanTicker = cleanTwTicker(ticker);
        
        // 1. Try FinMind
        try {
            const url = `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${cleanTicker}&start_date=${new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0]}`;
            const data = await fetchWithProxy(url);
            if (data && data.data && data.data.length > 0 && data.status !== 402) {
                const latest = data.data[data.data.length - 1];
                return { price: latest.close, change: latest.spread, d: (latest.spread / (latest.close - latest.spread)) * 100 };
            }
        } catch (e) {
            console.warn("FinMind failed in getQuickQuote:", e);
        }
        
        // 2. Try Yahoo Finance
        try {
            const yahooData = await fetchYahooFallbackCandles(ticker, '1day');
            return { price: yahooData.quote.c, change: yahooData.quote.d, d: yahooData.quote.dp };
        } catch (yahooErr) {
            console.warn("Yahoo failed in getQuickQuote:", yahooErr);
        }
        
        // 3. Try TWSE API
        try {
            const fallback = await fetchTwseFallbackCandles(ticker);
            return { price: fallback.quote.c, change: fallback.quote.d, d: fallback.quote.dp };
        } catch (twseErr) {
            console.warn("TWSE failed in getQuickQuote:", twseErr);
        }
        
        return { price: 0, change: 0, d: 0, error: "All data sources failed" };
    } else {
        const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
        if (!res.ok) return { price: 0, change: 0, d: 0, error: `HTTP ${res.status}` };
        const data = await res.json();
        return { price: data.c, change: data.d, d: data.dp };
    }
    return null;
}

// --- News Helpers ---
function getRelativeTime(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
}

async function fetchMarketNews() {
    if (!FINNHUB_API_KEY) return null;
    try {
        const res = await fetch(`${FINNHUB_BASE}/news?category=general&token=${FINNHUB_API_KEY}`);
        const data = await res.json();
        return Array.isArray(data) ? data.slice(0, 10) : [];
    } catch (e) {
        console.error("Failed to fetch news:", e);
        return null;
    }
}

// --- Auth Logic ---
function initAuth() {
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');

    if (btnLogin) btnLogin.addEventListener('click', signInWithGoogle);
    if (btnLogout) btnLogout.addEventListener('click', signOutUser);

    if (auth) {
        onAuthStateChanged(auth, async (user) => {
            currentUser = user;
            if (user) {
                // Logged in
                if (btnLogin) btnLogin.style.display = 'none';
                if (userInfo) userInfo.style.display = 'flex';
                if (btnLogout) btnLogout.style.display = 'flex';
                if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
                if (userName) userName.textContent = user.displayName || user.email;
                
                showToast(`Welcome, ${user.displayName || user.email}`);
                await fetchCloudWatchlist(user.uid);
                await fetchCloudPortfolio(user.uid);
                await fetchObservationList();
            } else {
                // Logged out
                if (btnLogin) btnLogin.style.display = 'flex';
                if (userInfo) userInfo.style.display = 'none';
                if (btnLogout) btnLogout.style.display = 'none';
                
                currentPortfolio = JSON.parse(localStorage.getItem('myPortfolio')) || [];
                portfolioQuotes = {};
                currentWatchlist = JSON.parse(localStorage.getItem('myWatchlist')) || defaultWatchlist;
                renderPortfolio();
                populateDashboard(); // Re-render watchlist
                fetchPortfolioQuotes(); // Fetch quotes for local portfolio
            }
        });
    } else {
        console.warn("Firebase Auth disabled. Proceeding locally.");
        currentPortfolio = JSON.parse(localStorage.getItem('myPortfolio')) || [];
        portfolioQuotes = {};
        currentWatchlist = JSON.parse(localStorage.getItem('myWatchlist')) || defaultWatchlist;
        renderPortfolio();
        populateDashboard();
        fetchPortfolioQuotes();
    }
}

async function signInWithGoogle() {
    if (!auth) {
        showToast("Login is disabled (Firebase missing).");
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Auth Error:", error);
        showToast("Login failed: " + error.message);
    }
}

async function signOutUser() {
    if (!auth) return;
    try {
        await signOut(auth);
        showToast("Logged out successfully");
    } catch (error) {
        console.error("Sign Out Error:", error);
    }
}

// --- Pre-close & Post-close Automation ---
let observationList = [];

async function fetchObservationList() {
    if (!auth || !db) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
        const querySnapshot = await getDocs(collection(db, `users/${user.uid}/observations`));
        observationList = [];
        querySnapshot.forEach(doc => {
            observationList.push({ id: doc.id, ...doc.data() });
        });
        if (currentPortfolioTab === 'OBSERVATIONS') renderObservationList();
    } catch (e) {
        console.error("Fetch Observation Error:", e);
    }
}

async function addToObservation(ticker) {
    const user = auth.currentUser;
    if (!user) {
        showToast("Please login to add to observation list");
        return;
    }
    try {
        if (observationList.some(o => o.ticker === ticker)) return;
        const docRef = doc(collection(db, `users/${user.uid}/observations`));
        const data = { ticker, date: new Date().toISOString() };
        await setDoc(docRef, data);
        observationList.push({ id: docRef.id, ...data });
        updateObservationButton(ticker);
        if (currentPortfolioTab === 'OBSERVATIONS') renderObservationList();
        showToast(`Added ${ticker} to Observation List`);
    } catch (e) {
        console.error("Add Observation Error:", e);
    }
}

async function removeFromObservation(ticker) {
    if (!auth || !db) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
        const obs = observationList.find(o => o.ticker === ticker);
        if (!obs) return;
        await deleteDoc(doc(db, `users/${user.uid}/observations`, obs.id));
        observationList = observationList.filter(o => o.ticker !== ticker);
        updateObservationButton(ticker);
        if (currentPortfolioTab === 'OBSERVATIONS') renderObservationList();
        showToast(`Removed ${ticker} from Observation List`);
    } catch (e) {
        console.error("Remove Observation Error:", e);
    }
}

function updateObservationButton(ticker) {
    const btn = document.getElementById('add-to-observation-btn');
    if (!btn) return;
    const isObserved = observationList.some(o => o.ticker === ticker);
    if (isObserved) {
        btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i> Remove Observation`;
        btn.setAttribute('data-action', 'remove-observation');
        btn.setAttribute('data-ticker', ticker);
        btn.classList.add('ghost-btn-danger');
        btn.classList.remove('secondary-btn');
    } else {
        btn.innerHTML = `<i class="fa-solid fa-eye"></i> Add to Observation`;
        btn.setAttribute('data-action', 'add-observation');
        btn.setAttribute('data-ticker', ticker);
        btn.classList.remove('ghost-btn-danger');
        btn.classList.add('secondary-btn');
    }
}

async function runPreCloseScanner() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // Taiwan Market Pre-close Window: 13:00 - 13:25
    if (hours === 13 && minutes >= 0 && minutes <= 25) {
        console.log("[Scanner] Running Pre-close real-time engine...");
        
        // 1. Scan Portfolio for exit signals
        for (let i = 0; i < currentPortfolio.length; i++) {
            await evaluatePortfolioSignal(currentPortfolio[i].ticker, i);
        }
        
        // 2. Scan Observation List for entry signals
        await fetchObservationList();
        for (const obs of observationList) {
            const history = await fetchStockHistoryCached(obs.ticker, '1day');
            if (history && history.candles) {
                const signal = generatePIPSignal(history.candles);
                if (signal.signal === 'BUY') {
                    showActionNotification(obs.ticker, signal.text);
                }
            }
        }
    }
}

function showActionNotification(ticker, text) {
    showToast(`🚨 ACTION REQUIRED: ${ticker} - ${text}`, 10000);
    
    const container = document.getElementById('market-actions-container');
    const list = document.getElementById('market-actions-list');
    if (!container || !list) return;
    
    container.style.display = 'block';
    
    // Check if already in list
    if (list.querySelector(`[data-ticker="${ticker}"]`)) return;
    
    const item = document.createElement('div');
    item.setAttribute('data-ticker', ticker);
    item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px;';
    item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span class="ticker-badge">${ticker}</span>
            <span style="font-weight: 600; color: #22c55e;">${text}</span>
        </div>
        <button class="primary-btn" style="padding: 6px 12px; font-size: 0.8em;" data-action="view-detail" data-ticker="${ticker}">View Chart</button>
    `;
    list.appendChild(item);
}

// Start the scanner every minute
setInterval(runPreCloseScanner, 60000);

// --- Cloud DB Logic ---
async function fetchCloudPortfolio(uid) {
    if (!db) return;
    try {
        const querySnapshot = await getDocs(collection(db, `users/${uid}/portfolio`));
        currentPortfolio = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            currentPortfolio.push({
                docId: doc.id,
                ticker: data.ticker,
                cost: data.cost,
                qty: data.qty,
                date: data.date
            });
        });
        await fetchPortfolioQuotes();
    } catch (error) {
        console.error("Fetch DB Error:", error);
        showToast("Failed to load portfolio");
    }
}

async function addCloudPortfolio(uid, ticker, cost, qty) {
    if (!db) return;
    try {
        const newDocRef = doc(collection(db, `users/${uid}/portfolio`));
        const data = { ticker, cost, qty, date: new Date().toISOString() };
        await setDoc(newDocRef, data);
        currentPortfolio.push({ docId: newDocRef.id, ...data });
        await fetchPortfolioQuotes();
    } catch (error) {
        console.error("Add DB Error:", error);
        showToast("Failed to add holding");
    }
}

async function updateCloudPortfolio(uid, docId, cost, qty) {
    if (!db) return;
    try {
        const docRef = doc(db, `users/${uid}/portfolio`, docId);
        await updateDoc(docRef, { cost, qty });
    } catch (error) {
        console.error("Update DB Error:", error);
        showToast("Failed to update holding");
    }
}

async function removeCloudPortfolio(uid, index) {
    const item = currentPortfolio[index];
    if (!item || !item.docId) return;
    try {
        await deleteDoc(doc(db, `users/${uid}/portfolio`, item.docId));
        currentPortfolio.splice(index, 1);
        renderPortfolio();
    } catch (error) {
        console.error("Delete DB Error:", error);
        showToast("Failed to remove holding");
    }
}

async function fetchCloudWatchlist(uid) {
    if (!db) return;
    try {
        const docRef = doc(db, `users/${uid}/settings`, 'watchlist');
        const docSnap = await getDocs(collection(db, `users/${uid}/settings`));
        let found = false;
        docSnap.forEach(d => {
            if (d.id === 'watchlist') {
                currentWatchlist = d.data().list || [];
                found = true;
            }
        });
        if (!found) {
            currentWatchlist = defaultWatchlist;
            await setDoc(docRef, { list: currentWatchlist });
        }
        populateDashboard();
    } catch (error) {
        console.error("Fetch DB Error:", error);
    }
}

async function saveCloudWatchlist(uid) {
    if (!db) return;
    try {
        await setDoc(doc(db, `users/${uid}/settings`, 'watchlist'), { list: currentWatchlist });
    } catch (error) {
        console.error("Save DB Error:", error);
    }
}

// --- Portfolio Logic ---
let portfolioQuotes = {};
let currentPortfolioTab = 'HOLDINGS'; // 'HOLDINGS' or 'OBSERVATIONS'

function switchPortfolioTab(tab) {
    currentPortfolioTab = tab;
    
    // UI Update
    document.querySelectorAll('.view-toggles .toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const holdingsContainer = document.getElementById('holdings-container');
    const observationsContainer = document.getElementById('observations-container');
    const summaryCard = document.getElementById('portfolio-summary');
    const addForm = document.getElementById('add-holding-panel');

    if (tab === 'HOLDINGS') {
        document.getElementById('tab-holdings').classList.add('active');
        holdingsContainer.style.display = 'block';
        observationsContainer.style.display = 'none';
        summaryCard.style.display = 'flex';
        addForm.style.display = 'block';
        renderPortfolio();
    } else {
        document.getElementById('tab-observations').classList.add('active');
        holdingsContainer.style.display = 'none';
        observationsContainer.style.display = 'block';
        summaryCard.style.display = 'none';
        addForm.style.display = 'none';
        renderObservationList();
    }
}

async function renderObservationList() {
    const listBody = document.getElementById('observation-table-list');
    const emptyState = document.getElementById('empty-observations');
    if (!listBody) return;

    if (observationList.length === 0) {
        listBody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    listBody.innerHTML = '';

    for (const obs of observationList) {
        const ticker = obs.ticker;
        const row = document.createElement('tr');
        row.classList.add('clickable-row');
        row.setAttribute('data-ticker', ticker);
        row.setAttribute('data-action', 'view-detail');
        row.innerHTML = `
            <td data-label="Ticker" style="padding: 16px 12px;"><span class="ticker-badge">${ticker}</span></td>
            <td data-label="Price" id="obs-price-${ticker}" style="text-align: right;">...</td>
            <td data-label="Trend" id="obs-trend-${ticker}" style="text-align: center;">...</td>
            <td data-label="Signal" id="obs-signal-${ticker}" style="text-align: center;">...</td>
            <td data-label="Confidence" id="obs-conf-${ticker}" style="text-align: center;">...</td>
            <td data-label="Action" style="text-align: center;">
                <button class="ghost-btn-danger" data-action="remove-observation" data-ticker="${ticker}" title="Stop Observing">
                    <i class="fa-solid fa-eye-slash"></i>
                </button>
            </td>
        `;
        listBody.appendChild(row);

        // Async fetch and update
        updateObservationRow(ticker);
    }
}

async function updateObservationRow(ticker) {
    const quote = await getQuickQuote(ticker);
    const priceCell = document.getElementById(`obs-price-${ticker}`);
    if (priceCell && quote) {
        priceCell.textContent = formatCurrency(quote.price, ticker);
    }

    const history = await fetchStockHistoryCached(ticker, '1day');
    if (history && history.candles) {
        const pips = findPIPs(history.candles);
        const trend = analyzeTrend(pips, history.candles);
        const itemSignal = generatePIPSignal(history.candles);

        const trendCell = document.getElementById(`obs-trend-${ticker}`);
        const signalCell = document.getElementById(`obs-signal-${ticker}`);
        const confCell = document.getElementById(`obs-conf-${ticker}`);

        if (trendCell) {
            trendCell.innerHTML = `<span style="color: ${trend.status === 'BULLISH' ? '#22c55e' : (trend.status === 'CONSOLIDATION' ? '#eab308' : 'var(--text-secondary)')}">${trend.status}</span>`;
        }
        if (signalCell) {
            signalCell.innerHTML = `<span style="color: ${itemSignal.color}">${itemSignal.text}</span>`;
        }
        if (confCell) {
            confCell.textContent = `${(trend.confidence * 100).toFixed(0)}%`;
        }
        
        // Cache this for the AI Assistant
        updateTacticalCache(ticker, trend, itemSignal);
    }
}

// In-memory cache for Tactical Insights
let tacticalCache = {};
let lastCacheUpdate = 0;

function updateTacticalCache(ticker, trend, signal) {
    tacticalCache[ticker] = {
        ticker,
        status: trend.status,
        signal: signal.text,
        confidence: trend.confidence,
        timestamp: Date.now()
    };
    lastCacheUpdate = Date.now();
}

/**
 * Returns a summarized string of all high-confidence signals for AI prompt injection
 */
export function getGlobalTacticalContext() {
    const activeSignals = Object.values(tacticalCache)
        .filter(item => item.confidence > 0.6)
        .map(item => `${item.ticker}: ${item.status} (${item.signal})`);
    
    if (activeSignals.length === 0) return "No significant tactical signals detected in portfolio/observations.";
    return "Active Tactical Signals: " + activeSignals.join(", ");
}
window.getGlobalTacticalContext = getGlobalTacticalContext;

async function fetchPortfolioQuotes() {
    if (currentPortfolio.length === 0) {
        renderPortfolio();
        return;
    }
    const promises = currentPortfolio.map(item => getQuickQuote(item.ticker));
    const results = await Promise.all(promises);
    currentPortfolio.forEach((item, index) => {
        if (results[index]) {
            portfolioQuotes[item.ticker] = results[index];
        }
    });
    renderPortfolio();
}

function initPortfolio() {
    // Handled by auth state change
}

// Market Tabs Logic
function setMarketTab(tabName) {
    currentMarketTab = tabName;
    document.querySelectorAll('.market-tabs .tab-btn').forEach(btn => {
        if (btn.textContent.toUpperCase() === tabName || (btn.textContent === 'All' && tabName === 'ALL')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderPortfolio();
    populateDashboard();
}

async function getTaiwanStockName(ticker) {
    if (!isTaiwanStock(ticker)) return '';
    const cleanTicker = cleanTwTicker(ticker);
    const hardcoded = {
        '2330': '台積電',
        '2317': '鴻海',
        '8299': '群聯',
        '2454': '聯發科',
        '2603': '長榮',
        '2609': '陽明',
        '2615': '萬海'
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

// Format Currency Utility
function formatCurrency(value, ticker = '') {
    if (ticker && isTaiwanStock(ticker)) {
        return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(value);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// Format volume utility
function formatCompactNumber(num) {
    if (num >= 1e6) {
        return (num / 1e6).toFixed(1) + 'M';
    }
    if (num >= 1e3) {
        return (num / 1e3).toFixed(1) + 'K';
    }
    return num.toString();
}

async function renderPortfolio() {
    const tableBody = document.getElementById('portfolio-list');
    const summaryContainer = document.getElementById('portfolio-summary');
    if (!tableBody) return;

    let displayPortfolio = currentPortfolio;
    if (currentMarketTab === 'US') {
        displayPortfolio = currentPortfolio.filter(item => !isTaiwanStock(item.ticker));
    } else if (currentMarketTab === 'TW') {
        displayPortfolio = currentPortfolio.filter(item => isTaiwanStock(item.ticker));
    }

    if (displayPortfolio.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px;">No holdings in this market.</td></tr>';
        if (summaryContainer) summaryContainer.innerHTML = '';
        return;
    }

    tableBody.innerHTML = '';
    let usEquity = 0, usCost = 0;
    let twEquity = 0, twCost = 0;

    for (let index = 0; index < currentPortfolio.length; index++) {
        const item = currentPortfolio[index];
        // Only render if it matches the tab filter
        const isTW = isTaiwanStock(item.ticker);
        if (currentMarketTab === 'US' && isTW) continue;
        if (currentMarketTab === 'TW' && !isTW) continue;

        const currentPrice = portfolioQuotes[item.ticker] ? portfolioQuotes[item.ticker].price : 0;
        const cost = parseFloat(item.cost) || 0;
        const qty = parseFloat(item.qty) || 0;
        const price = parseFloat(currentPrice) || 0;

        const pl = price > 0 ? (price * qty) - (cost * qty) : 0;
        const totalCost = cost * qty;
        const plPercent = totalCost !== 0 ? (pl / totalCost) * 100 : 0;
        
        if (item.ticker.includes('.TW') || isTaiwanStock(item.ticker)) {
            twEquity += price * qty;
            twCost += totalCost;
        } else {
            usEquity += price * qty;
            usCost += totalCost;
        }

        let displayName = item.ticker;
        if (isTW) {
            const name = await getTaiwanStockName(item.ticker);
            if (name) displayName = `${item.ticker} ${name}`;
        }

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        row.style.transition = 'background 0.2s';
        
        // Escape potentially malicious ticker names (XSS prevention)
        const escapeHtml = (unsafe) => {
            return (unsafe || '').toString()
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };
        const safeDisplayName = escapeHtml(displayName);
        
        row.innerHTML = `
            <td data-label="Ticker" style="padding: 16px 12px;"><span class="ticker-badge" style="font-size: 0.95em;">${safeDisplayName}</span></td>
            <td data-label="Price" style="padding: 16px 12px; text-align: right; font-variant-numeric: tabular-nums;">${currentPrice ? formatCurrency(currentPrice, item.ticker) : '...'}</td>
            <td data-label="Avg Cost" style="padding: 16px 12px; text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(item.cost, item.ticker)}</td>
            <td data-label="Qty" style="padding: 16px 12px; text-align: right; font-variant-numeric: tabular-nums;">${item.qty}</td>
            <td data-label="P/L" style="padding: 16px 12px; text-align: right; font-variant-numeric: tabular-nums;" class="${pl >= 0 ? 'positive' : 'negative'}">
                <div style="font-weight: 500;">${formatCurrency(pl, item.ticker)}</div>
                <div style="font-size: 0.85em; opacity: 0.8; margin-top: 2px;">${plPercent.toFixed(2)}%</div>
            </td>
            <td data-label="Signal" id="port-sig-${index}" style="padding: 16px 12px; text-align: center;"><i class="fa-solid fa-spinner fa-spin" style="color: var(--text-secondary);"></i></td>
            <td data-label="Action" style="padding: 16px 12px; text-align: center;"><button class="ghost-btn-danger" aria-label="Delete Holding" title="Delete Holding" data-action="remove-portfolio" data-index="${index}"><i class="fa-solid fa-trash"></i></button></td>
        `;
        row.classList.add('clickable-row');
        row.setAttribute('data-action', 'view-detail');
        row.setAttribute('data-ticker', item.ticker);
        tableBody.appendChild(row);
        
        // Asynchronously evaluate PIP signal
        evaluatePortfolioSignal(item.ticker, index);
    }

    if (summaryContainer) {
        let html = '';
        if (currentMarketTab === 'ALL' || currentMarketTab === 'US') {
            const usPL = usEquity - usCost;
            const usPLPercent = usCost !== 0 ? (usPL / usCost) * 100 : 0;
            html += `
                <div class="stat-card glass-panel" style="flex: 1; padding: 20px;">
                    <span class="stat-label">US Total Equity</span>
                    <span class="stat-value">${formatCurrency(usEquity, 'AAPL')}</span>
                </div>
                <div class="stat-card glass-panel" style="flex: 1; padding: 20px;">
                    <span class="stat-label">US Total P/L</span>
                    <span class="stat-value ${usPL >= 0 ? 'positive' : 'negative'}">
                        ${formatCurrency(usPL, 'AAPL')} (${usPLPercent.toFixed(2)}%)
                    </span>
                </div>
            `;
        }
        if (currentMarketTab === 'ALL' || currentMarketTab === 'TW') {
            const twPL = twEquity - twCost;
            const twPLPercent = twCost !== 0 ? (twPL / twCost) * 100 : 0;
            html += `
                <div class="stat-card glass-panel" style="flex: 1; padding: 20px;">
                    <span class="stat-label">TW Total Equity</span>
                    <span class="stat-value">${formatCurrency(twEquity, '2330')}</span>
                </div>
                <div class="stat-card glass-panel" style="flex: 1; padding: 20px;">
                    <span class="stat-label">TW Total P/L</span>
                    <span class="stat-value ${twPL >= 0 ? 'positive' : 'negative'}">
                        ${formatCurrency(twPL, '2330')} (${twPLPercent.toFixed(2)}%)
                    </span>
                </div>
            `;
        }
        summaryContainer.innerHTML = html;
    }
}

async function addToPortfolioFromForm(event) {
    const tickerInput = document.getElementById('port-ticker');
    const costInput = document.getElementById('port-cost');
    const qtyInput = document.getElementById('port-qty');

    if (!tickerInput || !costInput || !qtyInput) return;

    let ticker = tickerInput.value.toUpperCase().trim();
    ticker = resolveTicker(ticker);
    
    const cost = parseFloat(costInput.value);
    const qty = parseInt(qtyInput.value);

    if (!ticker || isNaN(cost) || isNaN(qty)) {
        showToast("Please enter valid Ticker, Cost, and Quantity");
        return;
    }

    const btn = event ? event.target.closest('button') : null;
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
    }
    
    const existingIndex = currentPortfolio.findIndex(p => p.ticker === ticker);

    if (currentUser) {
        if (existingIndex !== -1) {
            const docId = currentPortfolio[existingIndex].docId;
            await updateCloudPortfolio(currentUser.uid, docId, cost, qty);
            currentPortfolio[existingIndex].cost = cost;
            currentPortfolio[existingIndex].qty = qty;
            renderPortfolio();
            fetchPortfolioQuotes();
            showToast(`Updated ${ticker} in cloud portfolio`);
        } else {
            await addCloudPortfolio(currentUser.uid, ticker, cost, qty);
            showToast(`Added ${ticker} to cloud portfolio`);
        }
    } else {
        if (existingIndex !== -1) {
            currentPortfolio[existingIndex].cost = cost;
            currentPortfolio[existingIndex].qty = qty;
            showToast(`Updated ${ticker} in local portfolio`);
        } else {
            const data = { ticker, cost, qty, date: new Date().toISOString() };
            currentPortfolio.push(data);
            showToast(`Added ${ticker} to local portfolio`);
        }
        localStorage.setItem('myPortfolio', JSON.stringify(currentPortfolio));
    }

    // Auto switch tab to added stock market
    const isTW = isTaiwanStock(ticker);
    currentMarketTab = isTW ? 'TW' : 'US';
    document.querySelectorAll('#portfolio-tabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.includes(isTW ? 'TW' : 'US'));
    });

    renderPortfolio();
    fetchPortfolioQuotes();
    
    if (btn) {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
    
    // Sync to Watchlist if not exists
    if (!currentWatchlist.includes(ticker)) {
        currentWatchlist.push(ticker);
        saveWatchlist();
        populateDashboard();
    }
    
    // Clear form
    document.getElementById('port-ticker').value = '';
    document.getElementById('port-cost').value = '';
    document.getElementById('port-qty').value = '';
}

async function removeFromPortfolio(index, event) {
    if (event) {
        event.stopPropagation();
    }
    if (confirm('Are you sure you want to remove this holding?')) {
        if (currentUser) {
            await removeCloudPortfolio(currentUser.uid, index);
            showToast("Removed from cloud portfolio");
        } else {
            currentPortfolio.splice(index, 1);
            localStorage.setItem('myPortfolio', JSON.stringify(currentPortfolio));
            renderPortfolio();
            showToast("Removed from local portfolio");
        }
    }
}




async function evaluatePortfolioSignal(ticker, index) {
    try {
        const history = await fetchStockHistoryCached(ticker, '1day');
        const sigTd = document.getElementById(`port-sig-${index}`);
        if (!sigTd) return;
        
        if (history && history.candles && history.candles.length > 7) {
            // Slice last 120 candles for recent trend evaluation
            const recentCandles = history.candles.slice(-120);
            const pips = findPIPs(recentCandles);
            const signal = generatePIPSignal(recentCandles);
            
            // Apply confidence styling
            const confidenceStr = signal.confidence ? ` <small>(${Math.round(signal.confidence * 100)}%)</small>` : '';
            sigTd.innerHTML = `<span style="color: ${signal.color}; font-weight: bold; font-size: 0.9em;">${signal.text}${confidenceStr}</span>`;
            
            // Verify if it's a new BUY signal
            if (signal.signal === 'BUY') {
                const verification = await verifyWithYahoo(ticker, recentCandles[recentCandles.length-1].close);
                if (!verification.verified) {
                    sigTd.innerHTML += ` <i class="fa-solid fa-triangle-exclamation" style="color: #eab308" title="Yahoo Verification Failed"></i>`;
                }
            }
        } else {
            sigTd.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.9em;">N/A</span>`;
        }
    } catch (e) {
        const sigTd = document.getElementById(`port-sig-${index}`);
        if (sigTd) sigTd.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.9em;">Err</span>`;
    }
}

function calcATR(candles, period = 14) {
    if (candles.length < period + 1) return 0;
    
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
        const h = candles[i].high;
        const l = candles[i].low;
        const pc = candles[i-1].close;
        const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        trs.push(tr);
    }
    
    // Simple average of TR
    const latestTRs = trs.slice(-period);
    return latestTRs.reduce((a, b) => a + b, 0) / period;
}

function calculateAISignals(ticker, candles) {
    const portfolioList = (typeof window !== 'undefined' && window.currentPortfolio) ? window.currentPortfolio : currentPortfolio;
    const portfolioItem = portfolioList.find(p => p.ticker === ticker);
    
    // Truncate context to last 200 candles for tactical signals to avoid historical bias
    const recentCandles = candles.length > 200 ? candles.slice(-200) : candles;
    const atr = calcATR(recentCandles, 14);
    const lastPrice = candles[candles.length - 1].close;
    
    if (!atr) return null;

    const pips = findPIPs(recentCandles);
    const trend = analyzeTrend(pips, recentCandles);
    const pipSignal = generatePIPSignal(recentCandles);

    const entryPrice = portfolioItem ? portfolioItem.cost : lastPrice;
    const qty = portfolioItem ? portfolioItem.qty : 0;

    // ── Trailing Stop & Targets ──────────────────────────────────────────────
    // 移動停損 (Trailing Stop): 近期最高價往下 2×ATR% 自動追蹤
    // 目標價 (TP): 以持倉均價為基準 +15% / +25% 固定目標
    const recentHigh = Math.max(...recentCandles.map(c => c.high));
    const trailingPct = (2 * atr) / recentHigh;  // ATR-based trailing %
    const trailingStop = recentHigh * (1 - trailingPct);

    const isBearish = pipSignal.signal === 'SELL';

    let stopLoss, tp1, tp2;

    if (portfolioItem) {
        // 持倉模式：移動停損 + 固定百分比目標
        stopLoss = Math.max(trailingStop, entryPrice * (isBearish ? 1.05 : 0.88)); // 多單最低容忍 -12%
        tp1 = isBearish ? entryPrice * 0.85 : entryPrice * 1.15;   // ±15%
        tp2 = isBearish ? entryPrice * 0.75 : entryPrice * 1.25;   // ±25%
    } else {
        // 無持倉模式：純 ATR 計算（原本邏輯）
        const anchorPrice = lastPrice;
        if (isBearish) {
            const lastPeak = trend.peaks.length > 0 ? trend.peaks[trend.peaks.length-1].value : 0;
            if (lastPeak > lastPrice) {
                const peakDist = (lastPeak - lastPrice) / lastPrice;
                stopLoss = (peakDist < 0.15) ? lastPeak : lastPrice + (2 * atr);
            } else {
                stopLoss = lastPrice + (2 * atr);
            }
            const riskPerShare = stopLoss - anchorPrice;
            tp1 = anchorPrice - (2 * riskPerShare);
            tp2 = anchorPrice - (3 * riskPerShare);
        } else {
            const lastTrough = trend.troughs.length > 0 ? trend.troughs[trend.troughs.length-1].value : 0;
            if (lastTrough > 0 && lastTrough < lastPrice) {
                const troughDist = (lastPrice - lastTrough) / lastPrice;
                stopLoss = (troughDist < 0.15) ? lastTrough : lastPrice - (2 * atr);
            } else {
                stopLoss = lastPrice - (2 * atr);
            }
            const riskPerShare = anchorPrice - stopLoss;
            tp1 = anchorPrice + (2 * riskPerShare);
            tp2 = anchorPrice + (3 * riskPerShare);
        }
    }

    // 移動停損目前是否已在獲利區（鎖利）
    const isTrailingInProfit = portfolioItem && trailingStop > entryPrice;
    const trailingLockedPnl = portfolioItem ? qty * (trailingStop - entryPrice) : 0;
    const trailingPctDisplay = (trailingPct * 100).toFixed(1);
    const recentHighDisplay = recentHigh.toFixed(2);

    // Evaluate Entry signals (Entry A and Entry B)
    const entrySignal = evaluateEntry(recentCandles, pips, trend);

    // Evaluate Exit signals for portfolio positions
    let exitSignal = null;
    if (portfolioItem) {
        const pos = {
            cost: portfolioItem.cost,
            stopLoss: parseFloat(stopLoss.toFixed(2))
        };
        exitSignal = evaluateExit(recentCandles, pips, pos);
    }

    // R:R Ratio
    const risk = Math.abs(entryPrice - stopLoss);
    const reward1 = Math.abs(tp1 - entryPrice);
    const reward2 = Math.abs(tp2 - entryPrice);
    const rrRatio1 = risk > 0 ? (reward1 / risk).toFixed(1) : '2.0';
    const rrRatio2 = risk > 0 ? (reward2 / risk).toFixed(1) : '3.0';

    // Projected P/L
    const slImpact = qty * (stopLoss - entryPrice);
    const tp1Impact = qty * (tp1 - entryPrice);
    const tp2Impact = qty * (tp2 - entryPrice);

    // Real-Time unearned P/L (即時損益)
    const realtimePnl = portfolioItem ? qty * (lastPrice - entryPrice) : 0;
    const realtimePnlPercent = portfolioItem ? ((lastPrice - entryPrice) / entryPrice) * 100 : 0;

    // Expected Trailing stop P/L (移動鎖利預期損益)
    const expectedPnl = portfolioItem ? qty * (stopLoss - entryPrice) : 0;
    const expectedPnlPercent = portfolioItem ? ((stopLoss - entryPrice) / entryPrice) * 100 : 0;

    return {
        atr: atr.toFixed(2),
        stopLoss: stopLoss.toFixed(2),
        tp1: tp1.toFixed(2),
        tp2: tp2.toFixed(2),
        slImpact: slImpact.toFixed(0),
        tp1Impact: tp1Impact.toFixed(0),
        tp2Impact: tp2Impact.toFixed(0),
        inPortfolio: !!portfolioItem,
        entryPrice: entryPrice.toFixed(2),
        currentPrice: lastPrice,
        trend: trend,
        signal: pipSignal,
        rrRatio1: `1:${rrRatio1}`,
        rrRatio2: `1:${rrRatio2}`,
        entrySignal: entrySignal,
        exitSignal: exitSignal,
        qty: qty,
        realtimePnl: realtimePnl.toFixed(0),
        realtimePnlPercent: realtimePnlPercent.toFixed(2),
        expectedPnl: expectedPnl.toFixed(0),
        expectedPnlPercent: expectedPnlPercent.toFixed(2),
        // 移動停損附加資料
        trailingStop: trailingStop.toFixed(2),
        trailingPct: trailingPctDisplay,
        recentHigh: recentHighDisplay,
        isTrailingInProfit,
        trailingLockedPnl: trailingLockedPnl.toFixed(0),
    };
}

// --- Watchlist Logic ---
function initWatchlist() {
    const addBtn = document.getElementById('add-watchlist-btn');
    const addInput = document.getElementById('add-watchlist-input');

    if (addBtn && addInput) {
        addBtn.addEventListener('click', () => {
            const ticker = addInput.value.trim().toUpperCase();
            if (ticker && !currentWatchlist.includes(ticker)) {
                currentWatchlist.push(ticker);
                saveWatchlist();
                addInput.value = '';
                populateDashboard();
            }
        });

        addInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addBtn.click();
        });
    }
}

function removeFromWatchlist(ticker, event) {
    event.stopPropagation();
    currentWatchlist = currentWatchlist.filter(t => t !== ticker);
    saveWatchlist();
    populateDashboard();
}

async function saveWatchlist() {
    if (currentUser) {
        await saveCloudWatchlist(currentUser.uid);
    } else {
        localStorage.setItem('myWatchlist', JSON.stringify(currentWatchlist));
    }
}

// Dashboard Population
async function populateDashboard() {
    // Indices (Mock for now, as finding reliable free index APIs is hard)
    const marketIndices = [
        { name: 'S&P 500', price: '5,087.03', change: '+1.2%', isPositive: true, ticker: '^GSPC' },
        { name: 'NASDAQ', price: '15,996.82', change: '+1.5%', isPositive: true, ticker: '^IXIC' },
        { name: 'TWSE', price: '20,466.84', change: '+0.5%', isPositive: true, ticker: '^TWII' }
    ];
    
    document.querySelector('.indices-grid').innerHTML = marketIndices.map(index => `
        <div class="index-card glass-panel clickable-card" data-action="view-detail" data-ticker="${index.ticker}">
            <div class="index-header"><span>${index.name}</span><i class="fa-solid fa-arrow-trend-${index.isPositive ? 'up' : 'down'} ${index.isPositive ? 'positive' : 'negative'}"></i></div>
            <div class="index-price">${index.price}</div>
            <div class="index-change ${index.isPositive ? 'positive' : 'negative'}">${index.change}</div>
        </div>
    `).join('');

    // Watchlist
    const listEl = document.getElementById('trending-list');
    listEl.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    
    const apiKey = FINNHUB_API_KEY;
    let html = '';
    
    let displayWatchlist = currentWatchlist;
    if (currentMarketTab === 'US') {
        displayWatchlist = currentWatchlist.filter(t => !isTaiwanStock(t));
    } else if (currentMarketTab === 'TW') {
        displayWatchlist = currentWatchlist.filter(t => isTaiwanStock(t));
    }

    if (displayWatchlist.length === 0) {
        html = '<div style="text-align:center; padding: 20px;">No stocks in this market.</div>';
    }

    for (let ticker of displayWatchlist) {
        let price = '...', change = '...', isPositive = true, name = ticker;
        try {
            if (isTaiwanStock(ticker)) {
                const twName = await getTaiwanStockName(ticker);
                if (twName) name = `${ticker} ${twName}`;
                
                const quoteInfo = await getQuickQuote(ticker);
                if (quoteInfo && !quoteInfo.error && quoteInfo.price > 0) {
                    price = quoteInfo.price;
                    isPositive = quoteInfo.change >= 0;
                    change = `${isPositive?'+':''}${quoteInfo.change.toFixed(2)} (${quoteInfo.d.toFixed(2)}%)`;
                } else {
                    price = 'Error';
                    change = quoteInfo.error || 'Error';
                }
            } else {
                if (apiKey) {
                    // Fetch from Finnhub
                    const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${ticker}&token=${apiKey}`);
                    const data = await res.json();
                    if (data.c) {
                        price = data.c;
                        isPositive = data.d >= 0;
                        change = `${isPositive?'+':''}${data.d.toFixed(2)} (${data.dp.toFixed(2)}%)`;
                    }
                } else {
                    price = 'No Finnhub Key';
                    change = 'Set VITE_FINNHUB_API_KEY in .env';
                }
            }
        } catch(e) {
            price = 'Error'; change = 'Error';
        }

        const priceStr = typeof price === 'number' ? formatCurrency(price, ticker) : price;

        html += `
            <li class="stock-item clickable-item" data-action="view-detail" data-ticker="${ticker}">
                <div class="stock-info"><strong>${name}</strong><span>${isTaiwanStock(ticker) ? 'TWSE' : 'US'}</span></div>
                <div class="stock-price-col"><strong>${priceStr}</strong><span class="${isPositive ? 'positive' : 'negative'}">${change}</span></div>
                <button class="delete-stock-btn" data-action="remove-watchlist" data-ticker="${ticker}"><i class="fa-solid fa-trash"></i></button>
            </li>
        `;
    }
    
    listEl.innerHTML = html;

    // News
    const newsListEl = document.getElementById('news-list');
    fetchMarketNews().then(newsData => {
        if (!newsData || newsData.length === 0) {
            newsListEl.innerHTML = '<li class="news-item"><h4>No news available</h4><span>Check VITE_FINNHUB_API_KEY in .env</span></li>';
            return;
        }
        newsListEl.innerHTML = newsData.map(news => `
            <li class="news-item">
                <a href="${news.url}" target="_blank" style="text-decoration: none; color: inherit;">
                    <h4>${news.headline}</h4>
                    <span>${news.source} • ${getRelativeTime(news.datetime)}</span>
                </a>
            </li>
        `).join('');
    });
}

// Stock Detail Logic
const POPULAR_STOCKS = [
    { symbol: '2330.TW', name: '台積電', market: 'tw' },
    { symbol: '2317.TW', name: '鴻海', market: 'tw' },
    { symbol: '2454.TW', name: '聯發科', market: 'tw' },
    { symbol: '8299.TWO', name: '群聯', market: 'tw' },
    { symbol: '2603.TW', name: '長榮', market: 'tw' },
    { symbol: '2881.TW', name: '富邦金', market: 'tw' },
    { symbol: '2882.TW', name: '國泰金', market: 'tw' },
    { symbol: '0050.TW', name: '元大台灣50', market: 'tw' },
    { symbol: 'AAPL', name: 'Apple Inc.', market: 'us' },
    { symbol: 'TSLA', name: 'Tesla Inc.', market: 'us' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'us' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'us' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'us' },
    { symbol: 'META', name: 'Meta Platforms', market: 'us' },
    { symbol: 'NFLX', name: 'Netflix Inc.', market: 'us' }
];

function setupSearch() {
    const searchInput = document.getElementById('stock-search');
    const autocompleteContainer = document.getElementById('search-autocomplete');
    let activeIndex = -1;
    let filteredStocks = [];

    function renderSuggestions(suggestions) {
        filteredStocks = suggestions;
        if (suggestions.length === 0) {
            autocompleteContainer.innerHTML = '';
            autocompleteContainer.classList.add('hidden');
            activeIndex = -1;
            return;
        }

        autocompleteContainer.innerHTML = suggestions.map((stock, index) => `
            <div class="autocomplete-item ${index === activeIndex ? 'active' : ''}" data-index="${index}" data-symbol="${stock.symbol}">
                <div class="stock-info">
                    <span class="stock-symbol">${stock.symbol}</span>
                    <span class="stock-name">${stock.name}</span>
                </div>
                <span class="market-badge ${stock.market}">${stock.market.toUpperCase()}</span>
            </div>
        `).join('');
        autocompleteContainer.classList.remove('hidden');

        // Click handlers on items
        const items = autocompleteContainer.querySelectorAll('.autocomplete-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.getAttribute('data-symbol');
                loadStockDetail(symbol);
                searchInput.value = '';
                autocompleteContainer.classList.add('hidden');
                activeIndex = -1;
            });
        });
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toUpperCase();
        if (!query) {
            renderSuggestions([]);
            return;
        }

        // Filter: match query by symbol start or name partial
        const matches = POPULAR_STOCKS.filter(stock => 
            stock.symbol.toUpperCase().includes(query) || 
            stock.name.includes(query) ||
            stock.name.toLowerCase().includes(query.toLowerCase())
        );

        activeIndex = -1;
        renderSuggestions(matches);
    });

    searchInput.addEventListener('keydown', (e) => {
        const items = autocompleteContainer.querySelectorAll('.autocomplete-item');
        if (autocompleteContainer.classList.contains('hidden') || items.length === 0) {
            if (e.key === 'Enter' && searchInput.value.trim() !== '') {
                loadStockDetail(searchInput.value.toUpperCase());
                searchInput.value = '';
                autocompleteContainer.classList.add('hidden');
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
            updateActiveItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            updateActiveItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < filteredStocks.length) {
                const selectedSymbol = filteredStocks[activeIndex].symbol;
                loadStockDetail(selectedSymbol);
                searchInput.value = '';
                autocompleteContainer.classList.add('hidden');
                activeIndex = -1;
            } else if (searchInput.value.trim() !== '') {
                loadStockDetail(searchInput.value.toUpperCase());
                searchInput.value = '';
                autocompleteContainer.classList.add('hidden');
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            autocompleteContainer.classList.add('hidden');
            activeIndex = -1;
        }
    });

    function updateActiveItem(items) {
        items.forEach((item, index) => {
            if (index === activeIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Click outside to close dropdown
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !autocompleteContainer.contains(e.target)) {
            autocompleteContainer.classList.add('hidden');
            activeIndex = -1;
        }
    });
}

async function fetchTwseFallbackCandles(ticker, tf = '1day') {
    const twTicker = cleanTwTicker(ticker);
    const today = new Date();
    
    // Fetch last 3 months to ensure enough data for PIP/Patterns
    const months = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}${m}01`);
    }

    let allData = [];
    let title = '';
    
    // Parallel fetch for all months
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
    
    // Process results (reverse them to maintain chronological order as months are [latest, mid, oldest])
    results.reverse().forEach(json => {
        if (json && json.data && json.data.length > 0) {
            allData = [...allData, ...json.data];
            if (!title) title = json.title;
        }
    });

    if (allData.length === 0) throw new Error("No data from TWSE");
    
    // Deduplicate if any
    const uniqueData = Array.from(new Set(allData.map(r => JSON.stringify(r)))).map(s => JSON.parse(s));
    
    const candles = uniqueData.map(row => {
        try {
            const dateParts = row[0].split('/');
            if (dateParts.length < 3) return null;
            const year = parseInt(dateParts[0]) + 1911;
            const month = dateParts[1];
            const day = dateParts[2];
            const time = `${year}-${month}-${day}`;
            
            const parseVal = (val) => {
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
    }).filter(c => c !== null);

    if (candles.length === 0) throw new Error("No valid data points found in TWSE response");

    const latest = candles[candles.length - 1];

    // Fetch Taiwan stock outstanding shares for market cap
    let marketCapitalization = null;
    try {
        const shStart = new Date();
        shStart.setDate(shStart.getDate() - 30);
        const shUrl = `${FINMIND_BASE}?dataset=TaiwanStockShareholding&data_id=${twTicker}&start_date=${formatDt(shStart)}`;
        const shData = await fetchWithProxy(shUrl);
        if (shData && shData.data && shData.data.length > 0) {
            const validRecords = shData.data.filter(r => r.NumberOfSharesIssued > 0);
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
            pc: candles[candles.length-2]?.close || latest.open 
        },
        candles: aggregateCandles(candles, tf),
        profile: { name: title ? title.split(' ')[2] : ticker, marketCapitalization }
    };
}

/**
 * Helper to aggregate daily candles into higher timeframes
 */
function aggregateCandles(candles, tf) {
    if (!tf || tf === '1day' || !candles || candles.length === 0) return candles;
    
    const result = [];
    const groups = {};

    candles.forEach(candle => {
        let dateObj;
        if (typeof candle.time === 'number') {
            dateObj = new Date(candle.time * 1000);
        } else {
            dateObj = new Date(candle.time);
        }

        let key;
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

async function fetchTwseCandles(ticker, tf) {
    try {
        const twTicker = cleanTwTicker(ticker);
        const end = new Date();
        const start = new Date();
        start.setFullYear(end.getFullYear() - 3);
        
        const url = `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${twTicker}&start_date=${formatDt(start)}&end_date=${formatDt(end)}`;
        const data = await fetchWithProxy(url);
        
        if(!data.data || data.data.length === 0 || data.status === 402) {
            throw new Error("FinMind rate limited or empty data");
        }
        
        const candles = data.data.map(d => ({
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
            pc: candles[candles.length-2]?.close || latest.open 
        };

        // Fetch Taiwan stock outstanding shares for market cap
        let marketCapitalization = null;
        try {
            const shStart = new Date();
            shStart.setDate(shStart.getDate() - 30);
            const shUrl = `${FINMIND_BASE}?dataset=TaiwanStockShareholding&data_id=${twTicker}&start_date=${formatDt(shStart)}`;
            const shData = await fetchWithProxy(shUrl);
            if (shData && shData.data && shData.data.length > 0) {
                const validRecords = shData.data.filter(r => r.NumberOfSharesIssued > 0);
                if (validRecords.length > 0) {
                    const latestSh = validRecords[validRecords.length - 1];
                    marketCapitalization = (latestSh.NumberOfSharesIssued * latest.close) / 1000000;
                }
            }
        } catch (shErr) {
            console.warn("Failed to fetch shareholding for TW stock market cap:", shErr);
        }

        return { quote, candles: aggregateCandles(candles, tf), profile: { name, marketCapitalization } };
    } catch (e) {
        console.error("FinMind Error, trying Yahoo fallback first, then TWSE fallback:", e);
        try {
            return await fetchYahooFallbackCandles(ticker, tf);
        } catch (yahooErr) {
            console.error("Yahoo fallback failed too, trying TWSE fallback:", yahooErr);
            return await fetchTwseFallbackCandles(ticker);
        }
    }
}

async function fetchUSCandles(ticker, finnhubKey, tf) {
    // 1. Fetch real-time quote and profile from Finnhub
    const [quoteRes, profileRes] = await Promise.all([
        fetch(`${FINNHUB_BASE}/quote?symbol=${ticker}&token=${finnhubKey}`),
        fetch(`${FINNHUB_BASE}/stock/profile2?symbol=${ticker}&token=${finnhubKey}`)
    ]);

    if (quoteRes.status === 429 || profileRes.status === 429) {
        throw new Error("Fetch failed with status 429");
    }
    if (!quoteRes.ok || !profileRes.ok) {
        throw new Error(`Fetch failed with status ${quoteRes.status || profileRes.status}`);
    }

    const quote = await quoteRes.json();
    const profile = await profileRes.json();

    if (quote.c == 0 && quote.d == null) throw new Error("Invalid ticker");

    // 2. Fetch historical candles from Twelve Data
    let candles = [];
    if (TWELVEDATA_API_KEY) {
        try {
            // Twelve data doesn't have 1year, so we use 1month and aggregate for 1year
            const apiTf = tf === '1year' ? '1month' : tf;
            const outputSize = (tf === '15min' || tf === '1h') ? 500 : 2520;
            
            // Symbol Translation for Indices (Twelve Data uses different formats than Finnhub/Yahoo)
            let twelveTicker = ticker;
            if (ticker === '^GSPC') twelveTicker = 'SPX';
            if (ticker === '^IXIC') twelveTicker = 'IXIC';
            if (ticker === '^NDX') twelveTicker = 'NDX';
            if (ticker === '^DJI') twelveTicker = 'DJI';

            const candleRes = await fetch(`${TWELVEDATA_BASE}/time_series?symbol=${twelveTicker}&interval=${apiTf}&outputsize=${outputSize}&apikey=${TWELVEDATA_API_KEY}`);
            const cData = await candleRes.json();
            
            if (cData.status === "ok") {
                candles = cData.values.map(v => {
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

                // If yearly was requested, aggregate from monthly
                if (tf === '1year') {
                    candles = aggregateCandles(candles, '1year');
                }
            }
        } catch (e) {
            console.warn("Twelve Data fetch failed:", e);
        }
    }
    
    return { quote, candles, profile };
}

async function fetchStockHistoryCached(ticker, resolution = '1day') {
    const cacheKey = `history_cache_${ticker}_${resolution}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            // TTL = 1 hour (3600000 ms)
            if (Date.now() - parsed.timestamp < 3600000) {
                return parsed.data;
            }
        } catch(e) {}
    }
    
    let result = null;
    if (isTaiwanStock(ticker)) {
        result = await fetchTwseCandles(ticker, resolution);
    } else {
        result = await fetchUSCandles(ticker, FINNHUB_API_KEY, resolution);
    }
    
    if (result && result.candles && result.candles.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: result
        }));
    }
    return result;
}

function showToast(msg, duration = 3500) {
    let container = document.getElementById('app-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'app-toast-container';
        container.className = 'app-toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'app-toast';

    // Match theme tags
    let type = 'info';
    let icon = 'fa-info-circle';
    if (msg.includes('Removed') || msg.includes('failed') || msg.includes('🚨') || msg.includes('Failed') || msg.includes('missing')) {
        type = 'danger';
        icon = 'fa-circle-exclamation';
    } else if (msg.includes('Added') || msg.includes('success') || msg.includes('Welcome') || msg.includes('Success') || msg.includes('successfully')) {
        type = 'success';
        icon = 'fa-circle-check';
    }

    toast.classList.add(type);
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);

    // Force reflow for opacity transition
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, duration);
}

async function loadStockDetail(ticker) {
    currentTicker = ticker; // Save for TF switching
    switchView('stock-detail-view');
    document.getElementById('detail-ticker').textContent = ticker;
    document.getElementById('detail-name').textContent = ticker; // Default to ticker during load
    document.getElementById('detail-price').textContent = '...';
    document.getElementById('detail-change').textContent = '';
    document.getElementById('ai-quick-summary').innerHTML = `
        <div class="skeleton-loader">
            <div class="skeleton-line w-90"></div>
            <div class="skeleton-line w-80"></div>
            <div class="skeleton-line w-65"></div>
        </div>
    `;
    
    updateObservationButton(ticker);

    // Reset to Day view on new search
    currentTimeframe = '1day';
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-tf') === '1day'));

    await loadChartData(ticker, '1day');
}

async function loadChartData(ticker, tf) {
    currentChartData = []; // Reset
    const summaryEl = document.getElementById('ai-quick-summary');
    
    try {
        let data;
        if (isTaiwanStock(ticker)) {
            data = await fetchTwseCandles(ticker, tf);
        } else if (FINNHUB_API_KEY) {
            data = await fetchUSCandles(ticker, FINNHUB_API_KEY, tf);
        } else {
            throw new Error('VITE_FINNHUB_API_KEY not set in .env file');
        }

        const { quote, candles, profile } = data;
        currentChartData = candles;

        // Robust Quote Fallback (especially for indices where Finnhub might return empty quotes)
        const lastCandle = candles.length > 0 ? candles[candles.length - 1] : { close: 0, high: 0, low: 0, open: 0 };
        const safeQuote = {
            c: quote?.c || lastCandle.close || 0,
            d: quote?.d || 0,
            dp: quote?.dp || 0,
            h: quote?.h || lastCandle.high || 0,
            l: quote?.l || lastCandle.low || 0,
            pc: quote?.pc || lastCandle.open || 0
        };

        const currencySymbol = getCurrencySymbol(ticker);
        document.getElementById('detail-name').textContent = profile?.name || ticker;
        document.getElementById('detail-price').textContent = `${currencySymbol}${safeQuote.c.toFixed(2)}`;
        
        const isPositive = safeQuote.d >= 0;
        const changeText = `${isPositive ? '+' : ''}${safeQuote.d.toFixed(2)} (${safeQuote.dp.toFixed(2)}%)`;
        const changeEl = document.getElementById('detail-change');
        changeEl.textContent = changeText;
        changeEl.className = isPositive ? 'positive' : 'negative';

        document.getElementById('stats-grid').innerHTML = `
            <div class="stat-item"><span class="stat-label">Market Cap</span><span class="stat-value">${profile?.marketCapitalization ? currencySymbol+(profile.marketCapitalization/1000).toFixed(2)+'B' : 'N/A'}</span></div>
            <div class="stat-item"><span class="stat-label">High (Day)</span><span class="stat-value">${currencySymbol}${safeQuote.h.toFixed(2)}</span></div>
            <div class="stat-item"><span class="stat-label">Low (Day)</span><span class="stat-value">${currencySymbol}${safeQuote.l.toFixed(2)}</span></div>
            <div class="stat-item"><span class="stat-label">Prev Close</span><span class="stat-value">${currencySymbol}${safeQuote.pc.toFixed(2)}</span></div>
        `;

        document.getElementById('ai-quick-summary').innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span class="badge" style="background: ${isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${isPositive ? '#10B981' : '#EF4444'}; padding: 4px 8px;">
                    ${isPositive ? '📈' : '📉'} ${safeQuote.dp.toFixed(2)}%
                </span>
                <span>${profile?.name || ticker} is currently trading at <strong>${currencySymbol}${safeQuote.c.toFixed(2)}</strong>.</span>
            </div>
        `;
        renderTradingViewChart(candles);
        
        // --- Validation Start ---
        if (isPipTacticalEnabled) {
            verifyWithYahoo(ticker, safeQuote.c).then(() => {
                renderTacticalChart(candles);
            });
        } else {
            renderTacticalChart(candles);
        }
        // --- Validation End ---
        
        updateAISignals(ticker, candles);
    } catch (err) {
        const isQuotaError = err.message.includes('402') || (err instanceof Response && err.status === 402);
        const isRateLimitError = err.message.includes('429') || (err instanceof Response && err.status === 429);
        
        document.getElementById('detail-name').textContent = isQuotaError ? "API Quota Exceeded" : (isRateLimitError ? "Rate Limit Exceeded" : "Error fetching data");
        
        if (isQuotaError) {
            document.getElementById('ai-quick-summary').innerHTML = `<div class="error-msg"><i class="fa-solid fa-circle-exclamation"></i> FinMind API 額度已達上限 (402)。請稍後再試或檢查 API 權限。</div>`;
        } else if (isRateLimitError) {
            document.getElementById('ai-quick-summary').innerHTML = `<div class="error-msg"><i class="fa-solid fa-clock"></i> Finnhub API 頻率限制 (429)。請稍等 1 分鐘後再重新整理。</div>`;
        } else {
            document.getElementById('ai-quick-summary').innerHTML = `Failed to fetch data for ${ticker}. ${err.message}`;
        }
        
        console.error("Fetch Error:", err);
        if(currentStockChart) { currentStockChart.remove(); currentStockChart = null; }
    }
}

// --- Indicator State ---
let bollingerSeries = { upper: null, mid: null, lower: null };
let rsiChart = null;
let rsiSeries = null;
let mainPipMarkers = [];
let tacticalPipMarkers = [];
const mainHoverState = { time: null }; // Module-level so refreshPipAnalysis can reset it
let tacticalHoverState = { time: null };

// --- Charting ---
function renderTradingViewChart(data) {
    // Destroy old RSI chart
    if (rsiChart) { rsiChart.remove(); rsiChart = null; rsiSeries = null; }
    document.getElementById('rsiChart').style.display = 'none';
    
    currentStopLossLine = null;
    currentTp1Line = null;
    currentTp2Line = null;

    const chartContainer = document.getElementById('stockChart');
    if (currentStockChart) {
        try { currentStockChart.remove(); } catch(e) {}
        currentStockChart = null;
    }
    chartContainer.innerHTML = '';
    if (!data || data.length === 0) return;

    const isLight = document.body.classList.contains('light-theme');
    const chartTextColor = isLight ? '#4B5563' : '#9CA3AF';
    const chartGridColor = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)';
    const chartBorderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';

    // Explicitly compute rendered dimensions or fall back to responsive defaults (resolves mobile height collapse)
    const initialWidth = chartContainer.clientWidth || 800;
    let initialHeight = chartContainer.clientHeight || 350;
    if (initialHeight <= 0) {
        if (window.innerWidth <= 768) {
            initialHeight = 280; // Mobile portrait fallback
        } else if (window.innerWidth <= 1024) {
            initialHeight = window.innerHeight > window.innerWidth ? 300 : 220; // Mobile landscape fallback
        } else {
            initialHeight = 350;
        }
    }

    currentStockChart = createChart(chartContainer, {
        width: initialWidth,
        height: initialHeight,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: chartTextColor },
        grid: { vertLines: { color: chartGridColor }, horzLines: { color: chartGridColor } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { 
            borderColor: chartBorderColor,
            minimumWidth: 100, // Fixed width to ensure alignment
            borderVisible: false
        },
        timeScale: { borderColor: chartBorderColor, timeVisible: true },
    });

    applyAxisLockOptions();
    observeChartResize(currentStockChart, chartContainer);

    mainPipMarkers = []; // Clear previous markers to prevent "ghost" tooltips

    candlestickSeries = currentStockChart.addSeries(CandlestickSeries, {
        upColor: '#10B981', downColor: '#EF4444',
        borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#EF4444',
    });
    candlestickSeries.setData(data);
    
    // Add Markers Plugin
    createSeriesMarkers(candlestickSeries, []);
    
    // Add PIP Series Overlay
    pipSeries = currentStockChart.addSeries(LineSeries, {
        color: '#facc15', // Bright Yellow
        lineWidth: 2,
        lineStyle: 0, // Solid
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        visible: isPipOverlayEnabled
    });
    
    // Dynamic PIP update on visible range change
    let pipTimeout = null;
    currentStockChart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
        if (!logicalRange || !data || data.length === 0 || !isPipOverlayEnabled) {
            if (pipSeries) pipSeries.setData([]);
            return;
        }
        
        // Debounce calculation to maintain 60fps
        if (pipTimeout) clearTimeout(pipTimeout);
        pipTimeout = setTimeout(() => {
            refreshPipAnalysis(logicalRange, data);
        }, CHART_UPDATE_DEBOUNCE_MS);
    });
    
    // Enable volume by default
    toggleVolume(true);

    // Initial PIP markers
    if (isPipOverlayEnabled) {
        try {
            const pips = findPIPs(data);
            if (pips && pips.length > 0) {
                const initialMarkers = pips.map(p => {
                    let isHigh = (p.type === 'peak' || p.type === 'LH' || p.type === 'HH');
                    return {
                        time: p.time,
                        position: isHigh ? 'aboveBar' : 'belowBar',
                        color: isHigh ? '#ef4444' : '#10b981',
                        shape: isHigh ? 'arrowDown' : 'arrowUp'
                    };
                });
                mainPipMarkers = initialMarkers;
                createSeriesMarkers(candlestickSeries, initialMarkers);
            } else {
                createSeriesMarkers(candlestickSeries, []);
            }
        } catch (e) {
            console.error("Initial PIP markers failed:", e);
        }
    } else {
        createSeriesMarkers(candlestickSeries, []);
    }

    // Interactive Marker Hover Logic
    mainHoverState.time = null; // Reset on chart re-render

    function clearAllLabels(series, markers) {
        if (!markers || markers.length === 0) return;
        const cleaned = markers.map(m => {
            const { text, ...rest } = m;
            return rest;
        });
        createSeriesMarkers(series, cleaned);
    }

    currentStockChart.subscribeCrosshairMove((param) => {
        if (!param.time) {
            if (mainHoverState.time !== null) {
                createSeriesMarkers(candlestickSeries, mainPipMarkers.map(m => {
                    const { text, ...rest } = m;
                    return rest;
                }));
                mainHoverState.time = null;
            }
            return;
        }

        const hoveredMarker = mainPipMarkers.find(m => m.time === param.time);
        if (hoveredMarker) {
            if (mainHoverState.time !== param.time) {
                const candle = data.find(d => d.time === param.time);
                if (candle) {
                    const text = `P: $${candle.close.toFixed(2)} | V: ${formatCompactNumber(candle.volume || 0)}`;
                    const updated = mainPipMarkers.map(m => {
                        if (m.time === param.time) {
                            return { ...m, text };
                        } else {
                            const { text, ...rest } = m;
                            return rest;
                        }
                    });
                    createSeriesMarkers(candlestickSeries, updated);
                    mainHoverState.time = param.time;
                }
            }
        } else if (mainHoverState.time !== null) {
            createSeriesMarkers(candlestickSeries, mainPipMarkers.map(m => {
                const { text, ...rest } = m;
                return rest;
            }));
            mainHoverState.time = null;
        }
    });

    // Fallback: Clear markers when mouse leaves the chart container
    if (chartContainer) {
        chartContainer.addEventListener('mouseleave', () => {
            if (mainHoverState.time !== null) {
                clearAllLabels(candlestickSeries, mainPipMarkers);
                mainHoverState.time = null;
            }
        });
    }

    
    // Scale Optimization: Show exactly 60 candles by default regardless of timeframe or Axis Lock
    if (data.length > 60) {
        currentStockChart.timeScale().setVisibleLogicalRange({
            from: data.length - 60,
            to: data.length - 1
        });
    } else {
        currentStockChart.timeScale().fitContent();
    }

    smaSeriesList = [];
    volumeSeries = null;
    bollingerSeries = { upper: null, mid: null, lower: null };
    document.querySelectorAll('.indicator-btn').forEach(btn => btn.classList.remove('active'));

    // Delayed resize to ensure rendering pass/layout is settled
    setTimeout(resizeAllCharts, 50);
    setTimeout(resizeAllCharts, 150);
}

// --- Helper for Range Equality ---
function areRangesEqual(r1, r2) {
    if (!r1 || !r2) return false;
    // Increased tolerance slightly to 0.1 to avoid jitter
    return Math.abs(r1.from - r2.from) < 0.1 && Math.abs(r1.to - r2.to) < 0.1;
}

/**
 * Checks if the Main Stock Chart and Tactical Pip Chart are synchronized in their visible logical range.
 */
function checkTimeScaleSync() {
    if (!currentStockChart || !pipChartInstance) return true; // Default to true if not initialized
    const mainRange = currentStockChart.timeScale().getVisibleLogicalRange();
    const pipRange = pipChartInstance.timeScale().getVisibleLogicalRange();
    if (!mainRange || !pipRange) return true;
    return areRangesEqual(mainRange, pipRange);
}

// --- Calculations ---
function calculateMA(candles, period) {
    if (candles.length < period) return 0;
    const slice = candles.slice(-period);
    return slice.reduce((sum, c) => sum + c.close, 0) / period;
}

// --- Unified Analysis Refresh ---
function refreshPipAnalysis(logicalRange, allData) {
    if (!logicalRange || !allData || allData.length === 0) return;
    
    try {
        const startIdx = Math.max(0, Math.floor(logicalRange.from));
        const endIdx = Math.min(allData.length - 1, Math.ceil(logicalRange.to));
        
        if (endIdx - startIdx <= 5) return;
        
        const visibleData = allData.slice(startIdx, endIdx + 1);
        
        // 1. RE-CALCULATE standard parameters from visible data FIRST
        const logVals = visibleData.map(c => Math.log10(c.close));
        if (logVals.length > 0) {
            window.tacticalStdMean = logVals.reduce((a, b) => a + b, 0) / logVals.length;
            window.tacticalStdDev = Math.sqrt(logVals.reduce((a, b) => a + Math.pow(b - window.tacticalStdMean, 2), 0) / logVals.length) || 1;
        }

        const pips = findPIPs(visibleData);
        
        // 2. Inject CORRECT stdY using current stats
        pips.forEach(p => {
            const price = p.value || p.close; // Handle both schemas
            if (price && window.tacticalStdDev && window.tacticalStdDev !== 0) {
                p.stdY = (Math.log10(price) - window.tacticalStdMean) / window.tacticalStdDev;
            } else {
                p.stdY = 0;
            }
            
            // Final NaN defense
            if (isNaN(p.stdY)) p.stdY = 0;
        });
        window.allTacticalPips = pips; 
        
        // 3. Update Main Overlay (if enabled)
        if (isPipOverlayEnabled && pipSeries) {
            pipSeries.setData(pips);
            
            const markers = pips.map(p => {
                const isHovered = mainHoverState.time === p.time;
                return {
                    time: p.time,
                    position: p.type === 'high' ? 'aboveBar' : 'belowBar',
                    color: p.type === 'high' ? '#ff4949' : '#00ff00',
                    shape: p.type === 'high' ? 'arrowDown' : 'arrowUp',
                    // No text property here ensures markers are hidden by default
                };
            });
            window.mainPipMarkers = markers;
            mainHoverState.time = null;
            // Double-tap clear to handle potential plugin internal state
            createSeriesMarkers(candlestickSeries, []); 
            createSeriesMarkers(candlestickSeries, markers);
        }
        
        // 4. Update Tactical Chart
        if (isPipTacticalEnabled && pipChartInstance) {
            tacticalStdDev = Math.sqrt(logVals.reduce((a, b) => a + Math.pow(b - tacticalStdMean, 2), 0) / logVals.length) || 1;

            if (pipLineSeries) pipLineSeries.setData(pips.map(p => ({ time: p.time, value: p.stdY })));
            
            // Recreate and sync tactical pip markers
            tacticalPipMarkers = pips.map(p => ({
                time: p.time,
                position: 'inBar',
                color: '#eab308',
                shape: 'circle',
                size: 0.1
            }));
            createSeriesMarkers(pipLineSeries, []);
            createSeriesMarkers(pipLineSeries, tacticalPipMarkers);
            
            const signal = generatePIPSignal(visibleData, pips);
            const patternLabel = document.getElementById('pip-pattern-label');
            
            if (signal.patterns && signal.patterns.length > 0) {
                const p = signal.patterns[0];
                const prob = signal.probability || { bullish: 50, bearish: 50 };

                let statusBadge = '';
                if (p.status === 'CONFIRMED') {
                    statusBadge = '<span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-left: 8px;">已確認</span>';
                } else if (p.status === 'FORMING') {
                    statusBadge = '<span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-left: 8px;">成形中</span>';
                }

                let volBadge = '';
                if (p.volumeConfirmed) {
                    volBadge = '<span style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-left: 8px;"><i class="fa-solid fa-chart-simple"></i> 量能確認</span>';
                }

                patternLabel.innerHTML = `
                    <div style="display: flex; flex-direction: column; width: 100%; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="color: ${p.color}; font-weight: bold;">${p.name} (相似度: ${p.similarity}%)</span>
                                ${statusBadge}
                                ${volBadge}
                            </div>
                            <span style="font-size: 0.9em; font-weight: bold;">
                                <i class="fa-solid fa-arrow-trend-up" style="color: #22c55e"></i> ${prob.bullish}% 
                                <span style="opacity: 0.5; margin: 0 4px;">|</span>
                                <i class="fa-solid fa-arrow-trend-down" style="color: #ef4444"></i> ${prob.bearish}%
                            </span>
                        </div>
                        <div style="height: 4px; width: 100%; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; display: flex;">
                            <div style="width: ${prob.bullish}%; background: #22c55e; height: 100%;"></div>
                            <div style="width: ${prob.bearish}%; background: #ef4444; height: 100%;"></div>
                        </div>
                    </div>
                `;
                patternLabel.style.display = 'flex';
                patternLabel.style.background = 'rgba(15, 23, 42, 0.9)';
                patternLabel.style.backdropFilter = 'blur(8px)';
                patternLabel.style.color = '#f8fafc';
                patternLabel.style.borderLeft = `4px solid ${p.color}`;
                patternLabel.style.padding = '12px 16px';
                patternLabel.style.borderRadius = '6px';
                patternLabel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                
                renderPatternGeometry(p, pips, pipChartInstance);
            } else {
                if (pipHighlightSeries) pipHighlightSeries.setData([]);
                if (pipPatternUpperSeries) pipPatternUpperSeries.setData([]);
                if (pipPatternLowerSeries) pipPatternLowerSeries.setData([]);
                renderAmplitudeTargets(null, null); // Clear target lines

                const trend = analyzeTrend(pips, visibleData);
                let trendColor = '#94a3b8';
                let trendName = 'NEUTRAL ⚖️';
                let trendDesc = '無明顯方向性結構 (No clear directional trend structure)';
                
                if (trend.status === 'BULLISH') {
                    trendColor = '#22c55e';
                    trendName = 'BULLISH 📈';
                    trendDesc = '上升結構：高點與低點持續墊高 (Higher Highs & Higher Lows)';
                } else if (trend.status === 'BEARISH') {
                    trendColor = '#ef4444';
                    trendName = 'BEARISH 📉';
                    trendDesc = '下跌結構：高點與低點持續降低 (Lower Highs & Lower Lows)';
                } else if (trend.status === 'CONSOLIDATION') {
                    trendColor = '#eab308';
                    trendName = 'CONSOLIDATION 🔄';
                    trendDesc = '盤整結構：波動收斂與區間震盪 (Rangebound / Compressing Volatility)';
                }

                const prob = signal.probability || { bullish: 50, bearish: 50 };

                patternLabel.innerHTML = `
                    <div style="display: flex; flex-direction: column; width: 100%; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="color: ${trendColor}; font-weight: bold; font-size: 13px;">市場結構: ${trendName}</span>
                                <span style="background: rgba(255, 255, 255, 0.08); color: rgba(255,255,255,0.7); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-left: 8px;">無幾何圖態</span>
                            </div>
                            <span style="font-size: 0.9em; font-weight: bold;">
                                <i class="fa-solid fa-arrow-trend-up" style="color: #22c55e"></i> ${prob.bullish}% 
                                <span style="opacity: 0.5; margin: 0 4px;">|</span>
                                <i class="fa-solid fa-arrow-trend-down" style="color: #ef4444"></i> ${prob.bearish}%
                            </span>
                        </div>
                        <div style="font-size: 11px; color: rgba(248, 250, 252, 0.6); margin-top: 1px;">
                            ${trendDesc}
                        </div>
                        <div style="height: 4px; width: 100%; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; display: flex; margin-top: 2px;">
                            <div style="width: ${prob.bullish}%; background: #22c55e; height: 100%;"></div>
                            <div style="width: ${prob.bearish}%; background: #ef4444; height: 100%;"></div>
                        </div>
                    </div>
                `;

                patternLabel.style.display = 'flex';
                patternLabel.style.background = 'rgba(15, 23, 42, 0.9)';
                patternLabel.style.backdropFilter = 'blur(8px)';
                patternLabel.style.color = '#f8fafc';
                patternLabel.style.borderLeft = `4px solid ${trendColor}`;
                patternLabel.style.padding = '12px 16px';
                patternLabel.style.borderRadius = '6px';
                patternLabel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }
            
            renderStructureLabels(pips, pipChartInstance);
            updateProbabilityUI(signal.probability);
        }
    } catch (e) {
        console.error("Refresh PIP Analysis Failed:", e);
    }
}

function updateProbabilityUI(prob) {
    const probContainer = document.getElementById('tactical-probability');
    if (!probContainer) return;
    
    probContainer.innerHTML = `
        <div class="prob-header">
            <span>Forecast Confidence</span>
            <span class="prob-val ${prob.bullish >= 50 ? 'bull' : 'bear'}">${Math.max(prob.bullish, prob.bearish)}%</span>
        </div>
        <div class="prob-bar-bg">
            <div class="prob-bar-fill bull" style="width: ${prob.bullish}%"></div>
            <div class="prob-bar-fill bear" style="width: ${prob.bearish}%"></div>
        </div>
        <div class="prob-footer">
            <span class="bull-label">BULL ${prob.bullish}%</span>
            <span class="bear-label">BEAR ${prob.bearish}%</span>
        </div>
    `;
}

function calcSMA(data, period) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0);
        result.push({ time: data[i].time, value: sum / period });
    }
    return result;
}

function calcEMA(data, period) {
    const result = [];
    const k = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
    result.push({ time: data[period - 1].time, value: ema });
    for (let i = period; i < data.length; i++) {
        ema = data[i].close * k + ema * (1 - k);
        result.push({ time: data[i].time, value: ema });
    }
    return result;
}

function calcBollinger(data, period = 20, mult = 2) {
    const upper = [], mid = [], lower = [];
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const avg = slice.reduce((s, d) => s + d.close, 0) / period;
        const std = Math.sqrt(slice.reduce((s, d) => s + (d.close - avg) ** 2, 0) / period);
        upper.push({ time: data[i].time, value: avg + mult * std });
        mid.push({ time: data[i].time, value: avg });
        lower.push({ time: data[i].time, value: avg - mult * std });
    }
    return { upper, mid, lower };
}

function calcRSI(data, period = 14) {
    const result = [];
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = data[i].close - data[i - 1].close;
        if (diff > 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / period, avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 0.0001);
    result.push({ time: data[period].time, value: 100 - 100 / (1 + rs) });
    for (let i = period + 1; i < data.length; i++) {
        const diff = data[i].close - data[i - 1].close;
        avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
        const rsi = 100 - 100 / (1 + avgGain / (avgLoss || 0.0001));
        result.push({ time: data[i].time, value: rsi });
    }
    return result;
}

// --- Indicator Renderers ---
function addSMA(period) {
    if (!currentStockChart || currentChartData.length === 0) return;
    const colors = { 5: '#3B82F6', 20: '#F59E0B', 60: '#8B5CF6', 120: '#EC4899' };
    const line = currentStockChart.addSeries(LineSeries, {
        color: colors[period] || '#6B7280', lineWidth: 2, title: `SMA${period}`,
    });
    line.setData(calcSMA(currentChartData, period));
    smaSeriesList.push(line);
}

function addEMA(period) {
    if (!currentStockChart || currentChartData.length < period) return;
    const colors = { 12: '#06B6D4', 26: '#F97316' };
    const line = currentStockChart.addSeries(LineSeries, {
        color: colors[period] || '#A3E635', lineWidth: 2, lineStyle: 1, title: `EMA${period}`,
    });
    line.setData(calcEMA(currentChartData, period));
    smaSeriesList.push(line);
}

function addBollinger(period) {
    if (!currentStockChart || currentChartData.length < period) return;
    // Remove old Bollinger if any
    if (bollingerSeries.upper) {
        ['upper','mid','lower'].forEach(k => { currentStockChart.removeSeries(bollingerSeries[k]); bollingerSeries[k] = null; });
    }
    const { upper, mid, lower } = calcBollinger(currentChartData, period);
    bollingerSeries.upper = currentStockChart.addSeries(LineSeries, { color: '#60A5FA', lineWidth: 1, title: 'BB Upper' });
    bollingerSeries.mid   = currentStockChart.addSeries(LineSeries, { color: '#9CA3AF', lineWidth: 1, lineStyle: 2, title: 'BB Mid' });
    bollingerSeries.lower = currentStockChart.addSeries(LineSeries, { color: '#F87171', lineWidth: 1, title: 'BB Lower' });
    bollingerSeries.upper.setData(upper);
    bollingerSeries.mid.setData(mid);
    bollingerSeries.lower.setData(lower);
}

function removeBollinger() {
    if (!currentStockChart || !bollingerSeries.upper) return;
    ['upper','mid','lower'].forEach(k => { currentStockChart.removeSeries(bollingerSeries[k]); bollingerSeries[k] = null; });
}

function toggleVolume(active) {
    if (!currentStockChart || currentChartData.length === 0) return;
    if (!active) {
        if (volumeSeries) { currentStockChart.removeSeries(volumeSeries); volumeSeries = null; }
        return;
    }
    volumeSeries = currentStockChart.addSeries(HistogramSeries, {
        color: '#26a69a', priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
    });
    currentStockChart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeries.setData(currentChartData.map(d => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'
    })));
}

function toggleRSI(active, period = 14) {
    const rsiContainer = document.getElementById('rsiChart');
    if (!active) {
        if (window._rsiMainRangeListener && currentStockChart) {
            try { currentStockChart.timeScale().unsubscribeVisibleLogicalRangeChange(window._rsiMainRangeListener); } catch(e) {}
            window._rsiMainRangeListener = null;
        }
        if (rsiChart) { rsiChart.remove(); rsiChart = null; rsiSeries = null; }
        // Don't set display:none — the panel visibility is controlled by .chart-panel.active
        return;
    }
    
    if (currentChartData.length < period + 1) return;
    
    // Cleanup old instances to prevent duplication
    if (window._rsiMainRangeListener && currentStockChart) {
        try { currentStockChart.timeScale().unsubscribeVisibleLogicalRangeChange(window._rsiMainRangeListener); } catch(e) {}
        window._rsiMainRangeListener = null;
    }
    if (rsiChart) { rsiChart.remove(); rsiChart = null; rsiSeries = null; }
    rsiContainer.innerHTML = '';
    
    // Don't set display:block — the .chart-panel.active CSS controls visibility
    // Let createChart use the container's actual rendered dimensions
    const isLight = document.body.classList.contains('light-theme');
    const chartTextColor = isLight ? '#4B5563' : '#9CA3AF';
    const chartGridColor = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.03)';
    const chartBorderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';

    // Explicitly compute rendered dimensions or fall back to responsive defaults (resolves mobile height collapse)
    const initialRsiWidth = rsiContainer.clientWidth || 800;
    let initialRsiHeight = rsiContainer.clientHeight || 150;
    if (initialRsiHeight <= 0) {
        initialRsiHeight = window.innerWidth <= 768 ? 120 : 150;
    }

    rsiChart = createChart(rsiContainer, {
        width: initialRsiWidth,
        height: initialRsiHeight,
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: chartTextColor, fontSize: 10 },
        grid: { vertLines: { color: chartGridColor }, horzLines: { color: chartGridColor } },
        rightPriceScale: { 
            borderColor: chartBorderColor, 
            scaleMargins: { top: 0.1, bottom: 0.1 },
            minimumWidth: 80
        },
        timeScale: { borderColor: chartBorderColor, timeVisible: true, visible: false },
        crosshair: { mode: CrosshairMode.Normal },
    });

    applyAxisLockOptions();
    observeChartResize(rsiChart, rsiContainer);
    rsiSeries = rsiChart.addSeries(LineSeries, { color: '#A78BFA', lineWidth: 2, title: 'RSI 14' });
    rsiSeries.setData(calcRSI(currentChartData, period));
    
    // Sync time scales
    const mainRange = currentStockChart.timeScale().getVisibleLogicalRange();
    if (mainRange) {
        try { rsiChart.timeScale().setVisibleLogicalRange(mainRange); } catch(e) {}
    }

    window._rsiMainRangeListener = (range) => {
        if (isSyncing || !range || !rsiChart) return;
        isSyncing = true;
        try { rsiChart.timeScale().setVisibleLogicalRange(range); } catch(e) {}
        isSyncing = false;
    };
    currentStockChart.timeScale().subscribeVisibleLogicalRangeChange(window._rsiMainRangeListener);

    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (isSyncing || !range || !currentStockChart) return;
        isSyncing = true;
        try { currentStockChart.timeScale().setVisibleLogicalRange(range); } catch(e) {}
        isSyncing = false;
    });
}

// --- Indicator Init & Toggle Logic ---
function clearIndicators() {
    if (!currentStockChart) return;
    smaSeriesList.forEach(s => currentStockChart.removeSeries(s));
    smaSeriesList = [];
    removeBollinger();
    toggleVolume(false);
    switchSubchart('kline');
}


function initIndicators() {
    document.getElementById('clear-indicators-btn').addEventListener('click', clearIndicators);

    document.querySelectorAll('.indicator-btn:not(.danger)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const b = e.currentTarget;
            const type = b.getAttribute('data-type');
            const period = parseInt(b.getAttribute('data-period'));
            const isActive = b.classList.contains('active');

            if (type === 'sma') {
                b.classList.toggle('active');
                if (isActive) { redrawActiveIndicators(); } else { addSMA(period); }
            } else if (type === 'ema') {
                b.classList.toggle('active');
                if (isActive) { redrawActiveIndicators(); } else { addEMA(period); }
            } else if (type === 'boll') {
                b.classList.toggle('active');
                if (isActive) removeBollinger(); else addBollinger(period);
            } else if (type === 'vol') {
                b.classList.toggle('active');
                toggleVolume(!isActive);
            } else if (type === 'rsi') {
                if (isActive) {
                    switchSubchart('kline');
                } else {
                    switchSubchart('rsi');
                }
            } else if (type === 'pip-tactical') {
                if (isActive) {
                    switchSubchart('kline');
                } else {
                    switchSubchart('pip');
                }
            } else if (type === 'pip-overlay') {
                b.classList.toggle('active');
                togglePipOverlay();
            }
        });
    });
}

function togglePipTactical() {
    isPipTacticalEnabled = !isPipTacticalEnabled;
    const insightPanel = document.getElementById('tactical-insights-panel');

    if (isPipTacticalEnabled) {
        if (insightPanel) insightPanel.style.display = 'block';
        // In split-view mode: delegate everything to switchSubchart
        switchSubchart('pip');
    } else {
        if (insightPanel) insightPanel.style.display = 'none';
        // Return to main K-line panel
        switchSubchart('kline');
    }
}

function togglePipOverlay() {
    isPipOverlayEnabled = !isPipOverlayEnabled;
    const btn = document.querySelector('[data-type="pip-overlay"]');
    
    if (isPipOverlayEnabled) {
        btn.classList.add('active');
        if (pipSeries) pipSeries.applyOptions({ visible: true });
        // Force refresh to show markers immediately
        const range = currentStockChart.timeScale().getVisibleLogicalRange();
        if (range && currentChartData) refreshPipAnalysis(range, currentChartData);
    } else {
        btn.classList.remove('active');
        if (pipSeries) {
            pipSeries.setData([]);
            pipSeries.applyOptions({ visible: false });
        }
        // Clear markers from main chart
        createSeriesMarkers(candlestickSeries, []);
    }
}

function initTimeframeSwitcher() {
    const tfBtns = document.querySelectorAll('.tf-btn');
    tfBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const b = e.currentTarget;
            const tf = b.getAttribute('data-tf');
            if (tf === currentTimeframe) return;

            // Update UI
            tfBtns.forEach(el => el.classList.remove('active'));
            b.classList.add('active');
            currentTimeframe = tf;

            // Reload data
            if (currentTicker) {
                await loadChartData(currentTicker, tf);
                // Preserve active indicators
                redrawActiveIndicators();
            }
        });
    });
}

function redrawActiveIndicators() {
    if (!currentStockChart) return;
    
    // Clear MA list
    smaSeriesList.forEach(s => currentStockChart.removeSeries(s));
    smaSeriesList = [];
    
    // Redraw based on active buttons
    document.querySelectorAll('.indicator-btn.active').forEach(b => {
        const type = b.getAttribute('data-type');
        const period = parseInt(b.getAttribute('data-period'));
        
        if (type === 'sma') addSMA(period);
        else if (type === 'ema') addEMA(period);
        else if (type === 'boll') addBollinger(period);
        else if (type === 'vol') toggleVolume(true);
        else if (type === 'rsi') toggleRSI(true, period);
    });
}

// AI Chat Logic
function initChat() {
    const sendBtn = document.getElementById('send-msg-btn');
    const chatInput = document.getElementById('chat-input');

    if (sendBtn) {
        sendBtn.addEventListener('click', handleUserMessage);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUserMessage();
        });
    }
}

function handleUserMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    // Add user message
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.insertAdjacentHTML('beforeend', `
        <div class="message user-message"><div class="message-content">${text}</div></div>
    `);
    
    input.value = '';
    scrollToBottom();

    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    messagesContainer.insertAdjacentHTML('beforeend', `
        <div class="message ai-message" id="${typingId}">
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>
        </div>
    `);
    scrollToBottom();

    // AI Command Parser or Gemini API Call
    setTimeout(async () => {
        
        const lowerText = text.toLowerCase();
        
        // Command Hook: Draw MA
        if (lowerText.includes('draw') && lowerText.includes('ma')) {
            document.getElementById(typingId).remove();
            const match = lowerText.match(/\d+/);
            let response;
            if (match) {
                const period = parseInt(match[0]);
                addSMA(period);
                response = `I've drawn the ${period}-day Moving Average on your chart. As you can see, this helps smooth out price action to identify the underlying trend.`;
            } else {
                addSMA(20);
                response = `I've drawn the 20-day Moving Average on your chart as a standard indicator.`;
            }
            switchView('stock-detail-view');
            addAiMessage(response);
            return;
        }

        // Gemini AI Call
        if (GEMINI_API_KEY) {
            try {
                const tacticalContext = getGlobalTacticalContext();
                const systemPrompt = `You are AlphaLens AI Assistant. Current tactical state: ${tacticalContext}. 
                Current Ticker in focus: ${currentTicker || 'None'}.
                User says: "${text}"
                
                Please provide a professional, concise analysis. Use markdown for emphasis. 
                If the user asks to draw indicators, the system handles that separately, so just confirm you understand.`;
                
                const response = await callGeminiAPI(systemPrompt, GEMINI_API_KEY);
                document.getElementById(typingId).remove();
                addAiMessage(formatMarkdown(response));
            } catch (err) {
                document.getElementById(typingId).remove();
                addAiMessage(`❌ AI Error: ${err.message}. Please check your connection or API key.`);
            }
        } else {
            // Mock / Disabled Response
            document.getElementById(typingId).remove();
            let response = '🚧 AI analysis is temporarily disabled (No GEMINI_API_KEY found in .env).';
            addAiMessage(response);
        }

    }, 500);
}

async function callGeminiAPI(prompt, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
    const payload = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim()
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Gemini API Error:", errorText);
        throw new Error(`API Error ${res.status} (Please check console for details)`);
    }

    const data = await res.json();
    if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
    }
    return "No response generated.";
}

function formatMarkdown(text) {
    // Very basic markdown formatting for the chat
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\*(.*?)\*/g, '<em>$1</em>')
               .replace(/\n/g, '<br>');
}

function addAiMessage(text) {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.insertAdjacentHTML('beforeend', `
        <div class="message ai-message"><div class="message-avatar"><i class="fa-solid fa-robot"></i></div><div class="message-content">${text}</div></div>
    `);
    scrollToBottom();
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
/**
 * Renders 1x and 2x amplitude projection lines on the tactical chart.
 * Works in standardized (Z-Score) space so values align with the pipLineSeries Y-axis.
 */
function renderAmplitudeTargets(pattern, pips) {
    // Remove all existing target lines first
    if (pipLineSeries) {
        pipTargetLines.forEach(line => {
            try { pipLineSeries.removePriceLine(line); } catch(e) {}
        });
    }
    pipTargetLines = [];

    if (!pattern || !pips || !pipLineSeries || pips.length < 2) return;

    // Calculate stdY amplitude from pattern points using standardized values
    const stdYValues = pattern.points.map(pt => pt.stdY).filter(v => v !== undefined && !isNaN(v));
    if (stdYValues.length < 2) return;

    const maxStdY = Math.max(...stdYValues);
    const minStdY = Math.min(...stdYValues);
    const amplitude = maxStdY - minStdY;
    if (amplitude <= 0) return;

    // Calculate targets in standardized space
    const up1x  = maxStdY + amplitude;
    const up2x  = maxStdY + amplitude * 2;
    const dn1x  = minStdY - amplitude;
    const dn2x  = minStdY - amplitude * 2;

    const isNetBullish = (pattern.probability?.bullish ?? 50) >= 50;

    // Task 5.1: Helper to convert σ back to price using current standardization params
    const toPrice = sigma => Math.pow(10, sigma * tacticalStdDev + tacticalStdMean);

    const targetDefs = [];
    if (isNetBullish) {
        targetDefs.push({ value: up1x,  label: `▲ 1x: $${toPrice(up1x).toFixed(2)}`, color: '#22c55e', style: 2 });
        targetDefs.push({ value: up2x,  label: `▲ 2x: $${toPrice(up2x).toFixed(2)}`, color: '#16a34a', style: 1 });
        targetDefs.push({ value: dn1x,  label: `🛑 STOP: $${toPrice(dn1x).toFixed(2)}`, color: '#ef4444', style: 2 });
    } else {
        targetDefs.push({ value: dn1x,  label: `▼ 1x: $${toPrice(dn1x).toFixed(2)}`, color: '#ef4444', style: 2 });
        targetDefs.push({ value: dn2x,  label: `▼ 2x: $${toPrice(dn2x).toFixed(2)}`, color: '#dc2626', style: 1 });
        targetDefs.push({ value: up1x,  label: `🛑 STOP: $${toPrice(up1x).toFixed(2)}`, color: '#22c55e', style: 2 });
    }

    targetDefs.forEach(def => {
        const line = pipLineSeries.createPriceLine({
            price: def.value,
            color: def.color,
            lineWidth: 1,
            lineStyle: def.style,
            axisLabelVisible: true,
            title: def.label,
        });
        pipTargetLines.push(line);
    });

    return { 
        up1x: toPrice(up1x), 
        up2x: toPrice(up2x), 
        dn1x: toPrice(dn1x), 
        dn2x: toPrice(dn2x), 
        amplitude 
    };
}

function renderPatternGeometry(pattern, pips, chartInstance) {
    if (!pattern || !chartInstance || !currentChartData) return;
    
    const isTactical = (chartInstance === pipChartInstance);
    
    // Choose correct series based on chart type
    let upperSeries = isTactical ? pipPatternUpperSeries : patternUpperSeries;
    let lowerSeries = isTactical ? pipPatternLowerSeries : patternLowerSeries;

    // Ensure we have series
    if (!upperSeries) {
        upperSeries = chartInstance.addSeries(LineSeries, { 
            color: pattern.color, 
            lineWidth: 2, 
            lineStyle: 2, // Dashed for projection
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false 
        });
        if (isTactical) pipPatternUpperSeries = upperSeries;
        else patternUpperSeries = upperSeries;
    } else {
        upperSeries.applyOptions({ color: pattern.color });
    }
    
    if (!lowerSeries) {
        lowerSeries = chartInstance.addSeries(LineSeries, { 
            color: pattern.color, 
            lineWidth: 2, 
            lineStyle: 2, // Dashed for projection
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false
        });
        if (isTactical) pipPatternLowerSeries = lowerSeries;
        else patternLowerSeries = lowerSeries;
    } else {
        lowerSeries.applyOptions({ color: pattern.color });
    }

    const lastBar = currentChartData[currentChartData.length - 1];
    const lastIdx = currentChartData.length - 1;

    if (pattern.type.includes('TRIANGLE') || pattern.type === 'RECTANGLE') {
        const p1 = pattern.points[0];
        const p2 = pattern.points[1];
        const t1 = pattern.points[2];
        const t2 = pattern.points[3];
        
        // Use either absolute price or standardized stdY
        const getV = (p) => isTactical ? p.stdY : p.value;
        
        const v_p1 = getV(p1);
        const v_p2 = getV(p2);
        const v_t1 = getV(t1);
        const v_t2 = getV(t2);

        // Recalculate slopes for standardized space if needed
        const slopeU = (v_p2 - v_p1) / (p2.index - p1.index);
        const slopeL = (v_t2 - v_t1) / (t2.index - t1.index);
        
        const upperData = [
            { time: p1.time, value: v_p1 },
            { time: p2.time, value: v_p2 }
        ];
        
        const lowerData = [
            { time: t1.time, value: v_t1 },
            { time: t2.time, value: v_t2 }
        ];

        // Add projection point
        const upperProj = v_p1 + slopeU * (lastIdx - p1.index);
        const lowerProj = v_t1 + slopeL * (lastIdx - t1.index);
        
        upperData.push({ time: lastBar.time, value: upperProj });
        lowerData.push({ time: lastBar.time, value: lowerProj });

        upperSeries.setData(upperData);
        lowerSeries.setData(lowerData);
    } else if (pattern.type.includes('DOUBLE')) {
        const sortedPoints = [...pattern.points].sort((a, b) => a.index - b.index);
        if (sortedPoints.length >= 2) {
            upperSeries.setData(sortedPoints.map(p => ({ 
                time: p.time, 
                value: isTactical ? p.stdY : p.value 
            })));
            lowerSeries.setData([]);
        }
    }
}

function renderStructureLabels(pips, chartInstance) {
    if (!pips || !chartInstance || !structureLabelSeries) return;
    
    const markers = [];
    const isTactical = (chartInstance === pipChartInstance);

    for (let i = 1; i < pips.length - 1; i++) {
        const prev = pips[i-1];
        const curr = pips[i];
        const next = pips[i+1];
        
        let label = '';
        let color = '#94a3b8';
        let position = 'aboveBar';
        
        const getV = (p) => isTactical ? p.stdY : p.value;
        const v_curr = getV(curr);
        const v_prev = getV(prev);
        const v_next = getV(next);

        if (v_curr > v_prev && v_curr > v_next) {
            // Peak - Check if HH or LH
            const prevPeaks = pips.slice(0, i).filter((p, idx) => {
                if (idx === 0 || idx >= pips.length - 1) return false;
                const v = getV(p);
                return v > getV(pips[idx-1]) && v > getV(pips[idx+1]);
            });
            if (prevPeaks.length > 0) {
                const lastPeak = prevPeaks[prevPeaks.length - 1];
                label = v_curr > getV(lastPeak) ? 'HH' : 'LH';
            } else {
                label = 'H';
            }
            color = '#ef4444';
            position = 'aboveBar';
        } else if (v_curr < v_prev && v_curr < v_next) {
            // Trough - Check if HL or LL
            const prevTroughs = pips.slice(0, i).filter((p, idx) => {
                if (idx === 0 || idx >= pips.length - 1) return false;
                const v = getV(p);
                return v < getV(pips[idx-1]) && v < getV(pips[idx+1]);
            });
            if (prevTroughs.length > 0) {
                const lastTrough = prevTroughs[prevTroughs.length - 1];
                label = v_curr > getV(lastTrough) ? 'HL' : 'LL';
            } else {
                label = 'L';
            }
            color = '#22c55e';
            position = 'belowBar';
        }
        
        if (label) {
            markers.push({
                time: curr.time,
                position: position,
                color: color,
                shape: 'circle',
                text: label,
                size: 1
            });
        }
    }
    
    if (structureLabelSeries) {
        createSeriesMarkers(structureLabelSeries, markers);
    }
}

function renderPatternLabels(pattern, tacticalSignal, candles, chartInstance) {
    if (!pattern || !chartInstance || !patternLabelSeries) return;
    
    const markers = [];
    
    // 1. Add Pattern Name Marker at the beginning of the pattern
    const startPoint = pattern.points[0];
    markers.push({
        time: startPoint.time,
        position: 'aboveBar',
        color: '#ffffff',
        shape: 'circle',
        text: `【 ${pattern.name} 】`,
        size: 1
    });

    if (pattern.points.length >= 4) {
        const p1 = pattern.points[0]; const p2 = pattern.points[1];
        const t1 = pattern.points[2]; const t2 = pattern.points[3];
        
        // Add Resistance/Support labels
        if (pattern.type === 'RECTANGLE') {
            markers.push({ time: p2.time, position: 'aboveBar', color: pattern.color, shape: 'arrowDown', text: '阻力 RESISTANCE', size: 1 });
            markers.push({ time: t2.time, position: 'belowBar', color: pattern.color, shape: 'arrowUp', text: '支撐 SUPPORT', size: 1 });
        } else if (pattern.type === 'ASCENDING_TRIANGLE') {
            markers.push({ time: p2.time, position: 'aboveBar', color: pattern.color, shape: 'arrowDown', text: '阻力 RESISTANCE', size: 1 });
            markers.push({ time: t1.time, position: 'belowBar', color: pattern.color, shape: 'arrowUp', text: '高底 HL', size: 1 });
            markers.push({ time: t2.time, position: 'belowBar', color: pattern.color, shape: 'arrowUp', text: '高底 HL', size: 1 });
        } else if (pattern.type === 'DESCENDING_TRIANGLE') {
            markers.push({ time: p1.time, position: 'aboveBar', color: pattern.color, shape: 'arrowDown', text: '低頂 LH', size: 1 });
            markers.push({ time: p2.time, position: 'aboveBar', color: pattern.color, shape: 'arrowDown', text: '低頂 LH', size: 1 });
            markers.push({ time: t2.time, position: 'belowBar', color: pattern.color, shape: 'arrowUp', text: '支撐 SUPPORT', size: 1 });
        } else if (pattern.type === 'SYMMETRICAL_TRIANGLE') {
            markers.push({ time: p2.time, position: 'aboveBar', color: pattern.color, shape: 'arrowDown', text: '低頂 LH', size: 1 });
            markers.push({ time: t2.time, position: 'belowBar', color: pattern.color, shape: 'arrowUp', text: '高底 HL', size: 1 });
        }
    }

    // 2. Add Breakout label if there is a signal
    if (tacticalSignal.signal !== 'NEUTRAL' && tacticalSignal.details && tacticalSignal.details.reason && tacticalSignal.details.reason.includes('BREAKOUT')) {
        const lastCandle = candles[candles.length - 1];
        markers.push({
            time: lastCandle.time,
            position: tacticalSignal.signal === 'BUY' ? 'belowBar' : 'aboveBar',
            color: tacticalSignal.color,
            shape: tacticalSignal.signal === 'BUY' ? 'arrowUp' : 'arrowDown',
            text: tacticalSignal.signal === 'BUY' ? '突破 BREAKOUT 🚀' : '跌破 BREAKOUT ⚠️',
            size: 2
        });
    }

    createSeriesMarkers(patternLabelSeries, markers);

    // 3. DRAW SHAPES on Tactical Chart
    // Clear previous shapes first
    if (pipHighlightSeries) pipHighlightSeries.setData([]);
    if (pipPatternUpperSeries) pipPatternUpperSeries.setData([]);
    if (pipPatternLowerSeries) pipPatternLowerSeries.setData([]);

    if (pattern.points) {
        if (['DOUBLE_BOTTOM', 'DOUBLE_TOP', 'HEAD_AND_SHOULDERS'].includes(pattern.type)) {
            // M/W/HS: Draw a single continuous ZIGZAG line
            const sortedPoints = [...pattern.points].sort((a, b) => a.time - b.time);
            const highlightData = sortedPoints.map(p => ({ time: p.time, value: p.stdY }));
            if (pipHighlightSeries) {
                pipHighlightSeries.applyOptions({ color: pattern.color, lineWidth: 4 });
                pipHighlightSeries.setData(highlightData);
            }
        } else {
            // Triangles, Wedges, Rectangles, Flags: Draw UPPER and LOWER boundary lines
            const pips = window.allTacticalPips;
            if (pips && pips.length > 0) {
                // Determine upper/lower from the points
                const upperPoints = pattern.points.filter(p => p.type === 'high').sort((a,b) => a.time - b.time);
                const lowerPoints = pattern.points.filter(p => p.type === 'low').sort((a,b) => a.time - b.time);
                
                if (upperPoints.length >= 2 && pipPatternUpperSeries) {
                    pipPatternUpperSeries.applyOptions({ color: pattern.color, lineWidth: 3, lineStyle: 1 }); // Dashed for boundary
                    pipPatternUpperSeries.setData(upperPoints.map(p => ({ time: p.time, value: p.stdY })));
                }
                if (lowerPoints.length >= 2 && pipPatternLowerSeries) {
                    pipPatternLowerSeries.applyOptions({ color: pattern.color, lineWidth: 3, lineStyle: 1 });
                    pipPatternLowerSeries.setData(lowerPoints.map(p => ({ time: p.time, value: p.stdY })));
                }
            }
        }
    }
}

// --- Charting Modules ---
function renderTacticalChart(candles) {
    if (!isPipTacticalEnabled || !candles || candles.length === 0) {
        if (pipChartInstance) {
            pipChartInstance.remove();
            pipChartInstance = null;
            pipLineSeries = null;
            patternOverlaySeries = null;
            structureLabelSeries = null;
            patternLabelSeries = null;
            patternUpperSeries = null;
            patternLowerSeries = null;
            pipPatternUpperSeries = null;
            pipPatternLowerSeries = null;
            pipGhostSeries = null;
        }
        return;
    }

    console.log("[TACTICAL] Initializing chart...", { mean: window.tacticalStdMean, dev: window.tacticalStdDev });
    
    // Ensure containers exist
    let pipContainer = document.getElementById('pipChart');
    if (!pipContainer) {
        pipContainer = document.createElement('div');
        pipContainer.id = 'pipChart';
        pipContainer.style.position = 'relative';
        pipContainer.style.marginTop = '20px';
        pipContainer.style.background = 'rgba(255,255,255,0.02)';
        pipContainer.style.borderRadius = '8px';
        pipContainer.style.padding = '10px';
        document.getElementById('stockChart')?.parentElement.appendChild(pipContainer);
    }
    
    let patternLabel = document.getElementById('pip-pattern-label');
    if (!patternLabel) {
        patternLabel = document.createElement('div');
        patternLabel.id = 'pip-pattern-label';
        // Professional styling for the pattern panel
        patternLabel.style.minHeight = '60px';
        patternLabel.style.marginBottom = '10px';
        patternLabel.style.padding = '12px';
        patternLabel.style.background = 'rgba(255,255,255,0.05)';
        patternLabel.style.borderRadius = '6px';
        patternLabel.style.borderLeft = '4px solid #ffd700';
        patternLabel.style.fontSize = '13px';
        patternLabel.style.color = '#fff';
        patternLabel.style.display = 'block'; // FORCE VISIBLE ON CREATION
        pipContainer.appendChild(patternLabel);
    } else {
        patternLabel.style.display = 'block'; // FORCE VISIBLE IF EXISTS
    }

    let chartDiv = document.getElementById('pipChartCanvas');
    if (!chartDiv) {
        chartDiv = document.createElement('div');
        chartDiv.id = 'pipChartCanvas';
        chartDiv.style.height = '160px';
        pipContainer.appendChild(chartDiv);
    }
    
    pipContainer.style.display = '';  // Don't override — CSS .chart-panel.active controls visibility

    if (pipChartInstance) {
        pipChartInstance.remove();
        patternLowerSeries = null;
        pipPatternUpperSeries = null;
        pipPatternLowerSeries = null;
        pipGhostSeries = null;
    }

    // Use actual rendered container height (fills split-view panel), fallback to 220
    const pipHeight = Math.max((chartDiv.closest('.chart-panel')?.clientHeight || 300) - 100, 160);
    const isLight = document.body.classList.contains('light-theme');
    const chartTextColor = isLight ? '#4B5563' : '#94a3b8';
    const chartGridColor = isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)';
    const chartBorderColor = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)';

    pipChartInstance = createChart(chartDiv, {
        width: pipContainer.clientWidth || 800,
        height: pipHeight,
        layout: { background: { color: 'transparent' }, textColor: chartTextColor },
        grid: { vertLines: { color: chartGridColor }, horzLines: { color: chartGridColor } },
        timeScale: { 
            visible: true, 
            borderVisible: false,
            borderColor: chartBorderColor,
            rightOffset: 12, // Match main chart offset
            barSpacing: 6,   // Initial spacing
        },
        rightPriceScale: { 
            borderVisible: false,
            minimumWidth: 100,
            lastValueVisible: false
        },
        localization: {
            priceFormatter: price => price.toFixed(2),
        },
        crosshair: { mode: CrosshairMode.Normal }
    });

    applyAxisLockOptions();
    observeChartResize(pipChartInstance, chartDiv);

    // --- CLEANUP PREVIOUS LISTENERS ---
    if (window._pipMainRangeListener && currentStockChart) {
        try {
            currentStockChart.timeScale().unsubscribeVisibleLogicalRangeChange(window._pipMainRangeListener);
        } catch(e) {}
        window._pipMainRangeListener = null;
    }
    if (window._pipMainCrosshairListener && currentStockChart) {
        try {
            currentStockChart.unsubscribeCrosshairMove(window._pipMainCrosshairListener);
        } catch(e) {}
        window._pipMainCrosshairListener = null;
    }
    if (window._pipMouseLeaveHandler && pipContainer) {
        try {
            pipContainer.removeEventListener('mouseleave', window._pipMouseLeaveHandler);
        } catch(e) {}
        window._pipMouseLeaveHandler = null;
    }

    // Add a label indicating standardized units (avoid duplicates and position on the top-right to prevent overlap)
    let statsLabel = document.getElementById('pip-stats-label');
    if (!statsLabel) {
        statsLabel = document.createElement('div');
        statsLabel.id = 'pip-stats-label';
        pipContainer.appendChild(statsLabel);
    }
    statsLabel.style.position = 'absolute';
    statsLabel.style.top = '10px';
    statsLabel.style.right = '110px';
    statsLabel.style.left = 'auto';
    statsLabel.style.textAlign = 'right';
    statsLabel.style.zIndex = '5';
    statsLabel.style.fontSize = '10px';
    statsLabel.style.color = 'rgba(255,255,255,0.4)';
    statsLabel.style.pointerEvents = 'none';
    statsLabel.textContent = 'STANDARDIZED (Z-SCORE)';

    pipLineSeries = pipChartInstance.addSeries(LineSeries, {
        color: '#eab308',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        priceFormat: {
            type: 'volume', // Using 'volume' type removes '$' prefix in most contexts or we can use custom
            precision: 2,
            minMove: 0.01,
        }
    });

    patternOverlaySeries = pipChartInstance.addSeries(LineSeries, {
        lineWidth: 2,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
    });

    structureLabelSeries = pipChartInstance.addSeries(LineSeries, {
        visible: false,
        priceLineVisible: false,
        lastValueVisible: false
    });

    pipPatternUpperSeries = pipChartInstance.addSeries(LineSeries, {
        lineWidth: 2,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
    });

    pipPatternLowerSeries = pipChartInstance.addSeries(LineSeries, {
        lineWidth: 2,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
    });

    // Unified Highlight series for M/W
    pipHighlightSeries = pipChartInstance.addSeries(LineSeries, {
        lineWidth: 4,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
    });

    patternLabelSeries = pipChartInstance.addSeries(LineSeries, {
        visible: false,
        priceLineVisible: false,
        lastValueVisible: false
    });

    pipGhostSeries = pipChartInstance.addSeries(LineSeries, {
        color: 'rgba(0,0,0,0)', // Transparent but visible to anchor the timescale
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
    });
    // Calculate mean/std
    const logPrices = candles.map(c => Math.log10(c.close));
    window.tacticalStdMean = logPrices.reduce((a, b) => a + b, 0) / logPrices.length;
    window.tacticalStdDev = Math.sqrt(logPrices.map(x => Math.pow(x - window.tacticalStdMean, 2)).reduce((a, b) => a + b, 0) / logPrices.length);

    if (!window.tacticalStdDev || window.tacticalStdDev === 0) window.tacticalStdDev = 1;

    pipGhostSeries.setData(candles.map(c => ({
        time: c.time,
        value: (Math.log10(c.close) - tacticalStdMean) / tacticalStdDev
    })));

    // 2. Standardized PIP Data - inject stdY into each PIP point
    const allPips = findPIPs(candles);
    allPips.forEach(p => {
        p.stdY = (Math.log10(p.close) - tacticalStdMean) / tacticalStdDev;
    });
    
    // Initialize tactical markers
    tacticalPipMarkers = allPips.map(p => ({
        time: p.time,
        position: 'inBar', // Tactical uses values on the line, not high/low
        color: '#eab308',
        shape: 'circle',
        size: 0.1
    }));

    pipLineSeries.setData(allPips.map(p => ({ time: p.time, value: p.stdY })));

    // 3. Consolidated & Leak-Proof Sync Logic
    if (currentStockChart) {
        // Initial Range Sync
        const mainRange = currentStockChart.timeScale().getVisibleLogicalRange();
        if (mainRange) {
            try {
                pipChartInstance.timeScale().setVisibleLogicalRange(mainRange);
            } catch(e) {}
        } else {
            try {
                pipChartInstance.timeScale().setVisibleLogicalRange({ from: candles.length - 60, to: candles.length - 1 });
            } catch(e) {}
        }

        // K-line to PIP Time scale synchronization
        window._pipMainRangeListener = (range) => {
            if (isSyncing || !range || !pipChartInstance) return;
            isSyncing = true;
            try {
                pipChartInstance.timeScale().setVisibleLogicalRange(range);
            } catch(e) {}
            isSyncing = false;
        };
        currentStockChart.timeScale().subscribeVisibleLogicalRangeChange(window._pipMainRangeListener);

        // PIP to K-line Time scale synchronization
        pipChartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (isSyncing || !range || !currentStockChart) return;
            isSyncing = true;
            try {
                currentStockChart.timeScale().setVisibleLogicalRange(range);
            } catch(e) {}
            isSyncing = false;
        });

        // K-line to PIP Crosshair synchronization
        window._pipMainCrosshairListener = (param) => {
            if (isSyncing || !pipChartInstance || !pipLineSeries) return;
            isSyncing = true;
            try {
                if (!param || !param.time) {
                    pipChartInstance.clearCrosshairPosition();
                } else {
                    pipChartInstance.setCrosshairPosition(0, param.time, pipLineSeries);
                }
            } catch(e) {}
            isSyncing = false;
        };
        currentStockChart.subscribeCrosshairMove(window._pipMainCrosshairListener);

        // PIP to K-line Crosshair synchronization + PIP Interactive Marker Hover
        tacticalHoverState.time = null; // Re-initialize hover state
        pipChartInstance.subscribeCrosshairMove((param) => {
            if (isSyncing || !currentStockChart || !candlestickSeries) return;

            // Declarative, unconditional marker hover logic for tactical chart
            const activeTime = (param && param.time) ? param.time : null;
            const pipsList = (typeof window.allTacticalPips !== 'undefined') ? window.allTacticalPips : allPips;

            const updated = tacticalPipMarkers.map(marker => {
                if (activeTime && marker.time === activeTime) {
                    const pip = pipsList.find(p => p.time === activeTime);
                    if (pip) {
                        const m = window.tacticalStdMean || 0;
                        const d = window.tacticalStdDev || 1;
                        const priceVal = Math.pow(10, pip.stdY * d + m);
                        return { ...marker, text: `Val: $${priceVal.toFixed(2)}` };
                    }
                }
                const { text, ...rest } = marker;
                return rest;
            });

            createSeriesMarkers(pipLineSeries, updated);
            tacticalHoverState.time = activeTime;

            // Sync back to K-line
            isSyncing = true;
            try {
                if (!param || !param.time) {
                    currentStockChart.clearCrosshairPosition();
                } else {
                    currentStockChart.setCrosshairPosition(0, param.time, candlestickSeries);
                }
            } catch(e) {}
            isSyncing = false;
        });

        // Fallback for tactical chart mouseleave
        window._pipMouseLeaveHandler = () => {
            const updated = tacticalPipMarkers.map(m => {
                const { text, ...rest } = m;
                return rest;
            });
            createSeriesMarkers(pipLineSeries, updated);
            tacticalHoverState.time = null;
        };
        if (pipContainer) {
            pipContainer.addEventListener('mouseleave', window._pipMouseLeaveHandler);
        }

        window.allTacticalPips = allPips; // Set initial reference
    }

    const visibleCandles = candles.slice(-60);
    const visiblePips = findPIPs(visibleCandles);
    visiblePips.forEach(p => {
        p.stdY = (Math.log10(p.close) - tacticalStdMean) / tacticalStdDev;
    });

    const tacticalSignal = typeof generatePIPSignal === 'function' ? generatePIPSignal(visibleCandles, visiblePips) : { patterns: [], probability: { bullish: 50, bearish: 50 } };

    if (tacticalSignal && tacticalSignal.patterns && tacticalSignal.patterns.length > 0) {
        const p = tacticalSignal.patterns[0];
        const prob = tacticalSignal.probability || { bullish: 50, bearish: 50 };

        // Render amplitude target lines on tactical chart
        const targets = renderAmplitudeTargets(p, visiblePips);

        patternLabel.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>PATTERN: <strong>${p.name}</strong></span>
                    <span style="font-size: 0.9em; font-weight: bold;">
                        <i class="fa-solid fa-arrow-trend-up" style="color: #22c55e"></i> ${prob.bullish}% 
                        <span style="opacity: 0.5; margin: 0 4px;">|</span>
                        <i class="fa-solid fa-arrow-trend-down" style="color: #ef4444"></i> ${prob.bearish}%
                    </span>
                </div>
                <div style="height: 4px; width: 100%; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; display: flex;">
                    <div style="width: ${prob.bullish}%; background: #22c55e; height: 100%;"></div>
                    <div style="width: ${prob.bearish}%; background: #ef4444; height: 100%;"></div>
                </div>
                ${targets ? `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-top: 4px; font-size: 11px;">
                    <span style="color: #22c55e;">▲ 1x: <strong>$${targets.up1x.toFixed(2)}</strong></span>
                    <span style="color: #16a34a;">▲ 2x: <strong>$${targets.up2x.toFixed(2)}</strong></span>
                    <span style="color: #ef4444;">▼ 1x: <strong>$${targets.dn1x.toFixed(2)}</strong></span>
                    <span style="color: #dc2626;">▼ 2x: <strong>$${targets.dn2x.toFixed(2)}</strong></span>
                </div>` : ''}
            </div>
        `;
        patternLabel.style.display = 'flex';
        patternLabel.style.background = 'rgba(15, 23, 42, 0.8)';
        patternLabel.style.backdropFilter = 'blur(4px)';
        patternLabel.style.color = '#f8fafc';
        patternLabel.style.borderLeft = `4px solid ${p.color}`;
        patternLabel.style.padding = '10px 14px';
        patternLabel.style.borderRadius = '4px';
        
        // Update Sidebar Panel
        const sidePattern = document.getElementById('tactical-pattern-name');
        if (sidePattern) {
            sidePattern.textContent = p.name;
            sidePattern.style.color = p.color;
        }

        renderPatternGeometry(p, visiblePips, pipChartInstance);
        renderPatternLabels(p, tacticalSignal, visibleCandles, pipChartInstance);
    } else {
        if (pipPatternUpperSeries) pipPatternUpperSeries.setData([]);
        if (pipPatternLowerSeries) pipPatternLowerSeries.setData([]);
        renderAmplitudeTargets(null, null); // Clear any stale target lines

        const trend = analyzeTrend(visiblePips, visibleCandles);
        let trendColor = '#94a3b8';
        let trendName = 'NEUTRAL ⚖️';
        let trendDesc = '無明顯方向性結構 (No clear directional trend structure)';
        
        if (trend.status === 'BULLISH') {
            trendColor = '#22c55e';
            trendName = 'BULLISH 📈';
            trendDesc = '上升結構：高點與低點持續墊高 (Higher Highs & Higher Lows)';
        } else if (trend.status === 'BEARISH') {
            trendColor = '#ef4444';
            trendName = 'BEARISH 📉';
            trendDesc = '下跌結構：高點與低點持續降低 (Lower Highs & Lower Lows)';
        } else if (trend.status === 'CONSOLIDATION') {
            trendColor = '#eab308';
            trendName = 'CONSOLIDATION 🔄';
            trendDesc = '盤整結構：波動收斂與區間震盪 (Rangebound / Compressing Volatility)';
        }

        const prob = tacticalSignal.probability || { bullish: 50, bearish: 50 };

        patternLabel.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: ${trendColor}; font-weight: bold; font-size: 13px;">市場結構: ${trendName}</span>
                        <span style="background: rgba(255, 255, 255, 0.08); color: rgba(255,255,255,0.7); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; margin-left: 8px;">無幾何圖態</span>
                    </div>
                    <span style="font-size: 0.9em; font-weight: bold;">
                        <i class="fa-solid fa-arrow-trend-up" style="color: #22c55e"></i> ${prob.bullish}% 
                        <span style="opacity: 0.5; margin: 0 4px;">|</span>
                        <i class="fa-solid fa-arrow-trend-down" style="color: #ef4444"></i> ${prob.bearish}%
                    </span>
                </div>
                <div style="font-size: 11px; color: rgba(248, 250, 252, 0.6); margin-top: 1px;">
                    ${trendDesc}
                </div>
                <div style="height: 4px; width: 100%; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; display: flex; margin-top: 2px;">
                    <div style="width: ${prob.bullish}%; background: #22c55e; height: 100%;"></div>
                    <div style="width: ${prob.bearish}%; background: #ef4444; height: 100%;"></div>
                </div>
            </div>
        `;
        patternLabel.style.display = 'flex';
        patternLabel.style.background = 'rgba(15, 23, 42, 0.8)';
        patternLabel.style.backdropFilter = 'blur(4px)';
        patternLabel.style.color = '#f8fafc';
        patternLabel.style.borderLeft = `4px solid ${trendColor}`;
        patternLabel.style.padding = '10px 14px';
        patternLabel.style.borderRadius = '4px';

        const sidePattern = document.getElementById('tactical-pattern-name');
        if (sidePattern) {
            sidePattern.textContent = 'NONE';
            sidePattern.style.color = '#94a3b8';
        }
    }

    renderStructureLabels(visiblePips, pipChartInstance);
    
    // Render Validation Status
    let statusBadge = document.getElementById('tactical-validation-status');
    const validationContainer = document.getElementById('tactical-validation-container');
    
    if (!statusBadge) {
        statusBadge = document.createElement('div');
        statusBadge.id = 'tactical-validation-status';
        statusBadge.className = 'validation-badge';
        patternLabel.parentNode.insertBefore(statusBadge, patternLabel);
    }
    
    if (validationStatus.ticker === currentTicker) {
        const isTimeSynced = checkTimeScaleSync();
        const icon = !isTimeSynced ? 'sync-alt' : (validationStatus.status === 'SUCCESS' ? 'check-circle' : (validationStatus.status === 'WARNING' ? 'exclamation-triangle' : 'exclamation-circle'));
        const color = !isTimeSynced ? '#ef4444' : (validationStatus.status === 'SUCCESS' ? '#22c55e' : (validationStatus.status === 'WARNING' ? '#eab308' : '#94a3b8'));
        const text = !isTimeSynced ? 'Sync Error' : (validationStatus.status === 'SUCCESS' ? 'Verified' : (validationStatus.status === 'WARNING' ? 'Data Lag' : 'Verify Error'));
        
        const badgeHtml = `<i class="fa-solid fa-${icon}"></i> ${text}`;
        statusBadge.innerHTML = badgeHtml;
        statusBadge.style.color = color;
        statusBadge.style.display = 'inline-flex';
        statusBadge.title = validationStatus.status === 'WARNING' ? `Diff: ${(validationStatus.diff*100).toFixed(2)}%` : '';
        
        if (validationContainer) {
            validationContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="tactical-label">Data Validity</span>
                    <span style="color: ${color}; font-weight: 600; font-size: 13px;">${badgeHtml}</span>
                </div>
                ${validationStatus.yahooPrice ? `<div style="display: flex; justify-content: space-between; font-size: 11px; opacity: 0.6;">
                    <span>Yahoo Reference</span>
                    <span>$${validationStatus.yahooPrice.toFixed(2)}</span>
                </div>` : ''}
            `;
        }
    } else {
        statusBadge.style.display = 'none';
    }

    let probContainer = document.getElementById('tactical-probability');
    if (!probContainer) {
        probContainer = document.createElement('div');
        probContainer.id = 'tactical-probability';
        probContainer.className = 'probability-container';
        patternLabel.parentNode.insertBefore(probContainer, patternLabel.nextSibling);
    }

    const prob = tacticalSignal.probability || { bullish: 50, bearish: 50 };
    probContainer.innerHTML = `
        <div class="prob-header">
            <span>Forecast Confidence</span>
            <span class="prob-val ${prob.bullish >= 50 ? 'bull' : 'bear'}">${Math.max(prob.bullish, prob.bearish)}%</span>
        </div>
        <div class="prob-bar-bg">
            <div class="prob-bar-fill bull" style="width: ${prob.bullish}%"></div>
            <div class="prob-bar-fill bear" style="width: ${prob.bearish}%"></div>
        </div>
        <div class="prob-footer">
            <span class="bull-label">BULL ${prob.bullish}%</span>
            <span class="bear-label">BEAR ${prob.bearish}%</span>
        </div>
    `;
}

// Returns currency symbol: NT$ for TW stocks, $ for US
function getCurrencySymbol(ticker) {
    if (!ticker) return '$';
    // TW stocks: 4-digit numeric codes, or well-known TW suffixes
    if (/^\d{4,}$/.test(ticker)) return 'NT$';
    if (/\.(TW|TWO)$/i.test(ticker)) return 'NT$';
    return '$';
}

function updateAISignals(ticker, candles) {
    const signalCard = document.getElementById('ai-signal-card');
    if (!candles || candles.length === 0) {
        if (signalCard) signalCard.style.display = 'none';
        return;
    }
    
    // 1. Safe PriceLine Cleanup to eliminate visual stacking and memory leakage
    if (candlestickSeries) {
        if (currentStopLossLine) {
            try { candlestickSeries.removePriceLine(currentStopLossLine); } catch (e) {}
            currentStopLossLine = null;
        }
        if (currentTp1Line) {
            try { candlestickSeries.removePriceLine(currentTp1Line); } catch (e) {}
            currentTp1Line = null;
        }
        if (currentTp2Line) {
            try { candlestickSeries.removePriceLine(currentTp2Line); } catch (e) {}
            currentTp2Line = null;
        }
    }

    const signals = (typeof window !== 'undefined' && window.calculateAISignals)
        ? window.calculateAISignals(ticker, candles)
        : calculateAISignals(ticker, candles);
    if (!signalCard) return;

    if (signals) {
        signalCard.style.display = 'block';
        const sig = signals.signal;
        const trend = signals.trend;
        const currencySymbol = getCurrencySymbol(ticker);
        
        // 2. Determine risk reward rating badge
        const r1 = parseFloat(signals.rrRatio1.split(':')[1]);
        let rrBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2);">差 (Poor)</span>`;
        if (r1 >= 2.5) {
            rrBadge = `<span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.2);">極佳 (Excellent)</span>`;
        } else if (r1 >= 1.8) {
            rrBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.2);">良 (Good)</span>`;
        } else if (r1 >= 1.0) {
            rrBadge = `<span class="badge" style="background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.2);">一般 (Fair)</span>`;
        }

        // 3. Setup Alert Banners (Advanced Stop Loss Warning System)
        let alertHtml = '';
        const slVal = parseFloat(signals.stopLoss);
        const cpVal = parseFloat(signals.currentPrice);
        const tp1Val = parseFloat(signals.tp1);
        const tp2Val = parseFloat(signals.tp2);
        
        if (signals.inPortfolio && cpVal < slVal) {
            const entryPriceVal = parseFloat(signals.entryPrice);
            if (slVal <= entryPriceVal) {
                // Scenario A: Discipline Stop Loss
                alertHtml = `
                    <div class="alert-banner discipline-sl" style="background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; animation: pulseRedBanner 2s infinite;">
                        <i class="fa-solid fa-radiation fa-fade" style="color: #ef4444; font-size: 18px;"></i>
                        <div style="display: flex; flex-direction: column; text-align: left;">
                            <span style="color: #ef4444; font-weight: 700; font-size: 14px;">🚨 紀律停損已觸發 (Discipline Stop-Loss Triggered)</span>
                            <span style="color: var(--text-secondary); font-size: 12px; margin-top: 2px; line-height: 1.5;">現價 ${currencySymbol}${cpVal.toFixed(2)} 已跌破停損價 ${currencySymbol}${slVal.toFixed(2)}。為了保護您的交易資本，強烈建議嚴格執行紀律停損出場！</span>
                        </div>
                    </div>
                `;
            } else {
                // Scenario B: Trailing Profit Lock
                alertHtml = `
                    <div class="alert-banner profit-lock" style="background: rgba(245, 158, 11, 0.12); border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; animation: pulseGlow 2s infinite;">
                        <i class="fa-solid fa-triangle-exclamation fa-fade" style="color: #f59e0b; font-size: 18px;"></i>
                        <div style="display: flex; flex-direction: column; text-align: left;">
                            <span style="color: #f59e0b; font-weight: 700; font-size: 14px;">⚠️ 移動鎖利已觸發 (Trailing Profit-Lock Triggered)</span>
                            <span style="color: var(--text-secondary); font-size: 12px; margin-top: 2px; line-height: 1.5;">現價 ${currencySymbol}${cpVal.toFixed(2)} 已跌破移動停損價 ${currencySymbol}${slVal.toFixed(2)}，但高於持倉成本 ${currencySymbol}${entryPriceVal.toFixed(2)}。雖然目前仍處於獲利狀態，建議獲利了結以鎖定交易利潤！</span>
                        </div>
                    </div>
                `;
            }
        } else if (signals.exitSignal) {
            alertHtml = `
                <div class="alert-banner warning">
                    <i class="fa-solid fa-triangle-exclamation fa-fade"></i>
                    <span>⚠️ 戰術減碼警告: ${signals.exitSignal.reason} (${signals.exitSignal.type === 'EXIT_STOP' ? '停損觸發' : signals.exitSignal.type === 'EXIT_TRAILING' ? '跌破五日線' : '高檔爆量/長上影線'}) - 建議減碼防守！</span>
                </div>
            `;
        } else if (signals.entrySignal) {
            alertHtml = `
                <div class="alert-banner opportunity">
                    <i class="fa-solid fa-lightbulb fa-bounce"></i>
                    <span>💡 入場交易契機: ${signals.entrySignal.reason} (${signals.entrySignal.type === 'ENTRY_A' ? '盤整突破' : '回後買上漲'}) - 適合分批佈局建倉！</span>
                </div>
            `;
        }

        // 4. Calculate Risk-Reward timeline positions
        const isBearish = sig.signal === 'SELL';
        let cpPct, tp1Pct;
        if (isBearish) {
            if (cpVal <= slVal) {
                const range = slVal - tp2Val;
                const fraction = range > 0 ? (slVal - cpVal) / range : 0.5;
                cpPct = 15 + Math.min(1, Math.max(0, fraction)) * 85;
            } else {
                const maxBreachRise = slVal * 0.05;
                const breachAmount = cpVal - slVal;
                const breachFraction = maxBreachRise > 0 ? Math.min(1, Math.max(0, breachAmount / maxBreachRise)) : 1;
                cpPct = 15 - breachFraction * 15;
            }
            
            const tp1Range = slVal - tp2Val;
            const tp1Fraction = tp1Range > 0 ? (slVal - tp1Val) / tp1Range : 0.6;
            tp1Pct = 15 + Math.min(1, Math.max(0, tp1Fraction)) * 85;
        } else {
            if (cpVal >= slVal) {
                const range = tp2Val - slVal;
                const fraction = range > 0 ? (cpVal - slVal) / range : 0.5;
                cpPct = 15 + Math.min(1, Math.max(0, fraction)) * 85;
            } else {
                const maxBreachDrop = slVal * 0.05;
                const breachAmount = slVal - cpVal;
                const breachFraction = maxBreachDrop > 0 ? Math.min(1, Math.max(0, breachAmount / maxBreachDrop)) : 1;
                cpPct = 15 - breachFraction * 15;
            }
            
            const tp1Range = tp2Val - slVal;
            const tp1Fraction = tp1Range > 0 ? (tp1Val - slVal) / tp1Range : 0.6;
            tp1Pct = 15 + Math.min(1, Math.max(0, tp1Fraction)) * 85;
        }

        // 5. Portfolio Context Info with Trailing Stop
        let portfolioHtml = '';
        if (signals.inPortfolio) {
            const realtimePnlVal = parseFloat(signals.realtimePnl);
            const realtimePnlPercentVal = parseFloat(signals.realtimePnlPercent);
            const expectedPnlVal = parseFloat(signals.expectedPnl);
            const expectedPnlPercentVal = parseFloat(signals.expectedPnlPercent);

            const realtimeColor = realtimePnlVal >= 0 ? '#34d399' : '#f87171';
            const expectedColor = expectedPnlVal >= 0 ? '#34d399' : '#f87171';

            portfolioHtml = `
                <div class="strategy-analysis" style="margin-top: 16px; border: 1px dashed rgba(59, 130, 246, 0.3); background: rgba(59, 130, 246, 0.03); padding: 14px 16px;">
                    <strong style="color: var(--accent-primary); font-size: 13px;"><i class="fa-solid fa-briefcase"></i> 投資組合持倉分析</strong>

                    <!-- Row 1: 均價 / 現價 / 近期最高 -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px;">
                        <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 10px;">
                            <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">持倉均價</div>
                            <div style="font-weight: 700; color: #f8fafc; font-size: 14px;">${currencySymbol}${signals.entryPrice}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 10px;">
                            <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">現價</div>
                            <div style="font-weight: 700; color: #f8fafc; font-size: 14px;">${currencySymbol}${parseFloat(signals.currentPrice).toFixed(2)}</div>
                        </div>
                        <div style="background: rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 10px;">
                            <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 2px;">近期最高</div>
                            <div style="font-weight: 700; color: #f8fafc; font-size: 14px;">${currencySymbol}${signals.recentHigh}</div>
                        </div>
                    </div>

                    <!-- Row 2: 即時損益 vs 移動停損預期損益 -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column;">
                            <div style="font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #3b82f6;"></span>
                                即時未實現損益
                            </div>
                            <div style="font-weight: 700; font-size: 15px; color: ${realtimeColor}; margin-top: 4px;">
                                ${realtimePnlVal >= 0 ? '+' : ''}${currencySymbol}${realtimePnlVal.toLocaleString()}
                            </div>
                            <div style="font-size: 11px; color: ${realtimeColor}; margin-top: 2px; font-weight: 500;">
                                ${realtimePnlPercentVal >= 0 ? '+' : ''}${realtimePnlPercentVal}%
                            </div>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column;">
                            <div style="font-size: 10px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #eab308;"></span>
                                移動停損預計損益
                            </div>
                            <div style="font-weight: 700; font-size: 15px; color: ${expectedColor}; margin-top: 4px;">
                                ${expectedPnlVal >= 0 ? '+' : ''}${currencySymbol}${expectedPnlVal.toLocaleString()}
                            </div>
                            <div style="font-size: 11px; color: ${expectedColor}; margin-top: 2px; font-weight: 500;">
                                ${expectedPnlPercentVal >= 0 ? '+' : ''}${expectedPnlPercentVal}%
                            </div>
                        </div>
                    </div>

                    <!-- Row 3: 移動停損 -->
                    <div style="margin-top: 12px; background: ${signals.isTrailingInProfit ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${signals.isTrailingInProfit ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}; border-radius: 8px; padding: 10px 12px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                            <div style="text-align: left;">
                                <div style="font-size: 10px; color: var(--text-muted);">🔄 移動停損 (Trailing Stop) — 追蹤幅度 ${signals.trailingPct}%</div>
                                <div style="font-weight: 700; font-size: 16px; color: ${signals.isTrailingInProfit ? '#34d399' : '#f87171'}; margin-top: 2px;">${currencySymbol}${signals.trailingStop}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 10px; color: var(--text-muted);">${signals.isTrailingInProfit ? '✅ 鎖定獲利' : '⚠️ 尚未獲利'}</div>
                                <div style="font-weight: 700; font-size: 14px; color: ${signals.isTrailingInProfit ? '#34d399' : '#f87171'}; margin-top: 2px;">${signals.isTrailingInProfit ? '+' : ''}${currencySymbol}${signals.trailingLockedPnl}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Row 4: SL / TP1 / TP2 損益 -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px;">
                        <div style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 8px 10px;">
                            <div style="font-size: 10px; color: #f87171; margin-bottom: 2px;">停損觸發</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${currencySymbol}${signals.stopLoss}</div>
                            <div style="font-weight: 700; color: #f87171; font-size: 13px; margin-top: 2px;">${signals.slImpact >= 0 ? '+' : ''}${currencySymbol}${Number(signals.slImpact).toLocaleString()}</div>
                        </div>
                        <div style="background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2); border-radius: 8px; padding: 8px 10px;">
                            <div style="font-size: 10px; color: #34d399; margin-bottom: 2px;">目標 1 (+15%)</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${currencySymbol}${signals.tp1}</div>
                            <div style="font-weight: 700; color: #34d399; font-size: 13px; margin-top: 2px;">+${currencySymbol}${Number(signals.tp1Impact).toLocaleString()}</div>
                        </div>
                        <div style="background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px; padding: 8px 10px;">
                            <div style="font-size: 10px; color: #22c55e; margin-bottom: 2px;">目標 2 (+25%)</div>
                            <div style="font-size: 11px; color: var(--text-muted);">${currencySymbol}${signals.tp2}</div>
                            <div style="font-weight: 700; color: #22c55e; font-size: 13px; margin-top: 2px;">+${currencySymbol}${Number(signals.tp2Impact).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        const isBreached = cpVal < slVal;
        const progressLeft = isBreached ? cpPct : 15;
        const progressWidth = isBreached ? (15 - cpPct) : (cpPct - 15);

        signalCard.innerHTML = `
            <div class="glass-panel strategy-card" style="border-left: 4px solid ${sig.color};">
                ${alertHtml}
                
                <div class="strategy-header">
                    <h3 class="strategy-title">
                        <i class="fa-solid fa-robot"></i> AI Strategy: <span style="color: ${sig.color}">${sig.text}</span>
                    </h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${rrBadge}
                        <span class="badge strategy-badge">${trend.status}</span>
                    </div>
                </div>
                
                <div class="strategy-grid">
                    <div class="stat-item">
                        <span class="stat-label">Stop Loss (PIP/ATR)</span>
                        <span class="stat-value negative">${currencySymbol}${signals.stopLoss}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Target 1 (R:R ${signals.rrRatio1})</span>
                        <span class="stat-value positive">${currencySymbol}${signals.tp1}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Target 2 (R:R ${signals.rrRatio2})</span>
                        <span class="stat-value positive">${currencySymbol}${signals.tp2}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Confidence</span>
                        <span class="stat-value" style="color: var(--accent-primary);">${Math.round((sig.confidence || 0) * 100)}%</span>
                    </div>
                </div>

                <!-- Upgraded Trade Playbook Timeline -->
                <div class="playbook-container">
                    <h4 class="playbook-title">
                        <i class="fa-solid fa-compass-drafting"></i> 戰術交易劇本 (Tactical Trade Playbook)
                    </h4>
                    <div class="rr-timeline-container">
                        <div class="rr-timeline">
                            <div class="rr-timeline-progress ${isBreached ? 'breached' : ''}" style="left: ${progressLeft}%; width: ${progressWidth}%;"></div>
                            
                            <!-- Stop Loss Node -->
                            <div class="rr-node" style="left: 15%;">
                                <div class="rr-node-dot sl"></div>
                                <span class="rr-node-label">停損 SL</span>
                                <span class="rr-node-price">${currencySymbol}${signals.stopLoss}</span>
                            </div>
                            
                            <!-- Current Price Node -->
                            <div class="rr-node" style="left: ${cpPct}%;">
                                <div class="rr-node-dot cp ${isBreached ? 'breached' : ''}" title="Current Price"></div>
                                <span class="rr-node-label cp ${isBreached ? 'breached' : ''}">現價</span>
                                <span class="rr-node-price cp ${isBreached ? 'breached' : ''}">${currencySymbol}${signals.currentPrice}</span>
                            </div>
                            
                            <!-- Target 1 Node -->
                            <div class="rr-node" style="left: ${tp1Pct}%;">
                                <div class="rr-node-dot tp1"></div>
                                <span class="rr-node-label">目標 1</span>
                                <span class="rr-node-price">${currencySymbol}${signals.tp1}</span>
                            </div>
                            
                            <!-- Target 2 Node -->
                            <div class="rr-node" style="left: 100%;">
                                <div class="rr-node-dot tp2"></div>
                                <span class="rr-node-label">目標 2</span>
                                <span class="rr-node-price">${currencySymbol}${signals.tp2}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="strategy-analysis" style="margin-top: 16px;">
                    <strong><i class="fa-solid fa-circle-info"></i> Trend Analysis:</strong><br>
                    PIP trend structure is currently ${trend.status.toLowerCase()}. 
                    ${trend.status === 'BULLISH' ? 'Strong higher-peaks and higher-troughs structure detected.' : ''}
                    ${trend.status === 'CONSOLIDATION' ? 'Price is oscillating within a tight range (neckline identification active).' : ''}
                    ${sig.signal === 'BUY' ? `Signal triggered by ${(sig.details && sig.details.reason) || 'pattern structure'}. Target entries at current level.` : 'Waiting for optimal entry setup.'}
                </div>
                
                ${portfolioHtml}
            </div>
        `;

        if (candlestickSeries) {
            currentStopLossLine = candlestickSeries.createPriceLine({
                price: parseFloat(signals.stopLoss),
                color: '#EF4444',
                lineWidth: 1,
                lineStyle: 2,
                axisLabelVisible: true,
                title: 'SL',
            });
            currentTp1Line = candlestickSeries.createPriceLine({
                price: parseFloat(signals.tp1),
                color: '#10B981',
                lineWidth: 1,
                lineStyle: 1,
                axisLabelVisible: true,
                title: 'Target 1',
            });
            currentTp2Line = candlestickSeries.createPriceLine({
                price: parseFloat(signals.tp2),
                color: '#10B981',
                lineWidth: 1,
                lineStyle: 1,
                axisLabelVisible: true,
                title: 'Target 2',
            });
        }
    }
}

// ── NEW VIEWPORT & DASHBOARD INTEGRATION UTILITIES ────────────────────────

function initAxisLock() {
    const lockBtn = document.getElementById('axis-lock-btn');
    if (!lockBtn) return;
    
    // Set initial state
    updateAxisLockUI();

    lockBtn.addEventListener('click', () => {
        isAxisLocked = !isAxisLocked;
        updateAxisLockUI();
        applyAxisLockOptions();
        
        if (isAxisLocked) {
            fitAllCharts();
        }
    });
}

function updateAxisLockUI() {
    const lockBtn = document.getElementById('axis-lock-btn');
    if (!lockBtn) return;
    
    if (isAxisLocked) {
        lockBtn.classList.add('active');
        lockBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Auto-Fit & Lock';
    } else {
        lockBtn.classList.remove('active');
        lockBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> Free Scroll';
    }
}

function applyAxisLockOptions() {
    const scrollOptions = isAxisLocked ? {
        mouseWheel: false,
        pressedMouseButton: false,
        horzTouchDrag: false,
        vertTouchDrag: false,
    } : {
        mouseWheel: true,
        pressedMouseButton: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
    };
    
    const scaleOptions = isAxisLocked ? {
        axisPressedMouseEvent: { time: false, price: true },
        mouseWheel: false,
        pinch: false,
    } : {
        axisPressedMouseEvent: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
    };

    if (currentStockChart) {
        currentStockChart.applyOptions({
            handleScroll: scrollOptions,
            handleScale: scaleOptions
        });
    }
    if (rsiChart) {
        rsiChart.applyOptions({
            handleScroll: scrollOptions,
            handleScale: scaleOptions
        });
    }
    if (pipChartInstance) {
        pipChartInstance.applyOptions({
            handleScroll: scrollOptions,
            handleScale: scaleOptions
        });
    }
}

function fitAllCharts() {
    if (currentStockChart) {
        currentStockChart.timeScale().fitContent();
    }
    if (rsiChart) {
        rsiChart.timeScale().fitContent();
    }
    if (pipChartInstance) {
        pipChartInstance.timeScale().fitContent();
    }
}

let chartObservers = [];

function observeChartResize(chartInstance, containerElement) {
    if (!chartInstance || !containerElement) return;
    
    // Cleanup existing observer if any
    const existing = chartObservers.find(o => o.container === containerElement);
    if (existing) {
        existing.observer.disconnect();
        chartObservers = chartObservers.filter(o => o.container !== containerElement);
    }

    const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
                try {
                    chartInstance.resize(width, height);
                } catch(e) {}
            }
        }
    });
    observer.observe(containerElement);
    chartObservers.push({ container: containerElement, observer });
}

function resizeAllCharts() {
    // 1. Resize K-line chart
    if (currentStockChart) {
        const el = document.getElementById('stockChart');
        if (el && el.clientWidth > 0 && el.clientHeight > 0) {
            try {
                currentStockChart.resize(el.clientWidth, el.clientHeight);
            } catch(e) {
                console.warn('[RESIZE] K-Line resize failed:', e);
            }
        }
    }
    // 2. Resize RSI chart
    if (rsiChart) {
        const el = document.getElementById('rsiChart');
        if (el && el.clientWidth > 0 && el.clientHeight > 0) {
            try {
                rsiChart.resize(el.clientWidth, el.clientHeight);
            } catch(e) {
                console.warn('[RESIZE] RSI resize failed:', e);
            }
        }
    }
    // 3. Resize PIP Tactical chart
    if (pipChartInstance) {
        const el = document.getElementById('pipChart');
        if (el && el.clientWidth > 0 && el.clientHeight > 0) {
            try {
                pipChartInstance.resize(el.clientWidth, el.clientHeight);
            } catch(e) {
                console.warn('[RESIZE] PIP resize failed:', e);
            }
        }
    }
}

// Global window event listeners for orientation and viewport changes
window.addEventListener('resize', resizeAllCharts);
window.addEventListener('orientationchange', () => {
    // Small delay to let browser orientation rendering pass complete
    setTimeout(resizeAllCharts, 200);
});

function initChartTabs() {
    const tabs = document.querySelectorAll('.chart-tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-tab');
            switchSubchart(tabName);
        });
    });
}

function switchSubchart(tabName) {
    // 1. Update tab button active state
    document.querySelectorAll('.chart-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    const rsiBtn = document.querySelector('[data-type="rsi"]');
    const pipBtn = document.querySelector('[data-type="pip-tactical"]');

    // 2. Switch the visible panel (split-view: each panel is position:absolute, fills chart-view-area)
    document.querySelectorAll('.chart-panel').forEach(panel => panel.classList.remove('active'));
    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) targetPanel.classList.add('active');

    // 3. Handle per-panel logic
    if (tabName === 'kline') {
        // Turn off RSI
        toggleRSI(false);
        if (rsiBtn) rsiBtn.classList.remove('active');
        // Turn off PIP
        isPipTacticalEnabled = false;
        if (pipBtn) pipBtn.classList.remove('active');
        const insightPanel = document.getElementById('tactical-insights-panel');
        if (insightPanel) insightPanel.style.display = 'none';
        if (pipChartInstance) {
            try { pipChartInstance.remove(); } catch(e) {}
            pipChartInstance = null; pipLineSeries = null;
        }
        // Trigger main chart resize so it fills the newly-visible panel
        if (currentStockChart) {
            setTimeout(() => {
                const el = document.getElementById('stockChart');
                if (el && el.clientWidth > 0 && el.clientHeight > 0) {
                    try { currentStockChart.resize(el.clientWidth, el.clientHeight); } catch(e) {}
                }
            }, 50);
        }

    } else if (tabName === 'rsi') {
        // Turn off PIP
        isPipTacticalEnabled = false;
        if (pipBtn) pipBtn.classList.remove('active');
        const insightPanel = document.getElementById('tactical-insights-panel');
        if (insightPanel) insightPanel.style.display = 'none';
        if (pipChartInstance) {
            try { pipChartInstance.remove(); } catch(e) {}
            pipChartInstance = null; pipLineSeries = null;
        }
        // Enable RSI
        toggleRSI(true);
        if (rsiBtn) rsiBtn.classList.add('active');
        // Trigger RSI chart resize after panel becomes visible
        setTimeout(() => {
            if (rsiChart) {
                const el = document.getElementById('rsiChart');
                if (el) rsiChart.resize(el.clientWidth, el.clientHeight);
            }
        }, 80);

    } else if (tabName === 'pip') {
        // Turn off RSI
        toggleRSI(false);
        if (rsiBtn) rsiBtn.classList.remove('active');
        // Enable PIP
        isPipTacticalEnabled = true;
        if (pipBtn) pipBtn.classList.add('active');
        const insightPanel = document.getElementById('tactical-insights-panel');
        if (insightPanel) insightPanel.style.display = 'block';

        if (currentChartData) {
            renderTacticalChart(currentChartData);
            const patternLabel = document.getElementById('pip-pattern-label');
            if (patternLabel) {
                patternLabel.style.display = 'block';
                patternLabel.innerHTML = `<div style="opacity: 0.5; font-size: 12px; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-circle-notch fa-spin"></i>
                    INITIALIZING TACTICAL ANALYSIS...
                </div>`;
            }
            const triggerRefresh = (delay) => {
                setTimeout(() => {
                    if (currentStockChart) {
                        const range = currentStockChart.timeScale().getVisibleLogicalRange();
                        if (range) refreshPipAnalysis(range, currentChartData);
                    }
                }, delay);
            };
            triggerRefresh(150);
            triggerRefresh(500);
        }
    }
}

// Expose test utilities to global window object
window.switchView = switchView;
window.calculateAISignals = calculateAISignals;
window.updateAISignals = updateAISignals;
window.currentPortfolio = currentPortfolio;
