// DOM Elements
const mainStat = document.getElementById('main-stat');
const subStat = document.getElementById('sub-stat');
const statusMessage = document.getElementById('status-message');
const progressRingCircle = document.getElementById('progress-ring-circle');
const waveFill = document.getElementById('wave-fill');
const wavePath = document.getElementById('wave-path');
const lapseBtn = document.getElementById('lapse-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const startDateInput = document.getElementById('start-date');
const addLapseDateInput = document.getElementById('add-lapse-date');
const addLapseBtn = document.getElementById('add-lapse-btn');
const lapsesList = document.getElementById('lapses-list');
const hardResetBtn = document.getElementById('hard-reset-btn');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importDataFile = document.getElementById('import-data-file');
const toast = document.getElementById('toast');

// State
let appState = {
    startDate: null,
    lapses: [], // Array of 'YYYY-MM-DD' strings
    ninetyEightPercentDate: null, // Date when 98% was first achieved or re-achieved
    waveProgress: 0, // 0-100, persisted wave fill level
    waveLastUpdated: null // YYYY-MM-DD string, last day wave was updated
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

// Wave animation state
let waveAnimationId = null;
let waveTargetPercent = 0;

// Ring pulse animation - runs always
const ringGradientEl = document.getElementById('ring-gradient');

function ringPulseLoop(timestamp) {
    // Spin gradient angle slowly (~20 seconds per full rotation)
    const angle = (timestamp * 0.018) % 360;
    const rad = (angle * Math.PI) / 180;
    const x1 = (0.5 + Math.cos(rad) * 0.5).toFixed(4);
    const y1 = (0.5 + Math.sin(rad) * 0.5).toFixed(4);
    const x2 = (0.5 - Math.cos(rad) * 0.5).toFixed(4);
    const y2 = (0.5 - Math.sin(rad) * 0.5).toFixed(4);
    if (ringGradientEl) {
        ringGradientEl.setAttribute('x1', x1);
        ringGradientEl.setAttribute('y1', y1);
        ringGradientEl.setAttribute('x2', x2);
        ringGradientEl.setAttribute('y2', y2);
    }
    requestAnimationFrame(ringPulseLoop);
}
requestAnimationFrame(ringPulseLoop);

function setWaveColor(increasing) {
    const waveGrad = document.getElementById('wave-gradient');
    if (!waveGrad) return;
    const st1 = waveGrad.querySelector('stop:nth-child(1)');
    const st2 = waveGrad.querySelector('stop:nth-child(2)');
    if (increasing) {
        // Soft green
        st1.setAttribute('stop-color', '#6ee7b7');
        st2.setAttribute('stop-color', '#34d399');
    } else {
        // Soft red
        st1.setAttribute('stop-color', '#fca5a5');
        st2.setAttribute('stop-color', '#f87171');
    }
}

function drawWaveFrame(percent, timestamp) {
    const circleRadius = 104;
    const circleCenterY = 140;
    const fillHeight = (percent / 100) * (circleRadius * 2);
    const waveY = circleCenterY + circleRadius - fillHeight;

    const amplitude = 5;
    const frequency = 0.022;
    const speed = 0.0018;
    const points = [];

    const leftX = 36;
    const rightX = 244;
    const bottomY = circleCenterY + circleRadius;

    points.push(`M ${leftX} ${bottomY}`);

    for (let x = leftX; x <= rightX; x += 2) {
        const y = waveY + Math.sin((x * frequency) + (timestamp * speed)) * amplitude
                       + Math.sin((x * frequency * 0.7) + (timestamp * speed * 1.3) + 1) * (amplitude * 0.4);
        points.push(`L ${x} ${y}`);
    }

    points.push(`L ${rightX} ${bottomY}`);
    points.push(`L ${leftX} ${bottomY}`);
    points.push('Z');

    wavePath.setAttribute('d', points.join(' '));
}

function waveAnimationLoop(timestamp) {
    if (waveTargetPercent <= 0) {
        waveFill.style.display = 'none';
        waveAnimationId = null;
        return;
    }
    drawWaveFrame(waveTargetPercent, timestamp);
    waveAnimationId = requestAnimationFrame(waveAnimationLoop);
}

function setWaveFill(percent) {
    waveTargetPercent = percent;

    if (percent <= 0) {
        waveFill.style.display = 'none';
        if (waveAnimationId) {
            cancelAnimationFrame(waveAnimationId);
            waveAnimationId = null;
        }
        return;
    }

    waveFill.style.display = 'block';

    // Start loop only if not already running
    if (!waveAnimationId) {
        waveAnimationId = requestAnimationFrame(waveAnimationLoop);
    }
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
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

function getLocalDateString(date) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
}

function applyBrightTheme() {
    document.body.classList.add('bright-theme');
}

function removeBrightTheme() {
    document.body.classList.remove('bright-theme');
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
    // Migrate from old key if present
    const oldSaved = localStorage.getItem('nofap_tracker_state');
    if (oldSaved) {
        localStorage.setItem('reset_tracker_state', oldSaved);
        localStorage.removeItem('nofap_tracker_state');
    }

    const saved = localStorage.getItem('reset_tracker_state');
    if (saved) {
        try {
            const parsedState = JSON.parse(saved);
            appState = {
                startDate: null,
                lapses: [],
                ninetyEightPercentDate: null,
                waveProgress: 0,
                waveLastUpdated: null,
                ...parsedState
            };
        } catch (e) {
            console.error('Failed to parse state:', e);
            appState = {
                startDate: null,
                lapses: [],
                ninetyEightPercentDate: null,
                waveProgress: 0,
                waveLastUpdated: null
            };
        }
    } else {
        appState = {
            startDate: null,
            lapses: [],
            ninetyEightPercentDate: null,
            waveProgress: 0,
            waveLastUpdated: null
        };
    }
}

function saveData() {
    localStorage.setItem('reset_tracker_state', JSON.stringify(appState));
}

function calculateStats() {
    const todayStr = getTodayString();
    
    const start = new Date(appState.startDate);
    const today = new Date(todayStr);
    
    // Validate dates
    if (!appState.startDate || isNaN(start.getTime()) || isNaN(today.getTime())) {
        console.error('Invalid dates detected');
        return {
            totalDays: 0,
            successfulDaysCount: 0,
            percentage: 0,
            lapsesWithinPeriod: 0
        };
    }
    
    // Calculate total days elapsed (inclusive of start date)
    const totalDays = Math.max(1, Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1);
    
    // Ensure we have valid days
    if (totalDays <= 0) {
        return {
            totalDays: 0,
            successfulDaysCount: 0,
            percentage: 0,
            lapsesWithinPeriod: 0
        };
    }
    
    // Count lapses within the tracking period
    const lapsesWithinPeriod = appState.lapses.filter(dateStr => {
        if (!dateStr) return false;
        const lapseDate = new Date(dateStr);
        return !isNaN(lapseDate.getTime()) && lapseDate >= start && lapseDate <= today;
    });
    
    const successfulDaysCount = totalDays - lapsesWithinPeriod.length;
    const percentage = totalDays > 0 ? (successfulDaysCount / totalDays) * 100 : 0;
    
    const result = {
        totalDays,
        successfulDaysCount,
        percentage,
        lapsesWithinPeriod: lapsesWithinPeriod.length
    };
    return result;
}

function checkStrongRecovery(stats) {
    // Must have at least 98% overall AND be tracking for 6+ months
    if (stats.percentage < 98 || stats.totalDays < 180) return false;
    
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);
    
    // Check if user has been tracking for at least 6 months
    const startDate = new Date(appState.startDate);
    if (startDate > sixMonthsAgo) return false;
    
    // Calculate stats for the last 6 months
    const totalDaysInPeriod = Math.floor((today - sixMonthsAgo) / (1000 * 60 * 60 * 24)) + 1;
    const lapsesInPeriod = appState.lapses.filter(dateStr => {
        const lapseDate = new Date(dateStr);
        return lapseDate >= sixMonthsAgo && lapseDate <= today;
    }).length;
    
    const successfulDaysInPeriod = totalDaysInPeriod - lapsesInPeriod;
    const percentageInPeriod = (successfulDaysInPeriod / totalDaysInPeriod) * 100;
    
    return percentageInPeriod >= 98;
}

function checkStableRecovery(stats) {
    // Stable recovery is achieved when waveProgress reaches 100
    // AND currently at 98%+
    if (stats.percentage < 98) return false;
    return appState.waveProgress >= 100;
}

function calculateStableRecoveryProgress(stats) {
    // Calculate progress towards 6-month stable recovery (0-100%)
    if (stats.percentage < 98 || !appState.ninetyEightPercentDate) {
        return 0;
    }

    const today = new Date();
    const sinceDate = new Date(appState.ninetyEightPercentDate);
    if (isNaN(sinceDate.getTime())) return 0;

    const daysSince = Math.floor((today - sinceDate) / (1000 * 60 * 60 * 24));
    const progress = Math.min((daysSince / 180) * 100, 100);
    return progress;
}

function updateWaveProgress(stats) {
    // Wave only exists if 98% has ever been achieved
    if (!appState.ninetyEightPercentDate) {
        appState.waveProgress = 0;
        return;
    }

    const todayStr = getTodayString();
    const lastUpdated = appState.waveLastUpdated;

    // First time running — initialise from ninetyEightPercentDate
    if (!lastUpdated) {
        const sinceDate = new Date(appState.ninetyEightPercentDate);
        const today = new Date(todayStr);
        const daysSince = Math.max(0, Math.floor((today - sinceDate) / (1000 * 60 * 60 * 24)));
        appState.waveProgress = Math.min((daysSince / 180) * 100, 100);
        appState.waveLastUpdated = todayStr;
        saveData();
        return;
    }

    if (lastUpdated === todayStr) return; // Already updated today

    // Count days elapsed since last update
    const last = new Date(lastUpdated);
    const today = new Date(todayStr);
    const daysElapsed = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    if (daysElapsed <= 0) return;

    // Rate: 1/180 of full wave per day
    const ratePerDay = (1 / 180) * 100;
    const delta = daysElapsed * ratePerDay;

    if (stats.percentage >= 98) {
        appState.waveProgress = Math.min(appState.waveProgress + delta, 100);
    } else {
        appState.waveProgress = Math.max(appState.waveProgress - delta, 0);
    }

    appState.waveLastUpdated = todayStr;
    saveData();
}

function calculateRecoveryDuration() {
    const today = new Date();
    const startDate = new Date(appState.startDate);
    const totalDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;
    
    let duration = '';
    if (years > 0) duration += `${years} year${years > 1 ? 's' : ''} `;
    if (months > 0) duration += `${months} month${months > 1 ? 's' : ''} `;
    if (days > 0 || duration === '') duration += `${days} day${days !== 1 ? 's' : ''}`;
    
    return duration.trim();
}

function getWeeklyTrend() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = getLocalDateString(today);
    const yesterdayStr = getLocalDateString(yesterday);
    
    // Check if we have data for both days
    const todayHasLapse = appState.lapses.includes(todayStr);
    const yesterdayHasLapse = appState.lapses.includes(yesterdayStr);
    
    // Skip if yesterday is before start date
    if (yesterday < new Date(appState.startDate)) {
        return null;
    }
    
    // Focus on positive momentum rather than pass/fail
    const currentStreak = calculateCurrentStreak();
    const daysSinceStart = Math.floor((today - new Date(appState.startDate)) / (1000 * 60 * 60 * 24));
    
    // Day 1: always encouraging
    if (daysSinceStart === 1) {
        return { type: 'starting', color: '#10b981', text: 'Great start!' };
    }
    
    // Building momentum
    if (!todayHasLapse && !yesterdayHasLapse) {
        return { type: 'momentum', color: '#10b981', text: 'Building momentum' };
    }
    
    // Back on track
    if (!todayHasLapse && yesterdayHasLapse) {
        return { type: 'recovery', color: '#3b82f6', text: 'Back on track' };
    }
    
    // Learning moment
    if (todayHasLapse && !yesterdayHasLapse) {
        return { type: 'learning', color: '#f59e0b', text: 'Keep growing' };
    }
    
    // Need support
    if (todayHasLapse && yesterdayHasLapse) {
        return { type: 'support', color: '#ef4444', text: 'Stay strong' };
    }
    
    return { type: 'steady', color: '#10b981', text: 'Keep going' };
}

