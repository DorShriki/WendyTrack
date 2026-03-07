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
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRndYhMdzPabGCTLneqVebw9r0II-iPdNWuSJG02VFiPneHotbX6WKWq3q3l6QmBfmdfvVV-OzS1kcj/pub?output=csv'; // <-- PASTE URL HERE

// Global Variables
let chartInstance = null;
let timeChartInstance = null;
let allData = []; // Will hold the parsed CSV data

// DOM Elements
const timeFilter = document.getElementById('time-filter');
const refreshBtn = document.getElementById('refresh-btn');
const setupWarning = document.getElementById('setup-warning');

// Insight Elements
const insights = {
    mealToPoop: document.getElementById('insight-meal-poop'),
    commonPoop: document.getElementById('insight-common-poop'),
    commonPee: document.getElementById('insight-common-pee'),
    tripPee: document.getElementById('insight-trip-pee'),
    tripPoop: document.getElementById('insight-trip-poop')
};

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

                const timeStr = row[1].replace(/"/g, '').trim();
                let timeDecimal = null;
                if (timeStr && timeStr.includes(':')) {
                    const [hours, minutes] = timeStr.split(':');
                    timeDecimal = parseInt(hours, 10) + (parseInt(minutes, 10) / 60);
                }

                data.push({
                    dateStr: row[0].replace(/"/g, '').trim(),
                    isoDate: isoDateStr,
                    timestamp: new Date(isoDateStr).getTime(), // Used for sorting/filtering
                    time: timeStr,
                    timeDecimal: timeDecimal,
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

    // Calculate Smart Insights
    calculateInsights(filteredData);

    // Update Charts
    renderChart(dailyStats);
    renderTimeChart(filteredData);
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

// ============================================================================
// Smart Insights Engine
// ============================================================================
function calculateInsights(filteredData) {
    if (filteredData.length === 0) return;

    // 1. Meal to Poop Correlation
    let mealToPoopGaps = []; // Minutes
    let lastMealTime = null;

    filteredData.forEach(item => {
        if (item.action === 'אוכל') {
            lastMealTime = item.timestamp;
        } else if (item.action === 'קקי' && lastMealTime !== null) {
            const diffMs = item.timestamp - lastMealTime;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));

            // Only consider it related if the poop happened within 12 hours of the meal
            if (diffMinutes > 0 && diffMinutes < (12 * 60)) {
                mealToPoopGaps.push(diffMinutes);
            }
            lastMealTime = null; // Reset until next meal
        }
    });

    if (mealToPoopGaps.length > 0) {
        const avgGap = mealToPoopGaps.reduce((sum, val) => sum + val, 0) / mealToPoopGaps.length;
        const hours = Math.floor(avgGap / 60);
        const mins = Math.floor(avgGap % 60);
        insights.mealToPoop.innerText = hours > 0
            ? `~${hours}h ${mins}m after eating`
            : `~${mins}m after eating`;
    } else {
        insights.mealToPoop.innerText = "No data available";
    }

    // 2. Trip Efficiency (Walk to Potty)
    let tripToPeeGaps = [];
    let tripToPoopGaps = [];
    let lastWalkTime = null;

    filteredData.forEach(item => {
        if (item.action === 'טיול') {
            lastWalkTime = item.timestamp;
        } else if ((item.action === 'פיפי' || item.action === 'קקי') && lastWalkTime !== null) {
            const diffMs = item.timestamp - lastWalkTime;
            const diffMinutes = Math.floor(diffMs / (1000 * 60));

            // Assume the walk "trip" only lasts 15 minutes.
            // If the activity happened within 15 mins of the walk starting, it occurred ON the trip.
            if (diffMinutes >= 0 && diffMinutes <= 15) {
                if (item.action === 'פיפי') tripToPeeGaps.push(diffMinutes);
                if (item.action === 'קקי') tripToPoopGaps.push(diffMinutes);
            }
        }
    });

    if (tripToPeeGaps.length > 0) {
        const avgPeeGap = Math.round(tripToPeeGaps.reduce((sum, val) => sum + val, 0) / tripToPeeGaps.length);
        insights.tripPee.innerText = `~${avgPeeGap} mins into walk`;
    } else {
        insights.tripPee.innerText = "No data available";
    }

    if (tripToPoopGaps.length > 0) {
        const avgPoopGap = Math.round(tripToPoopGaps.reduce((sum, val) => sum + val, 0) / tripToPoopGaps.length);
        insights.tripPoop.innerText = `~${avgPoopGap} mins into walk`;
    } else {
        insights.tripPoop.innerText = "No data available";
    }

    // 3. Typical Times
    function getMostCommonHour(actionName) {
        const hourBins = new Array(24).fill(0);

        filteredData.forEach(item => {
            if (item.action === actionName && item.timeDecimal !== null) {
                const hour = Math.floor(item.timeDecimal);
                hourBins[hour]++;
            }
        });

        const maxCount = Math.max(...hourBins);
        if (maxCount === 0) return "N/A";

        const peakHour = hourBins.indexOf(maxCount);
        const nextHour = (peakHour + 1) % 24;
        return `${peakHour.toString().padStart(2, '0')}:00 - ${nextHour.toString().padStart(2, '0')}:00`;
    }

    insights.commonPoop.innerText = getMostCommonHour('קקי');
    insights.commonPee.innerText = getMostCommonHour('פיפי');
}

// ============================================================================
// Time Distribution Chart (Histogram)
// ============================================================================
function renderTimeChart(filteredData) {
    const ctx = document.getElementById('timeChart').getContext('2d');

    // Group events into 24-hour bins for a histogram
    const hourlyBins = {
        'קקי': new Array(24).fill(0),
        'פיפי': new Array(24).fill(0),
        'אוכל': new Array(24).fill(0),
        'טיול': new Array(24).fill(0)
    };

    filteredData.forEach(item => {
        if (item.timeDecimal !== null && hourlyBins[item.action]) {
            const hour = Math.floor(item.timeDecimal);
            hourlyBins[item.action][hour]++;
        }
    });

    const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

    const colors = {
        'קקי': '#8b5a2b',
        'פיפי': '#eab308',
        'אוכל': '#f97316',
        'טיול': '#10b981'
    };

    if (timeChartInstance) {
        timeChartInstance.destroy();
    }

    timeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'קקי 💩',
                    data: hourlyBins['קקי'],
                    backgroundColor: colors['קקי'],
                    borderRadius: 4
                },
                {
                    label: 'פיפי 🚰',
                    data: hourlyBins['פיפי'],
                    backgroundColor: colors['פיפי'],
                    borderRadius: 4
                },
                {
                    label: 'אוכל 🦴',
                    data: hourlyBins['אוכל'],
                    backgroundColor: colors['אוכל'],
                    borderRadius: 4
                },
                {
                    label: 'טיול 🦮',
                    data: hourlyBins['טיול'],
                    backgroundColor: colors['טיול'],
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    }
                }
            },
            plugins: {
                tooltip: {
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
            }
        }
    });
}
