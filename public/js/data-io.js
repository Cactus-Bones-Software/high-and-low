/**
 * HIGH & LOW - DATA IMPORT / EXPORT (JSON INTERFACE)
 * Backup serialization, JSON file export, and conflict-checked database restore operations.
 */

import { getDatabase, getConfig, setConfig, getAll } from './storage/db.js';
import { showNoticeDialog } from "./ui/dialogs.js";
import { t } from './localization.js';
import {
    SEED_VERSION,
    seedDefaults,
    loadActiveQuestions,
    BOOLEAN_NO_SCORE,
    BOOLEAN_YES_SCORE
} from './questions.js';
import { clearActiveCheckin, VIEW_STORAGE_KEY } from './storage/session.js';
import { STATE } from './state.js';

/**
 * Formats an ISO-8601 string into a localized date string for backup display.
 * @param {string | null | undefined} isoString - ISO-8601 timestamp string.
 * @returns {string} Localized date string, or empty string if invalid or null.
 */
export function formatBackupDate(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString();
    } catch {
        return '';
    }
}

/**
 * Updates the last backup date indicator in the Data view (#panel-data).
 * Displays "Last backup: <date>" or "No backup yet".
 * @returns {Promise<void>}
 */
export async function updateLastBackupDisplay() {
    const indicatorElement = document.getElementById('last-backup-display');
    if (!indicatorElement) return;

    try {
        const lastBackupAt = await getConfig('lastBackupAt');
        if (lastBackupAt) {
            const formattedDate = formatBackupDate(lastBackupAt);
            if (formattedDate) {
                indicatorElement.textContent = t('data.lastBackup', { date: formattedDate });
                indicatorElement.removeAttribute('data-i18n');
                return;
            }
        }
        indicatorElement.textContent = t('data.noBackupYet');
        indicatorElement.setAttribute('data-i18n', 'data.noBackupYet');
    } catch (error) {
        console.warn('Could not retrieve lastBackupAt from config:', error);
        indicatorElement.textContent = t('data.noBackupYet');
        indicatorElement.setAttribute('data-i18n', 'data.noBackupYet');
    }
}

export const EXPORTABLE_CONFIG_KEYS = [
    'activeQuestionSet',
    'theme',
    'contrast',
    'handedness',
    'holdDelay',
    'language'
];

/**
 * Serializes database records into a scope-aware JSON backup file and triggers a browser download.
 * Scopes supported:
 * - 'history': entries store records + all questions referenced by those entries. Updates lastBackupAt.
 * - 'settings': all questions in catalog + allowlisted config keys. Does not update lastBackupAt.
 *
 * @param {Object} [options={}] - Export configuration options.
 * @param {boolean} [options.includeHistory=true] - Whether to include check-in entries and referenced questions.
 * @param {boolean} [options.includeSettings=true] - Whether to include question catalog and allowlisted settings.
 * @returns {Promise<{ backupData: Object, filename: string }>} Resolves with export metadata and file content.
 */
