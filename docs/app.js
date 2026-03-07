/**
 * WendyTrack Dashboard Logic
 * Fetches data from a published Google Sheet CSV and renders it into a Chart.js dashboard.
 */

// ============================================================================
// CONFIGURATION: Add your Google Sheet CSV URL here
// ============================================================================
// To get this URL:
// 1. Open your Google Sheet
// 2. Click File > Share > Publish to web
// 3. Link -> Entire Document -> Comma-separated values (.csv)
// 4. Click Publish and paste the link below:
const GOOGLE_SHEET_CSV_URL = ''; // <-- PASTE URL HERE

// Global Variables
let chartInstance = null;
let allData = []; // Will hold the parsed CSV data

// DOM Elements
const timeFilter = document.getElementById('time-filter');
const refreshBtn = document.getElementById('refresh-btn');
const setupWarning = document.getElementById('setup-warning');

// Metric Elements
const els = {
    poop: { total: document.getElementById('total-poop'), avg: document.getElementById('avg-poop') },
    pee: { total: document.getElementById('total-pee'), avg: document.getElementById('avg-pee') },
    food: { total: document.getElementById('total-food'), avg: document.getElementById('avg-food') },
    walk: { total: document.getElementById('total-walk'), avg: document.getElementById('avg-walk') }
};

// ============================================================================
// Initialization & Event Listeners
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (!GOOGLE_SHEET_CSV_URL) {
        setupWarning.classList.remove('hidden');
        return;
    }

    fetchDataAndRender();

    timeFilter.addEventListener('change', () => {
        updateDashboard(allData);
    });

    refreshBtn.addEventListener('click', () => {
        const originalText = refreshBtn.innerText;
        refreshBtn.innerText = '⏳ Loading...';
        fetchDataAndRender().then(() => {
            refreshBtn.innerText = originalText;
        });
    });
});

// ============================================================================
// Fetch & Parse CSV
// ============================================================================
async function fetchDataAndRender() {
    try {
        // Prevent browser caching by appending timestamp
        const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Network response was not ok');

        const csvText = await response.text();
        allData = parseCSV(csvText);

        updateDashboard(allData);
    } catch (error) {
        console.error('Error fetching Google Sheet Data:', error);
        alert('Failed to load data from Google Sheets. Ensure the link is correct and published to the web.');
    }
}

/**
 * Parses raw CSV text into an array of objects.
 * Assumes format: Date, Time, Action, Logged At
 */
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim().length > 0);
    const data = [];

    // Skip the first row (headers)
    for (let i = 1; i < lines.length; i++) {
        // Handle split by comma, ignoring commas inside quotes
        const row = lines[i].split(/(?!\B"[^"]*),(?![^"]*"\B)/);
        if (row.length >= 3) {
            // Convert DD/MM/YYYY to a standard Date object
            const dateParts = row[0].replace(/"/g, '').trim().split('/');
            if (dateParts.length === 3) {
                // Ensure Date resolves correctly [Day, Month, Year] -> YYYY-MM-DD
                const isoDateStr = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

                data.push({
                    dateStr: row[0].replace(/"/g, '').trim(),
                    isoDate: isoDateStr,
                    timestamp: new Date(isoDateStr).getTime(), // Used for sorting/filtering
                    time: row[1].replace(/"/g, '').trim(),
                    action: row[2].replace(/"/g, '').trim()
                });
            }
        }
    }

    // Sort oldest to newest
    return data.sort((a, b) => a.timestamp - b.timestamp);
}

// ============================================================================
// Dashboard Update Logic
// ============================================================================
function updateDashboard(data) {
    if (data.length === 0) return;

    const daysToFilter = timeFilter.value;
    let filteredData = data;

    // Filter by Timeframe
    if (daysToFilter !== 'all') {
        const days = parseInt(daysToFilter);
        const cutoffTime = new Date().getTime() - (days * 24 * 60 * 60 * 1000);
        filteredData = data.filter(item => item.timestamp >= cutoffTime);
    }

    // Group items by Date -> Action
    // Structure: { '10/03/2026': { 'קקי': 2, 'פיפי': 5 } }
    const dailyStats = {};
    const actionTotals = { 'קקי': 0, 'פיפי': 0, 'אוכל': 0, 'טיול': 0 };

    filteredData.forEach(item => {
        const d = item.dateStr;
        const a = item.action;

        if (!dailyStats[d]) {
            dailyStats[d] = { 'קקי': 0, 'פיפי': 0, 'אוכל': 0, 'טיול': 0 };
        }

        if (dailyStats[d][a] !== undefined) {
            dailyStats[d][a]++;
            actionTotals[a]++;
        }
    });

    const uniqueDaysCount = Object.keys(dailyStats).length || 1; // Prevent divide by zero

    // Update Metric Cards
    updateMetricCard(els.poop, actionTotals['קקי'], uniqueDaysCount);
    updateMetricCard(els.pee, actionTotals['פיפי'], uniqueDaysCount);
    updateMetricCard(els.food, actionTotals['אוכל'], uniqueDaysCount);
    updateMetricCard(els.walk, actionTotals['טיול'], uniqueDaysCount);

    // Update Chart
    renderChart(dailyStats);
}

function updateMetricCard(elements, total, daysCount) {
    elements.total.innerText = total;
    // Calculate average and round to 1 decimal place
    elements.avg.innerText = (total / daysCount).toFixed(1);
}

// ============================================================================
// Chart.js Rendering
// ============================================================================
function renderChart(dailyStats) {
    const ctx = document.getElementById('activityChart').getContext('2d');

    // Extract labels (dates) and datasets
    const labels = Object.keys(dailyStats);

    const dataPoop = labels.map(date => dailyStats[date]['קקי']);
    const dataPee = labels.map(date => dailyStats[date]['פיפי']);
    const dataFood = labels.map(date => dailyStats[date]['אוכל']);
    const dataWalk = labels.map(date => dailyStats[date]['טיול']);

    // Chart Design System colors matching CSS variables
    const colors = {
        poop: '#8b5a2b',
        pee: '#eab308',
        food: '#f97316',
        walk: '#10b981'
    };

    if (chartInstance) {
        chartInstance.destroy();
    }

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'קקי 💩',
                    data: dataPoop,
                    backgroundColor: colors.poop,
                    borderRadius: 4
                },
                {
                    label: 'פיפי 🚰',
                    data: dataPee,
                    backgroundColor: colors.pee,
                    borderRadius: 4
                },
                {
                    label: 'אוכל 🦴',
                    data: dataFood,
                    backgroundColor: colors.food,
                    borderRadius: 4
                },
                {
                    label: 'טיול 🦮',
                    data: dataWalk,
                    backgroundColor: colors.walk,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 14, family: "'Outfit', sans-serif" },
                    bodyFont: { size: 13, family: "'Outfit', sans-serif" },
                    padding: 12,
                    cornerRadius: 8,
                },
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: {
                    stacked: true, // Stack bars on top of each other
                    grid: {
                        display: false,
                        drawBorder: false
                    }
                },
                y: {
                    stacked: true, // Stack bars on top of each other
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}
