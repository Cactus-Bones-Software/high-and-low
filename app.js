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
// installs pick up the new built-ins on next load (see seedDefaults) without
// disturbing the user's own active set or authored questions.
const SEED_VERSION = 1;

// Built-in questions shipped with the app. User-authored questions live in the
// same 'questions' store but with builtIn:false and a content-addressed id
// (see makeCustomId). Built-ins use readable slugs for export/debug legibility.
const DEFAULT_QUESTIONS = [
    { id: 'q_energy',       text: 'What is your current energy level?',            curve: 'more-is-better',   minLabel: 'Bedbound/Depleted',      maxLabel: 'Fully Charged',   midLabel: null },
    { id: 'q_sadness',      text: 'How heavy or deep is your sadness right now?',  curve: 'less-is-better',   minLabel: 'No Sadness',             maxLabel: 'Overwhelming',    midLabel: null },
    { id: 'q_worth',        text: 'How is your sense of self-worth and guilt?',    curve: 'more-is-better',   minLabel: 'Intense Guilt/Worthless', maxLabel: 'At Peace',        midLabel: null },
    { id: 'q_irritability', text: 'How irritable or easily agitated do you feel?', curve: 'less-is-better',   minLabel: 'Calm & Patient',         maxLabel: 'Highly Snappy',   midLabel: null },
    { id: 'q_racing',       text: 'How fast are your thoughts moving?',            curve: 'less-is-better',   minLabel: 'Quiet & Focused',        maxLabel: 'Unstoppable Racing', midLabel: null },
    { id: 'q_impulse',      text: 'Are you experiencing restless or reckless urges?', curve: 'less-is-better', minLabel: 'Deliberate',           maxLabel: 'Highly Impulsive', midLabel: null },
    { id: 'q_overall',      text: 'Overall, where does your mood sit right now?',  curve: 'middle-is-best',   minLabel: 'Deeply Low',             maxLabel: 'Manic/Spiked',    midLabel: 'Stable & Even' }
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
        const req = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}
