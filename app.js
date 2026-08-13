/**
 * HIGH & LOW - RUNTIME SYSTEM ENGINE
 * Architecture: Vanilla JS Local-First
 */

// --- 1. CORE CONFIGURATION STATE ---
const STATE = {
    activeQuestions: [],
    currentQuestionIndex: 0,
    sessionAnswers: [],
    sessionNote: null,
    deviceMode: 'mouse'
};

// Bump this whenever new entries are added to DEFAULT_QUESTIONS so that existing
// installations pick up the new built-ins on next load (see seedDefaults) without
// disturbing the user's own active set or authored questions.
const SEED_VERSION = 1;

// Built-in questions shipped with the app. User-authored questions live in the
// same 'questions' store but with builtIn:false and a content-addressed id
// (see makeCustomId). Built-ins use readable slugs for export/debug legibility.
const DEFAULT_QUESTIONS = [
    { id: 'q_energy',       text: 'What is your current energy level?',            shortLabel: 'Energy Level',      curve: 'more-is-better',   minLabel: 'Bedbound/Depleted',      maxLabel: 'Fully Charged',   midLabel: null },
    { id: 'q_sadness',      text: 'How heavy or deep is your sadness right now?',  shortLabel: 'Sadness Depth',     curve: 'less-is-better',   minLabel: 'No Sadness',             maxLabel: 'Overwhelming',    midLabel: null },
    { id: 'q_worth',        text: 'How is your sense of self-worth and guilt?',    shortLabel: 'Self-Worth',        curve: 'more-is-better',   minLabel: 'Intense Guilt/Worthless', maxLabel: 'At Peace',        midLabel: null },
    { id: 'q_irritability', text: 'How irritable or easily agitated do you feel?', shortLabel: 'Irritability',      curve: 'less-is-better',   minLabel: 'Calm & Patient',         maxLabel: 'Highly Snappy',   midLabel: null },
    { id: 'q_racing',       text: 'How fast are your thoughts moving?',            shortLabel: 'Racing Thoughts',   curve: 'less-is-better',   minLabel: 'Quiet & Focused',        maxLabel: 'Unstoppable Racing', midLabel: null },
    { id: 'q_impulse',      text: 'Are you experiencing restless or reckless urges?', shortLabel: 'Restless Urges', curve: 'less-is-better', minLabel: 'Deliberate',           maxLabel: 'Highly Impulsive', midLabel: null },
    { id: 'q_overall',      text: 'Overall, where does your mood sit right now?',  shortLabel: 'Overall Mood',      curve: 'middle-is-best',   minLabel: 'Deeply Low',             maxLabel: 'Manic/Spiked',    midLabel: 'Stable & Even' }
];

// Daily set established on first run (ids into the 'questions' store).
const DEFAULT_ACTIVE_SET = ['q_energy', 'q_sadness', 'q_irritability', 'q_overall'];

// --- 2. INDEXEDDB LOCAL VAULT STRUCT ---
let db = null;
const DB_NAME = 'HighAndLowDB';
const DB_VERSION = 2;

function initDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB is not supported in this environment."));
            return;
        }
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
            if (!upgradeDb.objectStoreNames.contains('questions')) {
                upgradeDb.createObjectStore('questions', { keyPath: 'id' });
            }
        };
    });
}

// Promise wrappers over the raw IndexedDB request API.
function getAll(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve([]);
        const req = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}
function getConfig(key) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(undefined);
        const req = db.transaction(['config'], 'readonly').objectStore('config').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
        req.onerror = () => reject(req.error);
    });
}
function setConfig(key, value) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const tx = db.transaction(['config'], 'readwrite');
        tx.objectStore('config').put({ key, value });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// --- 2b. QUESTION IDENTITY & SEEDING ---

// Collapse leading/trailing and internal whitespace so trivially-different
// wordings resolve to the same content-addressed id.
function normalizeQuestionText(text) {
    return text.trim().replace(/\s+/g, ' ');
}

