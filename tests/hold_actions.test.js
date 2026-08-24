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
});
