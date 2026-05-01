// Mock Data
const marketIndices = [
    { name: 'S&P 500', price: '5,087.03', change: '+1.2%', isPositive: true },
    { name: 'NASDAQ', price: '15,996.82', change: '+1.5%', isPositive: true },
    { name: 'Dow Jones', price: '39,069.11', change: '+0.8%', isPositive: true },
    { name: 'Russell 2000', price: '2,016.69', change: '-0.3%', isPositive: false }
];

const trendingStocks = [
    { ticker: 'NVDA', name: 'NVIDIA Corp', price: '$788.17', change: '+16.4%', isPositive: true },
    { ticker: 'AAPL', name: 'Apple Inc', price: '$189.43', change: '+1.2%', isPositive: true },
    { ticker: 'TSLA', name: 'Tesla Inc', price: '$191.97', change: '-2.1%', isPositive: false },
    { ticker: 'MSFT', name: 'Microsoft Corp', price: '$410.34', change: '+0.5%', isPositive: true },
    { ticker: 'AMD', name: 'Advanced Micro Devices', price: '$176.42', change: '+4.2%', isPositive: true }
];

const mockNews = [
    { title: 'Fed Signals Potential Rate Cuts Later This Year', source: 'Financial Times', time: '2 hours ago' },
    { title: 'Tech Stocks Rally on Strong AI Demand', source: 'Wall Street Journal', time: '4 hours ago' },
    { title: 'Oil Prices Dip as Global Supply Increases', source: 'Bloomberg', time: '5 hours ago' },
    { title: 'New EV Regulations Announced in Europe', source: 'Reuters', time: '6 hours ago' }
];

// App State
let currentStockChart = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    populateDashboard();
    initChat();
    setupSearch();
    
    // Setup Action Buttons
    document.getElementById('ask-ai-banner-btn').addEventListener('click', () => {
        switchView('assistant-view');
        addAiMessage("I can analyze the current market for you. Overall, the market is bullish today driven by tech stocks. What specific sector would you like me to look into?");
    });
    
    document.getElementById('deep-dive-btn').addEventListener('click', () => {
        const ticker = document.getElementById('detail-ticker').textContent;
        switchView('assistant-view');
        addAiMessage(`Let's take a deep dive into ${ticker}. What specific metrics or risks are you concerned about?`);
    });
});

// Navigation Logic
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Update active nav state
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Switch view
            const targetId = e.currentTarget.getAttribute('data-target');
            if(targetId) switchView(targetId);
        });
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
    document.getElementById(viewId).classList.add('active-view');
    
    // Update nav state if called programmatically
    document.querySelectorAll('.nav-links li').forEach(l => {
        if(l.getAttribute('data-target') === viewId) {
            l.classList.add('active');
        } else {
            l.classList.remove('active');
        }
    });
}

