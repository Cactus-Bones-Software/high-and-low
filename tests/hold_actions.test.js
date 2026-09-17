// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, sleep, dispatchContextMenuEvent } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

describe('Hold-To-Confirm Actions & Mobile Touch Compatibility', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('prevents default on contextmenu event for all .hold-action buttons', () => {
        const holdButtons = Array.from(documentInstance.querySelectorAll('.hold-action'));
        expect(holdButtons.length).toBeGreaterThan(0);

        holdButtons.forEach(button => {
            const contextMenuEvent = dispatchContextMenuEvent(windowInstance, button);
            expect(contextMenuEvent.defaultPrevented).toBe(true);
        });
    });

    it('Wipe & Replace button (#button-import-replace) executes after 1500ms hold', async () => {
        const replaceButton = documentInstance.getElementById('button-import-replace');
        expect(replaceButton).not.toBeNull();

        // Pointerdown starts hold
        const pointerDownEvent = new windowInstance.PointerEvent('pointerdown', {
            pointerId: 1,
            button: 0,
            bubbles: true,
            cancelable: true
        });
        replaceButton.dispatchEvent(pointerDownEvent);

        expect(replaceButton.classList.contains('is-holding')).toBe(true);

        // Simulate contextmenu event during hold (mobile long press)
        const contextMenuEvent = dispatchContextMenuEvent(windowInstance, replaceButton);
        expect(contextMenuEvent.defaultPrevented).toBe(true);

        // Holding should still be active
        expect(replaceButton.classList.contains('is-holding')).toBe(true);

        // Wait for 1500ms hold timer to complete
        await sleep(1600);

        expect(replaceButton.classList.contains('is-holding')).toBe(false);
    });

    it('activates hidden file-import input when #button-import is clicked and maintains a11y attributes', () => {
        const importButton = documentInstance.getElementById('button-import');
        const fileImportInput = documentInstance.getElementById('file-import');

        expect(importButton).not.toBeNull();
        expect(fileImportInput).not.toBeNull();

        // Accessible configuration
        expect(importButton.getAttribute('type')).toBe('button');
        expect(importButton.getAttribute('aria-label')).toBe('Import Backup File');
        expect(fileImportInput.getAttribute('tabindex')).toBe('-1');
        expect(fileImportInput.getAttribute('aria-hidden')).toBe('true');

        let clickTriggered = false;
        fileImportInput.click = () => {
            clickTriggered = true;
        };

        importButton.click();
        expect(clickTriggered).toBe(true);
    });

    it('opens import dialog when file is dropped on .file-import-zone', () => {
        const importZone = documentInstance.querySelector('.file-import-zone');
        expect(importZone).not.toBeNull();

        const dummyFile = new windowInstance.File(
            [JSON.stringify({ exportVersion: '2.0', config: [], questions: [], entries: [] })],
            'test-backup.json',
            { type: 'application/json' }
        );

        const dropEvent = new windowInstance.Event('drop', { bubbles: true, cancelable: true });
        Object.defineProperty(dropEvent, 'dataTransfer', {
            value: {
                files: [dummyFile]
            }
        });

        importZone.dispatchEvent(dropEvent);

        const importOverlay = documentInstance.getElementById('import-dialog-overlay');
        expect(importOverlay.classList.contains('is-open')).toBe(true);
        const fileNameElement = documentInstance.getElementById('import-file-name');
        expect(fileNameElement.textContent).toBe('test-backup.json');
    });
});