function calculateCurrentStreak() {
    const today = new Date();
    let streak = 0;
    
    // Count backwards from today
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = getLocalDateString(checkDate);
        
        if (checkDate < new Date(appState.startDate)) {
            break;
        }
        
        if (!appState.lapses.includes(dateStr)) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

function calculateNinetyEightPercentDate() {
    // Walk forward day-by-day from the start date and find the last day the
    // cumulative score dipped below 98%. The day after that is when 98%+ was
    // regained and held continuously. If it never dipped below, the start date is returned.
    const start = new Date(appState.startDate);
    const todayStr = getTodayString();
    const today = new Date(todayStr);

    if (!appState.startDate || isNaN(start.getTime())) return null;

    const lapseSet = new Set(appState.lapses);

    const totalDaysOverall = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
    if (totalDaysOverall <= 0) return null;

    let lapsesSoFar = 0;
    let lastDipDate = null;

    for (let i = 0; i < totalDaysOverall; i++) {
        const checkDate = new Date(start);
        checkDate.setDate(start.getDate() + i);
        const checkStr = getLocalDateString(checkDate);

        if (lapseSet.has(checkStr)) lapsesSoFar++;

        const dayNumber = i + 1;
        const pct = ((dayNumber - lapsesSoFar) / dayNumber) * 100;

        if (pct < 98) {
            lastDipDate = new Date(checkDate);
        }
    }

    if (lastDipDate === null) {
        // Never dipped below 98% — journey start is when it was first achieved
        return appState.startDate;
    }

    // Day after the last dip is when >=98% was regained and held
    const recoveryDate = new Date(lastDipDate);
    recoveryDate.setDate(lastDipDate.getDate() + 1);
    return getLocalDateString(recoveryDate);
}

function checkAndUpdateNinetyEightPercentDate(stats) {
    if (stats.percentage < 98) {
        // Don't clear ninetyEightPercentDate — we need it to track wave history
        // even when below 98%. Just leave it as-is.
        return;
    }

    // Always recalculate from full history so it's accurate regardless of when
    // the app was first opened or whether the start date was changed.
    const correctDate = calculateNinetyEightPercentDate();
    if (appState.ninetyEightPercentDate !== correctDate) {
        appState.ninetyEightPercentDate = correctDate;
        saveData();
    }
}

function updateUI() {
    console.log('=== UPDATEUI START ===');
    try {
        const stats = calculateStats();
        console.log('Stats:', JSON.stringify(stats));
        console.log('totalDays value:', stats.totalDays, 'type:', typeof stats.totalDays);
        console.log('totalDays === 1:', stats.totalDays === 1);
        
        const weeklyTrendData = getWeeklyTrend();
        
        // Check and update 98% achievement date
        checkAndUpdateNinetyEightPercentDate(stats);

        // Update wave progress (fill or drain based on current percentage)
        updateWaveProgress(stats);
        
        let mainText = '';
        let subText = '';
        let messageText = '';
        let progressVal = 100;
        
        if (stats.totalDays <= 0) {
            console.log('>>> ENTERED EMPTY STATE BRANCH');
            mainText = `${Math.floor(stats.percentage)}%`;
            subText = 'Success Rate';
            progressVal = stats.percentage;
            messageText = 'Start your journey today.';
        } else {
            console.log('>>> ENTERED PERCENTAGE BRANCH');
            mainText = `${Math.floor(stats.percentage)}%`;
            subText = 'Success Rate';
            progressVal = stats.percentage;
            
            // Tiered goal logic based on current performance
            const today = new Date();
            
            // Check for stable recovery (wave at 100% and above 98%)
            const hasStableRecovery = checkStableRecovery(stats);
            const stableRecoveryProgress = appState.waveProgress;
            const waveVisible = Boolean(appState.ninetyEightPercentDate) && !hasStableRecovery;
            const isInStableRecoveryProgress = waveVisible && stats.percentage >= 98;
            const waveIncreasing = stats.percentage >= 98;
            
            if (hasStableRecovery) {
                // Apply bright theme and show stable recovery message
                applyBrightTheme();
                
                mainText = `${Math.floor(stats.percentage)}%`;
                subText = 'Stable Recovery';
                progressVal = stats.percentage;
                
                // Format dates for message
                const startDate = new Date(appState.startDate);
                const startDateFormatted = startDate.toLocaleDateString();
                
                let ninetyEightDateFormatted = '';
                if (appState.ninetyEightPercentDate) {
                    const ninetyEightDate = new Date(appState.ninetyEightPercentDate);
                    ninetyEightDateFormatted = ninetyEightDate.toLocaleDateString();
                } else {
                    ninetyEightDateFormatted = startDateFormatted;
                }
                
                // Calculate journey duration
                const journeyDuration = calculateRecoveryDuration();
                
                messageText = `
                    <div style="text-align: center; padding: 10px;">
                        <strong style="color: #06b6d4; font-size: 1.2em;">🌟 Stable Recovery Achieved</strong><br><br>
                        You have maintained a <span style="color: #0891b2; font-weight: 600;">98%+</span> score since <span style="color: #0891b2; font-weight: 600;">${ninetyEightDateFormatted}</span>.<br>
                        You've been on this journey since <span style="color: #0891b2; font-weight: 600;">${startDateFormatted}</span>.<br>
                        <span style="color: #0e7490; font-weight: 600;">${journeyDuration}</span> of consistent progress.<br><br>
                        <span style="color: #155e75; font-style: italic;">Congratulations! Your dedication has created lasting change. Future relapses could lead to a loss of Stable Recovery status.</span>
                    </div>
                `;
                
                // Write to DOM before returning (the lines at the bottom of updateUI
                // are never reached due to the early return, so we set them here)
                mainStat.textContent = mainText;
                subStat.textContent = subText;
                statusMessage.innerHTML = messageText;

                // Update progress ring to bright cyan-green gradient for stable recovery
                setTimeout(() => {
                    setProgress(progressVal);
                    setWaveFill(0); // Hide wave fill for stable recovery
                    const ringGrad = document.getElementById('ring-gradient');
                    const st1 = ringGrad.querySelector('stop:nth-child(1)');
                    const st2 = ringGrad.querySelector('stop:nth-child(2)');
                    st1.setAttribute('stop-color', '#06b6d4');
                    st2.setAttribute('stop-color', '#10b981');
                }, 50);

                console.log('=== UPDATEUI END (stable recovery) ===');
                return;
            } else if (isInStableRecoveryProgress) {
                // Show yellow gradient wave filling towards stable recovery
                removeBrightTheme();
                
                mainText = `${Math.floor(stats.percentage)}%`;
                subText = 'Success Rate';
                progressVal = stats.percentage; // Keep normal progress for ring
                
                const lapsePercentage = Math.floor(((stats.successfulDaysCount - 1) / stats.totalDays) * 100);
                const todayStrSRP = getTodayString();
                const hasLapsedTodaySRP = appState.lapses.includes(todayStrSRP);
                messageText = 'Maintain 98%+ to fill the circle.';
                if (!hasLapsedTodaySRP) {
                    messageText += ` Relapsing today would drop you to <span class="highlight">${lapsePercentage}%</span>.`;
                    // Only show recovery days if lapse would drop below 98%
                    if (lapsePercentage < 98) {
                        // Calculate days needed to recover back to 98% after a lapse today
                        const targetDecimal = 0.98;
                        const newTotal = stats.totalDays;
                        const newSuccessful = stats.successfulDaysCount - 1;
                        const daysToRecover = Math.ceil(((targetDecimal * newTotal) - newSuccessful) / (1 - targetDecimal));
                        messageText += ` It would take <span class="highlight">${daysToRecover}</span> days to recover 98% and start filling the circle again!`;
                    }
                }

                // Write to DOM before returning
                mainStat.textContent = mainText;
                subStat.textContent = subText;
                statusMessage.innerHTML = messageText;
                
                // Update progress ring normally and show wave fill
                setTimeout(() => {
                    setProgress(progressVal);
                    setWaveFill(stableRecoveryProgress);
                    setWaveColor(waveIncreasing);
                    
                    const ringGrad = document.getElementById('ring-gradient');
                    const st1 = ringGrad.querySelector('stop:nth-child(1)');
                    const st2 = ringGrad.querySelector('stop:nth-child(2)');
                    
                    if (progressVal >= 90) {
                        st1.setAttribute('stop-color', '#3b82f6');
                        st2.setAttribute('stop-color', '#8b5cf6');
                    } else if (progressVal >= 75) {
                        st1.setAttribute('stop-color', '#3b82f6');
                        st2.setAttribute('stop-color', '#6366f1');
                    } else if (progressVal >= 50) {
                        st1.setAttribute('stop-color', '#06b6d4');
                        st2.setAttribute('stop-color', '#3b82f6');
                    } else {
                        st1.setAttribute('stop-color', '#10b981');
                        st2.setAttribute('stop-color', '#06b6d4');
                    }
                }, 50);
                
                console.log('=== UPDATEUI END (stable recovery progress) ===');
                return;
            } else {
                // Remove bright theme if not in stable recovery
                removeBrightTheme();
            }
            
            if (stats.percentage >= 100) {
                // Perfect record — calculate cost of lapsing today
                const todayStr100 = getTodayString();
                const hasLapsedToday100 = appState.lapses.includes(todayStr100);
                if (!hasLapsedToday100) {
                    // After a lapse: (totalDays successful, totalDays+1 total)
                    // New percentage = totalDays / (totalDays + 1)
                    // Days to get back to 99%: need x clean days so that
                    // (totalDays + x) / (totalDays + 1 + x) >= 0.99
                    const t = stats.totalDays;
                    const targetDecimal = 0.99;
                    const neededBack = Math.ceil(((targetDecimal * (t + 1)) - t) / (1 - targetDecimal));
                    messageText = `Perfect record! Keep going! Relapsing today would require <span class="highlight">${neededBack}</span> more clean days to reach 99%.`;
                } else {
                    messageText = 'Perfect record! Keep going!';
                }
            } else if (stats.percentage >= 99) {
                // 100% is impossible to regain once lost, so no goal needed
                messageText = 'Keep going!';
            } else {
                // Determine target percentage based on current performance
                let targetPercent;
                if (stats.percentage >= 98) {
                    targetPercent = 99;
                } else if (stats.percentage >= 97) {
                    targetPercent = 98;
                } else if (stats.percentage >= 96) {
                    targetPercent = 97;
                } else if (stats.percentage >= 95) {
                    targetPercent = 96;
                } else if (stats.percentage >= 90) {
                    targetPercent = 95;
                } else if (stats.percentage >= 85) {
                    targetPercent = 90;
                } else if (stats.percentage >= 80) {
                    targetPercent = 85;
                } else if (stats.percentage >= 75) {
                    targetPercent = 80;
                } else if (stats.percentage >= 70) {
                    targetPercent = 75;
                } else if (stats.percentage >= 65) {
                    targetPercent = 70;
                } else if (stats.percentage >= 60) {
                    targetPercent = 65;
                } else if (stats.percentage >= 55) {
                    targetPercent = 60;
                } else if (stats.percentage >= 50) {
                    targetPercent = 55;
                } else if (stats.percentage >= 45) {
                    targetPercent = 50;
                } else if (stats.percentage >= 40) {
                    targetPercent = 45;
                } else if (stats.percentage >= 35) {
                    targetPercent = 40;
                } else if (stats.percentage >= 30) {
                    targetPercent = 35;
                } else if (stats.percentage >= 25) {
                    targetPercent = 30;
                } else if (stats.percentage >= 20) {
                    targetPercent = 25;
                } else if (stats.percentage >= 15) {
                    targetPercent = 20;
                } else if (stats.percentage >= 10) {
                    targetPercent = 15;
                } else if (stats.percentage >= 5) {
                    targetPercent = 10;
                } else {
                    targetPercent = 5;
                }
                
                // Calculate days needed to reach target percentage
                // We need: (successful + x) / (total + x) >= targetPercent/100
                // successful + x >= (targetPercent/100) * (total + x)
                // successful + x >= (targetPercent/100) * total + (targetPercent/100) * x
                // x - (targetPercent/100) * x >= (targetPercent/100) * total - successful
                // x * (1 - targetPercent/100) >= (targetPercent/100) * total - successful
                // x >= ((targetPercent/100) * total - successful) / (1 - targetPercent/100)
                
                const targetDecimal = targetPercent / 100;
                const neededSuccesses = Math.ceil(((targetDecimal * stats.totalDays) - stats.successfulDaysCount) / (1 - targetDecimal));
                
                // Check if user has already lapsed today
                const todayStr = getTodayString();
                const hasLapsedToday = appState.lapses.includes(todayStr);
                
                // For 98%+ users, show when they achieved it (now that neededSuccesses is defined)
                if (targetPercent === 99 && appState.ninetyEightPercentDate) {
                    const achievementDate = new Date(appState.ninetyEightPercentDate);
                    const offsetDate = new Date(achievementDate.getTime() + achievementDate.getTimezoneOffset() * 60000);
                    const formattedDate = offsetDate.toLocaleDateString();
                    messageText = `<div style="text-align: center;">🎯 98% achieved on ${formattedDate}. Keep going to reach stable recovery!</div>`;
                }

                if (neededSuccesses <= 0) {
                    if (!messageText) {
                        messageText = 'Keep going!';
                    }
                } else {
                    let baseMessage = `Abstain for <span class="highlight">${neededSuccesses}</span> more days to reach <span class="highlight">${targetPercent}%</span>!`;
                    
                    if (!hasLapsedToday) {
                        // Calculate what happens if they lapse today:
                        // total days stays the same, but one fewer successful day
                        const newTotal = stats.totalDays;
                        const newSuccessful = stats.successfulDaysCount - 1;
                        const newNeeded = Math.ceil(((targetDecimal * newTotal) - newSuccessful) / (1 - targetDecimal));
                        const extraDays = newNeeded - neededSuccesses;
                        
                        if (extraDays > 0) {
                            baseMessage += ` Relapsing today would add <span class="highlight">${extraDays}</span> days to reach <span class="highlight">${targetPercent}%</span>.`;
                        }
                    }
                    
                    messageText = baseMessage;
                }
            }
        }
        
        mainStat.textContent = mainText;
        subStat.textContent = subText;
        statusMessage.innerHTML = messageText;
        console.log('Setting mainStat to:', mainText);
        
        // Avoid animation glitches by setting timeout minimally
        setTimeout(() => {
            setProgress(progressVal);
            // Show wave if draining (waveProgress > 0), otherwise hide
            if (appState.waveProgress > 0) {
                setWaveFill(appState.waveProgress);
                setWaveColor(false); // draining = red
            } else {
                setWaveFill(0);
            }
            
            // Change color based on percentage
            const ringGrad = document.getElementById('ring-gradient');
            const st1 = ringGrad.querySelector('stop:nth-child(1)');
            const st2 = ringGrad.querySelector('stop:nth-child(2)');
            
            if (progressVal >= 90) {
                st1.setAttribute('stop-color', '#3b82f6');
                st2.setAttribute('stop-color', '#8b5cf6');
            } else if (progressVal >= 75) {
                st1.setAttribute('stop-color', '#3b82f6');
                st2.setAttribute('stop-color', '#6366f1');
            } else if (progressVal >= 50) {
                st1.setAttribute('stop-color', '#06b6d4');
                st2.setAttribute('stop-color', '#3b82f6');
            } else {
                st1.setAttribute('stop-color', '#10b981');
                st2.setAttribute('stop-color', '#06b6d4');
            }
        }, 50);
        console.log('=== UPDATEUI END ===');
    } catch (error) {
        console.error('Error updating UI:', error);
        console.error('Error stack:', error.stack);
        // Fallback to basic display
        mainStat.textContent = '--';
        subStat.textContent = 'Error';
        statusMessage.textContent = 'Please refresh the page.';
        setProgress(0);
    }
}

// Actions
function logLapseForToday() {
    const today = getTodayString();
    if (appState.lapses.includes(today)) {
        showToast('A lapse is already logged for today.', 3000);
        return;
    }
    addLapse(today);
}

function addLapse(dateStr) {
    if (!appState.lapses.includes(dateStr)) {
        appState.lapses.push(dateStr);
        // Sort descending
        appState.lapses.sort((a, b) => new Date(b) - new Date(a));
        saveData();
        updateUI();
        renderLapsesList();

        // Format date for toast message
        const dateObj = new Date(dateStr);
        const offsetDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
        const formatStr = offsetDate.toLocaleDateString();
        showToast(`Lapse logged for ${formatStr}`);
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
        const formatStr = offsetDate.toLocaleDateString();
        
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
        
        // Set min date to start date
        addLapseDateInput.min = appState.startDate;
        
        // Set max date to today
        addLapseDateInput.max = getTodayString();
        
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
            // Reset wave so it recalculates from new start date
            appState.waveProgress = 0;
            appState.waveLastUpdated = null;
            appState.ninetyEightPercentDate = null;
            saveData();
            updateUI();
        }
    });
    
    addLapseBtn.addEventListener('click', () => {
        const val = addLapseDateInput.value;
        if (val) {
            if (val > getTodayString()) {
                showToast("Can't log lapses in the future.", 4000);
                return;
            }
            if (val < appState.startDate) {
                showToast("Can't log lapses before start date.", 4000);
                return;
            }
            
            if (appState.lapses.includes(val)) {
                showToast("Lapse already exists for this date.", 3000);
            } else {
                addLapse(val);
            }
        }
    });
    
    lapsesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            const dateStr = e.target.getAttribute('data-date');
            const dateObj = new Date(dateStr);
            const offsetDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
            const formattedDate = offsetDate.toLocaleDateString();
            if (confirm(`Remove lapse for ${formattedDate}?`)) {
                removeLapse(dateStr);
            }
        }
    });
    
    hardResetBtn.addEventListener('click', () => {
        const verify = window.prompt('Type "RESET" to delete all data and start fresh.');
        if (verify === 'RESET') {
            appState = {
                startDate: getTodayString(),
                lapses: [],
                ninetyEightPercentDate: null,
                waveProgress: 0,
                waveLastUpdated: null
            };
            saveData();
            updateUI();
            settingsModal.classList.add('hidden');
            showToast('All data erased.');
        }
    });

    exportDataBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(appState, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'reset_tracker_backup.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        showToast('Data exported successfully.');
    });

    importDataBtn.addEventListener('click', () => {
        importDataFile.click();
    });

    importDataFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (importedData.startDate && Array.isArray(importedData.lapses)) {
                    appState = importedData;
                    saveData();
                    updateUI();
                    renderLapsesList();
                    startDateInput.value = appState.startDate;
                    showToast('Data imported successfully.');
                } else {
                    showToast('Invalid data format.', 4000);
                }
            } catch (error) {
                showToast('Error parsing file.', 4000);
            }
        };
        reader.readAsText(file);
        importDataFile.value = ''; // Reset file input
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