function getConfig(key) {
    return new Promise((resolve, reject) => {
        const req = db.transaction(['config'], 'readonly').objectStore('config').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
        req.onerror = () => reject(req.error);
    });
}
function setConfig(key, value) {
    return new Promise((resolve, reject) => {
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
async function createCustomQuestion({ text, curve, minLabel, maxLabel, midLabel, addToSet }) {
    const normalized = normalizeQuestionText(text || '');
    if (!normalized) throw new Error('Question text is required.');

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
                    const restored = { ...existing, archived: false, updatedAt: now };
                    store.put(restored);
                    result = { status: 'restored', id, question: restored };
                } else {
                    result = { status: 'exists', id, question: existing };
                }
            } else {
                const question = {
                    id,
                    text: normalized,
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
      <button type="button" class="score-btn" data-score="${score}" aria-label="${fullAriaLabel}">
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

    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
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

        // Support Enter / Space keypress on hold action buttons for keyboard accessibility
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                executeHoldAction(btn.id);
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
    if (id === 'btn-skip') finalizeSession();
    if (id === 'btn-notes') {
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

    themeSel.addEventListener('change', (e) => {
        document.body.setAttribute('data-theme', e.target.value);
        setConfig('theme', e.target.value);
    });
    contrastSel.addEventListener('change', (e) => {
        document.body.setAttribute('data-contrast', e.target.value);
        setConfig('contrast', e.target.value);
    });

    // Dynamic listener for OS system theme changes
    const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
        // If data-theme is "system", the DOM will automatically re-evaluate CSS media query rules
        if (document.body.getAttribute('data-theme') === 'system') {
            // Force layout/style re-evaluation for active question button stack and preview box
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
    } else if (systemThemeMedia.addListener) {
        systemThemeMedia.addListener(handleSystemThemeChange);
    }

    document.getElementById('btn-menu').addEventListener('click', openSettings);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
}

function openSettings() {
    document.body.classList.add('settings-open');
    const tracker = document.getElementById('tracker-canvas');
    const settings = document.getElementById('settings-canvas');
    if (tracker) {
        tracker.className = 'app-canvas view-hidden-left';
        tracker.inert = true;
    }
    if (settings) {
        settings.className = 'app-canvas view-active';
        settings.inert = false;
    }
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    const closeBtn = document.getElementById('btn-close-settings');
    if (closeBtn) closeBtn.focus();
}
function closeSettings() {
    document.body.classList.remove('settings-open');
    const tracker = document.getElementById('tracker-canvas');
    const settings = document.getElementById('settings-canvas');
    if (settings) {
        settings.className = 'app-canvas view-hidden-right';
        settings.inert = true;
    }
    if (tracker) {
        tracker.className = 'app-canvas view-active';
        tracker.inert = false;
    }
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.focus();
    }
}

function setupQuestionAuthoring() {
    const toggleBtn = document.getElementById('btn-add-question');
    const form = document.getElementById('question-form');
    const textInput = document.getElementById('q-text');
    const curveInput = document.getElementById('q-curve');
    const maxInput = document.getElementById('q-max-label');
    const midField = document.getElementById('field-mid-label');
    const midInput = document.getElementById('q-mid-label');
    const minInput = document.getElementById('q-min-label');
    const preview = document.getElementById('question-preview');
    const previewStack = document.getElementById('question-preview-stack');
    const addToSetInput = document.getElementById('q-add-to-set');
    const saveBtn = document.getElementById('btn-save-question');
    const cancelBtn = document.getElementById('btn-cancel-question');

    function refreshPreview() {
        const curve = curveInput.value;
        preview.setAttribute('data-curve', curve);
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
        saveBtn.disabled = normalizeQuestionText(textInput.value) === '';
    }

    function resetForm() {
        form.reset();
        syncMidVisibility();
        syncSaveEnabled();
        refreshPreview();
    }

    toggleBtn.addEventListener('click', () => {
        const opening = form.hidden;
        form.hidden = !opening;
        toggleBtn.textContent = opening ? 'Hide Form' : 'Add a Question';
        toggleBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
        if (opening) {
            resetForm();
            textInput.focus();
        }
    });

    curveInput.addEventListener('change', () => {
        syncMidVisibility();
        refreshPreview();
    });

    [textInput, maxInput, midInput, minInput].forEach(el => {
        el.addEventListener('input', () => {
            syncSaveEnabled();
            refreshPreview();
        });
    });

    cancelBtn.addEventListener('click', () => {
        resetForm();
        form.hidden = true;
        toggleBtn.textContent = 'Add a Question';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.focus();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.disabled = true;
        try {
            const outcome = await createCustomQuestion({
                text: textInput.value,
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
            toggleBtn.textContent = 'Add a Question';
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.focus();
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
                const scoreBtn = document.querySelector(`.score-btn[data-score="${score}"]`);
                if (scoreBtn) {
                    scoreBtn.focus();
                    scoreBtn.click();
                }
                return;
            }

            // Arrow key navigation through ALL interactive controls on the tracker canvas
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                const menuBtn = document.getElementById('btn-menu');
                const scoreBtns = Array.from(document.querySelectorAll('#button-stack .score-btn'));
                const notesBtn = document.getElementById('btn-notes');
                const skipBtn = document.getElementById('btn-skip');

                const focusables = [];
                if (menuBtn) focusables.push(menuBtn);
                focusables.push(...scoreBtns);
                if (notesBtn) focusables.push(notesBtn);
                if (skipBtn) focusables.push(skipBtn);

                if (focusables.length === 0) return;

                let currentIndex = focusables.indexOf(activeEl);
                e.preventDefault();

                if (currentIndex === -1) {
                    const score5 = document.querySelector(`.score-btn[data-score="5"]`);
                    if (score5) score5.focus();
                    else focusables[0].focus();
                } else {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        currentIndex = (currentIndex - 1 + focusables.length) % focusables.length;
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        currentIndex = (currentIndex + 1) % focusables.length;
                    }
                    focusables[currentIndex].focus();
                }
                return;
            }

            // Quick key shortcuts
            if (e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                executeHoldAction('btn-notes');
                return;
            }
            if (e.key === 's' || e.key === 'S') {
                e.preventDefault();
                executeHoldAction('btn-skip');
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
    const [theme, contrast] = await Promise.all([getConfig('theme'), getConfig('contrast')]);
    if (theme) {
        document.body.setAttribute('data-theme', theme);
        document.getElementById('theme-select').value = theme;
    } else {
        document.body.setAttribute('data-theme', 'system');
        document.getElementById('theme-select').value = 'system';
    }
    if (contrast) {
        document.body.setAttribute('data-contrast', contrast);
        document.getElementById('contrast-select').value = contrast;
    }
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
document.addEventListener("DOMContentLoaded", () => {
    initDatabase()
        .then(seedDefaults)
        .then(() => Promise.all([applyStoredDisplay(), loadActiveQuestions()]))
        .then(() => {
            setupHoldActions();
            setupSettingsAndMenu();
            setupQuestionAuthoring();
            setupKeyboardNavigation();
            renderCurrentQuestion();

            document.getElementById('btn-export-all').addEventListener('click', exportAllDataAndConfig);
            document.getElementById('file-import').addEventListener('change', (e) => {
                const file = e.target.files[0];
                const mode = confirm("Click [OK] to MERGE file data natively.\nClick [Cancel] to completely WIPEOUT and REPLACE device logs.") ? 'merge' : 'replace';
                handleFileImport(file, mode);
            });
        })
        .catch(err => {
            console.error('Initialization failed:', err);
            document.getElementById('question-text').textContent = "Could not open local storage.";
        });
});
