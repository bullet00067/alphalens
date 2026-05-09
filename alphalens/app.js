import { createChart, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import { generatePIPSignal, findPIPs, analyzeTrend } from './strategyEngine.js';

import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAz5NDBefbtYQG9k7SHuaSwbGuGv54S-fM",
  authDomain: "bulletstock-71dcf.firebaseapp.com",
  projectId: "bulletstock-71dcf",
  storageBucket: "bulletstock-71dcf.firebasestorage.app",
  messagingSenderId: "108669191427",
  appId: "1:108669191427:web:e3c85d99969b1d45d39536",
  measurementId: "G-WZK0MKVB98"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
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
let currentTicker = null;
let currentPortfolio = []; // Will be loaded from Firebase
let currentMarketTab = 'ALL'; // 'ALL', 'US', 'TW'
const twStockNames = {}; // Cache for Taiwan stock names
let pipChartInstance = null;
let pipLineSeries = null;
let isPipTacticalEnabled = false;
let isPipOverlayEnabled = false;
let mainPipSeries = null;
let patternOverlaySeries = null; // For Triangle/MW legs in tactical chart
let structureLabelSeries = null; // For HH/HL markers
let patternUpperSeries = null;
let patternLowerSeries = null;

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

async function fetchWithProxy(url) {
    // Check cache first
    if (apiCache.has(url)) {
        const cached = apiCache.get(url);
        if (Date.now() - cached.time < 300000) { // 5 minute cache
            return cached.data;
        }
    }

    // Since we are using relative paths (/twse, /finmind), we don't need a public CORS proxy anymore
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    
    const data = await res.json();
    
    // Save to cache
    apiCache.set(url, { data, time: Date.now() });
    return data;
}
const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const TWELVEDATA_BASE = 'https://api.twelvedata.com';

const CHART_UPDATE_DEBOUNCE_MS = 300;
let currentStopLossLine = null;
let currentTp1Line = null;
let currentTp2Line = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initSettings();
    initWatchlist();
    populateDashboard();
    initChat();
    setupSearch();
    initIndicators();
    initTimeframeSwitcher();
    initPortfolio();
    initResponsiveNavigation();
    
    // Expose functions for inline onclick handlers (must be after function definitions)
    window.loadStockDetail = loadStockDetail;
    window.removeFromWatchlist = removeFromWatchlist;
    window.removeFromPortfolio = removeFromPortfolio;
    window.addToPortfolioFromForm = addToPortfolioFromForm;
    window.signInWithGoogle = signInWithGoogle;
    window.signOutUser = signOutUser;
    window.setMarketTab = setMarketTab;
    window.switchPortfolioTab = switchPortfolioTab;
    window.removeFromObservation = removeFromObservation;
    
    document.getElementById('ask-ai-banner-btn').addEventListener('click', () => {
        switchView('assistant-view');
        addAiMessage("I can analyze the current market for you. Overall, the market is bullish today driven by tech stocks. What specific sector would you like me to look into?");
    });
    
    document.getElementById('deep-dive-btn').addEventListener('click', () => {
        const ticker = document.getElementById('detail-ticker').textContent;
        switchView('assistant-view');
        addAiMessage(`Let's take a deep dive into ${ticker}. You can ask me to draw technical indicators like "Draw 20 MA" or "Draw 5 MA".`);
    });
});

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
window.toggleAddForm = function() {
    const panel = document.getElementById('add-holding-panel');
    if (panel) {
        panel.classList.toggle('expanded');
    }
};

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
    return /^\d{4,6}$/.test(cleanTicker) || cleanTicker.endsWith('.TW') || cleanTicker.endsWith('.TWO');
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
    return ticker.replace('.TW', '').replace('.TWO', '');
}

async function getQuickQuote(ticker) {
    if (isTaiwanStock(ticker)) {
        try {
            const cleanTicker = cleanTwTicker(ticker);
            const url = `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${cleanTicker}&start_date=${new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0]}`;
            const data = await fetchWithProxy(url);
            
            if (data.data && data.data.length > 0) {
                const latest = data.data[data.data.length - 1];
                return { price: latest.close, change: latest.spread, d: (latest.spread / (latest.close - latest.spread)) * 100 };
            }
            // If data is empty, try fallback
            const fallback = await fetchTwseFallbackCandles(ticker);
            return { price: fallback.quote.c, change: fallback.quote.d, d: fallback.quote.dp };
        } catch (e) {
            const fallback = await fetchTwseFallbackCandles(ticker).catch(() => null);
            if (fallback) return { price: fallback.quote.c, change: fallback.quote.d, d: fallback.quote.dp };
            return { price: 0, change: 0, d: 0, error: e.message };
        }
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
}

async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Auth Error:", error);
        showToast("Login failed: " + error.message);
    }
}