export function exportBackup(options = {}) {
    const includeHistory = options.includeHistory !== undefined ? Boolean(options.includeHistory) : true;
    const includeSettings = options.includeSettings !== undefined ? Boolean(options.includeSettings) : true;

    if (!includeHistory && !includeSettings) {
        return Promise.reject(new Error('At least one export scope must be selected ("history" or "settings").'));
    }

    const database = getDatabase();
    if (!database) {
        console.error('Database not initialized for export.');
        return Promise.reject(new Error('Database not initialized for export.'));
    }

    const exportTimestamp = new Date().toISOString();
    const scope = [];
    if (includeHistory) scope.push('history');
    if (includeSettings) scope.push('settings');

    let scopeSuffix = 'full';
    if (includeHistory && !includeSettings) {
        scopeSuffix = 'history-only';
    } else if (!includeHistory && includeSettings) {
        scopeSuffix = 'settings-only';
    }

    const filename = `high-and-low-backup-${exportTimestamp.split('T')[0]}-${scopeSuffix}.json`;

    const rawConfig = [];
    const rawQuestions = [];
    const rawEntries = [];

    const transaction = database.transaction(['config', 'questions', 'entries'], 'readonly');

    transaction.objectStore('config').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            rawConfig.push(cursor.value);
            cursor.continue();
        }
    };
    transaction.objectStore('questions').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            rawQuestions.push(cursor.value);
            cursor.continue();
        }
    };
    transaction.objectStore('entries').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            rawEntries.push(cursor.value);
            cursor.continue();
        }
    };

    return new Promise((resolve, reject) => {
        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = async () => {
            const exportedEntries = includeHistory ? rawEntries : [];

            let exportedQuestions = [];
            if (includeSettings) {
                exportedQuestions = rawQuestions;
            } else if (includeHistory) {
                const referencedQuestionIds = new Set();
                for (const entry of exportedEntries) {
                    if (Array.isArray(entry.answers)) {
                        for (const answer of entry.answers) {
                            if (answer?.questionId) {
                                referencedQuestionIds.add(answer.questionId);
                            }
                        }
                    }
                }
                exportedQuestions = rawQuestions.filter(question => referencedQuestionIds.has(question.id));
            }

            let exportedConfig = [];
            if (includeSettings) {
                exportedConfig = rawConfig.filter(item =>
                    item && typeof item.key === 'string' && EXPORTABLE_CONFIG_KEYS.includes(item.key)
                );
            }

            const backupData = {
                exportVersion: "2.0",
                exportTimestamp,
                scope,
                config: exportedConfig,
                questions: exportedQuestions,
                entries: exportedEntries
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                const url = URL.createObjectURL(blob);
                const anchorLink = document.createElement('a');
                anchorLink.href = url;
                anchorLink.download = filename;
                document.body.appendChild(anchorLink);
                anchorLink.click();
                document.body.removeChild(anchorLink);
                if (typeof URL.revokeObjectURL === 'function') {
                    URL.revokeObjectURL(url);
                }
            }

            if (includeHistory) {
                try {
                    await setConfig('lastBackupAt', exportTimestamp);
                    await updateLastBackupDisplay();
                } catch (error) {
                    console.error('Failed to record lastBackupAt after export:', error);
                }
            }

            resolve({ backupData, filename });
        };
    });
}

/**
 * Serializes the entire IndexedDB database ('config', 'questions', and 'entries' stores)
 * into a full JSON backup file and triggers a browser download. Preserves one-tap contract.
 * @returns {Promise<{ backupData: Object, filename: string }>}
 */
export function exportAllDataAndConfig() {
    return exportBackup({ includeHistory: true, includeSettings: true });
}

/**
 * Initiates the asynchronous reading of an uploaded JSON backup file.
 * @param {File} file - The uploaded JSON file object.
 * @param {'replace' | 'merge'} mode - Import strategy: 'replace' wipes database first, 'merge' dedupes.
 * @returns {void}
 */
export function handleFileImport(file, mode) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => handleFileImportReaderLoad(mode, event);
    reader.readAsText(file);
}

/**
 * Recognised backup export versions supported by the import system.
 */
export const RECOGNISED_EXPORT_VERSIONS = ['1.0', '2.0'];

/**
 * Validates the parsed backup payload against recognized export versions and required store arrays.
 * Accepts full backups as well as partial backups that contain at least one store array.
 * @param {any} backupData - Parsed JSON object to validate.
 * @returns {{ isValid: boolean, errorType: 'malformed' | 'invalid_structure' | null, reason: string | null }}
 */
