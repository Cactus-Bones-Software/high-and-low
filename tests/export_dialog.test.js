import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';

describe('Task 2.18: Export Dialog with Scope Checkboxes Tests', () => {
    let windowInstance;
    let documentInstance;

    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;

        // Seed sample check-in entry for summary count testing
        const sampleEntry = {
            timestamp: '2026-10-15T12:00:00.000Z',
            dateString: '2026-10-15',
            note: 'Calm morning',
            answers: [
                { questionId: 'q_energy', score: 4, status: 'answered' }
            ]
        };
        await windowInstance.put('entries', sampleEntry);
    });

    it('1. Data View Button Layout: keeps primary Back Up Everything button and secondary Choose button', () => {
        const backupAllButton = documentInstance.getElementById('button-export-all');
        const chooseButton = documentInstance.getElementById('button-export-choose');

        expect(backupAllButton).not.toBeNull();
        expect(chooseButton).not.toBeNull();
        expect(backupAllButton.classList.contains('utility-button-primary')).toBe(true);
        expect(backupAllButton.textContent.trim()).toBe('Back Up Everything');
        expect(chooseButton.textContent.trim()).toBe('Choose What to Export…');
    });

    it('2. Modal Accessibility & Defaults: opens on secondary button tap, checked by default, hints accessible',
        async () => {
            const chooseButton = documentInstance.getElementById('button-export-choose');
            const overlay = documentInstance.getElementById('export-dialog-overlay');
            const historyCheckbox = documentInstance.getElementById('export-scope-history');
            const settingsCheckbox = documentInstance.getElementById('export-scope-settings');
            const historyHint = documentInstance.getElementById('export-scope-history-hint');
            const settingsHint = documentInstance.getElementById('export-scope-settings-hint');

            expect(overlay.hasAttribute('inert')).toBe(true);
            expect(overlay.classList.contains('is-open')).toBe(false);

            chooseButton.click();
            await waitFor(() => overlay.classList.contains('is-open'));

            expect(overlay.hasAttribute('inert')).toBe(false);
            expect(overlay.getAttribute('aria-hidden')).toBe('false');

            // Both checkboxes checked by default
            expect(historyCheckbox.checked).toBe(true);
            expect(settingsCheckbox.checked).toBe(true);

            // Hints accessible via aria-describedby
            expect(historyCheckbox.getAttribute('aria-describedby')).toBe('export-scope-history-hint');
            expect(settingsCheckbox.getAttribute('aria-describedby')).toBe('export-scope-settings-hint');
            expect(historyHint.textContent).toContain('Includes all recorded Check-Ins');
            expect(historyHint.textContent).toContain('questions they refer to');
            expect(settingsHint.textContent).toContain('full question catalog');
        });

    it('3. Ordinary Dialog Buttons: buttons do not use hold-to-confirm barrier (Bug 7.1)', () => {
        const exportSubmitButton = documentInstance.getElementById('button-export-submit');
        const exportCancelButton = documentInstance.getElementById('button-export-cancel');

        expect(exportSubmitButton.classList.contains('hold-action')).toBe(false);
        expect(exportCancelButton.classList.contains('hold-action')).toBe(false);
        expect(exportSubmitButton.querySelector('.hold-indicator')).toBeNull();
        expect(exportCancelButton.querySelector('.hold-indicator')).toBeNull();
    });

    it('4. Dynamic Summary Updates: reflects both, history-only, settings-only, and neither', async () => {
        const chooseButton = documentInstance.getElementById('button-export-choose');
        const historyCheckbox = documentInstance.getElementById('export-scope-history');
        const settingsCheckbox = documentInstance.getElementById('export-scope-settings');
        const summaryTextElement = documentInstance.getElementById('export-summary-text');
        const exportSubmitButton = documentInstance.getElementById('button-export-submit');

        chooseButton.click();
        await windowInstance.updateExportSummary();

        const allQuestions = await windowInstance.getAll('questions');
        const questionsCount = allQuestions.length;

        // 1. Both checked: "Everything — 1 Entry & X questions"
        expect(summaryTextElement.textContent).toBe(
            `Everything — 1 Entry & ${questionsCount} questions`
        );
        expect(exportSubmitButton.disabled).toBe(false);

        // 2. History only: "History only — 1 Entry"
        settingsCheckbox.checked = false;
        settingsCheckbox.dispatchEvent(new windowInstance.Event('change'));
        await windowInstance.updateExportSummary();

        expect(summaryTextElement.textContent).toBe('History only — 1 Entry');
        expect(exportSubmitButton.disabled).toBe(false);

        // 3. Neither checked: disabled with visible reason
        historyCheckbox.checked = false;
        historyCheckbox.dispatchEvent(new windowInstance.Event('change'));
        await windowInstance.updateExportSummary();

        expect(exportSubmitButton.disabled).toBe(true);
        expect(summaryTextElement.textContent).toBe('Select at least one scope to export.');
        expect(summaryTextElement.classList.contains('is-empty')).toBe(true);
        expect(exportSubmitButton.getAttribute('aria-describedby')).toBe('export-summary-text');

        // 4. Settings only: "Settings only — X questions & preferences"
        settingsCheckbox.checked = true;
        settingsCheckbox.dispatchEvent(new windowInstance.Event('change'));
        await windowInstance.updateExportSummary();

        expect(exportSubmitButton.disabled).toBe(false);
        expect(summaryTextElement.textContent).toBe(
            `Settings only — ${questionsCount} questions & preferences`
        );
        expect(summaryTextElement.classList.contains('is-empty')).toBe(false);
    });

    it('5. Escape Key: closes modal and returns focus to opener button', async () => {
        const chooseButton = documentInstance.getElementById('button-export-choose');
        const overlay = documentInstance.getElementById('export-dialog-overlay');

        chooseButton.focus();
        chooseButton.click();
        await waitFor(() => overlay.classList.contains('is-open'));

        const escapeKeyboardEvent = new windowInstance.KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true,
            cancelable: true
        });
        overlay.dispatchEvent(escapeKeyboardEvent);

        expect(overlay.classList.contains('is-open')).toBe(false);
        expect(overlay.hasAttribute('inert')).toBe(true);
        expect(documentInstance.activeElement).toBe(chooseButton);
    });

    it('6. Cancel Button: closes modal and returns focus to opener button', async () => {
        const chooseButton = documentInstance.getElementById('button-export-choose');
        const overlay = documentInstance.getElementById('export-dialog-overlay');
        const exportCancelButton = documentInstance.getElementById('button-export-cancel');

        chooseButton.focus();
        chooseButton.click();
        await waitFor(() => overlay.classList.contains('is-open'));

        exportCancelButton.click();

        expect(overlay.classList.contains('is-open')).toBe(false);
        expect(overlay.hasAttribute('inert')).toBe(true);
        expect(documentInstance.activeElement).toBe(chooseButton);
    });

    it('7. Focus Trapping: Tab key wraps within modal dialog', async () => {
        const chooseButton = documentInstance.getElementById('button-export-choose');
        const overlay = documentInstance.getElementById('export-dialog-overlay');
        const historyCheckbox = documentInstance.getElementById('export-scope-history');
        const exportSubmitButton = documentInstance.getElementById('button-export-submit');

        chooseButton.click();
        await waitFor(() => overlay.classList.contains('is-open'));

        // Tab from last element wraps to first element
        exportSubmitButton.focus();
        const tabForwardEvent = new windowInstance.KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: false,
            bubbles: true,
            cancelable: true
        });
        overlay.dispatchEvent(tabForwardEvent);
        expect(documentInstance.activeElement).toBe(historyCheckbox);

        // Shift+Tab from first element wraps to last element
        historyCheckbox.focus();
        const tabBackwardEvent = new windowInstance.KeyboardEvent('keydown', {
            key: 'Tab',
            shiftKey: true,
            bubbles: true,
            cancelable: true
        });
        overlay.dispatchEvent(tabBackwardEvent);
        expect(documentInstance.activeElement).toBe(exportSubmitButton);
    });

    it('8. Export Submission: triggers exportBackup with selected scopes and closes modal', async () => {
        const chooseButton = documentInstance.getElementById('button-export-choose');
        const overlay = documentInstance.getElementById('export-dialog-overlay');
        const settingsCheckbox = documentInstance.getElementById('export-scope-settings');
        const exportSubmitButton = documentInstance.getElementById('button-export-submit');

        const exportBackupSpy = vi.spyOn(windowInstance, 'exportBackup').mockResolvedValue({
            backupData: { scope: ['history'] },
            filename: 'high-and-low-backup-2026-10-15-history-only.json'
        });

        chooseButton.click();
        await waitFor(() => overlay.classList.contains('is-open'));

        // Uncheck settings to make it history-only
        settingsCheckbox.checked = false;
        settingsCheckbox.dispatchEvent(new windowInstance.Event('change'));
        await windowInstance.updateExportSummary();

        exportSubmitButton.click();

        expect(exportBackupSpy).toHaveBeenCalledWith({
            includeHistory: true,
            includeSettings: false
        });
        expect(overlay.classList.contains('is-open')).toBe(false);
        expect(overlay.hasAttribute('inert')).toBe(true);
    });
});