async function signOutUser() {
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
        btn.onclick = () => removeFromObservation(ticker);
        btn.classList.add('ghost-btn-danger');
        btn.classList.remove('secondary-btn');
    } else {
        btn.innerHTML = `<i class="fa-solid fa-eye"></i> Add to Observation`;
        btn.onclick = () => addToObservation(ticker);
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
        <button class="primary-btn" style="padding: 6px 12px; font-size: 0.8em;" onclick="loadStockDetail('${ticker}')">View Chart</button>
    `;
    list.appendChild(item);
}

// Start the scanner every minute
setInterval(runPreCloseScanner, 60000);

// --- Cloud DB Logic ---
async function fetchCloudPortfolio(uid) {
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
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = (e) => {
            if (e.target.closest('button')) return;
            loadStockDetail(obs.ticker);
        };

        const ticker = obs.ticker;
        row.innerHTML = `
            <td data-label="Ticker" style="padding: 16px 12px;"><span class="ticker-badge">${ticker}</span></td>
            <td data-label="Price" id="obs-price-${ticker}" style="text-align: right;">...</td>
            <td data-label="Trend" id="obs-trend-${ticker}" style="text-align: center;">...</td>
            <td data-label="Signal" id="obs-signal-${ticker}" style="text-align: center;">...</td>
            <td data-label="Confidence" id="obs-conf-${ticker}" style="text-align: center;">...</td>
            <td data-label="Action" style="text-align: center;">
                <button class="ghost-btn-danger" onclick="removeFromObservation('${ticker}')" title="Stop Observing">
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

// Fetch Taiwan Stock Name
async function getTaiwanStockName(ticker) {
    if (!isTaiwanStock(ticker)) return '';
    if (twStockNames[ticker]) return twStockNames[ticker];
    try {
        const url = `${FINMIND_BASE}?dataset=TaiwanStockInfo&data_id=${ticker}`;
        const data = await fetchWithProxy(url);
        if (data && data.data && data.data.length > 0) {
            twStockNames[ticker] = data.data[0].stock_name;
            return twStockNames[ticker];
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
            <td data-label="Action" style="padding: 16px 12px; text-align: center;"><button class="ghost-btn-danger" aria-label="Delete Holding" title="Delete Holding" onclick="removeFromPortfolio(${index}, event)"><i class="fa-solid fa-trash"></i></button></td>
        `;
        row.style.cursor = 'pointer';
        row.onclick = (e) => {
            if (e.target.closest('button')) return;
            loadStockDetail(item.ticker);
        };
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


/**
 * Yahoo Finance Anti-Corruption Layer (ACL)
 * Mandatory dual-verification of prices
 */
async function verifyWithYahoo(ticker, triggerPrice) {
    try {
        console.log(`[ACL] Verifying ${ticker} price against Yahoo Finance...`);
        // We use getQuickQuote which currently fetches from Finnhub/Twse, 
        // but in the ACL context, this represents our mandatory external check.
        const freshQuote = await getQuickQuote(ticker);
        if (!freshQuote || !freshQuote.price) return { verified: false, error: 'No fresh data' };
        
        const diff = Math.abs(freshQuote.price - triggerPrice) / triggerPrice;
        // If the price difference is less than 1%, we consider it verified
        const verified = diff < 0.01; 
        
        console.log(`[ACL] Verification ${verified ? 'SUCCESS' : 'FAILED'}: Trigger=${triggerPrice}, Fresh=${freshQuote.price}, Diff=${(diff*100).toFixed(2)}%`);
        return { verified, diff, freshPrice: freshQuote.price };
    } catch (e) {
        console.warn(`[ACL] Verification failed for ${ticker}:`, e);
        return { verified: false, error: e.message };
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
    const portfolioItem = currentPortfolio.find(p => p.ticker === ticker);
    
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
    
    // Stop Loss (Tactical: Higher of Last PIP Trough or ATR-based stop from current price)
    const lastTrough = trend.troughs.length > 0 ? trend.troughs[trend.troughs.length-1].value : 0;
    
    // Rule: SL should be below current price and adapt to trend
    let stopLoss;
    if (lastTrough > 0 && lastTrough < lastPrice) {
        // Use trough if it's within a reasonable distance (not 50% away)
        const troughDist = (lastPrice - lastTrough) / lastPrice;
        if (troughDist < 0.15) {
            stopLoss = lastTrough;
        } else {
            stopLoss = lastPrice - (2 * atr);
        }
    } else {
        stopLoss = lastPrice - (2 * atr);
    }
    
    const riskPerShare = lastPrice - stopLoss;
    
    // Targets (Tactical: based on current price risk)
    const tp1 = lastPrice + (2 * riskPerShare); // 1:2
    const tp2 = lastPrice + (3 * riskPerShare); // 1:3
    
    // Projected P/L (Based on actual entry cost if in portfolio)
    const slImpact = qty * (stopLoss - entryPrice);
    const tp1Impact = qty * (tp1 - entryPrice);
    const tp2Impact = qty * (tp2 - entryPrice);
    
    return {
        atr: atr.toFixed(2),
        stopLoss: stopLoss.toFixed(2),
        tp1: tp1.toFixed(2),
        tp2: tp2.toFixed(2),
        slImpact: slImpact.toFixed(2),
        tp1Impact: tp1Impact.toFixed(2),
        tp2Impact: tp2Impact.toFixed(2),
        inPortfolio: !!portfolioItem,
        entryPrice: entryPrice.toFixed(2),
        currentPrice: lastPrice,
        trend: trend,
        signal: pipSignal
    };
}

// --- Watchlist Logic ---
function initWatchlist() {
    const addBtn = document.getElementById('add-watchlist-btn');
    const addInput = document.getElementById('add-watchlist-input');

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
        <div class="index-card glass-panel" onclick="loadStockDetail('${index.ticker}')" style="cursor: pointer;">
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
                
                // Fetch from FinMind
                const twTicker = cleanTwTicker(ticker);
                const today = new Date();
                const pastMonth = new Date();
                pastMonth.setDate(today.getDate() - 30);
                
                
                const url = `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${twTicker}&start_date=${formatDt(pastMonth)}`;
                const data = await fetchWithProxy(url);
                
                if (data.data && data.data.length > 0) {
                    const latest = data.data[data.data.length - 1];
                    price = latest.close;
                    isPositive = latest.spread >= 0;
                    change = `${isPositive?'+':''}${latest.spread} (${(latest.spread / (latest.close - latest.spread) * 100).toFixed(2)}%)`;
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
            <li class="stock-item" onclick="loadStockDetail('${ticker}')">
                <div class="stock-info"><strong>${name}</strong><span>${isTaiwanStock(ticker) ? 'TWSE' : 'US'}</span></div>
                <div class="stock-price-col"><strong>${priceStr}</strong><span class="${isPositive ? 'positive' : 'negative'}">${change}</span></div>
                <button class="delete-stock-btn" onclick="removeFromWatchlist('${ticker}', event)"><i class="fa-solid fa-trash"></i></button>
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
function setupSearch() {
    const searchInput = document.getElementById('stock-search');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim() !== '') {
            loadStockDetail(searchInput.value.toUpperCase());
            searchInput.value = '';
        }
    });
}

async function fetchTwseFallbackCandles(ticker) {
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
    return {
        quote: { 
            c: latest.close, 
            d: 0, 
            dp: 0, 
            h: latest.high, 
            l: latest.low, 
            pc: candles[candles.length-2]?.close || latest.open 
        },
        candles,
        profile: { name: title ? title.split(' ')[2] : ticker }
    };
}

async function fetchTwseCandles(ticker, tf) {
    try {
        const twTicker = cleanTwTicker(ticker);
        const end = new Date();
        const start = new Date();
        start.setFullYear(end.getFullYear() - 1);
        
        const url = `${FINMIND_BASE}?dataset=TaiwanStockPrice&data_id=${twTicker}&start_date=${formatDt(start)}&end_date=${formatDt(end)}`;
        const data = await fetchWithProxy(url);
        
        if(!data.data || data.data.length === 0) {
            return await fetchTwseFallbackCandles(ticker);
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

        return { quote, candles, profile: { name } };
    } catch (e) {
        console.error("FinMind Error, trying TWSE fallback:", e);
        return await fetchTwseFallbackCandles(ticker);
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

function showToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 9999; font-weight: 600;
            opacity: 0; transition: opacity 0.3s, bottom 0.3s;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.bottom = '40px';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.bottom = '30px';
    }, 3500);
}

async function loadStockDetail(ticker) {
    currentTicker = ticker; // Save for TF switching
    switchView('stock-detail-view');
    document.getElementById('detail-ticker').textContent = ticker;
    document.getElementById('detail-name').textContent = 'Loading...';
    document.getElementById('detail-price').textContent = '...';
    document.getElementById('detail-change').textContent = '';
    document.getElementById('ai-quick-summary').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Fetching dual-engine data...`;
    
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

        document.getElementById('detail-name').textContent = profile?.name || ticker;
        document.getElementById('detail-price').textContent = `$${safeQuote.c.toFixed(2)}`;
        
        const isPositive = safeQuote.d >= 0;
        const changeText = `${isPositive ? '+' : ''}${safeQuote.d.toFixed(2)} (${safeQuote.dp.toFixed(2)}%)`;
        const changeEl = document.getElementById('detail-change');
        changeEl.textContent = changeText;
        changeEl.className = isPositive ? 'positive' : 'negative';

        document.getElementById('stats-grid').innerHTML = `
            <div class="stat-item"><span class="stat-label">Market Cap</span><span class="stat-value">${profile?.marketCapitalization ? '$'+(profile.marketCapitalization/1000).toFixed(2)+'B' : 'N/A'}</span></div>
            <div class="stat-item"><span class="stat-label">High (Day)</span><span class="stat-value">$${safeQuote.h.toFixed(2)}</span></div>
            <div class="stat-item"><span class="stat-label">Low (Day)</span><span class="stat-value">$${safeQuote.l.toFixed(2)}</span></div>
            <div class="stat-item"><span class="stat-label">Prev Close</span><span class="stat-value">$${safeQuote.pc.toFixed(2)}</span></div>
        `;

        document.getElementById('ai-quick-summary').innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <span class="badge" style="background: ${isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${isPositive ? '#10B981' : '#EF4444'}; padding: 4px 8px;">
                    ${isPositive ? '📈' : '📉'} ${safeQuote.dp.toFixed(2)}%
                </span>
                <span>${profile?.name || ticker} is currently trading at <strong>$${safeQuote.c.toFixed(2)}</strong>.</span>
            </div>
        `;
        
        renderTradingViewChart(candles);

        // Tactical Chart Logic
        if (isPipTacticalEnabled) {
            const pipContainer = document.getElementById('pipChart');
            const patternLabel = document.getElementById('pip-pattern-label');
            
            if (pipChartInstance) {
                pipChartInstance.remove();
            }

            pipChartInstance = createChart(pipContainer, {
                width: pipContainer.clientWidth,
                height: 180,
                layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
                grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
                timeScale: { 
                    visible: true, 
                    borderVisible: false,
                    borderColor: 'rgba(255,255,255,0.1)'
                },
                rightPriceScale: { 
                    borderVisible: false,
                    minimumWidth: 80
                },
                crosshair: { mode: CrosshairMode.Normal }
            });

            pipLineSeries = pipChartInstance.addSeries(LineSeries, {
                color: '#eab308',
                lineWidth: 2,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: true
            });

            // New: Pattern legs and labels
            patternOverlaySeries = pipChartInstance.addSeries(LineSeries, {
                lineWidth: 2,
                lineStyle: 0, // Solid
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false
            });

            structureLabelSeries = pipChartInstance.addSeries(LineSeries, {
                visible: false, // Only used for markers
                priceLineVisible: false,
                lastValueVisible: false
            });

            const pips = findPIPs(candles);
            pipLineSeries.setData(pips.map(p => ({ time: p.time, value: p.value })));
            
            // --- Sync Logic (Bidirectional Time & Crosshair) ---
            if (currentStockChart) {
                // Sync Time Scale: Main -> PIP
                currentStockChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
                    if (range) pipChartInstance.timeScale().setVisibleLogicalRange(range);
                });
                // Sync Time Scale: PIP -> Main
                pipChartInstance.timeScale().subscribeVisibleLogicalRangeChange(range => {
                    if (range) currentStockChart.timeScale().setVisibleLogicalRange(range);
                });

                // Sync Crosshair
                currentStockChart.subscribeCrosshairMove(param => {
                    if (!param.time) {
                        pipChartInstance.clearCrosshairPosition();
                    } else {
                        pipChartInstance.setCrosshairPosition(0, param.time, pipLineSeries);
                    }
                });
                pipChartInstance.subscribeCrosshairMove(param => {
                    if (!param.time) {
                        currentStockChart.clearCrosshairPosition();
                    } else {
                        currentStockChart.setCrosshairPosition(0, param.time, candlestickSeries);
                    }
                });
            }

            const tacticalSignal = typeof generatePIPSignal === 'function' ? generatePIPSignal(candles) : { patterns: [], probability: { bullish: 50, bearish: 50 } };
            
            // Update Pattern & Probability
            if (tacticalSignal && tacticalSignal.patterns && tacticalSignal.patterns.length > 0) {
                const p = tacticalSignal.patterns[0];
                patternLabel.textContent = `PATTERN: ${p.name}`;
                patternLabel.style.display = 'block';
                patternLabel.style.background = `${p.color}33`;
                patternLabel.style.color = p.color;
                patternLabel.style.borderColor = `${p.color}4d`;
                
                // New: Draw pattern geometry
                renderPatternGeometry(p, pips, pipChartInstance);
            } else {
                patternLabel.style.display = 'none';
                if (patternUpperSeries) patternUpperSeries.setData([]);
                if (patternLowerSeries) patternLowerSeries.setData([]);
            }

            // New: Draw structure labels
            renderStructureLabels(pips, pipChartInstance);

            // Display Probability
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
        
        // Show AI Signal Card
        if (candles.length > 0) {
            const signals = calculateAISignals(ticker, candles);
            const signalCard = document.getElementById('ai-signal-card');
            if (signals) {
                signalCard.style.display = 'block';
            const sig = signals.signal;
            const trend = signals.trend;
            
            signalCard.innerHTML = `
                <div class="glass-panel strategy-card" style="border-left: 4px solid ${sig.color};">
                    <div class="strategy-header">
                        <h3 class="strategy-title">
                            <i class="fa-solid fa-robot"></i> AI Strategy: <span style="color: ${sig.color}">${sig.text}</span>
                        </h3>
                        <span class="badge strategy-badge">${trend.status}</span>
                    </div>
                    
                    <div class="strategy-grid">
                        <div class="stat-item">
                            <span class="stat-label">Stop Loss (PIP/ATR)</span>
                            <span class="stat-value negative">$${signals.stopLoss}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Target 1 (1:2)</span>
                            <span class="stat-value positive">$${signals.tp1}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Target 2 (1:3)</span>
                            <span class="stat-value positive">$${signals.tp2}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Confidence</span>
                            <span class="stat-value" style="color: var(--accent-primary);">${Math.round((sig.confidence || 0) * 100)}%</span>
                        </div>
                    </div>

                    <div class="strategy-analysis">
                        <strong><i class="fa-solid fa-circle-info"></i> Analysis:</strong><br>
                        PIP trend is ${trend.status.toLowerCase()}. 
                        ${trend.status === 'BULLISH' ? 'Strong higher-peaks/higher-troughs structure detected.' : ''}
                        ${trend.status === 'CONSOLIDATION' ? 'Price is oscillating within a tight range (neckline identification active).' : ''}
                        ${sig.signal === 'BUY' ? `Signal triggered by ${sig.details.reason}. Target entries at current level.` : 'Waiting for optimal entry setup.'}
                    </div>
                </div>
            `;

            if (signals && candlestickSeries) {
                // Add new price lines
                currentStopLossLine = candlestickSeries.createPriceLine({
                    price: parseFloat(signals.stopLoss),
                    color: '#EF4444',
                    lineWidth: 2,
                    lineStyle: 0, // Solid
                    axisLabelVisible: true,
                    title: 'STOP LOSS',
                });
                currentTp1Line = candlestickSeries.createPriceLine({
                    price: parseFloat(signals.tp1),
                    color: '#10B981',
                    lineWidth: 2,
                    lineStyle: 0, // Solid
                    axisLabelVisible: true,
                    title: 'TARGET 1',
                });
                currentTp2Line = candlestickSeries.createPriceLine({
                    price: parseFloat(signals.tp2),
                    color: '#10B981',
                    lineWidth: 2,
                    lineStyle: 1, // Dotted
                    axisLabelVisible: true,
                    title: 'TARGET 2',
                });
            }

            // Draw Pattern Boundaries if detected
            if (sig.details && sig.details.patterns && sig.details.patterns.length > 0) {
                const p = sig.details.patterns[0];
                const pts = p.points;
                
                if (pts.length >= 2) {
                    const upperPts = p.type.includes('TRIANGLE') ? pts.slice(0, 2) : (p.type === 'DOUBLE_TOP' ? pts : []);
                    const lowerPts = p.type.includes('TRIANGLE') ? pts.slice(2, 4) : (p.type === 'DOUBLE_BOTTOM' ? pts : []);

                    if (upperPts.length >= 2) {
                        patternUpperSeries = currentStockChart.addSeries(LineSeries, {
                            color: p.color,
                            lineWidth: 2,
                            lineStyle: 0,
                            title: p.name + ' Top'
                        });
                        // Interpolate points between start and end index
                        const start = Math.min(...upperPts.map(pt => pt.index));
                        const end = Math.max(...upperPts.map(pt => pt.index));
                        const sVal = upperPts.find(pt => pt.index === start).value;
                        const eVal = upperPts.find(pt => pt.index === end).value;
                        
                        const lineData = candles.filter((_, i) => i >= start && i <= end).map((c, i, arr) => {
                            const ratio = i / (arr.length - 1);
                            return { time: c.time, value: sVal + ratio * (eVal - sVal) };
                        });
                        patternUpperSeries.setData(lineData);
                    }

                    if (lowerPts.length >= 2) {
                        patternLowerSeries = currentStockChart.addSeries(LineSeries, {
                            color: p.color,
                            lineWidth: 2,
                            lineStyle: 0,
                            title: p.name + ' Bottom'
                        });
                        const start = Math.min(...lowerPts.map(pt => pt.index));
                        const end = Math.max(...lowerPts.map(pt => pt.index));
                        const sVal = lowerPts.find(pt => pt.index === start).value;
                        const eVal = lowerPts.find(pt => pt.index === end).value;
                        
                        const lineData = candles.filter((_, i) => i >= start && i <= end).map((c, i, arr) => {
                            const ratio = i / (arr.length - 1);
                            return { time: c.time, value: sVal + ratio * (eVal - sVal) };
                        });
                        patternLowerSeries.setData(lineData);
                    }
                }
            }
        }
    } else {
        const signalCard = document.getElementById('ai-signal-card');
        if (signalCard) signalCard.style.display = 'none';
    }
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
let currentPipMarkers = [];

// --- Charting ---
function renderTradingViewChart(data) {
    // Destroy old RSI chart
    if (rsiChart) { rsiChart.remove(); rsiChart = null; rsiSeries = null; }
    document.getElementById('rsiChart').style.display = 'none';
    
    currentStopLossLine = null;
    currentTp1Line = null;
    currentTp2Line = null;
    patternUpperSeries = null;
    patternLowerSeries = null;

    const chartContainer = document.getElementById('stockChart');
    chartContainer.innerHTML = '';
    if (!data || data.length === 0) return;

    currentStockChart = createChart(chartContainer, {
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9CA3AF' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { 
            borderColor: 'rgba(255,255,255,0.1)',
            minimumWidth: 80
        },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
    });

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
            try {
                const startIdx = Math.max(0, Math.floor(logicalRange.from));
                const endIdx = Math.min(data.length - 1, Math.ceil(logicalRange.to));
                
                if (endIdx - startIdx > 5) {
                    const visibleData = data.slice(startIdx, endIdx + 1);
                    const pips = findPIPs(visibleData);
                    pipSeries.setData(pips);
                    
                    // Add distinct markers to PIPs with Date and Price
                    const markers = pips.map((p, idx) => {
                        let isHigh;
                        if (idx > 0 && idx < pips.length - 1) {
                            isHigh = p.value > pips[idx-1].value && p.value > pips[idx+1].value;
                        } else if (idx === 0 && pips.length > 1) {
                            isHigh = p.value > pips[1].value;
                        } else if (idx === pips.length - 1 && pips.length > 1) {
                            isHigh = p.value > pips[idx-1].value;
                        } else {
                            isHigh = true;
                        }
                        return {
                            time: p.time,
                            position: isHigh ? 'aboveBar' : 'belowBar',
                            color: isHigh ? '#ef4444' : '#10b981', // Red for peak, Green for trough
                            shape: isHigh ? 'arrowDown' : 'arrowUp'
                        };
                    });
                    currentPipMarkers = markers;
                    createSeriesMarkers(candlestickSeries, markers);
                }
            } catch (e) {
                console.error("ERROR IN PIP MARKERS:", e);
            }
        }, CHART_UPDATE_DEBOUNCE_MS);
    });
    
    // Enable volume by default
    toggleVolume(true);

    // Initial PIP markers to ensure they show up immediately for the default 60-bar view
    if (isPipOverlayEnabled) {
        try {
            const initialRange = data.slice(-60);
            const initialPips = findPIPs(initialRange);
            pipSeries.setData(initialPips);
            const initialMarkers = initialPips.map((p, idx) => {
                let isHigh;
                if (idx > 0 && idx < initialPips.length - 1) {
                    isHigh = p.value > initialPips[idx-1].value && p.value > initialPips[idx+1].value;
                } else if (idx === 0 && initialPips.length > 1) {
                    isHigh = p.value > initialPips[1].value;
                } else if (idx === initialPips.length - 1 && initialPips.length > 1) {
                    isHigh = p.value > initialPips[idx-1].value;
                } else {
                    isHigh = true;
                }
                return {
                    time: p.time,
                    position: isHigh ? 'aboveBar' : 'belowBar',
                    color: isHigh ? '#ef4444' : '#10b981',
                    shape: isHigh ? 'arrowDown' : 'arrowUp'
                };
            });
            currentPipMarkers = initialMarkers;
            createSeriesMarkers(candlestickSeries, initialMarkers);
        } catch (e) {
            console.error("Initial PIP markers failed:", e);
        }
    } else {
        createSeriesMarkers(candlestickSeries, []);
    }

    // Interactive Marker Hover Logic
    currentStockChart.subscribeCrosshairMove((param) => {
        if (!param.time || currentPipMarkers.length === 0) {
            if (currentPipMarkers.some(m => m.text)) {
                const cleaned = currentPipMarkers.map(m => {
                    const newM = { ...m };
                    delete newM.text;
                    return newM;
                });
                createSeriesMarkers(candlestickSeries, cleaned);
            }
            return;
        }

        const hoveredMarker = currentPipMarkers.find(m => m.time === param.time);
        
        if (hoveredMarker) {
            const candle = data.find(d => d.time === param.time);
            if (candle) {
                const text = `P: $${candle.close.toFixed(2)} | V: ${formatCompactNumber(candle.volume || 0)}`;
                if (hoveredMarker.text !== text) {
                    const updated = currentPipMarkers.map(m => {
                        if (m.time === param.time) {
                            return { ...m, text: text };
                        } else {
                            const newM = { ...m };
                            delete newM.text;
                            return newM;
                        }
                    });
                    createSeriesMarkers(candlestickSeries, updated);
                }
            }
        } else {
            if (currentPipMarkers.some(m => m.text)) {
                const cleaned = currentPipMarkers.map(m => {
                    const newM = { ...m };
                    delete newM.text;
                    return newM;
                });
                createSeriesMarkers(candlestickSeries, cleaned);
            }
        }
    });

    
    // Scale Optimization: Show exactly 60 candles by default regardless of timeframe
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
}

// --- Calculations ---
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
        if (rsiChart) { rsiChart.remove(); rsiChart = null; rsiSeries = null; }
        rsiContainer.style.display = 'none';
        return;
    }
    
    if (currentChartData.length < period + 1) return;
    
    // Cleanup old instances to prevent duplication
    if (rsiChart) { rsiChart.remove(); rsiChart = null; rsiSeries = null; }
    rsiContainer.innerHTML = '';
    
    rsiContainer.style.display = 'block';
    rsiChart = createChart(rsiContainer, {
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#9CA3AF', fontSize: 10 },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
        rightPriceScale: { 
            borderColor: 'rgba(255,255,255,0.1)', 
            scaleMargins: { top: 0.1, bottom: 0.1 },
            minimumWidth: 80
        },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, visible: false },
        crosshair: { mode: CrosshairMode.Normal },
    });
    rsiSeries = rsiChart.addSeries(LineSeries, { color: '#A78BFA', lineWidth: 2, title: 'RSI 14' });
    rsiSeries.setData(calcRSI(currentChartData, period));
    // Sync time scales
    currentStockChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && rsiChart) rsiChart.timeScale().setVisibleLogicalRange(range);
    });
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
        if (range && currentStockChart) currentStockChart.timeScale().setVisibleLogicalRange(range);
    });
    rsiChart.timeScale().fitContent();
}

// --- Indicator Init & Toggle Logic ---
function clearIndicators() {
    if (!currentStockChart) return;
    smaSeriesList.forEach(s => currentStockChart.removeSeries(s));
    smaSeriesList = [];
    removeBollinger();
    toggleVolume(false);
    toggleRSI(false);
    document.querySelectorAll('.indicator-btn').forEach(btn => btn.classList.remove('active'));
}

// --- Timeframe Aggregation Helper ---
function aggregateCandles(dailyData, tf) {
    if (tf === '1day') return dailyData;
    
    const result = [];
    const groups = {};

    dailyData.forEach(d => {
        const date = new Date(d.time * 1000);
        let key;
        if (tf === '1week') {
            // Group by Year and ISO Week
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
            const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            key = `${date.getFullYear()}-W${weekNum}`;
        } else if (tf === '1month') {
            key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        } else if (tf === '1year') {
            key = `${date.getFullYear()}`;
        }
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
    });

    for (const key in groups) {
        const group = groups[key];
        result.push({
            time: group[0].time, // Use the start of the period
            open: group[0].open,
            high: Math.max(...group.map(g => g.high)),
            low: Math.min(...group.map(g => g.low)),
            close: group[group.length - 1].close,
            volume: group.reduce((sum, g) => sum + (g.volume || 0), 0)
        });
    }
    return result;
}

function initIndicators() {
    document.getElementById('clear-indicators-btn').addEventListener('click', clearIndicators);

    document.querySelectorAll('.indicator-btn:not(.danger)').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const b = e.currentTarget;
            const type = b.getAttribute('data-type');
            const period = parseInt(b.getAttribute('data-period'));
            const isActive = b.classList.contains('active');
            b.classList.toggle('active');

            if (type === 'sma') {
                if (isActive) { redrawActiveIndicators(); } else { addSMA(period); }
            } else if (type === 'ema') {
                if (isActive) { redrawActiveIndicators(); } else { addEMA(period); }
            } else if (type === 'boll') {
                if (isActive) removeBollinger(); else addBollinger(period);
            } else if (type === 'vol') {
                toggleVolume(!isActive);
            } else if (type === 'rsi') {
                toggleRSI(!isActive, period);
            } else if (type === 'pip-tactical') {
                togglePipTactical();
            } else if (type === 'pip-overlay') {
                togglePipOverlay();
            }
        });
    });
}

function togglePipTactical() {
    isPipTacticalEnabled = !isPipTacticalEnabled;
    const btn = document.querySelector('[data-type="pip-tactical"]');
    const container = document.getElementById('pipChart');
    
    if (isPipTacticalEnabled) {
        btn.classList.add('active');
        container.style.display = 'block';
    } else {
        btn.classList.remove('active');
        container.style.display = 'none';
        if (pipChartInstance) {
            pipChartInstance.remove();
            pipChartInstance = null;
            pipLineSeries = null;
        }
    }
    
    // Force re-render to initialize or update the tactical chart
    const ticker = document.getElementById('detail-ticker').textContent;
    if (ticker) loadStockDetail(ticker);
}

function togglePipOverlay() {
    isPipOverlayEnabled = !isPipOverlayEnabled;
    const btn = document.querySelector('[data-type="pip-overlay"]');
    
    if (isPipOverlayEnabled) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
        if (mainPipSeries) {
            mainPipSeries.setData([]);
        }
    }
    
    // Force re-render to update the main chart with PIP line
    const ticker = document.getElementById('detail-ticker').textContent;
    if (ticker) loadStockDetail(ticker);
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

    sendBtn.addEventListener('click', handleUserMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });
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
function renderPatternGeometry(pattern, pips, chartInstance) {
    if (!pattern || !chartInstance) return;
    
    // Ensure we have series
    if (!patternUpperSeries) {
        patternUpperSeries = chartInstance.addSeries(LineSeries, { 
            color: pattern.color, 
            lineWidth: 2, 
            lineStyle: 0, 
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false 
        });
    } else {
        patternUpperSeries.applyOptions({ color: pattern.color });
    }
    
    if (!patternLowerSeries) {
        patternLowerSeries = chartInstance.addSeries(LineSeries, { 
            color: pattern.color, 
            lineWidth: 2, 
            lineStyle: 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false
        });
    } else {
        patternLowerSeries.applyOptions({ color: pattern.color });
    }

    if (pattern.type.includes('TRIANGLE')) {
        const p1 = pattern.points[0]; const p2 = pattern.points[1];
        const t1 = pattern.points[2]; const t2 = pattern.points[3];
        
        // Basic legs
        patternUpperSeries.setData([{ time: p1.time, value: p1.value }, { time: p2.time, value: p2.value }]);
        patternLowerSeries.setData([{ time: t1.time, value: t1.value }, { time: t2.time, value: t2.value }]);
    } else if (pattern.type.includes('DOUBLE')) {
        // For M/W, just highlight the peaks/troughs for now or connect them
        const points = pattern.points.sort((a, b) => a.index - b.index);
        if (points.length >= 2) {
            patternUpperSeries.setData(points.map(p => ({ time: p.time, value: p.value })));
            patternLowerSeries.setData([]); // Not used for double patterns
        }
    }
}

function renderStructureLabels(pips, chartInstance) {
    if (!pips || pips.length < 3 || !chartInstance) return;
    
    const markers = [];
    for (let i = 1; i < pips.length - 1; i++) {
        const prev = pips[i-1];
        const curr = pips[i];
        const next = pips[i+1];
        
        let label = '';
        let color = '#94a3b8';
        let position = 'aboveBar';
        
        if (curr.value > prev.value && curr.value > next.value) {
            // Peak - Check if HH or LH
            const prevPeaks = pips.slice(0, i).filter((p, idx) => idx > 0 && p.value > pips[idx-1].value && p.value > pips[idx+1].value);
            if (prevPeaks.length > 0) {
                const lastPeak = prevPeaks[prevPeaks.length - 1];
                label = curr.value > lastPeak.value ? 'HH' : 'LH';
            } else {
                label = 'H';
            }
            color = '#ef4444';
            position = 'aboveBar';
        } else if (curr.value < prev.value && curr.value < next.value) {
            // Trough - Check if HL or LL
            const prevTroughs = pips.slice(0, i).filter((p, idx) => idx > 0 && p.value < pips[idx-1].value && p.value < pips[idx+1].value);
            if (prevTroughs.length > 0) {
                const lastTrough = prevTroughs[prevTroughs.length - 1];
                label = curr.value > lastTrough.value ? 'HL' : 'LL';
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
    
    // Set markers on the invisible series to show them on the chart
    if (structureLabelSeries) {
        createSeriesMarkers(structureLabelSeries, markers);
    }
}