// FNV-1a 32-bit -> 8 hex chars. NOT cryptographic: used only for stable,
// content-addressed question identity. Identical (normalized) text yields an
// identical id, which lets identical questions self-dedupe when backups merge.
function fnv1a32(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

// Custom (user-authored) question ids are prefixed 'c_' so a raw export is
// human-scannable against the built-in 'q_' slugs. The id is frozen at creation
// from the original text; later edits to display text never change it, so
// historical logs never orphan.
function makeCustomId(text) {
    return 'c_' + fnv1a32(normalizeQuestionText(text));
}

// Idempotently insert any built-in question whose id is not already present.
// Runs every load: because we never hard-delete (only archive), an id the user
// archived still exists and won't be re-added, while genuinely new built-ins in
// a later SEED_VERSION get picked up automatically.
async function seedDefaults() {
    const existing = await getAll('questions');
    const existingIds = new Set(existing.map(q => q.id));
    const storedSeed = await getConfig('seedVersion');
    const now = new Date().toISOString();

    await new Promise((resolve, reject) => {
        const tx = db.transaction(['questions'], 'readwrite');
        const store = tx.objectStore('questions');
        DEFAULT_QUESTIONS.forEach(q => {
            if (!existingIds.has(q.id)) {
                store.add({
                    ...q,
                    originalText: q.text,
                    builtIn: true,
                    archived: false,
                    createdAt: now,
                    updatedAt: now
                });
            } else {
                const existingQuestion = existing.find(item => item.id === q.id);
                if (existingQuestion && (!existingQuestion.shortLabel || existingQuestion.shortLabel !== q.shortLabel)) {
                    store.put({
                        ...existingQuestion,
                        shortLabel: q.shortLabel,
                        updatedAt: now
                    });
                }
            }
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });

    // First run only: establish the default active set.
    if (storedSeed === undefined) {
        await setConfig('activeQuestionSet', DEFAULT_ACTIVE_SET);
    }
    await setConfig('seedVersion', SEED_VERSION);
}

// Resolve the ordered active-set ids into full question definitions, dropping
// any that are missing or archived.
async function loadActiveQuestions() {
    const [all, activeSet] = await Promise.all([getAll('questions'), getConfig('activeQuestionSet')]);
    const byId = new Map(all.map(q => [q.id, q]));
    const set = Array.isArray(activeSet) ? activeSet : DEFAULT_ACTIVE_SET;
    STATE.activeQuestions = set.map(id => byId.get(id)).filter(q => q && !q.archived);
}

// Persist a user-authored question.
async function createCustomQuestion({ text, shortLabel, curve, minLabel, maxLabel, midLabel, addToSet }) {
    const normalized = normalizeQuestionText(text || '');
    const normalizedShort = normalizeQuestionText(shortLabel || '');
    if (!normalized) throw new Error('Question text is required.');
    if (!normalizedShort) throw new Error('Short label is required.');

    const id = makeCustomId(normalized);
    const now = new Date().toISOString();

    const outcome = await new Promise((resolve, reject) => {
        const tx = db.transaction(['questions'], 'readwrite');
        const store = tx.objectStore('questions');
        let result = null;

        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const existing = getReq.result;
            if (existing) {
                if (existing.archived) {
                    const restored = { ...existing, shortLabel: normalizedShort, archived: false, updatedAt: now };
                    store.put(restored);
                    result = { status: 'restored', id, question: restored };
                } else {
                    result = { status: 'exists', id, question: existing };
                }
            } else {
                const question = {
                    id,
                    text: normalized,
                    shortLabel: normalizedShort,
                    originalText: normalized,
                    curve,
                    minLabel: minLabel || null,
                    maxLabel: maxLabel || null,
                    midLabel: curve === 'middle-is-best' ? (midLabel || null) : null,
                    builtIn: false,
                    archived: false,
                    createdAt: now,
                    updatedAt: now
                };
                store.add(question);
                result = { status: 'added', id, question };
            }
        };

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
    });

    if (addToSet) {
        const activeSet = await getConfig('activeQuestionSet');
        const set = Array.isArray(activeSet) ? activeSet.slice() : DEFAULT_ACTIVE_SET.slice();
        if (!set.includes(outcome.id)) {
            set.push(outcome.id);
            await setConfig('activeQuestionSet', set);
        }
    }

    return outcome;
}

// --- 3. DOM ROUTING & ORTHOGONAL SWAPPING ENGINE ---

function buildScoreButtonsHTML(question) {
    let buttonsHTML = '';
    for (let score = 5; score >= 1; score--) {
        let contextLabel = '';
        if (score === 5) contextLabel = question.maxLabel || '';
        else if (score === 1) contextLabel = question.minLabel || '';
        else if (score === 3 && question.curve === 'middle-is-best') contextLabel = question.midLabel || '';

        const fullAriaLabel = `Score ${score} out of 5${contextLabel ? ': ' + contextLabel : ''}`;
        buttonsHTML += `
      <button type="button" class="score-button" data-score="${score}" aria-label="${fullAriaLabel}">
        <span class="num" aria-hidden="true">${score}</span>
        <span class="label-desc">${contextLabel}</span>
      </button>
    `;
    }
    return buttonsHTML;
}

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

    document.getElementById('button-stack').innerHTML = buildScoreButtonsHTML(currentQuestion);

    document.querySelectorAll('.score-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetScore = parseInt(e.currentTarget.getAttribute('data-score'), 10);
            handleScoreSubmission(currentQuestion.id, targetScore);
        });
    });
}

