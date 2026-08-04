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
                    // Frozen collision-audit anchor: recompute makeCustomId(originalText)
                    // to verify id integrity and tell a legit text edit from a hash
                    // collision on merge (see docs/design-decisions.md).
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

    // First run only: establish the default active set. On later runs we leave
    // the user's set alone even if it diverges from the defaults.
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

// Persist a user-authored question. The practitioner supplies only meaning
// (text + curve + optional labels); everything else is inferred here so the
// record stays consistent with seedDefaults. Returns a Promise resolving to an
// outcome the UI can surface:
//   { status: 'added',    id, question }  - a brand-new question was stored
//   { status: 'restored', id, question }  - an archived twin was un-archived
//   { status: 'exists',   id, question }  - an active twin already exists (no dup)
// Duplicate handling leans on content-addressing: identical normalized text
// yields the same id, so we never store two copies of the same question.
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
                    // Content-addressed twin was archived: restore it rather than
                    // adding a duplicate under the same id.
                    const restored = { ...existing, archived: false, updatedAt: now };
                    store.put(restored);
                    result = { status: 'restored', id, question: restored };
                } else {
                    // Already active: self-dedupe, report instead of duplicating.
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

    // Optional bridge to the daily tracker: append the id to the active set so a
    // freshly authored question is reachable without the (separate) set editor.
    // Skip when the id is already present to avoid duplicate entries.
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

// Build the 5→1 score-button markup for a question. Shared by the live tracker
// (renderCurrentQuestion) and the authoring preview so the preview matches
// production exactly. Endpoints always carry their labels; the midpoint is only
// meaningful for the middle-is-best curve (e.g. "Stable & Even"). Blank labels
// fall back to '' so the button simply shows its number.
function buildScoreButtonsHTML(question) {
    let buttonsHTML = '';
    for (let score = 5; score >= 1; score--) {
        let contextLabel = '';
        if (score === 5) contextLabel = question.maxLabel || '';
        else if (score === 1) contextLabel = question.minLabel || '';
        else if (score === 3 && question.curve === 'middle-is-best') contextLabel = question.midLabel || '';

        buttonsHTML += `
      <button class="score-btn" data-score="${score}">
        <span class="num">${score}</span>
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
    // Backfill: every active-set question the user did NOT answer is recorded as
    // an explicit skip (score null, status 'skipped') rather than left absent.
    // This preserves the distinction between "chose not to answer" (skipped) and
    // "was never asked / didn't exist that day" (no record at all).
    const answeredIds = new Set(STATE.sessionAnswers.map(a => a.questionId));
    STATE.activeQuestions.forEach(q => {
        if (!answeredIds.has(q.id)) {
            STATE.sessionAnswers.push({ questionId: q.id, score: null, status: 'skipped' });
        }
    });

    const now = new Date();
    const logEntry = {
        timestamp: now.toISOString(), // Standard Human-Readable ISO Identifier
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
    // Export dumps all three stores in full (questions includes archived ones),
    // which is the only way to guarantee every exported log still resolves its
    // question definitions after import.
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

        // Explicit type guard (WebStorm: FileReader result is string | ArrayBuffer).
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
            // questions absent in legacy (v1) backups -> treat as empty.
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

// Same id implies same original text (content-addressed). The only real conflict
// is a divergent display-text/label edit; resolve it by newest updatedAt.
// ISO-8601 strings compare lexicographically in chronological order.
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

// Millisecond-exact dedup on import: a log is treated as "the same log" only if
// its timestamp key AND its full answer set match an existing record — that's
// the "true redundancy" case and is silently dropped. Any other same-timestamp
// record (different answers, e.g. two real entries that happened to serialize
// to the same millisecond, or a legacy/foreign backup) is genuinely unique data
// and must not be discarded; it's nudged forward 1ms at a time until it lands
// on a free key, so merge never loses or silently overwrites history.
// attempt guards against an unbounded recursion in the pathological case where
// thousands of distinct logs collide on the same starting millisecond in a row.
function safelyAddLogWithCollisionCheck(store, incomingLog, attempt = 0) {
    const MAX_COLLISION_ATTEMPTS = 1000;
    const getRequest = store.get(incomingLog.timestamp);
    getRequest.onsuccess = (e) => {
        const existingRecord = e.target.result;
        if (existingRecord) {
            if (areLogAnswersIdentical(existingRecord.answers, incomingLog.answers)) return; // True Redundancy Blocked

            if (attempt >= MAX_COLLISION_ATTEMPTS) {
                // Should be unreachable in practice (would need 1000 distinct logs
                // stacked on consecutive milliseconds). Fail loudly rather than
                // spin forever or silently drop real data.
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
    });
}
function resetHold(e) { clearTimeout(holdTimer); e.classList.remove('is-holding'); }
function executeHoldAction(id) {
    if (id === 'btn-skip') finalizeSession();
    if (id === 'btn-notes') {
        const note = prompt("Add a short internal log note (Optional):");
        if (note) {
            // MVP: notes accumulate into a single free-text field on the log.
            // A structured, individually-timestamped multi-note array is a
            // possible future feature (tabled pending interest).
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

    document.getElementById('btn-menu').addEventListener('click', openSettings);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettings);
}

// Settings live in a drawer that slides in from the right (orthogonal swap):
// tracker exits left, settings enters from the right edge.
function openSettings() {
    document.body.classList.add('settings-open');
    document.getElementById('tracker-canvas').className = 'app-canvas view-hidden-left';
    document.getElementById('settings-canvas').className = 'app-canvas view-active';
}
function closeSettings() {
    document.body.classList.remove('settings-open');
    document.getElementById('settings-canvas').className = 'app-canvas view-hidden-right';
    document.getElementById('tracker-canvas').className = 'app-canvas view-active';
}

// Wire up the custom-question authoring form: reveal/hide, conditional midLabel,
// live preview (via the shared buildScoreButtonsHTML), save-disabled-until-text,
// and save/cancel handling with duplicate/restore/already-exists messaging.
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

    // Render the preview from the current field values, reusing the exact markup
    // the live tracker uses so the practitioner sees production behaviour.
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

    // midLabel is only meaningful for middle-is-best; its presence signals
    // relevance, so we hide it entirely otherwise.
    function syncMidVisibility() {
        midField.hidden = curveInput.value !== 'middle-is-best';
    }

    // curve always has a valid default, so text is the only gate on Save.
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
        if (opening) resetForm();
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
        } catch (err) {
            console.error('Failed to save question:', err);
            alert('Could not save the question. Please try again.');
            syncSaveEnabled();
        }
    });

    // Establish the initial (hidden) state.
    syncMidVisibility();
    syncSaveEnabled();
    refreshPreview();
}

// Apply persisted display preferences (fall back to the HTML defaults if unset).
async function applyStoredDisplay() {
    const [theme, contrast] = await Promise.all([getConfig('theme'), getConfig('contrast')]);
    if (theme) {
        document.body.setAttribute('data-theme', theme);
        document.getElementById('theme-select').value = theme;
    }
    if (contrast) {
        document.body.setAttribute('data-contrast', contrast);
        document.getElementById('contrast-select').value = contrast;
    }
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