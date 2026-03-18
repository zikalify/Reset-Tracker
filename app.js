// DOM Elements
const mainStat = document.getElementById('main-stat');
const subStat = document.getElementById('sub-stat');
const statusMessage = document.getElementById('status-message');
const progressRingCircle = document.getElementById('progress-ring-circle');
const lapseBtn = document.getElementById('lapse-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const startDateInput = document.getElementById('start-date');
const addLapseDateInput = document.getElementById('add-lapse-date');
const addLapseBtn = document.getElementById('add-lapse-btn');
const lapsesList = document.getElementById('lapses-list');
const hardResetBtn = document.getElementById('hard-reset-btn');
const toast = document.getElementById('toast');

// State
let appState = {
    startDate: null,
    lapses: [] // Array of 'YYYY-MM-DD' strings
};

// SVG Circle properties
const radius = progressRingCircle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;

progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressRingCircle.style.strokeDashoffset = circumference;

// Utilities
function setProgress(percent) {
    const offset = circumference - percent / 100 * circumference;
    progressRingCircle.style.strokeDashoffset = offset;
}

function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function getTodayString() {
    const today = new Date();
    // Adjust for timezone to get local YYYY-MM-DD
    const offset = today.getTimezoneOffset()
    const localDate = new Date(today.getTime() - (offset*60*1000))
    return localDate.toISOString().split('T')[0];
}

// Logic & Data
function init() {
    loadData();
    
    // If no start date, set it to today implicitly but prompt user in UI
    if (!appState.startDate) {
        appState.startDate = getTodayString();
        saveData();
    }
    
    // Set max dates for inputs
    const todayStr = getTodayString();
    startDateInput.max = todayStr;
    addLapseDateInput.max = todayStr;
    
    bindEvents();
    updateUI();
}

function loadData() {
    const saved = localStorage.getItem('nofap_tracker_state');
    if (saved) {
        try {
            appState = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse state:', e);
        }
    }
}

function saveData() {
    localStorage.setItem('nofap_tracker_state', JSON.stringify(appState));
}

function calculateStats() {
    const todayStr = getTodayString();
    
    const start = new Date(appState.startDate);
    const today = new Date(todayStr);
    
    // Calculate total days elapsed (inclusive of start date)
    // Add timezone offset correction to avoid mid-day issues
    start.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diffTime = Math.abs(today - start);
    let totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Number of unique lapses on or after start date and on or before today
    const validLapses = appState.lapses.filter(l => {
        const d = new Date(l);
        d.setHours(0,0,0,0);
        return d >= start && d <= today;
    });
    
    // Remove duplicates
    const uniqueLapses = [...new Set(validLapses)];
    const lapsedDaysCount = uniqueLapses.length;
    
    const successfulDaysCount = totalDays - lapsedDaysCount;
    
    // Percentage
    let percentage = 100;
    if (totalDays > 0) {
        percentage = (successfulDaysCount / totalDays) * 100;
    }
    
    return {
        totalDays,
        successfulDaysCount,
        percentage
    };
}

function updateUI() {
    const stats = calculateStats();
    
    let mainText = '';
    let subText = '';
    let messageText = '';
    let progressVal = 100;
    
    if (stats.totalDays === 1) {
        // Day 1 special UI
        mainText = 'Day 1';
        subText = stats.successfulDaysCount === 1 ? 'So far, so good.' : 'Lapsed today.';
        progressVal = stats.successfulDaysCount === 1 ? 100 : 0;
        messageText = 'Every journey begins with a single step.';
    } else if (stats.totalDays <= 100) {
        // Up to 100 days
        mainText = `${stats.successfulDaysCount}/${stats.totalDays}`;
        subText = 'Days Succeeded';
        progressVal = stats.percentage;
        messageText = `Succeeded for <span class="highlight">${stats.successfulDaysCount} out of ${stats.totalDays} days</span> so far. Keep going!`;
    } else {
        // Over 100 days
        mainText = `${Math.round(stats.percentage)}%`;
        subText = 'Success Rate';
        progressVal = stats.percentage;
        messageText = `Succeeded <span class="highlight">${stats.percentage.toFixed(1)}%</span> of the time over ${stats.totalDays} days.`;
    }
    
    mainStat.textContent = mainText;
    subStat.textContent = subText;
    statusMessage.innerHTML = messageText;
    
    // Avoid animation glitches by setting timeout minimally
    setTimeout(() => {
        setProgress(progressVal);
        
        // Change color based on percentage
        const ringGrad = document.getElementById('ring-gradient');
        const st1 = ringGrad.querySelector('stop:nth-child(1)');
        const st2 = ringGrad.querySelector('stop:nth-child(2)');
        
        if (progressVal >= 80) {
            // Blue/Purple gradient
            st1.setAttribute('stop-color', '#3b82f6');
            st2.setAttribute('stop-color', '#8b5cf6');
            progressRingCircle.style.filter = 'url(#glow)';
        } else if (progressVal >= 50) {
            // Orange gradient
            st1.setAttribute('stop-color', '#f59e0b');
            st2.setAttribute('stop-color', '#ef4444');
            // Less glow
            progressRingCircle.style.filter = 'none';
        } else {
            // Red gradient
            st1.setAttribute('stop-color', '#ef4444');
            st2.setAttribute('stop-color', '#991b1b');
            progressRingCircle.style.filter = 'none';
        }
    }, 50);
}

// Actions
function logLapseForToday() {
    const today = getTodayString();
    addLapse(today);
    showToast('Lapse logged for today.');
}

function addLapse(dateStr) {
    if (!appState.lapses.includes(dateStr)) {
        appState.lapses.push(dateStr);
        // Sort descending
        appState.lapses.sort((a, b) => new Date(b) - new Date(a));
        saveData();
        updateUI();
        renderLapsesList();
    }
}

function removeLapse(dateStr) {
    appState.lapses = appState.lapses.filter(l => l !== dateStr);
    saveData();
    updateUI();
    renderLapsesList();
}

function renderLapsesList() {
    lapsesList.innerHTML = '';
    
    if (appState.lapses.length === 0) {
        lapsesList.innerHTML = '<li style="text-align:center; color: var(--text-muted); font-size: 0.9rem; margin-top: 10px;">No lapses recorded.</li>';
        return;
    }
    
    appState.lapses.forEach(dateStr => {
        const li = document.createElement('li');
        li.className = 'lapse-item';
        
        // Format date better
        const dateObj = new Date(dateStr);
        // Add offset to avoid timezone date shifts causing generic string display issues
        const offsetDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
        const formatStr = offsetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        
        li.innerHTML = `
            <span class="lapse-date">${formatStr}</span>
            <button class="btn-remove" data-date="${dateStr}" aria-label="Remove lapse">
                <span class="material-symbols-rounded" style="font-size: 20px; pointer-events: none;">delete</span>
            </button>
        `;
        lapsesList.appendChild(li);
    });
}

// Events
function bindEvents() {
    lapseBtn.addEventListener('click', () => {
        if(confirm('Are you sure you want to log a lapse for today?')) {
            logLapseForToday();
        }
    });
    
    settingsBtn.addEventListener('click', () => {
        startDateInput.value = appState.startDate;
        addLapseDateInput.value = getTodayString();
        renderLapsesList();
        settingsModal.classList.remove('hidden');
    });
    
    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });
    
    // Close on backdrop click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });
    
    // Settings logic
    startDateInput.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
            appState.startDate = val;
            saveData();
            updateUI();
        }
    });
    
    addLapseBtn.addEventListener('click', () => {
        const val = addLapseDateInput.value;
        if (val) {
            if (new Date(val) > new Date()) {
                showToast("Can't log lapses in the future.", 4000);
                return;
            }
            if (new Date(val) < new Date(appState.startDate)) {
                showToast("Can't log lapses before start date.", 4000);
                return;
            }
            
            if (appState.lapses.includes(val)) {
                showToast("Lapse already exists for this date.", 3000);
            } else {
                addLapse(val);
                showToast(`Lapse added for ${val}`);
            }
        }
    });
    
    lapsesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            const dateStr = e.target.getAttribute('data-date');
            if (confirm(`Remove lapse for ${dateStr}?`)) {
                removeLapse(dateStr);
            }
        }
    });
    
    hardResetBtn.addEventListener('click', () => {
        const verify = window.prompt('Type "RESET" to delete all data and start fresh.');
        if (verify === 'RESET') {
            appState = {
                startDate: getTodayString(),
                lapses: []
            };
            saveData();
            updateUI();
            settingsModal.classList.add('hidden');
            showToast('All data erased.');
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