function handleScoreSubmission(questionId, score) {
    STATE.sessionAnswers.push({ questionId, score, status: 'answered' });
    STATE.currentQuestionIndex++;

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
    const answeredIds = new Set(STATE.sessionAnswers.map(a => a.questionId));
    STATE.activeQuestions.forEach(q => {
        if (!answeredIds.has(q.id)) {
            STATE.sessionAnswers.push({ questionId: q.id, score: null, status: 'skipped' });
        }
    });

    const now = new Date();
    const logEntry = {
        timestamp: now.toISOString(),
        dateString: now.toISOString().split('T')[0],
        note: STATE.sessionNote || null,
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
    const backupData = { exportVersion: "2.0", exportTimestamp: new Date().toISOString(), config: [], questions: [], logs: [] };
    const transaction = db.transaction(['config', 'questions', 'logs'], 'readonly');

    transaction.objectStore('config').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { backupData.config.push(cursor.value); cursor.continue(); }
    };
    transaction.objectStore('questions').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { backupData.questions.push(cursor.value); cursor.continue(); }
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
            const importedQuestions = Array.isArray(importedData.questions) ? importedData.questions : [];

            const tx = db.transaction(['config', 'questions', 'logs'], 'readwrite');
            const configStore = tx.objectStore('config');
            const questionStore = tx.objectStore('questions');
            const logStore = tx.objectStore('logs');

            if (mode === 'replace') {
                configStore.clear();
                questionStore.clear();
                logStore.clear();
                importedData.config.forEach(i => configStore.add(i));
                importedQuestions.forEach(i => questionStore.add(i));
                importedData.logs.forEach(i => logStore.add(i));
            } else {
                importedData.config.forEach(i => configStore.put(i));
                importedQuestions.forEach(i => mergeQuestionWithConflictCheck(questionStore, i));
                importedData.logs.forEach(i => safelyAddLogWithCollisionCheck(logStore, i));
            }
            tx.oncomplete = () => window.location.reload();
        } catch (err) { alert("Corrupted file payload processing error."); }
    };
    reader.readAsText(file);
}

function mergeQuestionWithConflictCheck(store, incoming) {
    const getRequest = store.get(incoming.id);
    getRequest.onsuccess = (e) => {
        const existing = e.target.result;
        if (!existing) {
            store.add(incoming);
            return;
        }
        if ((incoming.updatedAt || '') > (existing.updatedAt || '')) {
            store.put(incoming);
        }
    };
}

