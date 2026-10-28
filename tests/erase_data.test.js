// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import { setIsHoldDelayEnabled } from '../public/js/ui/hold-actions.js';
import { openEraseDialog } from '../public/js/ui/dialogs.js';
import { eraseAllData } from '../public/js/data-io.js';
import { put, setConfig, count, getAll, getConfig, getDatabase } from '../public/js/storage/db.js';
import { DEFAULT_QUESTIONS } from '../public/js/questions.js';
import { STATE } from '../public/js/state.js';

let windowInstance;
let documentInstance;

describe('Erase All Data from Inside the App', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
        setIsHoldDelayEnabled(true);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('positions Erase All Data in a clearly separated section at the bottom of the Data view', () => {
        const panelData = documentInstance.getElementById('panel-data');
        expect(panelData).not.toBeNull();

        const eraseSection = documentInstance.getElementById('section-erase-data');
        expect(eraseSection).not.toBeNull();
        expect(panelData.contains(eraseSection)).toBe(true);

        const eraseButton = documentInstance.getElementById('button-erase-data');
        expect(eraseButton).not.toBeNull();
        expect(eraseSection.contains(eraseButton)).toBe(true);

        const divider = eraseSection.querySelector('.data-danger-divider');
        expect(divider).not.toBeNull();

        const heading = eraseSection.querySelector('.danger-heading');
        expect(heading).not.toBeNull();
        expect(heading.textContent.trim()).toBe('Erase All Data');

        // Verify erase section is positioned below the import zone
        const importZone = documentInstance.querySelector('.file-import-zone');
        expect(importZone).not.toBeNull();
        expect(importZone.compareDocumentPosition(eraseSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('requires a 1500ms hold on button-erase-data when holdDelay is enabled', async () => {
        setIsHoldDelayEnabled(true);

        const eraseButton = documentInstance.getElementById('button-erase-data');
        const overlay = documentInstance.getElementById('erase-dialog-overlay');
        expect(overlay.classList.contains('is-open')).toBe(false);

        // Stray click should NOT open the dialog
        eraseButton.click();
        expect(overlay.classList.contains('is-open')).toBe(false);

        // Start hold
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const pointerDownEvent = new windowInstance.PointerEvent('pointerdown', {
            pointerId: 1,
            button: 0,
            bubbles: true,
            cancelable: true
        });
        eraseButton.dispatchEvent(pointerDownEvent);
        expect(eraseButton.classList.contains('is-holding')).toBe(true);

        // Cancel before 1500ms
        vi.advanceTimersByTime(300);
        const pointerUpEvent = new windowInstance.PointerEvent('pointerup', {
            pointerId: 1,
            button: 0,
            bubbles: true,
            cancelable: true
        });
        eraseButton.dispatchEvent(pointerUpEvent);
        expect(eraseButton.classList.contains('is-holding')).toBe(false);
        expect(overlay.classList.contains('is-open')).toBe(false);

        // Full 1500ms hold opens dialog
        eraseButton.dispatchEvent(pointerDownEvent);
        expect(eraseButton.classList.contains('is-holding')).toBe(true);
        vi.advanceTimersByTime(1850);

        expect(eraseButton.classList.contains('is-holding')).toBe(false);
        expect(overlay.classList.contains('is-open')).toBe(true);
    });

    it('requires a 1500ms hold on button-erase-data even when holdDelay is disabled', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        setIsHoldDelayEnabled(false);

        const eraseButton = documentInstance.getElementById('button-erase-data');
        const overlay = documentInstance.getElementById('erase-dialog-overlay');
        expect(overlay.classList.contains('is-open')).toBe(false);

        // Single stray tap/click MUST NOT trigger or open dialog even when holdDelay setting is disabled
        eraseButton.click();
        expect(overlay.classList.contains('is-open')).toBe(false);

        // Full 1500ms hold MUST still be enforced
        const pointerDownEvent = new windowInstance.PointerEvent('pointerdown', {
            pointerId: 1,
            button: 0,
            bubbles: true,
            cancelable: true
        });
        eraseButton.dispatchEvent(pointerDownEvent);
        expect(eraseButton.classList.contains('is-holding')).toBe(true);

        vi.advanceTimersByTime(1850);
        expect(eraseButton.classList.contains('is-holding')).toBe(false);
        expect(overlay.classList.contains('is-open')).toBe(true);
    });

    it('states plainly what will be erased and offers Back Up First as default focus', async () => {
        openEraseDialog();

        const overlay = documentInstance.getElementById('erase-dialog-overlay');
        expect(overlay.classList.contains('is-open')).toBe(true);

        const backupFirstButton = documentInstance.getElementById('button-erase-backup');
        const cancelButton = documentInstance.getElementById('button-erase-cancel');
        const confirmButton = documentInstance.getElementById('button-erase-confirm');

        expect(backupFirstButton).not.toBeNull();
        expect(cancelButton).not.toBeNull();
        expect(confirmButton).not.toBeNull();

        expect(backupFirstButton.textContent.trim()).toBe('Back Up First');
        expect(cancelButton.textContent.trim()).toBe('Cancel');
        expect(confirmButton.textContent.trim()).toBe('Erase Everything');

        // States plainly what will be erased
        const lossList = overlay.querySelector('.erase-loss-list');
        expect(lossList).not.toBeNull();
        const listItems = Array.from(lossList.querySelectorAll('li')).map(item => item.textContent.trim());
        expect(listItems.some(item => item.includes('Check-In entries'))).toBe(true);
        expect(listItems.some(item => item.includes('custom questions'))).toBe(true);
        expect(listItems.some(item => item.includes('preferences') || item.includes('settings'))).toBe(true);

        // Back Up First is the first, default-focused option
        await waitFor(() => documentInstance.activeElement === backupFirstButton);
        expect(documentInstance.activeElement).toBe(backupFirstButton);
    });

    it('triggers full backup export on Back Up First without immediately closing modal', async () => {
        openEraseDialog();
        const overlay = documentInstance.getElementById('erase-dialog-overlay');
        const backupFirstButton = documentInstance.getElementById('button-erase-backup');

        let exportOptionsPassed = null;
        windowInstance.exportBackup = async (options) => {
            exportOptionsPassed = options;
            return { backupData: {}, filename: 'test-backup.json' };
        };

        backupFirstButton.click();
        await waitFor(() => exportOptionsPassed !== null);

        expect(exportOptionsPassed).toEqual({ includeHistory: true, includeSettings: true });
        // Dialog remains open so user can subsequently cancel or confirm erase
        expect(overlay.classList.contains('is-open')).toBe(true);
    });

    it('dismisses modal without erasing data on Cancel button and Escape key', () => {
        openEraseDialog('button-erase-data');
        const overlay = documentInstance.getElementById('erase-dialog-overlay');
        const cancelButton = documentInstance.getElementById('button-erase-cancel');

        expect(overlay.classList.contains('is-open')).toBe(true);

        cancelButton.click();
        expect(overlay.classList.contains('is-open')).toBe(false);
        expect(overlay.hasAttribute('inert')).toBe(true);

        // Test Escape key dismissal
        openEraseDialog('button-erase-data');
        expect(overlay.classList.contains('is-open')).toBe(true);

        overlay.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(overlay.classList.contains('is-open')).toBe(false);
    });

    it('clears stores, sessionStorage, and localStorage, and re-seeds defaults on erase execution', async () => {
        // Seed sample custom questions and entries
        await put('entries', {
            timestamp: '2026-10-15T12:00:00.000Z',
            answers: [{ questionId: 'mood', score: 4, status: 'answered' }],
            note: 'Feeling good'
        });
        await put('questions', {
            id: 'c_custom1',
            text: 'Custom question?',
            shortLabel: 'Custom',
            responseType: 'scale',
            curve: 'more-is-better',
            tags: ['test'],
            builtIn: false,
            archived: false,
            createdAt: '2026-10-15T12:00:00.000Z',
            updatedAt: '2026-10-15T12:00:00.000Z'
        });
        await setConfig('theme', 'dark');
        await setConfig('handedness', 'left');
        await setConfig('holdDelay', 'disabled');
        await setConfig('lastBackupAt', '2026-10-15T12:00:00.000Z');

        // Populate sessionStorage and localStorage
        windowInstance.sessionStorage.setItem('high_and_low_active_checkin', JSON.stringify({ currentQuestionIndex: 2 }));
        windowInstance.sessionStorage.setItem('high_and_low_active_view', 'history-canvas');
        windowInstance.localStorage.setItem('handedness', 'left');
        windowInstance.localStorage.setItem('holdDelay', 'disabled');
        windowInstance.localStorage.setItem('menuSide', 'left');
        windowInstance.localStorage.setItem('debug-bounds', 'on');

        expect(await count('entries')).toBe(1);
        expect(await count('questions')).toBeGreaterThan(DEFAULT_QUESTIONS.length);

        // Execute eraseAllData
        await eraseAllData();

        // 1. entries store must be empty
        const entriesCount = await count('entries');
        expect(entriesCount).toBe(0);

        // 2. questions store must only contain built-in questions
        const questions = await getAll('questions');
        expect(questions.length).toBe(DEFAULT_QUESTIONS.length);
        expect(questions.every(question => question.builtIn === true)).toBe(true);

        // 3. config store must have activeQuestionSet and seedVersion re-seeded, but custom settings cleared
        const activeQuestionSet = await getConfig('activeQuestionSet');
        expect(Array.isArray(activeQuestionSet)).toBe(true);
        expect(activeQuestionSet.length).toBeGreaterThan(0);
        const seedVersion = await getConfig('seedVersion');
        expect(seedVersion).toBe(DEFAULT_QUESTIONS.length > 0 ? 4 : 0);
        const lastBackupAt = await getConfig('lastBackupAt');
        expect(lastBackupAt).toBeUndefined();

        // 4. sessionStorage must have no in-progress check-in or view
        expect(windowInstance.sessionStorage.getItem('high_and_low_active_checkin')).toBeNull();
        expect(windowInstance.sessionStorage.getItem('high_and_low_active_view')).toBeNull();

        // 5. localStorage display caches must be removed
        expect(windowInstance.localStorage.getItem('handedness')).toBeNull();
        expect(windowInstance.localStorage.getItem('holdDelay')).toBeNull();
        expect(windowInstance.localStorage.getItem('menuSide')).toBeNull();

        // 6. Global in-memory STATE starts at Question 1
        expect(STATE.currentQuestionIndex).toBe(0);
        expect(STATE.checkinAnswers).toEqual([]);
        expect(STATE.checkinNote).toBeNull();
    });

    it('leaves all data intact and triggers notice dialog on failed transaction', async () => {
        // Populate sample data
        await put('entries', {
            timestamp: '2026-10-18T10:00:00.000Z',
            answers: [{ questionId: 'mood', score: 3, status: 'answered' }]
        });
        windowInstance.sessionStorage.setItem('high_and_low_active_checkin', JSON.stringify({ currentQuestionIndex: 1 }));
        windowInstance.localStorage.setItem('handedness', 'left');

        const database = getDatabase();
        const originalTransaction = database.transaction.bind(database);

        // Simulate transaction abort failure
        vi.spyOn(database, 'transaction').mockImplementation((storeNames, mode) => {
            if (Array.isArray(storeNames) && storeNames.includes('entries') && mode === 'readwrite') {
                const transaction = originalTransaction(storeNames, mode);
                transaction.abort();
                return transaction;
            }
            return originalTransaction(storeNames, mode);
        });

        openEraseDialog();
        const confirmButton = documentInstance.getElementById('button-erase-confirm');

        let noticeShown = false;
        windowInstance.showNoticeDialog = (title) => {
            noticeShown = true;
            expect(title).toContain('Erase');
        };

        confirmButton.click();
        await waitFor(() => noticeShown);

        // Transaction failed, so notice dialog was shown
        expect(noticeShown).toBe(true);

        // Data MUST remain intact
        database.transaction.mockRestore();
        const entriesCount = await count('entries');
        expect(entriesCount).toBe(1);
        expect(windowInstance.sessionStorage.getItem('high_and_low_active_checkin')).not.toBeNull();
        expect(windowInstance.localStorage.getItem('handedness')).toBe('left');
    });
});
