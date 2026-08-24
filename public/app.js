/**
 * HIGH & LOW - RUNTIME SYSTEM ENGINE
 * Architecture: Vanilla JS Local-First
 */

// --- 1. CORE CONFIGURATION STATE ---
const STATE = {
    activeQuestions: [],
    currentQuestionIndex: 0,
    checkinAnswers: [],
    checkinNote: null,
    deviceMode: 'mouse',
    historyVisibleQuestionIds: null,
    historyTimeRange: 'all'
};

const CHECKIN_STORAGE_KEY = 'high_and_low_active_checkin';
const VIEW_STORAGE_KEY = 'high_and_low_active_view';
const CHECKIN_TIMEOUT_MS = 30 * 60 * 1000; // 30-minute timeout for stale check-ins

function saveActiveCheckin() {
    try {
        const payload = {
            currentQuestionIndex: STATE.currentQuestionIndex,
            checkinAnswers: STATE.checkinAnswers,
            checkinNote: STATE.checkinNote,
            updatedAt: Date.now()
        };
        sessionStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
}

function clearActiveCheckin() {
    try {
        sessionStorage.removeItem(CHECKIN_STORAGE_KEY);
    } catch (_) {}
}

function restoreActiveCheckin() {
    try {
        const rawCheckin = sessionStorage.getItem(CHECKIN_STORAGE_KEY);
        if (!rawCheckin) return false;
        const parsedCheckin = JSON.parse(rawCheckin);
        if (parsedCheckin && typeof parsedCheckin.currentQuestionIndex === 'number' && Array.isArray(parsedCheckin.checkinAnswers)) {
            // Expire if inactive for > 30 minutes
            if (typeof parsedCheckin.updatedAt === 'number') {
                const elapsedMilliseconds = Date.now() - parsedCheckin.updatedAt;
                if (elapsedMilliseconds > CHECKIN_TIMEOUT_MS) {
                    clearActiveCheckin();
                    return false;
                }
            }
            STATE.currentQuestionIndex = parsedCheckin.currentQuestionIndex;
            STATE.checkinAnswers = parsedCheckin.checkinAnswers;
            STATE.checkinNote = parsedCheckin.checkinNote || null;
            return true;
        }
    } catch (_) {}
    return false;
}

function saveActiveView(viewId) {
    try {
        sessionStorage.setItem(VIEW_STORAGE_KEY, viewId);
    } catch (_) {}
}

function getStoredActiveView() {
    try {
        return sessionStorage.getItem(VIEW_STORAGE_KEY);
    } catch (_) {
        return null;
    }
}

function syncMetaThemeColor(themeValue) {
    const metaTag = document.querySelector('meta[name="theme-color"]');
    if (!metaTag) return;
    const isDark = themeValue === 'dark' || (themeValue === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    metaTag.setAttribute('content', isDark ? '#121212' : '#f2f2f7');
}

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
const DB_VERSION = 3;

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
        request.onupgradeneeded = (event) => {
            const upgradeDb = event.target.result;
            const transaction = event.target.transaction;
            if (!upgradeDb.objectStoreNames.contains('config')) {
                upgradeDb.createObjectStore('config', { keyPath: 'key' });
            }
            if (!upgradeDb.objectStoreNames.contains('entries')) {
                const entriesStore = upgradeDb.createObjectStore('entries', { keyPath: 'timestamp' });
                // If an older 'logs' object store existed from earlier prototypes, migrate its records
                if (upgradeDb.objectStoreNames.contains('logs') && transaction) {
                    try {
                        const oldLogsStore = transaction.objectStore('logs');
                        oldLogsStore.openCursor().onsuccess = (cursorEvent) => {
                            const cursor = cursorEvent.target.result;
                            if (cursor) {
                                entriesStore.put(cursor.value);
                                cursor.continue();
                            }
                        };
                    } catch (migrationError) {
                        console.warn('Could not migrate legacy logs store:', migrationError);
                    }
                }
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
        const request = db.transaction([storeName], 'readonly').objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}
function put(storeName, item) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction([storeName], 'readwrite');
        transaction.objectStore(storeName).put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
function getConfig(key) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve(undefined);
        const request = db.transaction(['config'], 'readonly').objectStore('config').get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : undefined);
        request.onerror = () => reject(request.error);
    });
}
function setConfig(key, value) {
    return new Promise((resolve, reject) => {
        if (!db) return resolve();
        const transaction = db.transaction(['config'], 'readwrite');
        transaction.objectStore('config').put({ key, value });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
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
function fnv1a32(inputString) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < inputString.length; index++) {
        hash ^= inputString.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

// Custom (user-authored) question ids are prefixed 'c_' so a raw export is
// human-scannable against the built-in 'q_' slugs. The id is frozen at creation
// from the original text; later edits to display text never change it, so
// historical entries never orphan.
function makeCustomId(text) {
    return 'c_' + fnv1a32(normalizeQuestionText(text));
}

// Idempotently insert any built-in question whose id is not already present.
// Runs every load: because we never hard-delete (only archive), an id the user
// archived still exists and won't be re-added, while genuinely new built-ins in
// a later SEED_VERSION get picked up automatically.
async function seedDefaults() {
    const existing = await getAll('questions');
    const existingIds = new Set(existing.map(question => question.id));
    const storedSeed = await getConfig('seedVersion');
    const now = new Date().toISOString();

    await new Promise((resolve, reject) => {
        const transaction = db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        DEFAULT_QUESTIONS.forEach(question => {
            if (!existingIds.has(question.id)) {
                store.add({
                    ...question,
                    originalText: question.text,
                    builtIn: true,
                    archived: false,
                    createdAt: now,
                    updatedAt: now
                });
            } else {
                const existingQuestion = existing.find(item => item.id === question.id);
                if (existingQuestion && (!existingQuestion.shortLabel || existingQuestion.shortLabel !== question.shortLabel)) {
                    store.put({
                        ...existingQuestion,
                        shortLabel: question.shortLabel,
                        updatedAt: now
                    });
                }
            }
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
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
    const [allQuestions, activeSet] = await Promise.all([getAll('questions'), getConfig('activeQuestionSet')]);
    const questionsById = new Map(allQuestions.map(question => [question.id, question]));
    const set = Array.isArray(activeSet) ? activeSet : DEFAULT_ACTIVE_SET;
    STATE.activeQuestions = set.map(id => questionsById.get(id)).filter(question => question && !question.archived);
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
        const transaction = db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        let result = null;

        const getRequest = store.get(id);
        getRequest.onsuccess = () => {
            const existing = getRequest.result;
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

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
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
        finalizeCheckin();
        return;
    }

    document.getElementById('progress-text').textContent = `Question ${STATE.currentQuestionIndex + 1} of ${STATE.activeQuestions.length}`;
    document.getElementById('question-text').textContent = currentQuestion.text;

    const inputBox = document.getElementById('input-box');
    inputBox.setAttribute('data-curve', currentQuestion.curve);

    document.getElementById('button-stack').innerHTML = buildScoreButtonsHTML(currentQuestion);

    document.querySelectorAll('.score-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const targetScore = parseInt(event.currentTarget.getAttribute('data-score'), 10);
            handleScoreSubmission(currentQuestion.id, targetScore);
        });
    });
}

function safeRAF(callback) {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        return window.requestAnimationFrame(callback);
    }
    if (typeof requestAnimationFrame === 'function') {
        return requestAnimationFrame(callback);
    }
    return setTimeout(callback, 16);
}

function clearQuestionTransitions() {
    const headerBox = document.getElementById('header-box');
    const inputBox = document.getElementById('input-box');
    if (headerBox) {
        headerBox.classList.remove('question-transition-out', 'question-transition-enter', 'question-transition-in');
    }
    if (inputBox) {
        inputBox.classList.remove('question-transition-out', 'question-transition-enter', 'question-transition-in');
    }
}

function handleScoreSubmission(questionId, score) {
    STATE.checkinAnswers.push({ questionId, score, status: 'answered' });
    STATE.currentQuestionIndex++;
    saveActiveCheckin();

    // If check-in is complete after this score, finalize cleanly without question advance transition
    if (STATE.currentQuestionIndex >= STATE.activeQuestions.length) {
        clearQuestionTransitions();
        finalizeCheckin();
        return;
    }

    const headerBox = document.getElementById('header-box');
    const inputBox = document.getElementById('input-box');

    // Smooth question transition without screen blanking
    if (headerBox) headerBox.classList.add('question-transition-out');
    if (inputBox) inputBox.classList.add('question-transition-out');

    setTimeout(() => {
        clearQuestionTransitions();
        renderCurrentQuestion();
        if (headerBox) {
            headerBox.classList.add('question-transition-enter');
        }
        if (inputBox) {
            inputBox.classList.add('question-transition-enter');
        }

        safeRAF(() => {
            safeRAF(() => {
                if (headerBox) {
                    headerBox.classList.remove('question-transition-enter');
                    headerBox.classList.add('question-transition-in');
                    setTimeout(() => headerBox && headerBox.classList.remove('question-transition-in'), 180);
                }
                if (inputBox) {
                    inputBox.classList.remove('question-transition-enter');
                    inputBox.classList.add('question-transition-in');
                    setTimeout(() => inputBox && inputBox.classList.remove('question-transition-in'), 180);
                }
            });
        });
    }, 120);
}

function startNewCheckIn() {
    clearQuestionTransitions();
    clearActiveCheckin();
    STATE.currentQuestionIndex = 0;
    STATE.checkinAnswers = [];
    STATE.checkinNote = null;
    updateNotesButtonLabel();

    const completionView = document.getElementById('completion-view');
    if (completionView) {
        completionView.hidden = true;
    }

    const buttonStack = document.getElementById('button-stack');
    if (buttonStack) {
        buttonStack.hidden = false;
    }

    const footerBox = document.getElementById('footer-box');
    if (footerBox) {
        footerBox.style.display = '';
    }

    return loadActiveQuestions().then(() => {
        renderCurrentQuestion();
    });
}

function finalizeCheckin() {
    clearQuestionTransitions();
    clearActiveCheckin();
    const answeredIds = new Set(STATE.checkinAnswers.map(answer => answer.questionId));
    STATE.activeQuestions.forEach(question => {
        if (!answeredIds.has(question.id)) {
            STATE.checkinAnswers.push({ questionId: question.id, score: null, status: 'skipped' });
        }
    });

    const now = new Date();
    const checkinEntry = {
        timestamp: now.toISOString(),
        dateString: now.toISOString().split('T')[0],
        note: STATE.checkinNote || null,
        answers: STATE.checkinAnswers
    };

    const progressElement = document.getElementById('progress-text');
    const questionElement = document.getElementById('question-text');
    if (progressElement) progressElement.textContent = "Check-In Complete";
    if (questionElement) questionElement.textContent = "Mood recorded. Rest easy.";

    const buttonStack = document.getElementById('button-stack');
    if (buttonStack) {
        buttonStack.hidden = true;
    }

    const completionView = document.getElementById('completion-view');
    if (completionView) {
        completionView.hidden = false;
    }

    const footerBox = document.getElementById('footer-box');
    if (footerBox) {
        footerBox.style.display = 'none';
    }

    const transaction = db.transaction(['entries'], 'readwrite');
    transaction.objectStore('entries').add(checkinEntry);

    transaction.oncomplete = () => {
        const newCheckinButton = document.getElementById('button-new-checkin');
        if (newCheckinButton) {
            setTimeout(() => newCheckinButton.focus({ preventScroll: true }), 60);
        }
    };
}

// --- 4. DATA ENTRY MANAGEMENT (JSON INTERFACE) ---
function exportAllDataAndConfig() {
    const backupData = { exportVersion: "2.0", exportTimestamp: new Date().toISOString(), config: [], questions: [], entries: [] };
    const transaction = db.transaction(['config', 'questions', 'entries'], 'readonly');

    transaction.objectStore('config').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) { backupData.config.push(cursor.value); cursor.continue(); }
    };
    transaction.objectStore('questions').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) { backupData.questions.push(cursor.value); cursor.continue(); }
    };
    transaction.objectStore('entries').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) { backupData.entries.push(cursor.value); cursor.continue(); }
    };
    transaction.oncomplete = () => {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchorLink = document.createElement('a');
        anchorLink.href = url;
        anchorLink.download = `high-and-low-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(anchorLink);
        anchorLink.click();
        document.body.removeChild(anchorLink);
        URL.revokeObjectURL(url);
    };
}

function handleFileImport(file, mode) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const result = event.target.result;
        if (typeof result !== 'string') {
            console.error("Invalid file format read. Expected text.");
            return;
        }
        try {
            const importedData = JSON.parse(result);
            if (!importedData.entries || !importedData.config) {
                showNoticeDialog('Invalid Backup File', 'The selected file is missing required blueprint structure (entries or configuration).', 'file-import');
                return;
            }
            const importedQuestions = Array.isArray(importedData.questions) ? importedData.questions : [];

            const transaction = db.transaction(['config', 'questions', 'entries'], 'readwrite');
            const configStore = transaction.objectStore('config');
            const questionStore = transaction.objectStore('questions');
            const entryStore = transaction.objectStore('entries');

            if (mode === 'replace') {
                configStore.clear();
                questionStore.clear();
                entryStore.clear();
                importedData.config.forEach(configItem => configStore.add(configItem));
                importedQuestions.forEach(questionItem => questionStore.add(questionItem));
                importedData.entries.forEach(entryItem => entryStore.add(entryItem));
            } else {
                importedData.config.forEach(configItem => configStore.put(configItem));
                importedQuestions.forEach(questionItem => mergeQuestionWithConflictCheck(questionStore, questionItem));
                importedData.entries.forEach(entryItem => safelyAddEntryWithCollisionCheck(entryStore, entryItem));
            }
            transaction.oncomplete = () => window.location.reload();
        } catch (error) {
            console.error('File import failed:', error);
            showNoticeDialog('Corrupted File', 'The selected file could not be parsed or contains corrupted data.', 'file-import');
        }
    };
    reader.readAsText(file);
}

function mergeQuestionWithConflictCheck(store, incoming) {
    const getRequest = store.get(incoming.id);
    getRequest.onsuccess = (event) => {
        const existing = event.target.result;
        if (!existing) {
            store.add(incoming);
            return;
        }
        if ((incoming.updatedAt || '') > (existing.updatedAt || '')) {
            store.put(incoming);
        }
    };
}

function safelyAddEntryWithCollisionCheck(store, incomingEntry, attempt = 0) {
    const MAX_COLLISION_ATTEMPTS = 1000;
    const getRequest = store.get(incomingEntry.timestamp);
    getRequest.onsuccess = (event) => {
        const existingRecord = event.target.result;
        if (existingRecord) {
            if (areEntryAnswersIdentical(existingRecord.answers, incomingEntry.answers)) return;

            if (attempt >= MAX_COLLISION_ATTEMPTS) {
                console.error('safelyAddEntryWithCollisionCheck: could not resolve a free timestamp key after', MAX_COLLISION_ATTEMPTS, 'attempts near', incomingEntry.timestamp, '- entry NOT imported:', incomingEntry);
                return;
            }

            const dateObject = new Date(incomingEntry.timestamp);
            dateObject.setUTCMilliseconds(dateObject.getUTCMilliseconds() + 1);
            incomingEntry.timestamp = dateObject.toISOString();
            safelyAddEntryWithCollisionCheck(store, incomingEntry, attempt + 1);
        } else {
            store.add(incomingEntry);
        }
    };
}

function areEntryAnswersIdentical(answersA, answersB) {
    if (answersA.length !== answersB.length) return false;
    const sortFunction = (firstAnswer, secondAnswer) => firstAnswer.questionId > secondAnswer.questionId ? 1 : -1;
    const sortedAnswersA = [...answersA].sort(sortFunction);
    const sortedAnswersB = [...answersB].sort(sortFunction);
    return sortedAnswersA.every((answerItem, index) => answerItem.questionId === sortedAnswersB[index].questionId && answerItem.score === sortedAnswersB[index].score && answerItem.status === sortedAnswersB[index].status);
}

// --- 5. HOLD-TO-CONFIRM SAFETY DELAY CONFIG & SETTING ---
let holdTimer = null;
let isExecutingAction = false;
let isHoldDelayEnabled = true; // Enabled on by default

function setupHoldActions() {
    document.querySelectorAll('.hold-action').forEach(button => {
        let holdFinished = false;

        const startHold = () => {
            if (!isHoldDelayEnabled) return;
            holdFinished = false;
            button.classList.add('is-holding');
            clearTimeout(holdTimer);
            holdTimer = setTimeout(() => {
                holdFinished = true;
                executeHoldAction(button.id);
                resetHold(button);
            }, 1500);
        };

        const cancelHold = () => {
            if (!isHoldDelayEnabled) return;
            clearTimeout(holdTimer);
            button.classList.remove('is-holding');
        };

        // Suppress native context menu and text selection callouts on mobile touch and touch emulation
        button.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        if (window.PointerEvent) {
            button.addEventListener('pointerdown', (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                try {
                    button.setPointerCapture(event.pointerId);
                } catch (_) {}
                if (isHoldDelayEnabled) startHold();
            });
            button.addEventListener('pointerup', (event) => {
                try {
                    if (button.hasPointerCapture && button.hasPointerCapture(event.pointerId)) {
                        button.releasePointerCapture(event.pointerId);
                    }
                } catch (_) {}
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('pointercancel', (event) => {
                try {
                    if (button.hasPointerCapture && button.hasPointerCapture(event.pointerId)) {
                        button.releasePointerCapture(event.pointerId);
                    }
                } catch (_) {}
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('pointerleave', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
        } else {
            button.addEventListener('touchstart', () => {
                if (isHoldDelayEnabled) startHold();
            });
            button.addEventListener('touchend', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('touchcancel', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('mousedown', (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                if (isHoldDelayEnabled) startHold();
            });
            button.addEventListener('mouseup', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
            button.addEventListener('mouseleave', () => {
                if (isHoldDelayEnabled) cancelHold();
            });
        }

        // Standard click handler:
        // - When hold delay is enabled: short clicks/taps are ignored because a 1.5s hold is required (except informational notice dismissals).
        // - When hold delay is disabled: executes immediately on regular click/tap.
        button.addEventListener('click', (event) => {
            event.preventDefault();
            if (isHoldDelayEnabled && button.id !== 'button-notice-ok' && button.id !== 'button-question-feedback-ok') {
                return;
            }
            executeHoldAction(button.id);
        });

        // Support Enter / Space keypress on hold action buttons for keyboard accessibility
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                executeHoldAction(button.id);
            }
        });
    });

    // Support Enter / Space keypress on the custom file import label
    const importLabel = document.querySelector('label[for="file-import"]');
    if (importLabel) {
        importLabel.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                document.getElementById('file-import').click();
            }
        });
    }
}

function resetHold(element) {
    clearTimeout(holdTimer);
    if (element && element.classList) element.classList.remove('is-holding');
}

function executeHoldAction(id) {
    if (isExecutingAction) return;
    isExecutingAction = true;
    setTimeout(() => { isExecutingAction = false; }, 300);

    if (id === 'button-skip') {
        finalizeCheckin();
    } else if (id === 'button-notes') {
        openNotesDialog();
    } else if (id === 'button-note-cancel') {
        closeNotesDialog();
    } else if (id === 'button-note-save') {
        saveNotesFromDialog();
    } else if (id === 'button-import-cancel') {
        closeImportDialog();
    } else if (id === 'button-import-merge') {
        confirmImport('merge');
    } else if (id === 'button-import-replace') {
        confirmImport('replace');
    } else if (id === 'button-question-feedback-ok' || id === 'button-notice-ok') {
        closeNoticeDialog();
    }
}

let noticeReturnFocusElement = null;

function showNoticeDialog(title, subtitle, returnFocusTarget, isNote = false) {
    noticeReturnFocusElement = returnFocusTarget || null;
    const overlay = document.getElementById('notice-dialog-overlay') || document.getElementById('question-feedback-dialog-overlay');
    const titleElement = document.getElementById('notice-dialog-title') || document.getElementById('question-feedback-title');
    const subtitleElement = document.getElementById('notice-dialog-subtitle') || document.getElementById('question-feedback-subtitle');
    if (!overlay) return;

    if (titleElement) titleElement.textContent = title;
    if (subtitleElement) {
        subtitleElement.textContent = subtitle;
        if (isNote) {
            subtitleElement.classList.add('notice-note-content');
        } else {
            subtitleElement.classList.remove('notice-note-content');
        }
    }

    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');

    const okButton = document.getElementById('button-notice-ok') || document.getElementById('button-question-feedback-ok');
    if (okButton) setTimeout(() => okButton.focus(), 60);
}

function closeNoticeDialog() {
    const overlay = document.getElementById('notice-dialog-overlay') || document.getElementById('question-feedback-dialog-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    const dialog = document.getElementById('notice-dialog') || document.getElementById('question-feedback-dialog');
    if (dialog) {
        dialog.querySelectorAll('.hold-action').forEach(button => resetHold(button));
    }

    if (noticeReturnFocusElement) {
        const element = typeof noticeReturnFocusElement === 'string'
            ? document.getElementById(noticeReturnFocusElement)
            : noticeReturnFocusElement;
        if (element && typeof element.focus === 'function') {
            element.focus({ preventScroll: true });
        }
        noticeReturnFocusElement = null;
    }
}

function setupNoticeDialog() {
    const overlay = document.getElementById('notice-dialog-overlay') || document.getElementById('question-feedback-dialog-overlay');
    if (!overlay) return;

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Enter') {
            event.preventDefault();
            closeNoticeDialog();
        }
    });

    const okButton = document.getElementById('button-notice-ok') || document.getElementById('button-question-feedback-ok');
    if (okButton) {
        okButton.addEventListener('click', (event) => {
            event.preventDefault();
            closeNoticeDialog();
        });
    }
}

let pendingImportFile = null;

function openImportDialog(file) {
    if (!file) return;
    pendingImportFile = file;

    const overlay = document.getElementById('import-dialog-overlay');
    const nameElement = document.getElementById('import-file-name');
    if (!overlay) return;

    if (nameElement) {
        nameElement.textContent = file.name || 'backup.json';
    }

    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');

    const mergeButton = document.getElementById('button-import-merge');
    if (mergeButton) setTimeout(() => mergeButton.focus(), 60);
}

function closeImportDialog() {
    const overlay = document.getElementById('import-dialog-overlay');
    const fileInput = document.getElementById('file-import');
    if (fileInput) fileInput.value = '';
    pendingImportFile = null;

    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    document.querySelectorAll('#import-dialog .hold-action').forEach(button => resetHold(button));
}

function confirmImport(mode) {
    const file = pendingImportFile;
    closeImportDialog();
    if (file) {
        handleFileImport(file, mode);
    }
}

function setupImportDialog() {
    const overlay = document.getElementById('import-dialog-overlay');
    if (!overlay) return;

    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeImportDialog();
        }
    });
}

function openNotesDialog() {
    const overlay = document.getElementById('notes-dialog-overlay');
    const input = document.getElementById('checkin-note-input');
    if (!overlay || !input) return;

    input.value = STATE.checkinNote || '';
    overlay.removeAttribute('inert');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-open');

    // Smooth focus and cursor positioning
    setTimeout(() => {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
    }, 60);
}

function closeNotesDialog() {
    const overlay = document.getElementById('notes-dialog-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');

    // Reset hold visual indicator state on dialog buttons
    document.querySelectorAll('#notes-dialog .hold-action').forEach(button => resetHold(button));

    // Return focus to notes button on the tracker canvas
    const notesButton = document.getElementById('button-notes');
    if (notesButton) notesButton.focus({ preventScroll: true });
}

function saveNotesFromDialog() {
    const input = document.getElementById('checkin-note-input');
    if (input) {
        const note = input.value.trim();
        STATE.checkinNote = note.length > 0 ? note : null;
        updateNotesButtonLabel();
        saveActiveCheckin();
    }
    closeNotesDialog();
}

function setupNotesDialog() {
    const overlay = document.getElementById('notes-dialog-overlay');
    const input = document.getElementById('checkin-note-input');
    if (!overlay || !input) return;

    // Handle Escape and Ctrl/Cmd+Enter inside the modal
    overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeNotesDialog();
        }
    });

    input.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            saveNotesFromDialog();
        }
    });
}

function updateNotesButtonLabel() {
    const notesButton = document.getElementById('button-notes');
    if (!notesButton) return;
    const labelSpan = notesButton.querySelector('.button-label');
    if (labelSpan) {
        labelSpan.textContent = STATE.checkinNote ? 'Note Attached ✓' : 'Add Note';
    }
    updateHoldActionAriaLabels();
}

function updateHoldActionAriaLabels() {
    const skipButton = document.getElementById('button-skip');
    if (skipButton) {
        skipButton.setAttribute('aria-label', isHoldDelayEnabled ? 'Skip remaining questions (Hold to confirm)' : 'Skip remaining questions');
    }
    const notesButton = document.getElementById('button-notes');
    if (notesButton) {
        const noteStateText = STATE.checkinNote ? 'Note Attached' : 'Add custom note';
        notesButton.setAttribute('aria-label', isHoldDelayEnabled ? `${noteStateText} (Hold to confirm)` : noteStateText);
    }
}

// --- 6. SETTINGS & MENU NAVIGATION ---
function setupSettingsAndMenu() {
    const themeSelect = document.getElementById('theme-select');
    const drawerThemeSelect = document.getElementById('drawer-theme-select');
    const contrastSelect = document.getElementById('contrast-select');
    const holdDelaySelect = document.getElementById('hold-delay-select');
    const menuSideSelect = document.getElementById('menu-side-select');

    const handleThemeChange = async (themeValue) => {
        document.body.setAttribute('data-theme', themeValue);
        await setConfig('theme', themeValue);
        syncMetaThemeColor(themeValue);
        if (themeSelect) themeSelect.value = themeValue;
        if (drawerThemeSelect) drawerThemeSelect.value = themeValue;
    };

    if (themeSelect) {
        themeSelect.addEventListener('change', (event) => handleThemeChange(event.target.value));
    }
    if (drawerThemeSelect) {
        drawerThemeSelect.addEventListener('change', (event) => handleThemeChange(event.target.value));
    }

    if (contrastSelect) {
        contrastSelect.addEventListener('change', async (event) => {
            document.body.setAttribute('data-contrast', event.target.value);
            await setConfig('contrast', event.target.value);
        });
    }

    const handleHoldDelayChange = async (holdDelayValue) => {
        isHoldDelayEnabled = (holdDelayValue !== 'disabled');
        document.body.setAttribute('data-hold-delay', isHoldDelayEnabled ? 'enabled' : 'disabled');
        updateHoldActionAriaLabels();
        await setConfig('holdDelay', isHoldDelayEnabled ? 'enabled' : 'disabled');
        try {
            localStorage.setItem('holdDelay', isHoldDelayEnabled ? 'enabled' : 'disabled');
        } catch (error) {}
        if (holdDelaySelect) holdDelaySelect.value = isHoldDelayEnabled ? 'enabled' : 'disabled';
    };

    if (holdDelaySelect) {
        holdDelaySelect.addEventListener('change', (event) => handleHoldDelayChange(event.target.value));
    }

    // Debug bounds functionality (Console controllable: window.toggleDebugBounds() or window.setDebugBounds(true/false))
    window.setDebugBounds = async (enable) => {
        const isEnabled = Boolean(enable);
        document.body.setAttribute('data-debug-bounds', isEnabled ? 'true' : 'false');
        await setConfig('debug-bounds', isEnabled ? 'on' : 'off');
        try {
            localStorage.setItem('debug-bounds', isEnabled ? 'on' : 'off');
        } catch (error) {
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

    const handleMenuSideChange = async (menuSideValue) => {
        document.body.classList.add('suppress-transitions');
        document.body.setAttribute('data-menu-side', menuSideValue);
        await setConfig('menuSide', menuSideValue);
        try {
            localStorage.setItem('menuSide', menuSideValue);
        } catch (error) {
        }
        if (menuSideSelect) menuSideSelect.value = menuSideValue;
        safeRAF(() => {
            safeRAF(() => {
                if (typeof document !== 'undefined' && document.body) {
                    document.body.classList.remove('suppress-transitions');
                }
            });
        });
    };

    if (menuSideSelect) {
        menuSideSelect.addEventListener('change', (event) => handleMenuSideChange(event.target.value));
    }

    // Dynamic listener for OS system theme changes
    if (window.matchMedia) {
        const systemThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = () => {
            syncMetaThemeColor('system');
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

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && document.body.classList.contains('drawer-open')) {
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

    // Drawer Actions: Restart Check-In (Task 2.13)
    const restartCheckinButton = document.getElementById('button-restart-checkin');
    if (restartCheckinButton) {
        restartCheckinButton.addEventListener('click', () => {
            closeDrawer();
            navigateTo('tracker-canvas');
            void startNewCheckIn();
        });
    }
}

function setupCanvasBackButtons() {
    document.querySelectorAll('[data-close-view]').forEach(button => {
        button.addEventListener('click', () => navigateTo('tracker-canvas'));
    });
}

window.addEventListener('popstate', (event) => {
    const targetView = (event.state && event.state.view) ? event.state.view : 'tracker-canvas';
    navigateTo(targetView, { fromPopState: true });
});

function setInert(element, isInert) {
    if (!element) return;
    element.inert = isInert;
    if (isInert) {
        element.setAttribute('inert', '');
    } else {
        element.removeAttribute('inert');
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

function getCurveColor(curve, index) {
    if (curve === 'more-is-better') return '#34c759';
    if (curve === 'less-is-better') return '#ff3b30';
    if (curve === 'middle-is-best') return '#007aff';
    const fallbackPalette = ['#34c759', '#ff3b30', '#007aff', '#af52de', '#ff9500', '#5ac8fa'];
    return fallbackPalette[index % fallbackPalette.length];
}

const QUESTION_DASH_PATTERNS = [
    'none',          // 0: Solid line
    '6,4',           // 1: Medium dashes
    '2,3',           // 2: Dotted
    '8,3,2,3',       // 3: Dash-dot
    '12,4',          // 4: Long dashes
    '6,3,2,3,2,3',   // 5: Dash-dot-dot
    '10,3,4,3'       // 6: Long-dash short-dash
];

function getQuestionDashArray(index) {
    return QUESTION_DASH_PATTERNS[index % QUESTION_DASH_PATTERNS.length];
}

async function loadHistoryView() {
    const container = document.getElementById('history-graph-container') || document.getElementById('panel-history');
    if (!container) return;

    try {
        const [entries, questions, activeSet] = await Promise.all([
            getAll('entries'),
            getAll('questions'),
            getConfig('activeQuestionSet')
        ]);

        const questionsById = new Map(questions.map(question => [question.id, question]));
        const activeIds = Array.isArray(activeSet) ? activeSet : DEFAULT_ACTIVE_SET;

        const sortedEntries = (entries || [])
            .filter(entry => entry && entry.timestamp && !isNaN(new Date(entry.timestamp).getTime()))
            .slice()
            .sort((firstEntry, secondEntry) => new Date(firstEntry.timestamp).getTime() - new Date(secondEntry.timestamp).getTime());

        // Collect all question IDs that are either active or present in the logged entries
        const relevantQuestionIds = new Set(activeIds);
        sortedEntries.forEach(entry => {
            if (Array.isArray(entry.answers)) {
                entry.answers.forEach(answerItem => {
                    if (answerItem && answerItem.questionId) {
                        relevantQuestionIds.add(answerItem.questionId);
                    }
                });
            } else if (entry && entry.answers && typeof entry.answers === 'object') {
                Object.keys(entry.answers).forEach(questionId => {
                    if (entry.answers[questionId] !== undefined && entry.answers[questionId] !== null) {
                        relevantQuestionIds.add(questionId);
                    }
                });
            }
        });

        const historyQuestions = [];
        relevantQuestionIds.forEach(questionId => {
            const foundQuestion = questionsById.get(questionId);
            if (foundQuestion) {
                historyQuestions.push(foundQuestion);
            }
        });

        STATE.historyData = {
            entries: sortedEntries,
            allEntries: sortedEntries,
            questions: historyQuestions,
            allQuestionsMap: questionsById
        };

        renderLineGraph(container, STATE.historyData);
    } catch (error) {
        console.error('Failed to load history data:', error);
    }
}

function escapeHTML(stringToEscape) {
    if (!stringToEscape) return '';
    return String(stringToEscape)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatEntryDateTime(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHour = hours % 12 || 12;
        const formattedMinute = minutes < 10 ? `0${minutes}` : minutes;
        return `${month}/${day}/${year}, ${formattedHour}:${formattedMinute} ${ampm}`;
    } catch (error) {
        return isoString;
    }
}

function formatTickDate(timeMilliseconds, isShortRange) {
    try {
        const date = new Date(timeMilliseconds);
        if (isNaN(date.getTime())) return '';
        const month = date.getMonth() + 1;
        const day = date.getDate();
        if (isShortRange) {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const ampm = hours >= 12 ? 'p' : 'a';
            const formattedHour = hours % 12 || 12;
            const formattedMinute = minutes === 0 ? '' : `:${minutes < 10 ? '0' + minutes : minutes}`;
            return `${month}/${day} ${formattedHour}${formattedMinute}${ampm}`;
        }
        return `${month}/${day}`;
    } catch (error) {
        return '';
    }
}

function getTimeframeLabel(rangeKey) {
    switch (rangeKey) {
        case '7d': return '7 Days';
        case '14d': return '14 Days';
        case '30d': return '30 Days';
        case '90d': return '90 Days';
        default: return 'All Time';
    }
}

function renderLineGraph(container, { entries, allEntries, questions, visibleQuestionIds, timeRange } = {}) {
    if (!container) return;

    const rawAllEntries = Array.isArray(allEntries)
        ? allEntries
        : (Array.isArray(entries) ? entries : []);

    if (!rawAllEntries || rawAllEntries.length === 0) {
        container.innerHTML = `
            <h3>Mood Timeline</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 12px; line-height: 1.5; text-align: center;">
                No recorded mood history yet.<br>Complete an entry in the Mood Tracker to view your history timeline.
            </p>
        `;
        return;
    }

    if (!questions || questions.length === 0) {
        container.innerHTML = `
            <h3>Mood Timeline</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 12px; line-height: 1.5; text-align: center;">
                No active questions found for timeline rendering.
            </p>
        `;
        return;
    }

    const currentTimeRange = timeRange || STATE.historyTimeRange || 'all';
    STATE.historyTimeRange = currentTimeRange;

    // Filter entries according to active timeframe
    let filteredEntries = rawAllEntries;
    if (currentTimeRange !== 'all' && rawAllEntries.length > 0) {
        const rangeDaysMap = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        const numberOfDays = rangeDaysMap[currentTimeRange] || 30;
        const millisecondsInWindow = numberOfDays * 24 * 60 * 60 * 1000;

        let latestTimestampNumber = -Infinity;
        for (const entry of rawAllEntries) {
            const time = new Date(entry.timestamp).getTime();
            if (!isNaN(time) && time > latestTimestampNumber) {
                latestTimestampNumber = time;
            }
        }
        const referenceTime = latestTimestampNumber === -Infinity ? Date.now() : latestTimestampNumber;
        const cutoffTime = referenceTime - millisecondsInWindow;

        filteredEntries = rawAllEntries.filter(entry => {
            const entryTime = new Date(entry.timestamp).getTime();
            return !isNaN(entryTime) && entryTime >= cutoffTime;
        });
    }

    // Determine current visible question IDs Set
    let currentVisibleSet;
    if (visibleQuestionIds instanceof Set) {
        currentVisibleSet = new Set(visibleQuestionIds);
    } else if (Array.isArray(visibleQuestionIds)) {
        currentVisibleSet = new Set(visibleQuestionIds);
    } else if (STATE.historyVisibleQuestionIds instanceof Set) {
        currentVisibleSet = new Set(STATE.historyVisibleQuestionIds);
    } else {
        currentVisibleSet = new Set(questions.map(question => question.id));
    }

    STATE.historyVisibleQuestionIds = currentVisibleSet;

    const timeframeRanges = [
        { key: '7d', label: '7D', ariaLabel: 'Last 7 days' },
        { key: '14d', label: '14D', ariaLabel: 'Last 14 days' },
        { key: '30d', label: '30D', ariaLabel: 'Last 30 days' },
        { key: '90d', label: '90D', ariaLabel: 'Last 90 days' },
        { key: 'all', label: 'All', ariaLabel: 'All time' }
    ];

    const timeframeButtonsHTML = timeframeRanges.map(rangeItem => {
        const isActive = rangeItem.key === currentTimeRange;
        return `
            <button type="button" class="graph-timeframe-button${isActive ? ' is-active' : ''}" data-range="${rangeItem.key}" role="radio" aria-checked="${isActive ? 'true' : 'false'}" aria-label="${rangeItem.ariaLabel}">${rangeItem.label}</button>
        `;
    }).join('');

    const timeframeToolbarHTML = `
        <div class="graph-timeframe-toolbar" role="toolbar" aria-label="Timeline time range filter">
            <span class="graph-timeframe-title">Timeframe</span>
            <div class="graph-timeframe-buttons" role="radiogroup" aria-label="Select date range">
                ${timeframeButtonsHTML}
            </div>
        </div>
    `;

    const quickActionsHTML = `
        <div class="legend-quick-actions" role="toolbar" aria-label="Timeline question quick filters">
            <span class="legend-quick-title">Filter Questions</span>
            <div class="legend-quick-buttons">
                <button type="button" class="legend-quick-button" id="button-legend-show-all" aria-label="Show all questions on timeline">Show all</button>
                <button type="button" class="legend-quick-button" id="button-legend-clear-all" aria-label="Clear all questions on timeline">Clear all</button>
            </div>
        </div>
    `;

    let legendItemsHTML = '';
    questions.forEach((question, questionIndex) => {
        const color = getCurveColor(question.curve, questionIndex);
        const dashArray = getQuestionDashArray(questionIndex);
        const questionTitle = escapeHTML(question.shortLabel || question.text);
        const swatchLineDash = dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : '';
        const isVisible = currentVisibleSet.has(question.id);
        const isIsolated = currentVisibleSet.size === 1 && currentVisibleSet.has(question.id);

        legendItemsHTML += `
            <div class="legend-checklist-row">
                <button type="button" class="legend-checklist-item" role="checkbox" aria-checked="${isVisible ? 'true' : 'false'}" data-question-id="${escapeHTML(question.id)}" aria-label="Toggle ${questionTitle}">
                    <span class="legend-checkbox-box" aria-hidden="true">${isVisible ? '✓' : ''}</span>
                    <svg class="legend-swatch" width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
                        <line x1="0" y1="5" x2="22" y2="5" stroke="${color}" stroke-width="2.5"${swatchLineDash} stroke-linecap="round" />
                        <circle cx="11" cy="5" r="3" fill="${color}" stroke="var(--box-bg)" stroke-width="1" />
                    </svg>
                    <span class="legend-label">${questionTitle}</span>
                </button>
                <button type="button" class="legend-isolate-button${isIsolated ? ' is-isolated' : ''}" data-question-id="${escapeHTML(question.id)}" aria-label="${isIsolated ? `Restore all questions (currently isolating ${questionTitle})` : `Isolate ${questionTitle}`}" title="${isIsolated ? 'Restore all questions' : `Isolate ${questionTitle}`}">
                    <svg class="isolate-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="8" cy="8" r="6" />
                        <circle cx="8" cy="8" r="2" fill="currentColor" />
                    </svg>
                </button>
            </div>
        `;
    });

    const legendHTML = `
        <div class="graph-legend graph-legend-checklist" role="group" aria-label="Timeline Questions Filter">
            ${legendItemsHTML}
        </div>
    `;

    // Reading Key for clear visual differentiation between Answered, Skipped, and Not Asked
    const guideKeyHTML = `
        <div class="graph-guide-key" style="display: flex; gap: 14px; justify-content: center; margin-top: 10px; font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap;">
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: currentColor;"></span>
                <span>Answered (1–5)</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 10px; height: 10px; border-radius: 50%; border: 1px dashed currentColor; font-size: 7px; font-weight: bold; line-height: 1;">✕</span>
                <span>Skipped (Chose not to answer)</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="display: inline-block; width: 12px; height: 0; border-top: 1px dashed currentColor;"></span>
                <span>(Gap) Not Asked</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <svg width="12" height="12" viewBox="0 0 14 14" style="flex-shrink: 0;" aria-hidden="true">
                    <rect x="0" y="0" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" />
                    <path d="M 3.5 3.5 h 7 M 3.5 7 h 7 M 3.5 10.5 h 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                <span>Note Attached (Tap to view)</span>
            </span>
        </div>
    `;

    function wireTimeframeAndLegendListeners() {
        const timeframeButtonElements = container.querySelectorAll('.graph-timeframe-button');
        timeframeButtonElements.forEach(timeframeButtonElement => {
            timeframeButtonElement.addEventListener('click', () => {
                const selectedRange = timeframeButtonElement.getAttribute('data-range');
                if (selectedRange && selectedRange !== currentTimeRange) {
                    STATE.historyTimeRange = selectedRange;
                    renderLineGraph(container, {
                        entries: rawAllEntries,
                        allEntries: rawAllEntries,
                        questions: questions,
                        visibleQuestionIds: currentVisibleSet,
                        timeRange: selectedRange
                    });
                }
            });
        });

        const showAllButton = container.querySelector('#button-legend-show-all');
        if (showAllButton) {
            showAllButton.addEventListener('click', () => {
                const allQuestionIds = questions.map(question => question.id);
                currentVisibleSet = new Set(allQuestionIds);
                STATE.historyVisibleQuestionIds = currentVisibleSet;
                renderLineGraph(container, {
                    entries: rawAllEntries,
                    allEntries: rawAllEntries,
                    questions: questions,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: currentTimeRange
                });
            });
        }

        const clearAllButton = container.querySelector('#button-legend-clear-all');
        if (clearAllButton) {
            clearAllButton.addEventListener('click', () => {
                currentVisibleSet = new Set();
                STATE.historyVisibleQuestionIds = currentVisibleSet;
                renderLineGraph(container, {
                    entries: rawAllEntries,
                    allEntries: rawAllEntries,
                    questions: questions,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: currentTimeRange
                });
            });
        }
    }

    if (filteredEntries.length === 0) {
        container.innerHTML = `
            <div class="history-graph-wrapper">
                <div class="graph-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                    <h3 style="margin: 0;">Mood Timeline</h3>
                    ${timeframeToolbarHTML}
                </div>
                <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 0.92rem; background: var(--box-bg); border: 1px solid var(--border-color); border-radius: 8px; margin: 12px 0;">
                    No check-ins found in the selected timeframe (${getTimeframeLabel(currentTimeRange)}).<br>
                    Switch to <strong>All</strong> or a wider timeframe to view earlier entries.
                </div>
                ${quickActionsHTML}
                ${legendHTML}
                ${guideKeyHTML}
            </div>
        `;
        wireTimeframeAndLegendListeners();
        return;
    }

    const entryCount = filteredEntries.length;
    const entryTimes = filteredEntries.map(entry => {
        const time = new Date(entry.timestamp).getTime();
        return isNaN(time) ? 0 : time;
    });

    let minTime = Infinity;
    let maxTime = -Infinity;
    for (let index = 0; index < entryTimes.length; index++) {
        const time = entryTimes[index];
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
    }
    if (minTime === Infinity) minTime = 0;
    if (maxTime === -Infinity) maxTime = 0;
    const timeDuration = maxTime - minTime;

    const minimumSpacingPerPoint = 48;
    const paddingTop = 24;
    const paddingBottom = 60;
    const paddingLeft = 42;
    const paddingRight = 24;

    const calculatedWidth = entryCount > 1
        ? Math.max(600, paddingLeft + paddingRight + (entryCount - 1) * minimumSpacingPerPoint)
        : 600;
    const width = calculatedWidth;
    const height = 320;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    function getY(score) {
        if (score === null || score === undefined) return null;
        const ratio = (score - 1) / 4;
        return paddingTop + chartHeight * (1 - ratio);
    }

    const skipBaselineY = height - paddingBottom + 16;
    const noteBaselineY = height - paddingBottom + 32;

    function getX(index) {
        if (entryCount === 1) return paddingLeft + chartWidth / 2;
        if (timeDuration <= 0) return paddingLeft + (index / (entryCount - 1)) * chartWidth;
        const ratio = (entryTimes[index] - minTime) / timeDuration;
        return paddingLeft + ratio * chartWidth;
    }

    // Grid lines for scores 1-5
    let gridLinesHTML = '';
    for (let score = 1; score <= 5; score++) {
        const y = getY(score);
        gridLinesHTML += `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" />
            <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end" font-weight="600">${score}</text>
        `;
    }

    // Dedicated Skip Baseline Row on Y-Axis
    gridLinesHTML += `
        <line x1="${paddingLeft}" y1="${skipBaselineY}" x2="${width - paddingRight}" y2="${skipBaselineY}" stroke="var(--border-color)" stroke-width="0.8" stroke-dasharray="1,3" opacity="0.6" />
        <text x="${paddingLeft - 8}" y="${skipBaselineY + 3.5}" fill="var(--text-muted)" font-size="9.5" text-anchor="end" font-style="italic">Skip</text>
    `;

    // Dedicated Note Baseline Row on Y-Axis
    gridLinesHTML += `
        <line x1="${paddingLeft}" y1="${noteBaselineY}" x2="${width - paddingRight}" y2="${noteBaselineY}" stroke="var(--border-color)" stroke-width="0.8" stroke-dasharray="1,3" opacity="0.6" />
        <text x="${paddingLeft - 8}" y="${noteBaselineY + 3.5}" fill="var(--text-muted)" font-size="9.5" text-anchor="end" font-style="italic">Note</text>
    `;

    // Time-Scaled X-Axis Gridlines & Tick Labels
    let xAxisHTML = '';
    if (entryCount === 1) {
        const xPosition = paddingLeft + chartWidth / 2;
        const dateString = formatTickDate(minTime, true);
        xAxisHTML += `
            <line x1="${xPosition}" y1="${paddingTop}" x2="${xPosition}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.4" />
            <text x="${xPosition}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${dateString}</text>
        `;
    } else if (timeDuration <= 0) {
        filteredEntries.forEach((entry, entryIndex) => {
            const xPosition = getX(entryIndex);
            const dateString = formatTickDate(entryTimes[entryIndex], true);
            xAxisHTML += `
                <line x1="${xPosition}" y1="${paddingTop}" x2="${xPosition}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.4" />
                <text x="${xPosition}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${dateString}</text>
            `;
        });
    } else {
        const isShortRange = timeDuration <= 36 * 3600 * 1000;
        const tickDensity = Math.max(3, Math.min(entryCount, Math.round(chartWidth / 90)));
        for (let tickIndex = 0; tickIndex < tickDensity; tickIndex++) {
            const tickTime = minTime + (tickIndex / (tickDensity - 1)) * timeDuration;
            const xPosition = paddingLeft + (tickIndex / (tickDensity - 1)) * chartWidth;
            const dateString = formatTickDate(tickTime, isShortRange);
            xAxisHTML += `
                <line x1="${xPosition}" y1="${paddingTop}" x2="${xPosition}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.35" />
                <text x="${xPosition}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${dateString}</text>
            `;
        }
    }

    let linesHTML = '';
    let skipsHTML = '';
    let notesHTML = '';
    let pointsHTML = '';

    questions.forEach((question, questionIndex) => {
        const color = getCurveColor(question.curve, questionIndex);
        const dashArray = getQuestionDashArray(questionIndex);
        const questionTitle = escapeHTML(question.shortLabel || question.text);
        const dashAttr = dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : '';
        const isVisible = currentVisibleSet.has(question.id);

        if (!isVisible) {
            return;
        }

        // Separate contiguous segments of answered points
        const segments = [];
        let currentSegment = [];

        filteredEntries.forEach((entry, entryIndex) => {
            let answer = null;
            if (Array.isArray(entry.answers)) {
                answer = entry.answers.find(answerItem => answerItem.questionId === question.id);
            } else if (entry.answers && typeof entry.answers === 'object') {
                const rawValue = entry.answers[question.id];
                if (typeof rawValue === 'number') {
                    answer = { questionId: question.id, score: rawValue, status: 'answered' };
                } else if (rawValue && typeof rawValue === 'object') {
                    answer = { questionId: question.id, ...rawValue };
                }
            }
            const isAnswered = answer && answer.status === 'answered' && answer.score !== null && answer.score >= 1 && answer.score <= 5;
            const isSkipped = answer && (answer.status === 'skipped' || answer.score === null);

            if (isAnswered) {
                const x = getX(entryIndex);
                const y = getY(answer.score);
                currentSegment.push({ x, y, score: answer.score, entryIndex: entryIndex, timestamp: entry.timestamp });
            } else {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }

                if (isSkipped) {
                    const rawXPosition = getX(entryIndex);
                    const fannedXPosition = (entryCount === 1 || questions.length === 1)
                        ? rawXPosition
                        : rawXPosition + (questionIndex - (questions.length - 1) / 2) * 6;
                    const dateString = formatEntryDateTime(entry.timestamp);
                    skipsHTML += `
                        <g class="skip-marker" aria-label="${questionTitle}: Skipped (${dateString})">
                            <title>${questionTitle}: Skipped (${dateString})</title>
                            <circle cx="${fannedXPosition}" cy="${skipBaselineY}" r="4.5" fill="var(--box-bg)" stroke="${color}" stroke-width="1.5" stroke-dasharray="2,2" />
                            <line x1="${fannedXPosition - 2.5}" y1="${skipBaselineY - 2.5}" x2="${fannedXPosition + 2.5}" y2="${skipBaselineY + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                            <line x1="${fannedXPosition + 2.5}" y1="${skipBaselineY - 2.5}" x2="${fannedXPosition - 2.5}" y2="${skipBaselineY + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                        </g>
                    `;
                }
            }
        });

        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        // Draw line paths for each contiguous segment (never across skips or absent gaps)
        segments.forEach(segment => {
            if (segment.length >= 2) {
                let pathData = `M ${segment[0].x} ${segment[0].y}`;
                for (let segmentIndex = 1; segmentIndex < segment.length; segmentIndex++) {
                    pathData += ` L ${segment[segmentIndex].x} ${segment[segmentIndex].y}`;
                }
                linesHTML += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5"${dashAttr} stroke-linejoin="round" stroke-linecap="round" />`;
            }

            // Draw data point circles with accessible tooltips
            segment.forEach(point => {
                const dateString = formatEntryDateTime(point.timestamp);
                pointsHTML += `
                    <circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" stroke="var(--box-bg)" stroke-width="1.5" aria-label="${questionTitle}: Score ${point.score} (${dateString})">
                        <title>${questionTitle}: Score ${point.score}/5 (${dateString})</title>
                    </circle>
                `;
            });
        });
    });

    // Generate Notes indicator markers on the timeline (Task 3.9)
    filteredEntries.forEach((entry, entryIndex) => {
        const hasNote = Boolean(entry.note && typeof entry.note === 'string' && entry.note.trim().length > 0);
        if (!hasNote) return;

        const noteXPosition = getX(entryIndex);
        const formattedDateString = formatEntryDateTime(entry.timestamp);
        const rawNoteText = entry.note.trim();
        const escapedNoteText = escapeHTML(rawNoteText);

        notesHTML += `
            <g class="note-marker" role="button" tabindex="0" data-entry-index="${entryIndex}" data-note="${escapedNoteText}" data-date="${escapeHTML(formattedDateString)}" aria-label="Note (${escapeHTML(formattedDateString)}): ${escapedNoteText}">
                <title>Note (${escapeHTML(formattedDateString)}): ${escapedNoteText}</title>
                <rect class="note-marker-hitbox" x="${noteXPosition - 14}" y="${noteBaselineY - 14}" width="28" height="28" fill="transparent" />
                <rect class="note-marker-box" x="${noteXPosition - 7}" y="${noteBaselineY - 7}" width="14" height="14" rx="3" fill="var(--button-default)" stroke="var(--border-color)" stroke-width="1.2" />
                <path class="note-marker-icon" d="M ${noteXPosition - 3.5} ${noteBaselineY - 3.5} h 7 M ${noteXPosition - 3.5} ${noteBaselineY} h 7 M ${noteXPosition - 3.5} ${noteBaselineY + 3.5} h 4.5" stroke="var(--text-bright)" stroke-width="1.2" stroke-linecap="round" />
            </g>
        `;
    });

    const svgHTML = `
        <svg class="graph-svg" viewBox="0 0 ${width} ${height}" style="width: ${calculatedWidth > 600 ? calculatedWidth + 'px' : '100%'}; min-width: 100%; height: auto; max-height: 280px; overflow: visible;">
            <g class="grid">${gridLinesHTML}</g>
            <g class="x-axis">${xAxisHTML}</g>
            <g class="lines">${linesHTML}</g>
            <g class="skips">${skipsHTML}</g>
            <g class="notes">${notesHTML}</g>
            <g class="points">${pointsHTML}</g>
        </svg>
    `;

    container.innerHTML = `
        <div class="history-graph-wrapper">
            <div class="graph-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                <h3 style="margin: 0;">Mood Timeline</h3>
                ${timeframeToolbarHTML}
            </div>
            <div class="graph-scroll-container" tabindex="0" role="region" aria-label="Interactive mood timeline chart, scroll horizontally to view earlier dates">
                ${svgHTML}
            </div>
            ${quickActionsHTML}
            ${legendHTML}
            ${guideKeyHTML}
        </div>
    `;

    // Auto-scroll timeline to recent entries on render
    const scrollContainerElement = container.querySelector('.graph-scroll-container');
    if (scrollContainerElement) {
        if (scrollContainerElement.scrollWidth > scrollContainerElement.clientWidth) {
            scrollContainerElement.scrollLeft = scrollContainerElement.scrollWidth;
        }

        // Map mouse wheel delta to horizontal scrolling when cursor is over the timeline
        scrollContainerElement.addEventListener('wheel', (event) => {
            if (scrollContainerElement.scrollWidth <= scrollContainerElement.clientWidth) {
                return;
            }
            // If the user is scrolling vertically with the mouse wheel, translate to horizontal scroll
            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.preventDefault();
                scrollContainerElement.scrollLeft += event.deltaY;
            }
        }, { passive: false });
    }

    wireTimeframeAndLegendListeners();

    // Attach click and keyboard interaction handlers to note markers
    const noteMarkerElements = container.querySelectorAll('.note-marker');
    noteMarkerElements.forEach(noteMarkerElement => {
        function displayNoteDialog() {
            const entryIndexAttribute = noteMarkerElement.getAttribute('data-entry-index');
            const entryIndex = entryIndexAttribute !== null ? parseInt(entryIndexAttribute, 10) : -1;
            const targetEntry = Number.isInteger(entryIndex) && filteredEntries && filteredEntries[entryIndex] ? filteredEntries[entryIndex] : null;
            const rawNoteContent = targetEntry && targetEntry.note
                ? targetEntry.note.trim()
                : (noteMarkerElement.dataset.note || noteMarkerElement.getAttribute('data-note') || '');
            const noteDateTime = targetEntry
                ? formatEntryDateTime(targetEntry.timestamp)
                : (noteMarkerElement.dataset.date || noteMarkerElement.getAttribute('data-date') || '');
            if (rawNoteContent) {
                showNoticeDialog(`Check-In Note — ${noteDateTime}`, rawNoteContent, noteMarkerElement, true);
            }
        }

        noteMarkerElement.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            displayNoteDialog();
        });

        noteMarkerElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                displayNoteDialog();
            }
        });
    });

    const legendElement = container.querySelector('.graph-legend');
    if (legendElement) {
        let longPressTimer = null;
        let isLongPressTriggered = false;
        let activePointerId = null;
        let startPosition = { x: 0, y: 0 };

        function clearLongPress() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            activePointerId = null;
        }

        function handleIsolateOrRestore(targetQuestionId) {
            const allQuestionIds = questions.map(question => question.id);
            const isCurrentlyIsolated = currentVisibleSet.size === 1 && currentVisibleSet.has(targetQuestionId);

            if (isCurrentlyIsolated) {
                // Restore all questions
                currentVisibleSet = new Set(allQuestionIds);
            } else {
                // Isolate to target question alone
                currentVisibleSet = new Set([targetQuestionId]);
            }

            STATE.historyVisibleQuestionIds = currentVisibleSet;
            if (navigator.vibrate) {
                try { navigator.vibrate(40); } catch (_) {}
            }
            renderLineGraph(container, {
                entries: rawAllEntries,
                allEntries: rawAllEntries,
                questions: questions,
                visibleQuestionIds: currentVisibleSet,
                timeRange: currentTimeRange
            });
        }

        legendElement.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.legend-isolate-button')) {
                return;
            }

            const button = event.target.closest('.legend-checklist-item');
            if (!button || (event.button !== undefined && event.button !== 0)) return;

            const questionId = button.dataset.questionId;
            if (!questionId) return;

            isLongPressTriggered = false;
            activePointerId = event.pointerId;
            startPosition = { x: event.clientX, y: event.clientY };

            clearLongPress();
            longPressTimer = setTimeout(() => {
                isLongPressTriggered = true;
                handleIsolateOrRestore(questionId);
            }, 450);
        });

        legendElement.addEventListener('pointermove', (event) => {
            if (!longPressTimer) return;
            const distance = Math.hypot(event.clientX - startPosition.x, event.clientY - startPosition.y);
            if (distance > 10) {
                clearLongPress();
            }
        });

        legendElement.addEventListener('pointerup', () => {
            clearLongPress();
        });

        legendElement.addEventListener('pointercancel', () => {
            clearLongPress();
        });

        legendElement.addEventListener('contextmenu', (event) => {
            if (event.target.closest('.legend-checklist-item')) {
                event.preventDefault();
            }
        });

        legendElement.addEventListener('click', (event) => {
            const isolateButton = event.target.closest('.legend-isolate-button');
            if (isolateButton) {
                event.preventDefault();
                event.stopPropagation();
                const questionId = isolateButton.dataset.questionId;
                if (questionId) {
                    handleIsolateOrRestore(questionId);
                }
                return;
            }

            const button = event.target.closest('.legend-checklist-item');
            if (!button) return;

            if (isLongPressTriggered) {
                isLongPressTriggered = false;
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            const questionId = button.dataset.questionId;
            if (!questionId) return;

            if (currentVisibleSet.has(questionId)) {
                currentVisibleSet.delete(questionId);
            } else {
                currentVisibleSet.add(questionId);
            }

            STATE.historyVisibleQuestionIds = currentVisibleSet;
            renderLineGraph(container, {
                entries: rawAllEntries,
                allEntries: rawAllEntries,
                questions: questions,
                visibleQuestionIds: currentVisibleSet,
                timeRange: currentTimeRange
            });
        });
    }
}