function safelyAddLogWithCollisionCheck(store, incomingLog, attempt = 0) {
    const MAX_COLLISION_ATTEMPTS = 1000;
    const getRequest = store.get(incomingLog.timestamp);
    getRequest.onsuccess = (e) => {
        const existingRecord = e.target.result;
        if (existingRecord) {
            if (areLogAnswersIdentical(existingRecord.answers, incomingLog.answers)) return;

            if (attempt >= MAX_COLLISION_ATTEMPTS) {
                console.error('safelyAddLogWithCollisionCheck: could not resolve a free timestamp key after', MAX_COLLISION_ATTEMPTS, 'attempts near', incomingLog.timestamp, '- log NOT imported:', incomingLog);
                return;
            }

            const dateObj = new Date(incomingLog.timestamp);
            dateObj.setUTCMilliseconds(dateObj.getUTCMilliseconds() + 1);
            incomingLog.timestamp = dateObj.toISOString();
            safelyAddLogWithCollisionCheck(store, incomingLog, attempt + 1);
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
    return sA.every((v, i) => v.questionId === sB[i].questionId && v.score === sB[i].score && v.status === sB[i].status);
}

// --- 5. TOUCH SAFETY TIME-BARRIER CONFIG ---
let holdTimer = null;
function setupHoldActions() {
    STATE.deviceMode = (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ? 'touch' : 'mouse';
    document.querySelectorAll('.hold-action').forEach(button => {
        if (STATE.deviceMode === 'touch') {
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.classList.add('is-holding');
                holdTimer = setTimeout(() => { executeHoldAction(button.id); resetHold(button); }, 1500);
            });
            button.addEventListener('touchend', () => resetHold(button));
            button.addEventListener('touchcancel', () => resetHold(button));
        } else {
            button.classList.add('desktop-click');
            button.addEventListener('click', () => executeHoldAction(button.id));
        }

        // Support Enter / Space keypress on hold action buttons for keyboard accessibility
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                executeHoldAction(button.id);
            }
        });
    });

    // Support Enter / Space keypress on the custom file import label
    const importLabel = document.querySelector('label[for="file-import"]');
    if (importLabel) {
        importLabel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                document.getElementById('file-import').click();
            }
        });
    }
}
function resetHold(e) { clearTimeout(holdTimer); e.classList.remove('is-holding'); }
function executeHoldAction(id) {
    if (id === 'button-skip') finalizeSession();
    if (id === 'button-notes') {
        const note = prompt("Add a short internal log note (Optional):");
        if (note) {
            STATE.sessionNote = STATE.sessionNote ? STATE.sessionNote + '\n\n' + note : note;
        }
    }
}

// --- 6. SETTINGS & MENU NAVIGATION ---
function setupSettingsAndMenu() {
    const themeSel = document.getElementById('theme-select');
    const contrastSel = document.getElementById('contrast-select');
    const menuSideSel = document.getElementById('menu-side-select');

    const handleThemeChange = async (val) => {
        document.body.setAttribute('data-theme', val);
        await setConfig('theme', val);
        if (themeSel) themeSel.value = val;
    };

    if (themeSel) {
        themeSel.addEventListener('change', (e) => handleThemeChange(e.target.value));
    }

    if (contrastSel) {
        contrastSel.addEventListener('change', async (e) => {
            document.body.setAttribute('data-contrast', e.target.value);
            await setConfig('contrast', e.target.value);
        });
    }

    // Debug bounds functionality (Console controllable: window.toggleDebugBounds() or window.setDebugBounds(true/false))
    window.setDebugBounds = async (enable) => {
        const isEnabled = Boolean(enable);
        document.body.setAttribute('data-debug-bounds', isEnabled ? 'true' : 'false');
        await setConfig('debug-bounds', isEnabled ? 'on' : 'off');
        try {
            localStorage.setItem('debug-bounds', isEnabled ? 'on' : 'off');
        } catch (e) {
        }
        console.log(`[Layout Rig Outlines] ${isEnabled ? 'Enabled' : 'Disabled'}`);
        return isEnabled;
    };

    window.toggleDebugBounds = (enable) => {
        if (enable !== undefined) {
            return window.setDebugBounds(enable);
        }
        const currentState = document.body.getAttribute('data-debug-bounds') === 'true';
        return window.setDebugBounds(!currentState);
    };

    const handleMenuSideChange = async (val) => {
        document.body.setAttribute('data-menu-side', val);
        await setConfig('menuSide', val);
        try {
            localStorage.setItem('menuSide', val);
        } catch (e) {
        }
        if (menuSideSel) menuSideSel.value = val;
    };

    if (menuSideSel) {
        menuSideSel.addEventListener('change', (e) => handleMenuSideChange(e.target.value));
    }

    // Dynamic listener for OS system theme changes
    if (window.matchMedia) {
        const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = () => {
            if (document.body.getAttribute('data-theme') === 'system') {
                const inputBox = document.getElementById('input-box');
                if (inputBox) {
                    const currentCurve = inputBox.getAttribute('data-curve');
                    inputBox.setAttribute('data-curve', currentCurve);
                }
                const previewBox = document.getElementById('question-preview');
                if (previewBox) {
                    const previewCurve = previewBox.getAttribute('data-curve');
                    previewBox.setAttribute('data-curve', previewCurve);
                }
            }
        };

        if (systemThemeMedia.addEventListener) {
            systemThemeMedia.addEventListener('change', handleSystemThemeChange);
        }
    }

    // Toggle menu drawer
    const menuButton = document.getElementById('button-menu');
    if (menuButton) {
        menuButton.addEventListener('click', () => {
            if (document.body.classList.contains('drawer-open')) {
                closeDrawer();
            } else {
                openDrawer();
            }
        });
    }

    const closeDrawerButton = document.getElementById('button-close-drawer');
    if (closeDrawerButton) {
        closeDrawerButton.addEventListener('click', closeDrawer);
    }

    const overlay = document.getElementById('drawer-overlay');
    if (overlay) {
        overlay.addEventListener('click', closeDrawer);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) {
            closeDrawer();
        }
    });

    // Drawer Navigation Items
    document.querySelectorAll('.drawer-nav-button').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            if (targetId) {
                navigateTo(targetId);
                closeDrawer();
            }
        });
    });
}

