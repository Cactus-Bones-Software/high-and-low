/**
 * HIGH & LOW - DATA IMPORT / EXPORT (JSON INTERFACE)
 * Backup serialization, JSON file export, and conflict-checked database restore operations.
 */

import { getDatabase, getConfig, setConfig } from './storage/db.js';
import { showNoticeDialog } from "./ui/dialogs.js";
import { t } from './localization.js';
import { SEED_VERSION } from './questions.js';

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