export function validateBackupPayload(backupData) {
    if (!backupData || typeof backupData !== 'object' || Array.isArray(backupData)) {
        return { isValid: false, errorType: 'invalid_structure', reason: 'Payload must be a JSON object' };
    }

    const versionString = typeof backupData.exportVersion === 'string'
        ? backupData.exportVersion.trim()
        : String(backupData.exportVersion || '').trim();

    if (!RECOGNISED_EXPORT_VERSIONS.includes(versionString)) {
        return {
            isValid: false,
            errorType: 'invalid_structure',
            reason: `Unrecognised exportVersion: ${versionString}`
        };
    }

    const hasEntriesArray = Array.isArray(backupData.entries);
    const hasQuestionsArray = Array.isArray(backupData.questions);
    const hasConfigArray = Array.isArray(backupData.config);

    if (!hasEntriesArray && !hasQuestionsArray && !hasConfigArray) {
        return {
            isValid: false,
            errorType: 'invalid_structure',
            reason: 'Backup must contain at least one of entries, questions, or config as an array'
        };
    }

    return { isValid: true, errorType: null, reason: null };
}

/**
 * Detects whether an imported backup payload contains history, settings, or both.
 * @param {Object} backupData - Validated backup payload.
 * @returns {{ containsHistory: boolean, containsSettings: boolean }}
 */
export function detectBackupScopes(backupData) {
    if (!backupData || typeof backupData !== 'object') {
        return { containsHistory: false, containsSettings: false };
    }

    // Explicit scope array (Task 2.17 standard)
    if (Array.isArray(backupData.scope)) {
        const containsHistory = backupData.scope.includes('history') && Array.isArray(backupData.entries);
        const containsSettings = backupData.scope.includes('settings') &&
            (Array.isArray(backupData.config) || Array.isArray(backupData.questions));
        return { containsHistory, containsSettings };
    }

    // Infer from presence of arrays
    const hasEntriesArray = Array.isArray(backupData.entries);
    const hasConfigArray = Array.isArray(backupData.config);
    const hasQuestionsArray = Array.isArray(backupData.questions);

    // If both entries and config arrays exist (standard full backup e.g. v1.0 or legacy v2.0)
    if (hasEntriesArray && hasConfigArray) {
        return { containsHistory: true, containsSettings: true };
    }

    // History-only: entries array present without config array
    if (hasEntriesArray && !hasConfigArray) {
        return { containsHistory: true, containsSettings: false };
    }

    // Settings-only: config or questions present without entries array
    if ((hasConfigArray || hasQuestionsArray) && !hasEntriesArray) {
        return { containsHistory: false, containsSettings: true };
    }

    return {
        containsHistory: hasEntriesArray,
        containsSettings: hasConfigArray || hasQuestionsArray
    };
}

/**
 * Writes validated backup records into IndexedDB according to the specified mode ('replace' or 'merge').
 * In 'replace' mode, wipes only the stores whose data the backup actually contains.
 * Ignores device-specific keys ('seedVersion', 'lastBackupAt') from incoming backup files.
 * @param {Object} importedData - Parsed and validated backup payload.
 * @param {'replace' | 'merge'} mode - Import strategy ('replace' or 'merge').
 * @returns {Promise<{ containsHistory: boolean, containsSettings: boolean }>} Resolves on transaction complete.
 */