function setupCanvasBackButtons() {
    document.querySelectorAll('[data-close-view]').forEach(button => {
        button.addEventListener('click', () => navigateTo('tracker-canvas'));
    });
}

window.addEventListener('popstate', (e) => {
    const targetView = (e.state && e.state.view) ? e.state.view : 'tracker-canvas';
    navigateTo(targetView, { fromPopState: true });
});


function setInert(el, isInert) {
    if (!el) return;
    el.inert = isInert;
    if (isInert) {
        el.setAttribute('inert', '');
    } else {
        el.removeAttribute('inert');
    }
}

function openDrawer() {
    document.body.classList.add('drawer-open');
    const drawer = document.getElementById('side-drawer');
    if (drawer) setInert(drawer, false);
    const menuButton = document.getElementById('button-menu');
    if (menuButton) menuButton.setAttribute('aria-expanded', 'true');

    // Make all canvases inert while drawer is open
    document.querySelectorAll('.app-canvas').forEach(canvas => {
        setInert(canvas, true);
    });

    // Focus active or first button in drawer
    if (drawer) {
        const activeNavButton = drawer.querySelector('.drawer-nav-button.active') || drawer.querySelector('.drawer-nav-button');
        if (activeNavButton) activeNavButton.focus({ preventScroll: true });
    }
}

function closeDrawer() {
    document.body.classList.remove('drawer-open');
    const drawer = document.getElementById('side-drawer');
    if (drawer) setInert(drawer, true);
    const menuButton = document.getElementById('button-menu');
    if (menuButton) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.focus({ preventScroll: true });
    }

    // Restore active canvas interactive state
    const currentCanvas = document.getElementById(currentViewId);
    if (currentCanvas) {
        setInert(currentCanvas, false);
    }
}

let currentViewId = 'tracker-canvas';

function navigateTo(targetViewId, opts = {}) {
    if (targetViewId === currentViewId) return;

    const currentCanvas = document.getElementById(currentViewId);
    const targetCanvas = document.getElementById(targetViewId);

    if (!targetCanvas) return;

    if (currentCanvas) {
        currentCanvas.className = 'app-canvas view-hidden-left';
        setInert(currentCanvas, true);
    }

    targetCanvas.className = 'app-canvas view-active';
    setInert(targetCanvas, false);

    currentViewId = targetViewId;

    // Push a history entry so hardware/gesture 'back' steps back one view
    // instead of exiting the app. Skip when we're already responding to
    // a popstate event, or we'd push right back onto the stack we just popped.
    if (!opts.fromPopState && window.history && window.history.pushState) {
        history.pushState({ view: targetViewId }, '');
    }

    // Update active state in drawer items
    document.querySelectorAll('.drawer-nav-button').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-target') === targetViewId);
    });

    // Focus header or first interactive control in target canvas
    const focusTarget = targetCanvas.querySelector('button, select, input, h1');
    if (focusTarget) {
        if (focusTarget.tagName === 'H1' && !focusTarget.hasAttribute('tabindex')) {
            focusTarget.setAttribute('tabindex', '-1');
        }
        focusTarget.focus({ preventScroll: true });
    }
}

function openSettings() {
    navigateTo('settings-canvas');
}
function closeSettings() {
    navigateTo('tracker-canvas');
}

