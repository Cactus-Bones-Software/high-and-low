/**
 * HIGH & LOW - RUNTIME SYSTEM ENGINE
 * Architecture: Vanilla JS Local-First
 */

// --- 1. CORE CONFIGURATION STATE ---
const STATE = {
    activeQuestions: [],
    currentQuestionIndex: 0,
    sessionAnswers: [],
    deviceMode: 'mouse'
};

const QUESTION_LIBRARY = [
    { id: 'q_energy', text: 'What is your current energy level?', curve: 'more-is-better', minLabel: 'Bedbound/Depleted', maxLabel: 'Fully Charged' },
    { id: 'q_sadness', text: 'How heavy or deep is your sadness right now?', curve: 'less-is-better', minLabel: 'No Sadness', maxLabel: 'Overwhelming' },
    { id: 'q_worth', text: 'How is your sense of self-worth and guilt?', curve: 'more-is-better', minLabel: 'Intense Guilt/Worthless', maxLabel: 'At Peace' },
    { id: 'q_irritability', text: 'How irritable or easily agitated do you feel?', curve: 'less-is-better', minLabel: 'Calm & Patient', maxLabel: 'Highly Snappy' },
    { id: 'q_racing', text: 'How fast are your thoughts moving?', curve: 'less-is-better', minLabel: 'Quiet & Focused', maxLabel: 'Unstoppable Racing' },
    { id: 'q_impulse', text: 'Are you experiencing restless or reckless urges?', curve: 'less-is-better', minLabel: 'Deliberate', maxLabel: 'Highly Impulsive' }
];

// --- 2. INDEXEDDB LOCAL VAULT STRUCT ---
let db = null;
const DB_NAME = 'HighAndLowDB';
const DB_VERSION = 1;

function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (e) => {
            const upgradeDb = e.target.result;
            if (!upgradeDb.objectStoreNames.contains('config')) {
                upgradeDb.createObjectStore('config', { keyPath: 'key' });
            }
            if (!upgradeDb.objectStoreNames.contains('logs')) {
                upgradeDb.createObjectStore('logs', { keyPath: 'timestamp' });
            }
        };
    });
}

// --- 3. DOM ROUTING & ORTHOGONAL SWAPPING ENGINE ---
function renderCurrentQuestion() {
    const currentQuestion = STATE.activeQuestions[STATE.currentQuestionIndex];

    if (!currentQuestion) {
        finalizeSession();
        return;
    }

    document.getElementById('progress-text').textContent = `Question ${STATE.currentQuestionIndex + 1} of ${STATE.activeQuestions.length}`;
    document.getElementById('question-text').textContent = currentQuestion.text;

    const inputBox = document.getElementById('input-box');
    inputBox.setAttribute('data-curve', currentQuestion.curve);

    let buttonsHTML = '';
    for (let score = 5; score >= 1; score--) {
        let contextLabel = score === 5 ? currentQuestion.maxLabel : (score === 1 ? currentQuestion.minLabel : '');
        buttonsHTML += `
      <button class="score-btn" data-score="${score}">
        <span class="num">${score}</span>
        <span class="label-desc">${contextLabel}</span>
      </button>
    `;
    }
    document.getElementById('button-stack').innerHTML = buttonsHTML;

    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetScore = parseInt(e.currentTarget.getAttribute('data-score'), 10);
            handleScoreSubmission(currentQuestion.id, targetScore);
        });
    });
}

function handleScoreSubmission(questionId, score) {
    STATE.sessionAnswers.push({ questionId, score });
    STATE.currentQuestionIndex++;

    // Transition Left out, Left in
    const trackerCanvas = document.getElementById('tracker-canvas');
    trackerCanvas.className = 'app-canvas view-hidden-left';

    setTimeout(() => {
        renderCurrentQuestion();
        trackerCanvas.className = 'app-canvas view-hidden-right';
        requestAnimationFrame(() => {
            trackerCanvas.className = 'app-canvas view-active';
        });
    }, 220);
}

function finalizeSession() {
    const now = new Date();
    const logEntry = {
        timestamp: now.toISOString(), // Standard Human-Readable ISO Identifier
        dateString: now.toISOString().split('T')[0],
        answers: STATE.sessionAnswers
    };

    const transaction = db.transaction(['logs'], 'readwrite');
    transaction.objectStore('logs').add(logEntry);

    transaction.oncomplete = () => {
        document.getElementById('progress-text').textContent = "Complete";
        document.getElementById('question-text').textContent = "Log recorded. Rest easy.";
        document.getElementById('button-stack').innerHTML = `<p style="text-align:center; margin-top:2rem; color: var(--text-primary)">Saved securely to device storage.</p>`;
    };
}

