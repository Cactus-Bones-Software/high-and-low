/**
 * HIGH & LOW - DATA IMPORT / EXPORT (JSON INTERFACE)
 * Backup serialization, JSON file export, and conflict-checked database restore operations.
 */

import { getDatabase, getConfig, setConfig } from './storage/db.js';
import { showNoticeDialog } from "./ui/dialogs.js";
import { t } from './localization.js';

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

/**
 * Serializes the entire IndexedDB database ('config', 'questions', and 'entries' stores)
 * into a JSON backup file and triggers a browser download.
 * Produces a full schema 2.0 export containing all records, including archived questions.
 * Writes `lastBackupAt` to the config store after a successful export and updates UI.
 * @returns {Promise<void>} Resolves when export serialization and storage updates complete.
 */
export function exportAllDataAndConfig() {
    const database = getDatabase();
    if (!database) {
        console.error('Database not initialized for export.');
        return Promise.resolve();
    }

    const exportTimestamp = new Date().toISOString();
    const backupData = {
        exportVersion: "2.0",
        exportTimestamp,
        config: [],
        questions: [],
        entries: []
    };
    const transaction = database.transaction(['config', 'questions', 'entries'], 'readonly');

    transaction.objectStore('config').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            backupData.config.push(cursor.value);
            cursor.continue();
        }
    };
    transaction.objectStore('questions').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            backupData.questions.push(cursor.value);
            cursor.continue();
        }
    };
    transaction.objectStore('entries').openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            backupData.entries.push(cursor.value);
            cursor.continue();
        }
    };
    return new Promise((resolve) => {
        transaction.oncomplete = async () => {
            const existingConfigIndex = backupData.config.findIndex(item => item.key === 'lastBackupAt');
            if (existingConfigIndex >= 0) {
                backupData.config[existingConfigIndex] = { key: 'lastBackupAt', value: exportTimestamp };
            } else {
                backupData.config.push({ key: 'lastBackupAt', value: exportTimestamp });
            }

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                const url = URL.createObjectURL(blob);
                const anchorLink = document.createElement('a');
                anchorLink.href = url;
                anchorLink.download = `high-and-low-backup-${exportTimestamp.split('T')[0]}.json`;
                document.body.appendChild(anchorLink);
                anchorLink.click();
                document.body.removeChild(anchorLink);
                if (typeof URL.revokeObjectURL === 'function') {
                    URL.revokeObjectURL(url);
                }
            }

            try {
                await setConfig('lastBackupAt', exportTimestamp);
                await updateLastBackupDisplay();
            } catch (error) {
                console.error('Failed to record lastBackupAt after export:', error);
            }
            resolve();
        };
    });
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
 * Handles FileReader load event, validates backup JSON structure, and executes database writes.
 * Reloads the browser tab on successful completion to re-initialize application state.
 * @param {'replace' | 'merge'} mode - Import strategy ('replace' or 'merge').
 * @param {ProgressEvent<FileReader>} event - FileReader load event containing the raw file text.
 * @returns {void}
 */
function handleFileImportReaderLoad(mode, event) {
    const result = event.target.result;
    if (typeof result !== 'string') {
        console.error("Invalid file format read. Expected text.");
        return;
    }
    try {
        const importedData = JSON.parse(result);
        if (!importedData.entries || !importedData.config) {
            if (typeof showNoticeDialog === 'function') {
                showNoticeDialog(
                    t('data.invalidBackupTitle'),
                    t('data.invalidBackupMessage'),
                    'file-import'
                );
            } else if (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function') {
                window.showNoticeDialog(
                    t('data.invalidBackupTitle'),
                    t('data.invalidBackupMessage'),
                    'file-import'
                );
            }
            return;
        }
        const importedQuestions = Array.isArray(importedData.questions) ? importedData.questions : [];

        const database = getDatabase();
        if (!database) {
            console.error('Database not initialized for import.');
            return;
        }
        const transaction = database.transaction(['config', 'questions', 'entries'], 'readwrite');
        const configStore = transaction.objectStore('config');
        const questionStore = transaction.objectStore('questions');
        const entryStore = transaction.objectStore('entries');

        if (mode === 'replace') {
            configStore.clear();
            questionStore.clear();
            entryStore.clear();
            for (const configItem of importedData.config) {
                configStore.add(configItem);
            }
            for (const questionItem of importedQuestions) {
                questionStore.add(questionItem);
            }
            for (const entryItem of importedData.entries) {
                entryStore.add(entryItem);
            }
        } else {
            for (const configItem of importedData.config) {
                configStore.put(configItem);
            }
            for (const questionItem of importedQuestions) {
                mergeQuestionWithConflictCheck(questionStore, questionItem);
            }
            for (const entryItem of importedData.entries) {
                safelyAddEntryWithCollisionCheck(entryStore, entryItem);
            }
        }
        transaction.oncomplete = () => window.location.reload();
    } catch (error) {
        console.error('File import failed:', error);
        if (typeof showNoticeDialog === 'function') {
            showNoticeDialog(
                t('data.corruptedTitle'),
                t('data.corruptedMessage'),
                'file-import'
            );
        } else if (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function') {
            window.showNoticeDialog(
                t('data.corruptedTitle'),
                t('data.corruptedMessage'),
                'file-import'
            );
        }
    }
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