export async function executeBackupImport(importedData, mode) {
    const validation = validateBackupPayload(importedData);
    if (!validation.isValid) {
        throw new Error(validation.reason || 'Invalid backup payload');
    }

    const database = getDatabase();
    if (!database) {
        throw new Error('Database not initialized for import.');
    }

    const { containsHistory, containsSettings } = detectBackupScopes(importedData);

    const importedQuestions = Array.isArray(importedData.questions) ? importedData.questions : [];
    const importedEntries = Array.isArray(importedData.entries) ? importedData.entries : [];

    // Filter out device-specific keys: seedVersion and lastBackupAt must never be imported from a backup file
    const IGNORED_CONFIG_KEYS = new Set(['seedVersion', 'lastBackupAt']);
    const filteredConfig = Array.isArray(importedData.config)
        ? importedData.config.filter((item) =>
            item && typeof item.key === 'string' && !IGNORED_CONFIG_KEYS.has(item.key)
        )
        : [];

    let currentDeviceLastBackup = null;
    try {
        currentDeviceLastBackup = await getConfig('lastBackupAt');
    } catch {
        // Safe to ignore if not configured
    }

    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['config', 'questions', 'entries'], 'readwrite');
        const configStore = transaction.objectStore('config');
        const questionStore = transaction.objectStore('questions');
        const entryStore = transaction.objectStore('entries');

        transaction.onerror = () => reject(transaction.error);
        transaction.oncomplete = () => resolve({ containsHistory, containsSettings });

        if (mode === 'replace') {
            // Wipe & Replace must only clear the stores whose data the file actually contains.
            if (containsHistory) {
                entryStore.clear();
                for (const entryItem of importedEntries) {
                    entryStore.add(entryItem);
                }
            }

            if (containsSettings) {
                configStore.clear();
                // Preserve device-level seedVersion and previous lastBackupAt
                configStore.add({ key: 'seedVersion', value: SEED_VERSION });
                if (currentDeviceLastBackup) {
                    configStore.add({ key: 'lastBackupAt', value: currentDeviceLastBackup });
                }
                for (const configItem of filteredConfig) {
                    configStore.put(configItem);
                }

                questionStore.clear();
                for (const questionItem of importedQuestions) {
                    questionStore.add(questionItem);
                }
            } else if (containsHistory && importedQuestions.length > 0) {
                // Orphan prevention: history-only import brings questions referenced by its entries.
                // Because settings are NOT being replaced, merge these questions without clearing questionStore.
                for (const questionItem of importedQuestions) {
                    mergeQuestionWithConflictCheck(questionStore, questionItem);
                }
            }
        } else {
            // Smart Merge retains non-destructive merge behavior across all present data
            for (const configItem of filteredConfig) {
                configStore.put(configItem);
            }
            for (const questionItem of importedQuestions) {
                mergeQuestionWithConflictCheck(questionStore, questionItem);
            }
            for (const entryItem of importedEntries) {
                safelyAddEntryWithCollisionCheck(entryStore, entryItem);
            }
        }
    });
}

/**
 * Handles FileReader load event, validates backup JSON structure, and executes database writes.
 * Reloads the browser tab on successful completion to re-initialize application state.
 * @param {'replace' | 'merge'} mode - Import strategy ('replace' or 'merge').
 * @param {ProgressEvent<FileReader>} event - FileReader load event containing the raw file text.
 * @returns {void}
 */