// --- 4. DATA LOG MANAGEMENT (JSON INTERFACE) ---
function exportAllDataAndConfig() {
    const backupData = { exportVersion: "1.0", exportTimestamp: new Date().toISOString(), config: [], logs: [] };
    const transaction = db.transaction(['config', 'logs'], 'readonly');

    transaction.objectStore('config').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { backupData.config.push(cursor.value); cursor.continue(); }
    };
    transaction.objectStore('logs').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { backupData.logs.push(cursor.value); cursor.continue(); }
    };
    transaction.oncomplete = () => {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `high-and-low-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
}

function handleFileImport(file, mode) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const result = e.target.result;

        // 1. Add this explicit type check guard for WebStorm
        if (typeof result !== 'string') {
            console.error("Invalid file format read. Expected text.");
            return;
        }
        try {
            const importedData = JSON.parse(result);
            if (!importedData.logs || !importedData.config) {
                alert("Invalid file blueprint structure.");
                return;
            }
            if (mode === 'replace') {
                const tx = db.transaction(['config', 'logs'], 'readwrite');
                tx.objectStore('config').clear();
                tx.objectStore('logs').clear();
                importedData.config.forEach(i => tx.objectStore('config').add(i));
                importedData.logs.forEach(i => tx.objectStore('logs').add(i));
                tx.oncomplete = () => window.location.reload();
            } else {
                const tx = db.transaction(['config', 'logs'], 'readwrite');
                importedData.config.forEach(i => tx.objectStore('config').put(i));
                importedData.logs.forEach(i => safelyAddLogWithCollisionCheck(tx.objectStore('logs'), i));
                tx.oncomplete = () => window.location.reload();
            }
        } catch (err) { alert("Corrupted file payload processing error."); }
    };
    reader.readAsText(file);
}

function safelyAddLogWithCollisionCheck(store, incomingLog) {
    const getRequest = store.get(incomingLog.timestamp);
    getRequest.onsuccess = (e) => {
        const existingRecord = e.target.result;
        if (existingRecord) {
            if (areLogAnswersIdentical(existingRecord.answers, incomingLog.answers)) return; // True Redundancy Blocked

            const dateObj = new Date(incomingLog.timestamp);
            dateObj.setUTCMilliseconds(dateObj.getUTCMilliseconds() + 1);
            incomingLog.timestamp = dateObj.toISOString();
            safelyAddLogWithCollisionCheck(store, incomingLog);
        } else {
            store.add(incomingLog);
        }
    };
}

function areLogAnswersIdentical(a, b) {
    if (a.length !== b.length) return false;
    const sortFn = (x, y) => x.questionId > y.questionId ? 1 : -1;
    const sA = [...a].sort(sortFn);
    const sB = [...b].sort(sortFn);
    return sA.every((v, i) => v.questionId === sB[i].questionId && v.score === sB[i].score && v.note === sB[i].note);
}

// --- 5. TOUCH SAFETY TIME-BARRIER CONFIG ---
let holdTimer = null;
function setupHoldActions() {
    STATE.deviceMode = window.matchMedia("(pointer: coarse)").matches ? 'touch' : 'mouse';
    document.querySelectorAll('.hold-action').forEach(btn => {
        if (STATE.deviceMode === 'touch') {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                btn.classList.add('is-holding');
                holdTimer = setTimeout(() => { executeHoldAction(btn.id); resetHold(btn); }, 1500);
            });
            btn.addEventListener('touchend', () => resetHold(btn));
            btn.addEventListener('touchcancel', () => resetHold(btn));
        } else {
            btn.classList.add('desktop-click');
            btn.addEventListener('click', () => executeHoldAction(btn.id));
        }
    });
}
function resetHold(e) { clearTimeout(holdTimer); e.classList.remove('is-holding'); }
function executeHoldAction(id) {
    if (id === 'btn-skip') finalizeSession();
    if (id === 'btn-notes') {
        const note = prompt("Add a short internal log note (Optional):");
        if (note) STATE.sessionAnswers.push({ questionId: 'custom_note', score: 0, note });
    }
}

// --- 6. ACCESSIBILITY INTERFACES OVERLAYS ---
function setupAccessibilitySettings() {
    const themeSel = document.getElementById('theme-select');
    const contrastSel = document.getElementById('contrast-select');

    themeSel.addEventListener('change', (e) => document.body.setAttribute('data-theme', e.target.value));
    contrastSel.addEventListener('change', (e) => document.body.setAttribute('data-contrast', e.target.value));

    // Double tap header gesture to reveal settings dashboard cleanly (Orthogonal Swapping)
    let lastTap = 0;
    document.getElementById('header-box').addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTap < 300) {
            document.getElementById('tracker-canvas').className = 'app-canvas view-hidden-top';
            document.getElementById('settings-canvas').className = 'app-canvas view-active';
        }
        lastTap = now;
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
        document.getElementById('settings-canvas').className = 'app-canvas view-hidden-bottom';
        document.getElementById('tracker-canvas').className = 'app-canvas view-active';
    });
}

// --- 7. INITIALIZATION BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
    initDatabase().then(() => {
        STATE.activeQuestions = [QUESTION_LIBRARY[0], QUESTION_LIBRARY[1], QUESTION_LIBRARY[3]]; // Baseline Default
        setupHoldActions();
        setupAccessibilitySettings();
        renderCurrentQuestion();

        document.getElementById('btn-export-all').addEventListener('click', exportAllDataAndConfig);
        document.getElementById('file-import').addEventListener('change', (e) => {
            const file = e.target.files[0];
            const mode = confirm("Click [OK] to MERGE file data natively.\nClick [Cancel] to completely WIPEOUT and REPLACE device logs.") ? 'merge' : 'replace';
            handleFileImport(file, mode);
        });
    });
});