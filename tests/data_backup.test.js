import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM } from './test-utils.js';

describe('Task 2.15: Last-Backup Indicator in the Data View Tests', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('1. Canvas Structure: last-backup-display exists in #panel-data inside #data-canvas', () => {
        const dataCanvas = documentInstance.getElementById('data-canvas');
        expect(dataCanvas).not.toBeNull();

        const panelData = documentInstance.getElementById('panel-data');
        expect(panelData).not.toBeNull();

        const backupIndicator = documentInstance.getElementById('last-backup-display');
        expect(backupIndicator).not.toBeNull();
        expect(panelData.contains(backupIndicator)).toBe(true);
        expect(backupIndicator.classList.contains('last-backup-indicator')).toBe(true);
    });

    it('2. Default State: displays "No backup yet" when lastBackupAt is not configured', async () => {
        const backupIndicator = documentInstance.getElementById('last-backup-display');
        expect(backupIndicator.textContent.trim()).toBe('No backup yet');

        // Confirm database config store does not have lastBackupAt
        const storedLastBackup = await windowInstance.getConfig('lastBackupAt');
        expect(storedLastBackup).toBeUndefined();
    });

    it('3. Navigation: navigating to data-canvas updates indicator from stored lastBackupAt', async () => {
        const sampleTimestamp = '2026-10-12T14:30:00.000Z';
        await windowInstance.setConfig('lastBackupAt', sampleTimestamp);

        const expectedDate = windowInstance.formatBackupDate(sampleTimestamp);
        expect(expectedDate).toBeTruthy();

        // Navigate to Data canvas
        windowInstance.navigateTo('data-canvas');
        await windowInstance.updateLastBackupDisplay();

        const backupIndicator = documentInstance.getElementById('last-backup-display');
        expect(backupIndicator.textContent.trim()).toBe(`Last backup: ${expectedDate}`);
    });

    it('4. Null Handling: displays "No backup yet" if lastBackupAt is explicitly set to null', async () => {
        await windowInstance.setConfig('lastBackupAt', null);

        await windowInstance.updateLastBackupDisplay();

        const backupIndicator = documentInstance.getElementById('last-backup-display');
        expect(backupIndicator.textContent.trim()).toBe('No backup yet');
    });

    it('5. Export Flow: exportAllDataAndConfig writes lastBackupAt and updates the indicator', async () => {
        const backupIndicator = documentInstance.getElementById('last-backup-display');
        expect(backupIndicator.textContent.trim()).toBe('No backup yet');

        // Execute full export
        await windowInstance.exportAllDataAndConfig();

        const storedLastBackup = await windowInstance.getConfig('lastBackupAt');
        expect(storedLastBackup).toBeDefined();
        expect(typeof storedLastBackup).toBe('string');

        // Validate timestamp is a valid ISO-8601 string
        const parsedDate = new Date(storedLastBackup);
        expect(Number.isNaN(parsedDate.getTime())).toBe(false);

        // Verify indicator reflects the newly recorded backup
        const expectedDate = windowInstance.formatBackupDate(storedLastBackup);
        expect(backupIndicator.textContent.trim()).toBe(`Last backup: ${expectedDate}`);
    });

    it('6. Export File Content: excludes device-specific keys (lastBackupAt, seedVersion) from config', async () => {
        let exportedBlob = null;
        const originalWindowCreateObjectURL = windowInstance.URL.createObjectURL;
        const originalGlobalCreateObjectURL = global.URL ? global.URL.createObjectURL : undefined;

        const mockCreateObjectURL = (blob) => {
            exportedBlob = blob;
            return 'blob:mock-url';
        };

        windowInstance.URL.createObjectURL = mockCreateObjectURL;
        if (global.URL) {
            global.URL.createObjectURL = mockCreateObjectURL;
        }

        try {
            await windowInstance.exportAllDataAndConfig();
            expect(exportedBlob).not.toBeNull();

            const exportedJSONString = await exportedBlob.text();
            const exportedPayload = JSON.parse(exportedJSONString);
            expect(exportedPayload.exportVersion).toBe('2.0');
            expect(exportedPayload.exportTimestamp).toBeDefined();

            // Config array must NOT contain lastBackupAt or seedVersion per Task 2.17 allowlist
            const lastBackupConfigItem = exportedPayload.config.find(item => item.key === 'lastBackupAt');
            expect(lastBackupConfigItem).toBeUndefined();
            const seedVersionConfigItem = exportedPayload.config.find(item => item.key === 'seedVersion');
            expect(seedVersionConfigItem).toBeUndefined();
        } finally {
            windowInstance.URL.createObjectURL = originalWindowCreateObjectURL;
            if (global.URL && originalGlobalCreateObjectURL) {
                global.URL.createObjectURL = originalGlobalCreateObjectURL;
            }
        }
    });

    it('7. Backward Compatibility: importing older backup without lastBackupAt does not fail', async () => {
        const legacyBackup = {
            exportVersion: '1.0',
            exportTimestamp: '2026-08-01T10:00:00.000Z',
            config: [
                { key: 'theme', value: 'dark' },
                { key: 'contrast', value: 'standard' }
            ],
            questions: [],
            entries: []
        };

        // Populate database with legacy backup records
        const database = windowInstance.getDatabase ? windowInstance.getDatabase() : null;
        expect(database).not.toBeNull();

        const transaction = database.transaction(['config', 'questions', 'entries'], 'readwrite');
        const configStore = transaction.objectStore('config');
        configStore.clear();

        for (const configItem of legacyBackup.config) {
            configStore.add(configItem);
        }

        await new Promise(resolve => {
            transaction.oncomplete = resolve;
        });

        // Verify lastBackupAt is undefined in legacy backup
        const storedLastBackup = await windowInstance.getConfig('lastBackupAt');
        expect(storedLastBackup).toBeUndefined();

        await windowInstance.updateLastBackupDisplay();
        const backupIndicator = documentInstance.getElementById('last-backup-display');
        expect(backupIndicator.textContent.trim()).toBe('No backup yet');
    });

    it('8. Two Energy Modes: tracker canvas has zero backup banners, badges, or reminders', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        expect(trackerCanvas).not.toBeNull();

        // Tracker canvas should never contain backup text or warnings
        const trackerText = trackerCanvas.textContent.toLowerCase();
        expect(trackerText).not.toContain('backup');
        expect(trackerText).not.toContain('stale');
        expect(trackerCanvas.querySelector('.last-backup-indicator')).toBeNull();
    });

    it('9. Terminology Compliance: Data view copy does not contain forbidden terms', () => {
        const dataCanvas = documentInstance.getElementById('data-canvas');
        expect(dataCanvas).not.toBeNull();

        const dataCanvasText = dataCanvas.textContent.toLowerCase();
        // Forbidden terms per docs/decisions.md: "Session", "Quiz", "Test", "Log"
        expect(dataCanvasText).not.toMatch(/\bsession\b/);
        expect(dataCanvasText).not.toMatch(/\bquiz\b/);
        expect(dataCanvasText).not.toMatch(/\btest\b/);
        expect(dataCanvasText).not.toMatch(/\blog\b/);
    });
});