function setupQuestionAuthoring() {
    const toggleButton = document.getElementById('button-add-question');
    const form = document.getElementById('question-form');
    const textInput = document.getElementById('q-text');
    const shortLabelInput = document.getElementById('q-short-label');
    const curveInput = document.getElementById('q-curve');
    const maxInput = document.getElementById('q-max-label');
    const midField = document.getElementById('field-mid-label');
    const midInput = document.getElementById('q-mid-label');
    const minInput = document.getElementById('q-min-label');
    const preview = document.getElementById('question-preview');
    const previewTitleBox = document.getElementById('preview-title-box');
    const previewStack = document.getElementById('question-preview-stack');
    const addToSetInput = document.getElementById('q-add-to-set');
    const saveButton = document.getElementById('button-save-question');
    const cancelButton = document.getElementById('button-cancel-question');

    function refreshPreview() {
        const curve = curveInput.value;
        preview.setAttribute('data-curve', curve);
        const shortVal = normalizeQuestionText(shortLabelInput ? shortLabelInput.value : '');
        const fullVal = normalizeQuestionText(textInput ? textInput.value : '');
        if (previewTitleBox) {
            previewTitleBox.textContent = shortVal ? shortVal : (fullVal || 'Short Label Preview');
        }
        previewStack.innerHTML = buildScoreButtonsHTML({
            curve,
            maxLabel: maxInput.value,
            minLabel: minInput.value,
            midLabel: midInput.value
        });
    }

    function syncMidVisibility() {
        midField.hidden = curveInput.value !== 'middle-is-best';
    }

    function syncSaveEnabled() {
        const textOk = normalizeQuestionText(textInput.value) !== '';
        const shortOk = shortLabelInput ? normalizeQuestionText(shortLabelInput.value) !== '' : true;
        saveButton.disabled = !(textOk && shortOk);
    }

    function resetForm() {
        form.reset();
        syncMidVisibility();
        syncSaveEnabled();
        refreshPreview();
    }

    toggleButton.addEventListener('click', () => {
        const opening = form.hidden;
        form.hidden = !opening;
        toggleButton.textContent = opening ? 'Hide Form' : 'Add a Question';
        toggleButton.setAttribute('aria-expanded', opening ? 'true' : 'false');
        if (opening) {
            resetForm();
            textInput.focus({ preventScroll: true });
        }
    });

    curveInput.addEventListener('change', () => {
        syncMidVisibility();
        refreshPreview();
    });

    [textInput, shortLabelInput, maxInput, midInput, minInput].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => {
            syncSaveEnabled();
            refreshPreview();
        });
    });

    cancelButton.addEventListener('click', () => {
        resetForm();
        form.hidden = true;
        toggleButton.textContent = 'Add a Question';
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.focus({ preventScroll: true });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveButton.disabled = true;
        try {
            const outcome = await createCustomQuestion({
                text: textInput.value,
                shortLabel: shortLabelInput ? shortLabelInput.value : '',
                curve: curveInput.value,
                minLabel: minInput.value,
                maxLabel: maxInput.value,
                midLabel: midInput.value,
                addToSet: addToSetInput.checked
            });

            if (outcome.status === 'added') {
                alert('Question saved. It will appear in your tracker on next load.');
            } else if (outcome.status === 'restored') {
                alert('That question already existed but was archived — it has been restored.');
            } else {
                alert('You already have that question, so nothing was added.');
            }

            resetForm();
            form.hidden = true;
            toggleButton.textContent = 'Add a Question';
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.focus({ preventScroll: true });
        } catch (err) {
            console.error('Failed to save question:', err);
            alert('Could not save the question. Please try again.');
            syncSaveEnabled();
        }
    });

    syncMidVisibility();
    syncSaveEnabled();
    refreshPreview();
}