// Dashboard Population
function populateDashboard() {
    // Indices
    const indicesGrid = document.querySelector('.indices-grid');
    indicesGrid.innerHTML = marketIndices.map(index => `
        <div class="index-card glass-panel">
            <div class="index-header">
                <span>${index.name}</span>
                <i class="fa-solid fa-arrow-trend-${index.isPositive ? 'up' : 'down'} ${index.isPositive ? 'positive' : 'negative'}"></i>
            </div>
            <div class="index-price">${index.price}</div>
            <div class="index-change ${index.isPositive ? 'positive' : 'negative'}">${index.change}</div>
        </div>
    `).join('');

    // Trending Stocks
    const trendingList = document.getElementById('trending-list');
    trendingList.innerHTML = trendingStocks.map(stock => `
        <li class="stock-item" onclick="loadStockDetail('${stock.ticker}')">
            <div class="stock-info">
                <strong>${stock.ticker}</strong>
                <span>${stock.name}</span>
            </div>
            <div class="stock-price-col">
                <strong>${stock.price}</strong>
                <span class="${stock.isPositive ? 'positive' : 'negative'}">${stock.change}</span>
            </div>
        </li>
    `).join('');

    // News
    const newsList = document.getElementById('news-list');
    newsList.innerHTML = mockNews.map(news => `
        <li class="news-item">
            <h4>${news.title}</h4>
            <span>${news.source} • ${news.time}</span>
        </li>
    `).join('');
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

function loadStockDetail(ticker) {
    // In a real app, fetch data here. Using mock logic.
    let stock = trendingStocks.find(s => s.ticker === ticker);
    
    // Fallback mock if not in trending
    if (!stock) {
        stock = { ticker: ticker, name: `${ticker} Corporation`, price: '$' + (Math.random() * 500).toFixed(2), change: '+' + (Math.random() * 5).toFixed(2) + '%', isPositive: true };
    }

    document.getElementById('detail-ticker').textContent = stock.ticker;
    document.getElementById('detail-name').textContent = stock.name;
    document.getElementById('detail-price').textContent = stock.price;
    const changeEl = document.getElementById('detail-change');
    changeEl.textContent = stock.change;
    changeEl.className = stock.isPositive ? 'positive' : 'negative';

    // Update Stats
    document.getElementById('stats-grid').innerHTML = `
        <div class="stat-item"><span class="stat-label">Market Cap</span><span class="stat-value">$3.0T</span></div>
        <div class="stat-item"><span class="stat-label">P/E Ratio</span><span class="stat-value">28.5</span></div>
        <div class="stat-item"><span class="stat-label">Div Yield</span><span class="stat-value">0.5%</span></div>
        <div class="stat-item"><span class="stat-label">52W High</span><span class="stat-value">$199.62</span></div>
    `;

    document.getElementById('ai-quick-summary').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing ${stock.ticker}...`;
    
    setTimeout(() => {
        document.getElementById('ai-quick-summary').innerHTML = `${stock.ticker} is showing strong momentum. The P/E ratio suggests a premium valuation, but recent earnings beat expectations. Key resistance level is at $195.`;
    }, 1500);

    renderChart(stock.ticker);
    switchView('stock-detail-view');
}

function renderChart(ticker) {
    const ctx = document.getElementById('stockChart').getContext('2d');
    
    if (currentStockChart) {
        currentStockChart.destroy();
    }

    // Generate random chart data
    const labels = Array.from({length: 30}, (_, i) => `Day ${i+1}`);
    let basePrice = 150;
    const data = labels.map(() => {
        basePrice += (Math.random() - 0.45) * 5;
        return basePrice;
    });

    currentStockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${ticker} Price`,
                data: data,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#9CA3AF' }
                },
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
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
        <div class="message user-message">
            <div class="message-content">${text}</div>
        </div>
    `);
    
    input.value = '';
    scrollToBottom();

    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    messagesContainer.insertAdjacentHTML('beforeend', `
        <div class="message ai-message" id="${typingId}">
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `);
    scrollToBottom();

    // Mock AI response
    setTimeout(() => {
        document.getElementById(typingId).remove();
        
        let response = "Based on my analysis, that's an interesting perspective. Market conditions are volatile, so I recommend maintaining a diversified portfolio.";
        if (text.toLowerCase().includes('apple') || text.toLowerCase().includes('aapl')) {
            response = "Apple (AAPL) recently reported strong services revenue, offsetting slight dips in hardware sales. The upcoming product announcements might serve as a positive catalyst. Are you considering a long position?";
        } else if (text.toLowerCase().includes('risk')) {
            response = "Current market risks include sticky inflation metrics and potential delayed rate cuts by the Fed. It's advisable to monitor macroeconomic indicators closely over the next two weeks.";
        }

        addAiMessage(response);
    }, 1500);
}

function addAiMessage(text) {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.insertAdjacentHTML('beforeend', `
        <div class="message ai-message">
            <div class="message-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">${text}</div>
        </div>
    `);
    scrollToBottom();
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
