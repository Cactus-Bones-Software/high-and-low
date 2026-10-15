import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM } from './test-utils.js';

describe('Task 2.17: Selective Backup — Data Layer & Scope Model Tests', () => {
    let windowInstance;
    let _documentInstance;

    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        _documentInstance = environment.document;

        // Seed sample question and entry
        const sampleEntry = {
            timestamp: '2026-10-15T12:00:00.000Z',
            dateString: '2026-10-15',
            note: 'Feeling calm',
            answers: [
                { questionId: 'q_energy', score: 4, status: 'answered' }
            ]
        };
        await windowInstance.put('entries', sampleEntry);
    });

    it('1. Full Export: includes history and settings, allowlisted config, and full filename suffix', async () => {
        const { backupData, filename } = await windowInstance.exportBackup({
            includeHistory: true,
            includeSettings: true
        });

        expect(backupData.exportVersion).toBe('2.0');
        expect(backupData.scope).toEqual(['history', 'settings']);
        expect(filename).toMatch(/^high-and-low-backup-\d{4}-\d{2}-\d{2}-full\.json$/);

        // Entries present
        expect(backupData.entries.length).toBeGreaterThan(0);

        // All questions present
        const allQuestions = await windowInstance.getAll('questions');
        expect(backupData.questions.length).toBe(allQuestions.length);

        // Config contains allowlisted keys only
        for (const configItem of backupData.config) {
            expect(windowInstance.EXPORTABLE_CONFIG_KEYS).toContain(configItem.key);
            expect(configItem.key).not.toBe('seedVersion');
            expect(configItem.key).not.toBe('lastBackupAt');
        }

        // Updates lastBackupAt
        const storedLastBackup = await windowInstance.getConfig('lastBackupAt');
        expect(storedLastBackup).toBeDefined();
        expect(storedLastBackup).toBe(backupData.exportTimestamp);
    });

    it('2. History-Only Export: contains entries and referenced questions, empty config, and updates lastBackupAt',
        async () => {
            // Create an unreferenced custom question to verify filtering
            const unreferencedQuestion = {
                id: 'c_unreferenced_test',
                originalText: 'Unreferenced test question?',
                text: 'Unreferenced test question?',
                shortLabel: 'Unreferenced',
                tags: ['Test'],
                responseType: 'scale',
                curve: 'more-is-better',
                minLabel: null,
                midLabel: null,
                maxLabel: null,
                archived: false,
                createdAt: '2026-10-15T10:00:00.000Z',
                updatedAt: '2026-10-15T10:00:00.000Z'
            };
            await windowInstance.put('questions', unreferencedQuestion);

            const { backupData, filename } = await windowInstance.exportBackup({
                includeHistory: true,
                includeSettings: false
            });

            expect(backupData.exportVersion).toBe('2.0');
            expect(backupData.scope).toEqual(['history']);
            expect(filename).toMatch(/^high-and-low-backup-\d{4}-\d{2}-\d{2}-history-only\.json$/);

            // Entries present
            expect(backupData.entries.length).toBeGreaterThan(0);

            // Questions only includes questions referenced by entries (q_energy), NOT c_unreferenced_test
            const exportedQuestionIds = backupData.questions.map(question => question.id);
            expect(exportedQuestionIds).toContain('q_energy');
            expect(exportedQuestionIds).not.toContain('c_unreferenced_test');

            // Config is empty array
            expect(backupData.config).toEqual([]);

            // Updates lastBackupAt
            const storedLastBackup = await windowInstance.getConfig('lastBackupAt');
            expect(storedLastBackup).toBe(backupData.exportTimestamp);
        });

    it('3. Settings-Only Export: contains questions and config, empty entries, and does not update lastBackupAt',
        async () => {
            // Clear any previous lastBackupAt
            await windowInstance.deleteConfig('lastBackupAt');

            const { backupData, filename } = await windowInstance.exportBackup({
                includeHistory: false,
                includeSettings: true
            });

            expect(backupData.exportVersion).toBe('2.0');
            expect(backupData.scope).toEqual(['settings']);
            expect(filename).toMatch(/^high-and-low-backup-\d{4}-\d{2}-\d{2}-settings-only\.json$/);

            // Entries must be empty
            expect(backupData.entries).toEqual([]);

            // All questions in library present
            const allQuestions = await windowInstance.getAll('questions');
            expect(backupData.questions.length).toBe(allQuestions.length);

            // Config present and filtered
            expect(backupData.config.length).toBeGreaterThan(0);
            for (const configItem of backupData.config) {
                expect(windowInstance.EXPORTABLE_CONFIG_KEYS).toContain(configItem.key);
                expect(configItem.key).not.toBe('seedVersion');
                expect(configItem.key).not.toBe('lastBackupAt');
            }

            // Coordinate with Task 2.15: Settings-only does NOT update lastBackupAt
            const storedLastBackup = await windowInstance.getConfig('lastBackupAt');
            expect(storedLastBackup).toBeUndefined();
        });

    it('4. Scope Validation: rejects if neither history nor settings is selected', async () => {
        await expect(
            windowInstance.exportBackup({ includeHistory: false, includeSettings: false })
        ).rejects.toThrow(/at least one export scope must be selected/i);
    });

    it('5. Default Export Invocation: exportBackup() without arguments defaults to full backup', async () => {
        const { backupData, filename } = await windowInstance.exportBackup();
        expect(backupData.scope).toEqual(['history', 'settings']);
        expect(filename).toMatch(/-full\.json$/);
        expect(backupData.entries.length).toBeGreaterThan(0);
        expect(backupData.questions.length).toBeGreaterThan(0);
    });

    it('6. exportAllDataAndConfig Preservation: delegates to full exportBackup', async () => {
        const { backupData, filename } = await windowInstance.exportAllDataAndConfig();
        expect(backupData.scope).toEqual(['history', 'settings']);
        expect(filename).toMatch(/-full\.json$/);
    });
});