function setupKeyboardNavigation() {
    window.addEventListener('scroll', () => {
        if (window.scrollX !== 0 || window.scrollY !== 0) {
            window.scrollTo(0, 0);
        }
    });

    document.addEventListener('keydown', (e) => {
        const activeEl = document.activeElement;
        const isInputActive = activeEl && (
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
            activeEl.isContentEditable
        );

        // Escape key closes settings drawer from anywhere
        if (e.key === 'Escape') {
            if (document.body.classList.contains('settings-open')) {
                closeSettings();
                return;
            }
        }

        if (isInputActive) return; // Do not trigger shortcuts when typing in inputs

        // Keyboard interaction for active mood tracker canvas
        if (!document.body.classList.contains('settings-open')) {
            // Direct score submission via Number keys 1-5
            if (['1', '2', '3', '4', '5'].includes(e.key)) {
                const score = parseInt(e.key, 10);
                const scoreButton = document.querySelector(`.score-button[data-score="${score}"]`);
                if (scoreButton) {
                    scoreButton.focus({ preventScroll: true });
                    scoreButton.click();
                }
                return;
            }

            // Arrow key navigation through ALL interactive controls on the tracker canvas
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                const menuButton = document.getElementById('button-menu');
                const scoreButtons = Array.from(document.querySelectorAll('#button-stack .score-button'));
                const notesButton = document.getElementById('button-notes');
                const skipButton = document.getElementById('button-skip');

                const focusables = [];
                if (menuButton) focusables.push(menuButton);
                focusables.push(...scoreButtons);
                if (notesButton) focusables.push(notesButton);
                if (skipButton) focusables.push(skipButton);

                if (focusables.length === 0) return;

                let currentIndex = focusables.indexOf(activeEl);
                e.preventDefault();

                if (currentIndex === -1) {
                    const score5 = document.querySelector(`.score-button[data-score="5"]`);
                    if (score5) score5.focus({ preventScroll: true });
                    else focusables[0].focus({ preventScroll: true });
                } else {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        currentIndex = (currentIndex - 1 + focusables.length) % focusables.length;
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        currentIndex = (currentIndex + 1) % focusables.length;
                    }
                    focusables[currentIndex].focus({ preventScroll: true });
                }
                return;
            }

            // Quick key shortcuts
            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                executeHoldAction('button-notes');
                return;
            }
            if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                executeHoldAction('button-skip');
                return;
            }
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                openSettings();
            }
        }
    });
}

async function applyStoredDisplay() {
    const [
        theme,
        contrast,
        menuSide
    ] = await Promise.all([
        getConfig('theme'),
        getConfig('contrast'),
        getConfig('menuSide'),
        getConfig('debug-bounds')
    ]);
    const themeVal = theme || 'system';
    document.body.setAttribute('data-theme', themeVal);
    const themeSel = document.getElementById('theme-select');
    const drawerThemeSel = document.getElementById('drawer-theme-select');
    if (themeSel) themeSel.value = themeVal;
    if (drawerThemeSel) drawerThemeSel.value = themeVal;

    if (contrast) {
        document.body.setAttribute('data-contrast', contrast);
        const contrastSel = document.getElementById('contrast-select');
        if (contrastSel) contrastSel.value = contrast;
    }

    let localMenuSide = null;
    try { localMenuSide = localStorage.getItem('menuSide'); } catch (e) {}
    const finalMenuSide = menuSide || localMenuSide || 'right';
    document.body.setAttribute('data-menu-side', finalMenuSide);
    const menuSideSel = document.getElementById('menu-side-select');
    if (menuSideSel) menuSideSel.value = finalMenuSide;

    // Ensure debug options/outlines are off on page load
    document.body.setAttribute('data-debug-bounds', 'false');
    await setConfig('debug-bounds', 'off');
    try { localStorage.setItem('debug-bounds', 'off'); } catch (e) {}
}

// Register service worker if available
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}

// --- 7. INITIALIZATION BOOTSTRAP ---
let isAppInitialized = false;
function initApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;

    setupHoldActions();
    setupSettingsAndMenu();
    setupQuestionAuthoring();
    setupKeyboardNavigation();
    setupCanvasBackButtons();

    if (window.history && window.history.replaceState) {
        history.replaceState({ view: 'tracker-canvas' }, '');
    }

    const exportButton = document.getElementById('button-export-all');
    if (exportButton) exportButton.addEventListener('click', exportAllDataAndConfig);

    const importFileInput = document.getElementById('file-import');
    if (importFileInput) {
        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const mode = confirm("Click [OK] to MERGE file data natively.\nClick [Cancel] to completely WIPEOUT and REPLACE device logs.") ? 'merge' : 'replace';
            handleFileImport(file, mode);
        });
    }

    initDatabase()
        .then(seedDefaults)
        .then(() => Promise.all([applyStoredDisplay(), loadActiveQuestions()]))
        .then(() => {
            renderCurrentQuestion();
        })
        .catch(err => {
            console.error('Initialization failed:', err);
            const qText = document.getElementById('question-text');
            if (qText) qText.textContent = "Could not open local storage.";
        });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
