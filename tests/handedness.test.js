// @vitest-environment jsdom
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

describe('Task 5.2: Handedness Setting & Non-Dominant Action Placement Tests', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('1. Settings UI Structure: Handedness select element exists with right/left options', () => {
        const handednessSelect = documentInstance.getElementById('handedness-select');
        expect(handednessSelect).not.toBeNull();

        const options = Array.from(handednessSelect.options).map(option => option.value);
        expect(options).toContain('right');
        expect(options).toContain('left');

        const label = documentInstance.querySelector('label[for="handedness-select"]');
        expect(label).not.toBeNull();
        expect(label.textContent).toContain('Handedness');
    });

    it('2. Default Handedness: Document body has data-handedness="right" by default', () => {
        expect(documentInstance.body.getAttribute('data-handedness')).toBe('right');
        const handednessSelect = documentInstance.getElementById('handedness-select');
        expect(handednessSelect.value).toBe('right');
    });

    it('3. Changing Handedness: Switching to left updates DOM attribute, IndexedDB config, and localStorage', async () => {
        const handednessSelect = documentInstance.getElementById('handedness-select');
        handednessSelect.value = 'left';
        handednessSelect.dispatchEvent(new windowInstance.Event('change', { bubbles: true }));

        await waitFor(() => documentInstance.body.getAttribute('data-handedness') === 'left');

        expect(documentInstance.body.getAttribute('data-handedness')).toBe('left');
        expect(windowInstance.localStorage.getItem('handedness')).toBe('left');

        const storedConfig = await windowInstance.getConfig('handedness');
        expect(storedConfig).toBe('left');
    });

    it('4. Switching back to Right Handedness: Updates DOM attribute and persistence accordingly', async () => {
        const handednessSelect = documentInstance.getElementById('handedness-select');

        // Change to left
        handednessSelect.value = 'left';
        handednessSelect.dispatchEvent(new windowInstance.Event('change', { bubbles: true }));
        await waitFor(() => documentInstance.body.getAttribute('data-handedness') === 'left');

        // Change back to right
        handednessSelect.value = 'right';
        handednessSelect.dispatchEvent(new windowInstance.Event('change', { bubbles: true }));
        await waitFor(() => documentInstance.body.getAttribute('data-handedness') === 'right');

        expect(documentInstance.body.getAttribute('data-handedness')).toBe('right');
        expect(windowInstance.localStorage.getItem('handedness')).toBe('right');

        const storedConfig = await windowInstance.getConfig('handedness');
        expect(storedConfig).toBe('right');
    });

    it('5. Backward Compatibility: Falls back to legacy menuSide if handedness is unset', async () => {
        // Clear handedness from config and localStorage, and set legacy menuSide in localStorage
        await windowInstance.deleteConfig('handedness');
        windowInstance.localStorage.removeItem('handedness');
        windowInstance.localStorage.setItem('menuSide', 'left');

        // Call applyStoredDisplay
        await windowInstance.applyStoredDisplay();

        expect(documentInstance.body.getAttribute('data-handedness')).toBe('left');
        const handednessSelect = documentInstance.getElementById('handedness-select');
        expect(handednessSelect.value).toBe('left');
    });

    it('6. CSS Verification: Menu drawer, toggle, and non-dominant card action CSS rules exist', () => {
        const cssContent = readFileSync(resolve(__dirname, '../public/style.css'), 'utf8');

        // Dominant hand dictates drawer and menu-toggle placement
        expect(cssContent).toContain('body[data-handedness="left"] .menu-toggle');
        expect(cssContent).toContain('body[data-handedness="right"] .menu-toggle');
        expect(cssContent).toContain('body[data-handedness="left"] .side-drawer');
        expect(cssContent).toContain('body[data-handedness="right"] .side-drawer');

        // Non-dominant hand dictates card action placement (e.g. edit buttons) to prevent accidental taps
        expect(cssContent).toContain('.card-action-row');
        expect(cssContent).toContain('body[data-handedness="right"] .card-actions-non-dominant');
        expect(cssContent).toContain('body[data-handedness="left"] .card-actions-non-dominant');
        expect(cssContent).toContain('body[data-handedness="right"] .card-action-edit');
        expect(cssContent).toContain('body[data-handedness="left"] .card-action-edit');
    });
});