import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM } from './test-utils.js';
import {
    validateBackupPayload,
    detectBackupScopes,
    exportBackup,
    executeBackupImport,
    handleFileImportReaderLoad
} from '../public/js/data-io.js';
import { put, setConfig, getDatabase, getAll, get, getConfig } from '../public/js/storage/db.js';
import { applyImportScopeToDialog } from '../public/js/ui/dialogs.js';

describe('Import Partial Backups Safely', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('accepts valid full backups and partial backups with at least one store array', () => {
        const validate = validateBackupPayload;

        // Valid full backup
        expect(validate({ exportVersion: '2.0', config: [], questions: [], entries: [] }).isValid).toBe(true);

        // Valid legacy 1.0 backup
        expect(validate({ exportVersion: '1.0', config: [], questions: [], entries: [] }).isValid).toBe(true);

        // Valid history-only backup (entries and questions, no config)
        expect(validate({
            exportVersion: '2.0',
            entries: [{ timestamp: '2026-10-10T10:00:00Z', answers: [] }]
        }).isValid).toBe(true);

        // Valid settings-only backup (config and questions, no entries)
        expect(validate({ exportVersion: '2.0', config: [{ key: 'theme', value: 'dark' }] }).isValid).toBe(true);

        // Valid empty-array backup (entries present as empty array)
        expect(validate({ exportVersion: '2.0', entries: [] }).isValid).toBe(true);

        // Valid empty-array backup (questions only)
        expect(validate({ exportVersion: '2.0', questions: [] }).isValid).toBe(true);
    });

    it('rejects unrecognized exportVersion, non-object, and missing stores', () => {
        const validate = validateBackupPayload;

        // Unrecognized exportVersion
        expect(validate({ exportVersion: '99.0', entries: [] }).isValid).toBe(false);
        expect(validate({ exportVersion: '3.0', config: [] }).isValid).toBe(false);

        // Missing exportVersion
        expect(validate({ entries: [] }).isValid).toBe(false);

        // Non-object or null
        expect(validate(null).isValid).toBe(false);
        expect(validate('string payload').isValid).toBe(false);
        expect(validate([]).isValid).toBe(false);

        // No store array present
        expect(validate({ exportVersion: '2.0' }).isValid).toBe(false);
        expect(validate({ exportVersion: '2.0', entries: 'not an array' }).isValid).toBe(false);
    });

    it('accurately determines history and settings presence during scope detection', () => {
        const detect = detectBackupScopes;

        // Explicit scope array (Task 2.17 convention)
        expect(detect({ scope: ['history', 'settings'], entries: [], config: [] })).toEqual({
            containsHistory: true,
            containsSettings: true
        });
        expect(detect({ scope: ['history'], entries: [], questions: [] })).toEqual({
            containsHistory: true,
            containsSettings: false
        });
        expect(detect({ scope: ['settings'], questions: [], config: [] })).toEqual({
            containsHistory: false,
            containsSettings: true
        });

        // Inferred from arrays for legacy backups
        expect(detect({ entries: [], config: [] })).toEqual({
            containsHistory: true,
            containsSettings: true
        });
        expect(detect({ entries: [] })).toEqual({
            containsHistory: true,
            containsSettings: false
        });
        expect(detect({ config: [] })).toEqual({
            containsHistory: false,
            containsSettings: true
        });
    });

    it('restores entries, questions, and settings completely on full backup round-trip', async () => {
        // Populate initial check-in entry
        const entryStore = 'entries';
        const sampleEntry = {
            timestamp: '2026-10-18T10:00:00.000Z',
            answers: [{ questionId: 'q_energy', score: 4, status: 'answered' }],
            note: 'Feeling energetic'
        };
        await put(entryStore, sampleEntry);

        // Customize a question
        const customizedQuestion = {
            id: 'custom_roundtrip_q',
            text: 'How focused were you today?',
            shortLabel: 'Focus Level',
            responseType: 'scale',
            tags: ['mind'],
            archived: false,
            createdAt: '2026-10-18T09:00:00.000Z',
            updatedAt: '2026-10-18T09:00:00.000Z'
        };
        await put('questions', customizedQuestion);

        // Set custom config
        await setConfig('theme', 'light');

        // Export full backup
        const { backupData } = await exportBackup({ includeHistory: true, includeSettings: true });

        // Modify local state to verify restore overwrites
        await setConfig('theme', 'dark');
        const database = getDatabase();
        const clearTransaction = database.transaction(['entries', 'questions'], 'readwrite');
        clearTransaction.objectStore('entries').clear();
        clearTransaction.objectStore('questions').clear();
        await new Promise(resolve => { clearTransaction.oncomplete = resolve; });

        // Execute Wipe & Replace with the exported backup
        await executeBackupImport(backupData, 'replace');

        // Verify entries restored
        const restoredEntries = await getAll('entries');
        expect(restoredEntries.length).toBe(1);
        expect(restoredEntries[0].timestamp).toBe(sampleEntry.timestamp);
        expect(restoredEntries[0].note).toBe('Feeling energetic');

        // Verify questions restored
        const restoredCustomQuestion = await get('questions', 'custom_roundtrip_q');
        expect(restoredCustomQuestion).toBeDefined();
        expect(restoredCustomQuestion.text).toBe(customizedQuestion.text);

        // Verify settings restored
        const restoredTheme = await getConfig('theme');
        expect(restoredTheme).toBe('light');
    });

    it('wipes history but preserves settings on history-only import into populated device (replace mode)', async () => {
        // Device starts with existing history entry A
        await put('entries', {
            timestamp: '2026-10-01T12:00:00.000Z',
            answers: [{ questionId: 'q_energy', score: 2, status: 'answered' }]
        });

        // Device has tailored activeQuestionSet and theme
        const customActiveSet = ['q_clarity', 'q_connection'];
        await setConfig('activeQuestionSet', customActiveSet);
        await setConfig('theme', 'light');

        // Incoming history-only backup has entry B
        const historyOnlyBackup = {
            exportVersion: '2.0',
            scope: ['history'],
            entries: [{
                timestamp: '2026-10-15T15:00:00.000Z',
                answers: [{ questionId: 'q_clarity', score: 5, status: 'answered' }]
            }],
            questions: [{
                id: 'q_clarity',
                text: 'How clear is your thinking?',
                shortLabel: 'Clarity',
                responseType: 'scale',
                tags: ['clarity'],
                archived: false,
                createdAt: '2026-10-01T00:00:00.000Z',
                updatedAt: '2026-10-01T00:00:00.000Z'
            }],
            config: []
        };

        // Import in replace mode
        await executeBackupImport(historyOnlyBackup, 'replace');

        // History entry A must be erased, and entry B present
        const currentEntries = await getAll('entries');
        expect(currentEntries.length).toBe(1);
        expect(currentEntries[0].timestamp).toBe('2026-10-15T15:00:00.000Z');

        // Settings must NOT be wiped or reset!
        const currentActiveSet = await getConfig('activeQuestionSet');
        expect(currentActiveSet).toEqual(customActiveSet);
        const currentTheme = await getConfig('theme');
        expect(currentTheme).toBe('light');
    });

    it('replaces settings but never erases history on settings-only import into populated device (replace mode)', async () => {
        // Device starts with valuable check-in history
        const localEntry = {
            timestamp: '2026-10-05T08:30:00.000Z',
            answers: [{ questionId: 'q_energy', score: 3, status: 'answered' }],
            note: 'Important historical note'
        };
        await put('entries', localEntry);

        // Incoming settings-only backup
        const settingsOnlyBackup = {
            exportVersion: '2.0',
            scope: ['settings'],
            entries: [],
            questions: [{
                id: 'imported_custom_question',
                text: 'How calm do you feel?',
                shortLabel: 'Calmness',
                responseType: 'scale',
                tags: ['calm'],
                archived: false,
                createdAt: '2026-10-10T00:00:00.000Z',
                updatedAt: '2026-10-10T00:00:00.000Z'
            }],
            config: [
                { key: 'theme', value: 'light' },
                { key: 'activeQuestionSet', value: ['imported_custom_question'] }
            ]
        };

        // Import in replace mode
        await executeBackupImport(settingsOnlyBackup, 'replace');

        // User's check-in history must be 100% intact!
        const currentEntries = await getAll('entries');
        expect(currentEntries.length).toBe(1);
        expect(currentEntries[0].timestamp).toBe(localEntry.timestamp);
        expect(currentEntries[0].note).toBe('Important historical note');

        // Settings and question catalog replaced
        const currentTheme = await getConfig('theme');
        expect(currentTheme).toBe('light');
        const currentActiveSet = await getConfig('activeQuestionSet');
        expect(currentActiveSet).toEqual(['imported_custom_question']);
        const importedQuestion = await get('questions', 'imported_custom_question');
        expect(importedQuestion).toBeDefined();
    });

    it('brings referenced questions into questions store to prevent orphans on history-only import', async () => {
        // Device does NOT have custom_clinician_q
        const existing = await get('questions', 'custom_clinician_q');
        expect(existing).toBeUndefined();

        const historyBackupWithQuestion = {
            exportVersion: '2.0',
            scope: ['history'],
            entries: [{
                timestamp: '2026-10-12T11:00:00.000Z',
                answers: [{ questionId: 'custom_clinician_q', score: 4, status: 'answered' }]
            }],
            questions: [{
                id: 'custom_clinician_q',
                text: 'Custom Clinician Question',
                shortLabel: 'Clinician Q',
                responseType: 'scale',
                tags: ['custom'],
                archived: false,
                createdAt: '2026-10-01T00:00:00.000Z',
                updatedAt: '2026-10-01T00:00:00.000Z'
            }],
            config: []
        };

        // Import in merge mode
        await executeBackupImport(historyBackupWithQuestion, 'merge');

        // Question must now exist in questions store
        const importedQuestion = await get('questions', 'custom_clinician_q');
        expect(importedQuestion).toBeDefined();
        expect(importedQuestion.shortLabel).toBe('Clinician Q');

        // Answer resolves properly
        const entries = await getAll('entries');
        const entry = entries.find(item => item.timestamp === '2026-10-12T11:00:00.000Z');
        expect(entry).toBeDefined();
        expect(entry.answers[0].questionId).toBe(importedQuestion.id);
    });

    it('ignores device-specific keys (seedVersion and lastBackupAt) on import', async () => {
        const initialSeed = await getConfig('seedVersion');
        expect(initialSeed).toBeDefined();

        await setConfig('lastBackupAt', '2026-10-17T00:00:00.000Z');

        const maliciousOldBackup = {
            exportVersion: '2.0',
            scope: ['history', 'settings'],
            config: [
                { key: 'seedVersion', value: 999 },
                { key: 'lastBackupAt', value: '2019-01-01T00:00:00.000Z' },
                { key: 'theme', value: 'light' }
            ],
            questions: [],
            entries: []
        };

        await executeBackupImport(maliciousOldBackup, 'replace');

        const finalSeed = await getConfig('seedVersion');
        expect(finalSeed).not.toBe(999);

        const finalLastBackup = await getConfig('lastBackupAt');
        expect(finalLastBackup).not.toBe('2019-01-01T00:00:00.000Z');
        expect(finalLastBackup).toBe('2026-10-17T00:00:00.000Z');
    });

    it('displays detected scope and updates Wipe & Replace wording in import dialog UI', () => {
        const dialogOverlay = documentInstance.getElementById('import-dialog-overlay');
        const contentsBadge = documentInstance.getElementById('import-file-contents');
        const replaceDescription = documentInstance.getElementById('import-replace-text');

        expect(dialogOverlay).not.toBeNull();
        expect(contentsBadge).not.toBeNull();
        expect(replaceDescription).not.toBeNull();

        // 1. Settings only
        applyImportScopeToDialog({
            exportVersion: '2.0',
            scope: ['settings'],
            config: [{ key: 'theme', value: 'dark' }],
            questions: []
        });
        expect(contentsBadge.textContent).toBe('Settings only');
        expect(replaceDescription.textContent.toLowerCase()).toContain('settings');
        expect(replaceDescription.textContent.toLowerCase()).toContain('history is kept');

        // 2. History only
        applyImportScopeToDialog({
            exportVersion: '2.0',
            scope: ['history'],
            entries: [{ timestamp: '2026-10-10T00:00:00Z', answers: [] }],
            questions: []
        });
        expect(contentsBadge.textContent).toBe('History only');
        expect(replaceDescription.textContent.toLowerCase()).toContain('check-in');
        expect(replaceDescription.textContent.toLowerCase()).toContain('settings are kept');

        // 3. Both (Full)
        applyImportScopeToDialog({
            exportVersion: '2.0',
            scope: ['history', 'settings'],
            entries: [],
            config: []
        });
        expect(contentsBadge.textContent).toBe('History & settings');
        expect(replaceDescription.textContent.toLowerCase()).toContain('all local records');
    });

    it('triggers notice dialog on malformed JSON and corrupted files', () => {
        let noticeShown = false;
        let noticeTitle = '';
        let noticeMessage = '';

        windowInstance.showNoticeDialog = (title, message) => {
            noticeShown = true;
            noticeTitle = title;
            noticeMessage = message;
        };

        // Simulate malformed JSON event
        handleFileImportReaderLoad('merge', {
            target: { result: '{ invalid json' }
        });
        expect(noticeShown).toBe(true);
        expect(noticeTitle.toLowerCase()).toContain('corrupted');
        expect(noticeMessage.length).toBeGreaterThan(0);

        // Simulate invalid blueprint event (no store arrays)
        noticeShown = false;
        handleFileImportReaderLoad('merge', {
            target: { result: JSON.stringify({ exportVersion: '2.0' }) }
        });
        expect(noticeShown).toBe(true);
        expect(noticeTitle.toLowerCase()).toContain('invalid');
        expect(noticeMessage.length).toBeGreaterThan(0);
    });
});