function navigateTo(targetViewId, options = {}) {
    if (targetViewId === currentViewId && !options.force) return;

    const currentCanvas = document.getElementById(currentViewId);
    const targetCanvas = document.getElementById(targetViewId);

    if (!targetCanvas) return;

    if (targetViewId === 'history-canvas') {
        void loadHistoryView().catch(error => {
            console.error('Failed to load history view:', error);
        });
    }

    if (targetViewId === 'tracker-canvas') {
        if (STATE.currentQuestionIndex >= STATE.activeQuestions.length && STATE.activeQuestions.length > 0) {
            void startNewCheckIn();
        }
    }

    const isInstant = Boolean(options.instant || options.fromInit);

    if (isInstant) {
        document.querySelectorAll('.app-canvas').forEach(canvas => {
            if (canvas === targetCanvas) {
                canvas.className = 'app-canvas view-active no-transition';
                setInert(canvas, false);
            } else if (canvas.id === 'tracker-canvas' && targetViewId !== 'tracker-canvas') {
                canvas.className = 'app-canvas view-hidden-left no-transition';
                setInert(canvas, true);
            } else {
                canvas.className = 'app-canvas view-hidden-right no-transition';
                setInert(canvas, true);
            }
        });
        safeRAF(() => {
            safeRAF(() => {
                document.querySelectorAll('.app-canvas.no-transition').forEach(canvasElement => {
                    canvasElement.classList.remove('no-transition');
                });
            });
        });
    } else {
        const isGoingHome = (targetViewId === 'tracker-canvas');

        if (currentCanvas && currentCanvas !== targetCanvas) {
            setInert(currentCanvas, true);
            if (isGoingHome) {
                currentCanvas.className = 'app-canvas view-hidden-right';
            } else {
                currentCanvas.className = 'app-canvas view-hidden-left';
            }
        }

        if (isGoingHome) {
            targetCanvas.className = 'app-canvas view-hidden-left no-transition';
        } else {
            targetCanvas.className = 'app-canvas view-hidden-right no-transition';
        }

        // Force reflow and transition to active
        if (typeof targetCanvas.offsetWidth === 'number') {
            void targetCanvas.offsetWidth;
        }
        targetCanvas.classList.remove('no-transition');
        targetCanvas.className = 'app-canvas view-active';
        setInert(targetCanvas, false);
    }

    currentViewId = targetViewId;
    saveActiveView(targetViewId);

    // Push a history entry so hardware/gesture 'back' steps back one view
    // instead of exiting the app. Skip when we're already responding to
    // a popstate event or during instant loads.
    if (!options.fromPopState && !isInstant && window.history && window.history.pushState) {
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
        const shortValue = normalizeQuestionText(shortLabelInput ? shortLabelInput.value : '');
        const fullValue = normalizeQuestionText(textInput ? textInput.value : '');
        if (previewTitleBox) {
            previewTitleBox.textContent = shortValue ? shortValue : (fullValue || 'Short Label Preview');
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
        const isTextValid = normalizeQuestionText(textInput.value) !== '';
        const isShortLabelValid = shortLabelInput ? normalizeQuestionText(shortLabelInput.value) !== '' : true;
        saveButton.disabled = !(isTextValid && isShortLabelValid);
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

    [textInput, shortLabelInput, maxInput, midInput, minInput].forEach(inputElement => {
        if (!inputElement) return;
        inputElement.addEventListener('input', () => {
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

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
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
                showNoticeDialog('Question Saved', 'Your custom question has been saved and will appear in your check-in tracker.', toggleButton);
            } else if (outcome.status === 'restored') {
                showNoticeDialog('Question Restored', 'That question already existed in your archived items and has been restored.', toggleButton);
            } else {
                showNoticeDialog('Question Exists', 'You already have an active question with this text in your library.', toggleButton);
            }

            resetForm();
            form.hidden = true;
            toggleButton.textContent = 'Add a Question';
            toggleButton.setAttribute('aria-expanded', 'false');
            toggleButton.focus({ preventScroll: true });
        } catch (error) {
            console.error('Failed to save question:', error);
            showNoticeDialog('Could Not Save', 'Could not save the question. Please check the fields and try again.', toggleButton);
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

    document.addEventListener('keydown', (event) => {
        const activeElement = document.activeElement;
        const isInputActive = activeElement && (
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName) ||
            activeElement.isContentEditable
        );

        // Escape key closes settings drawer from anywhere
        if (event.key === 'Escape') {
            if (document.body.classList.contains('settings-open')) {
                closeSettings();
                return;
            }
        }

        if (isInputActive) return; // Do not trigger shortcuts when typing in inputs

        // Keyboard interaction for active mood tracker canvas
        if (!document.body.classList.contains('settings-open')) {
            // Direct score submission via Number keys 1-5
            if (['1', '2', '3', '4', '5'].includes(event.key)) {
                const score = parseInt(event.key, 10);
                const scoreButton = document.querySelector(`.score-button[data-score="${score}"]`);
                if (scoreButton) {
                    scoreButton.focus({ preventScroll: true });
                    scoreButton.click();
                }
                return;
            }

            // Arrow key navigation through ALL interactive controls on the tracker canvas
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
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

                let currentIndex = focusables.indexOf(activeElement);
                event.preventDefault();

                if (currentIndex === -1) {
                    const score5 = document.querySelector(`.score-button[data-score="5"]`);
                    if (score5) score5.focus({ preventScroll: true });
                    else focusables[0].focus({ preventScroll: true });
                } else {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                        currentIndex = (currentIndex - 1 + focusables.length) % focusables.length;
                    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                        currentIndex = (currentIndex + 1) % focusables.length;
                    }
                    focusables[currentIndex].focus({ preventScroll: true });
                }
                return;
            }

            // Quick key shortcuts
            if (event.key === 'n' || event.key === 'N') {
                event.preventDefault();
                executeHoldAction('button-notes');
                return;
            }
            if (event.key === 's' || event.key === 'S') {
                event.preventDefault();
                executeHoldAction('button-skip');
                return;
            }
            if (event.key === 'm' || event.key === 'M') {
                event.preventDefault();
                openSettings();
            }
        }
    });
}

async function applyStoredDisplay() {
    const [
        theme,
        contrast,
        menuSide,
        holdDelay
    ] = await Promise.all([
        getConfig('theme'),
        getConfig('contrast'),
        getConfig('menuSide'),
        getConfig('holdDelay'),
        getConfig('debug-bounds')
    ]);
    const themeValue = theme || 'system';
    document.body.setAttribute('data-theme', themeValue);
    syncMetaThemeColor(themeValue);
    const themeSelect = document.getElementById('theme-select');
    const drawerThemeSelect = document.getElementById('drawer-theme-select');
    if (themeSelect) themeSelect.value = themeValue;
    if (drawerThemeSelect) drawerThemeSelect.value = themeValue;

    if (contrast) {
        document.body.setAttribute('data-contrast', contrast);
        const contrastSelect = document.getElementById('contrast-select');
        if (contrastSelect) contrastSelect.value = contrast;
    }

    let localHoldDelay = null;
    try { localHoldDelay = localStorage.getItem('holdDelay'); } catch (error) {}
    const finalHoldDelay = holdDelay || localHoldDelay || 'enabled';
    isHoldDelayEnabled = (finalHoldDelay !== 'disabled');
    document.body.setAttribute('data-hold-delay', isHoldDelayEnabled ? 'enabled' : 'disabled');
    updateHoldActionAriaLabels();
    const holdDelaySelect = document.getElementById('hold-delay-select');
    if (holdDelaySelect) holdDelaySelect.value = isHoldDelayEnabled ? 'enabled' : 'disabled';

    let localMenuSide = null;
    try { localMenuSide = localStorage.getItem('menuSide'); } catch (error) { }
    const finalMenuSide = menuSide || localMenuSide || 'right';
    document.body.setAttribute('data-menu-side', finalMenuSide);
    const menuSideSelect = document.getElementById('menu-side-select');
    if (menuSideSelect) menuSideSelect.value = finalMenuSide;

    // Ensure debug options/outlines are off on page load
    document.body.setAttribute('data-debug-bounds', 'false');
    await setConfig('debug-bounds', 'off');
    try { localStorage.setItem('debug-bounds', 'off'); } catch (error) { }
}

// Register service worker if available
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('SW registration failed:', error);
        });
    });
}

