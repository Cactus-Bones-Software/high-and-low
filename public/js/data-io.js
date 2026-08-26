/**
 * HIGH & LOW - DATA IMPORT / EXPORT (JSON INTERFACE)
 * Backup serialization, JSON file export, and conflict-checked database restore operations.
 */

import { getDatabase } from './storage/db.js';

export function exportAllDataAndConfig() {
    const database = getDatabase();
    if (!database) {
        console.error('Database not initialized for export.');
        return;
    }

    const backupData = {
        exportVersion: "2.0",
        exportTimestamp: new Date().toISOString(),
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

export function handleFileImport(file, mode) {
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
                if (typeof showNoticeDialog === 'function') {
                    showNoticeDialog('Invalid Backup File', 'The selected file is missing required blueprint structure (entries or configuration).', 'file-import');
                } else if (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function') {
                    window.showNoticeDialog('Invalid Backup File', 'The selected file is missing required blueprint structure (entries or configuration).', 'file-import');
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
            if (typeof showNoticeDialog === 'function') {
                showNoticeDialog('Corrupted File', 'The selected file could not be parsed or contains corrupted data.', 'file-import');
            } else if (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function') {
                window.showNoticeDialog('Corrupted File', 'The selected file could not be parsed or contains corrupted data.', 'file-import');
            }
        }
    };
    reader.readAsText(file);
}

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

export function safelyAddEntryWithCollisionCheck(store, incomingEntry, attempt = 0) {
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

export function areEntryAnswersIdentical(answersA, answersB) {
    if (answersA.length !== answersB.length) return false;
    const sortFunction = (firstAnswer, secondAnswer) => firstAnswer.questionId > secondAnswer.questionId ? 1 : -1;
    const sortedAnswersA = [...answersA].sort(sortFunction);
    const sortedAnswersB = [...answersB].sort(sortFunction);
    return sortedAnswersA.every((answerItem, index) => answerItem.questionId === sortedAnswersB[index].questionId && answerItem.score === sortedAnswersB[index].score && answerItem.status === sortedAnswersB[index].status);
}