export function handleFileImportReaderLoad(mode, event) {
    const result = event.target?.result;
    if (typeof result !== 'string') {
        console.error("Invalid file format read. Expected text.");
        return;
    }

    let importedData;
    try {
        importedData = JSON.parse(result);
    } catch (parseError) {
        console.error('File import JSON parse failed:', parseError);
        const triggerNotice = (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function')
            ? window.showNoticeDialog
            : showNoticeDialog;
        if (typeof triggerNotice === 'function') {
            triggerNotice(t('data.corruptedTitle'), t('data.corruptedMessage'), 'file-import');
        }
        return;
    }

    const validation = validateBackupPayload(importedData);
    if (!validation.isValid) {
        const triggerNotice = (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function')
            ? window.showNoticeDialog
            : showNoticeDialog;
        if (typeof triggerNotice === 'function') {
            triggerNotice(t('data.invalidBackupTitle'), t('data.invalidBackupMessage'), 'file-import');
        }
        return;
    }

    executeBackupImport(importedData, mode)
        .then(() => {
            if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
                window.location.reload();
            }
        })
        .catch((error) => {
            console.error('File import execution failed:', error);
            const triggerNotice = (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function')
                ? window.showNoticeDialog
                : showNoticeDialog;
            if (typeof triggerNotice === 'function') {
                triggerNotice(t('data.corruptedTitle'), t('data.corruptedMessage'), 'file-import');
            }
        });
}

/**
 * Merges an incoming question into the questions store with conflict resolution.
 * If the question already exists, retains the record with the newer updatedAt timestamp.
 * @param {IDBObjectStore} store - Questions IDBObjectStore transaction reference.
 * @param {Object} incoming - Incoming question record to merge.
 * @returns {void}
 */
export function mergeQuestionWithConflictCheck(store, incoming) {
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

/**
 * Inserts an entry into the entries store, resolving timestamp key collisions recursively.
 * If an entry with the exact same timestamp and identical answers exists, skips it as a duplicate.
 * If timestamps collide with different answers, increments the timestamp by 1 millisecond.
 * @param {IDBObjectStore} store - Entries IDBObjectStore transaction reference.
 * @param {Object} incomingEntry - Entry record being inserted.
 * @param {number} [attempt=0] - Recursion attempt counter (capped at 1000).
 * @returns {void}
 */
export function safelyAddEntryWithCollisionCheck(store, incomingEntry, attempt = 0) {
    const MAX_COLLISION_ATTEMPTS = 1000;
    const getRequest = store.get(incomingEntry.timestamp);
    getRequest.onsuccess = (event) => {
        const existingRecord = event.target.result;
        if (existingRecord) {
            if (areEntryAnswersIdentical(existingRecord.answers, incomingEntry.answers)) return;

            if (attempt >= MAX_COLLISION_ATTEMPTS) {
                console.error(
                    'safelyAddEntryWithCollisionCheck: could not resolve timestamp key near',
                    incomingEntry.timestamp,
                    '- entry NOT imported:',
                    incomingEntry
                );
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

/**
 * Deep-compares two check-in answers arrays for identical question IDs, scores, and status flags.
 * Used to detect genuine duplicate check-in entries during Smart Merge.
 * @param {Array<Object>} answersA - First answers array.
 * @param {Array<Object>} answersB - Second answers array.
 * @returns {boolean} True if both arrays contain identical answers regardless of order.
 */
export function areEntryAnswersIdentical(answersA, answersB) {
    if (answersA.length !== answersB.length) return false;
    const sortFunction = (firstAnswer, secondAnswer) =>
        firstAnswer.questionId > secondAnswer.questionId ? 1 : -1;
    const sortedAnswersA = [...answersA].sort(sortFunction);
    const sortedAnswersB = [...answersB].sort(sortFunction);
    return sortedAnswersA.every((answerItem, index) =>
        answerItem.questionId === sortedAnswersB[index].questionId &&
        answerItem.score === sortedAnswersB[index].score &&
        answerItem.status === sortedAnswersB[index].status
    );
}

/**
 * Completely erases all user data from the device:
 * - Clears 'entries', 'questions', and 'config' IndexedDB stores in a single atomic transaction.
 * - Clears in-progress Check-In and active view from sessionStorage.
 * - Clears display setting caches from localStorage (handedness, holdDelay, and legacy menuSide).
 * - Re-seeds built-in questions and default active set in IndexedDB.
 * - Does NOT alter service worker registration or runtime asset caches.
 * - Reloads the application into a clean first-run state upon successful completion.
 *
 * @returns {Promise<void>} Resolves when IndexedDB clears, storage resets, and re-seed succeed.
 */
export async function eraseAllData() {
    const database = getDatabase();
    if (!database) {
        throw new Error('Database not initialized for data erasure.');
    }

    // 1. Perform all IndexedDB store clears in ONE single transaction.
    // Never leave a half-erased state: if transaction fails, all data remains intact.
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(['entries', 'questions', 'config'], 'readwrite');
        transaction.onabort = () => {
            reject(transaction.error || new Error('IndexedDB clear transaction was aborted.'));
        };
        transaction.onerror = () => {
            reject(transaction.error || new Error('IndexedDB clear transaction failed.'));
        };
        transaction.oncomplete = () => {
            resolve();
        };

        const entriesStore = transaction.objectStore('entries');
        const questionsStore = transaction.objectStore('questions');
        const configStore = transaction.objectStore('config');

        entriesStore.clear();
        questionsStore.clear();
        configStore.clear();
    });

    // 2. Clear sessionStorage items (in-progress Check-In and view).
    clearActiveCheckin();
    try {
        sessionStorage.removeItem(VIEW_STORAGE_KEY);
    } catch (sessionError) {
        console.warn('Failed to clear active view from sessionStorage:', sessionError);
    }

    // 3. Clear localStorage display caches (handedness, holdDelay, legacy menuSide).
    try {
        localStorage.removeItem('handedness');
        localStorage.removeItem('holdDelay');
        localStorage.removeItem('menuSide');
        localStorage.removeItem('debug-bounds');
    } catch (storageError) {
        console.warn('Failed to clear display caches from localStorage:', storageError);
    }

    // 4. Re-seed built-in questions and default active set.
    await seedDefaults();

    // 5. Reset global in-memory state.
    STATE.currentQuestionIndex = 0;
    STATE.checkinAnswers = [];
    STATE.checkinNote = null;
    try {
        await loadActiveQuestions();
    } catch (loadError) {
        console.warn('Failed to reload active questions after re-seeding:', loadError);
    }

    void updateLastBackupDisplay();

    // 6. Reload into clean first-run state.
    if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
        try {
            window.location.reload();
        } catch {
            // In test environments (e.g. jsdom), location.reload triggers a navigation error
        }
    }
}

/**
 * Formats a value for RFC 4180 CSV output, sanitizing spreadsheet formula injection triggers (=, +, -, @).
 * @param {any} value - The raw cell value.
 * @returns {string} Escaped and sanitized CSV cell string.
 */
export function formatCSVCell(value) {
    if (value === null || value === undefined) {
        return '';
    }

    let stringValue = String(value);
    if (stringValue.length === 0) {
        return '';
    }

    // Neutralize spreadsheet formula injection for values starting with =, +, -, or @
    if (/^[=+\-@]/.test(stringValue)) {
        stringValue = "'" + stringValue;
    }

    // Quote and escape if containing comma, double quote, newline, or leading single-quote
    if (/[",\r\n]/.test(stringValue) || stringValue.startsWith("'")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
}

/**
 * Generates an RFC 4180 CSV string from entries and questions for clinician review.
 * @param {Array<Object>} [entries=[]] - Array of Entry objects.
 * @param {Array<Object>} [questions=[]] - Array of Question objects.
 * @param {Array<string>} [activeQuestionSet=[]] - Ordered array of active question IDs.
 * @returns {string} Formatted CSV file contents.
 */
export function generateHistoryCSV(entries = [], questions = [], activeQuestionSet = []) {
    const questionMap = new Map();
    if (Array.isArray(questions)) {
        for (const question of questions) {
            if (question && question.id) {
                questionMap.set(question.id, question);
            }
        }
    }

    // Collect all question IDs referenced in historical entries
    const historicalQuestionIds = new Set();
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            if (Array.isArray(entry?.answers)) {
                for (const answer of entry.answers) {
                    if (answer?.questionId) {
                        historicalQuestionIds.add(answer.questionId);
                    }
                }
            }
        }
    }

    // Determine ordered list of questions:
    // 1. Active questions in their configured sequence
    // 2. Other non-archived questions from catalog
    // 3. Archived questions that have answers in historical entries
    // 4. Any leftover question IDs referenced in entries that were not found in questions store
    const orderedQuestionList = [];
    const addedQuestionIds = new Set();

    if (Array.isArray(activeQuestionSet)) {
        for (const questionId of activeQuestionSet) {
            if (questionMap.has(questionId) && !addedQuestionIds.has(questionId)) {
                orderedQuestionList.push(questionMap.get(questionId));
                addedQuestionIds.add(questionId);
            }
        }
    }

    if (Array.isArray(questions)) {
        for (const question of questions) {
            if (question && question.id && !addedQuestionIds.has(question.id)) {
                if (!question.archived || historicalQuestionIds.has(question.id)) {
                    orderedQuestionList.push(question);
                    addedQuestionIds.add(question.id);
                }
            }
        }
    }

    for (const questionId of historicalQuestionIds) {
        if (!addedQuestionIds.has(questionId)) {
            const fallbackQuestion = {
                id: questionId,
                shortLabel: questionId,
                text: questionId,
                responseType: 'scale'
            };
            orderedQuestionList.push(fallbackQuestion);
            addedQuestionIds.add(questionId);
        }
    }

    // Build header row: Timestamp, Date, Note, <Question ShortLabels...>
    const headerRowCells = ['Timestamp', 'Date', 'Note'];
    for (const question of orderedQuestionList) {
        const columnHeader = question.shortLabel || question.text || question.id;
        headerRowCells.push(formatCSVCell(columnHeader));
    }

    // Sort entries chronologically ascending
    const sortedEntries = (Array.isArray(entries) ? [...entries] : []).sort((firstEntry, secondEntry) => {
        const firstTime = firstEntry?.timestamp ? new Date(firstEntry.timestamp).getTime() : 0;
        const secondTime = secondEntry?.timestamp ? new Date(secondEntry.timestamp).getTime() : 0;
        return firstTime - secondTime;
    });

    const rows = [headerRowCells.join(',')];

    for (const entry of sortedEntries) {
        if (!entry) continue;

        const timestampCell = formatCSVCell(entry.timestamp || '');
        const dateCell = formatCSVCell(entry.dateString || (entry.timestamp ? entry.timestamp.split('T')[0] : ''));
        const noteCell = formatCSVCell(entry.note || '');

        const entryRowCells = [timestampCell, dateCell, noteCell];

        const answerMap = new Map();
        if (Array.isArray(entry.answers)) {
            for (const answer of entry.answers) {
                if (answer?.questionId) {
                    answerMap.set(answer.questionId, answer);
                }
            }
        }

        for (const question of orderedQuestionList) {
            const answer = answerMap.get(question.id);

            // Not asked (no record in entry.answers)
            if (!answer) {
                entryRowCells.push('');
                continue;
            }

            // Skipped answer (explicitly skipped or score is null/undefined)
            if (answer.status === 'skipped' || answer.score === null || answer.score === undefined) {
                entryRowCells.push('');
                continue;
            }

            // Answered: format based on responseType
            if (question.responseType === 'boolean') {
                if (answer.score === BOOLEAN_YES_SCORE) {
                    entryRowCells.push(formatCSVCell('Yes'));
                } else if (answer.score === BOOLEAN_NO_SCORE) {
                    entryRowCells.push(formatCSVCell('No'));
                } else {
                    entryRowCells.push(formatCSVCell(answer.score));
                }
            } else {
                entryRowCells.push(formatCSVCell(answer.score));
            }
        }

        rows.push(entryRowCells.join(','));
    }

    return rows.join('\r\n');
}

/**
 * Reads all entries and questions from IndexedDB, formats an RFC 4180 CSV history file,
 * and initiates a browser file download for clinician sharing.
 * @returns {Promise<{ csvContent: string, filename: string, rowCount: number } | null>}
 */
export async function exportHistoryCSV() {
    const database = getDatabase();
    if (!database) {
        console.error('Database not initialized for CSV export.');
        return null;
    }

    let entries = [];
    let questions = [];
    let activeQuestionSet = [];

    try {
        entries = await getAll('entries');
        questions = await getAll('questions');
        activeQuestionSet = await getConfig('activeQuestionSet') || [];
    } catch (error) {
        console.error('Failed to load records for CSV export:', error);
        showNoticeDialog(t('data.corruptedTitle'), t('data.corruptedMessage'));
        return null;
    }

    if (!entries || entries.length === 0) {
        showNoticeDialog(t('data.noEntriesToExportTitle'), t('data.noEntriesToExportMessage'));
        return null;
    }

    const csvContent = generateHistoryCSV(entries, questions, activeQuestionSet);
    const exportDate = new Date().toISOString().split('T')[0];
    const filename = `high-and-low-history-${exportDate}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob);
        const anchorLink = document.createElement('a');
        anchorLink.href = url;
        anchorLink.download = filename;
        document.body.appendChild(anchorLink);
        anchorLink.click();
        document.body.removeChild(anchorLink);
        if (typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(url);
        }
    }

    return { csvContent, filename, rowCount: entries.length };
}