// --- 7. INITIALIZATION BOOTSTRAP ---
let isAppInitialized = false;
function initApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;

    setupHoldActions();
    setupNotesDialog();
    setupImportDialog();
    setupNoticeDialog();
    setupSettingsAndMenu();
    setupQuestionAuthoring();
    setupKeyboardNavigation();
    setupCanvasBackButtons();

    const newCheckinButton = document.getElementById('button-new-checkin');
    if (newCheckinButton) {
        newCheckinButton.addEventListener('click', () => {
            void startNewCheckIn();
        });
    }

    const exportButton = document.getElementById('button-export-all');
    if (exportButton) exportButton.addEventListener('click', exportAllDataAndConfig);

    const importFileInput = document.getElementById('file-import');
    if (importFileInput) {
        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) {
                openImportDialog(file);
            }
        });
    }

    initDatabase()
        .then(seedDefaults)
        .then(() => Promise.all([applyStoredDisplay(), loadActiveQuestions()]))
        .then(() => {
            restoreActiveCheckin();
            updateNotesButtonLabel();
            clearQuestionTransitions();

            if (STATE.currentQuestionIndex >= STATE.activeQuestions.length && STATE.activeQuestions.length > 0) {
                const buttonStack = document.getElementById('button-stack');
                if (buttonStack) buttonStack.hidden = true;
                const completionView = document.getElementById('completion-view');
                if (completionView) completionView.hidden = false;
                const footerBox = document.getElementById('footer-box');
                if (footerBox) footerBox.style.display = 'none';
                const progressElement = document.getElementById('progress-text');
                const questionElement = document.getElementById('question-text');
                if (progressElement) progressElement.textContent = "Check-In Complete";
                if (questionElement) questionElement.textContent = "Check-In recorded. Rest easy.";
            } else {
                renderCurrentQuestion();
            }

            const storedView = getStoredActiveView();
            const historyView = (window.history && window.history.state && window.history.state.view) ? window.history.state.view : null;
            const targetInitialView = storedView || historyView || 'tracker-canvas';

            if (targetInitialView && targetInitialView !== 'tracker-canvas') {
                navigateTo(targetInitialView, { fromPopState: true, instant: true, fromInit: true });
            } else {
                if (window.history && window.history.replaceState) {
                    history.replaceState({ view: 'tracker-canvas' }, '');
                }
            }

            if (typeof window !== 'undefined') {
                window.startNewCheckIn = startNewCheckIn;
                window.renderLineGraph = renderLineGraph;
                window.loadHistoryView = loadHistoryView;
                window.navigateTo = navigateTo;
                window.finalizeCheckin = finalizeCheckin;
                window.STATE = STATE;
                window.put = put;
                window.getAll = getAll;
                window.getConfig = getConfig;
                window.setConfig = setConfig;
            }

            safeRAF(() => {
                safeRAF(() => {
                    if (typeof document !== 'undefined' && document.body) {
                        document.body.classList.remove('suppress-transitions');
                    }
                });
            });
        })
        .catch(error => {
            console.error('Initialization failed:', error);
            const questionText = document.getElementById('question-text');
            if (questionText) questionText.textContent = "Could not open local storage.";
            safeRAF(() => {
                safeRAF(() => {
                    if (typeof document !== 'undefined' && document.body) {
                        document.body.classList.remove('suppress-transitions');
                    }
                });
            });
        });
}

if (typeof window !== 'undefined') {
    window.startNewCheckIn = startNewCheckIn;
    window.renderLineGraph = renderLineGraph;
    window.navigateTo = navigateTo;
    window.finalizeCheckin = finalizeCheckin;
    window.STATE = STATE;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}