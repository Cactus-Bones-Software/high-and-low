// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, waitFor } from './test-utils.js';
import { getConfig, setConfig, deleteConfig } from '../public/js/storage/db.js';
import { applyStoredDisplay, migrateLegacyMenuSideOnLoad } from '../public/js/ui/settings-menu.js';

let _domInstance;
let windowInstance;
let documentInstance;

describe('Handedness Setting and Non-Dominant Action Placement', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        _domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('provides handedness select element with right/left options in Settings UI', () => {
        const handednessSelect = documentInstance.getElementById('handedness-select');
        expect(handednessSelect).not.toBeNull();

        const options = Array.from(handednessSelect.options).map(option => option.value);
        expect(options).toContain('right');
        expect(options).toContain('left');

        const label = documentInstance.querySelector('label[for="handedness-select"]');
        expect(label).not.toBeNull();
        expect(label.textContent).toContain('Handedness');
    });

    it('sets data-handedness="right" on document body by default', () => {
        expect(documentInstance.body.getAttribute('data-handedness')).toBe('right');
        const handednessSelect = documentInstance.getElementById('handedness-select');
        expect(handednessSelect.value).toBe('right');
    });

    it('updates DOM attribute, IndexedDB config, and localStorage when switching to left', async () => {
        const handednessSelect = documentInstance.getElementById('handedness-select');
        handednessSelect.value = 'left';
        handednessSelect.dispatchEvent(new windowInstance.Event('change', { bubbles: true }));

        await waitFor(() => documentInstance.body.getAttribute('data-handedness') === 'left');

        expect(documentInstance.body.getAttribute('data-handedness')).toBe('left');
        expect(windowInstance.localStorage.getItem('handedness')).toBe('left');

        const storedConfig = await getConfig('handedness');
        expect(storedConfig).toBe('left');
    });

    it('updates DOM attribute and persistence when switching back to right handedness', async () => {
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

        const storedConfig = await getConfig('handedness');
        expect(storedConfig).toBe('right');
    });

    it('migrates legacy menuSide from localStorage to handedness on load and deletes menuSide', async () => {
        // Clear handedness from config and localStorage, and set legacy menuSide in localStorage
        await deleteConfig('handedness');
        windowInstance.localStorage.removeItem('handedness');
        windowInstance.localStorage.setItem('menuSide', 'left');

        // Call applyStoredDisplay
        await applyStoredDisplay();

        expect(documentInstance.body.getAttribute('data-handedness')).toBe('left');
        const handednessSelect = documentInstance.getElementById('handedness-select');
        expect(handednessSelect.value).toBe('left');

        // Handedness must be persisted and legacy menuSide must be removed
        expect(windowInstance.localStorage.getItem('handedness')).toBe('left');
        expect(windowInstance.localStorage.getItem('menuSide')).toBeNull();
        expect(await getConfig('handedness')).toBe('left');
        expect(await getConfig('menuSide')).toBeUndefined();
    });

    it('migrates legacy menuSide from IndexedDB config to handedness and deletes menuSide', async () => {
        await deleteConfig('handedness');
        windowInstance.localStorage.removeItem('handedness');
        await setConfig('menuSide', 'left');

        await applyStoredDisplay();

        expect(documentInstance.body.getAttribute('data-handedness')).toBe('left');
        expect(await getConfig('handedness')).toBe('left');
        expect(await getConfig('menuSide')).toBeUndefined();
        expect(windowInstance.localStorage.getItem('handedness')).toBe('left');
        expect(windowInstance.localStorage.getItem('menuSide')).toBeNull();
    });

    it('preserves existing handedness and purges legacy menuSide when both are present', async () => {
        await setConfig('handedness', 'right');
        windowInstance.localStorage.setItem('handedness', 'right');
        await setConfig('menuSide', 'left');
        windowInstance.localStorage.setItem('menuSide', 'left');

        const resolved = await migrateLegacyMenuSideOnLoad('right', 'right');
        expect(resolved).toBe('right');
        expect(await getConfig('handedness')).toBe('right');
        expect(await getConfig('menuSide')).toBeUndefined();
        expect(windowInstance.localStorage.getItem('menuSide')).toBeNull();
    });

    it('contains menu drawer, toggle, and non-dominant card action CSS rules', () => {
        const cssContent = readFileSync(resolve(__dirname, '../public/style.css'), 'utf8');

        // Dominant hand dictates drawer and menu-toggle placement
        expect(cssContent).toContain('body[data-handedness="left"] .menu-toggle');
        expect(cssContent).toContain('body[data-handedness="right"] .menu-toggle');
        expect(cssContent).toContain('body[data-handedness="left"] .side-drawer');
        expect(cssContent).toContain('body[data-handedness="right"] .side-drawer');

        // Non-dominant hand dictates card action placement (e.g., edit buttons) to prevent accidental taps
        expect(cssContent).toContain('.card-action-row');
        expect(cssContent).toContain('body[data-handedness="right"] .card-actions-non-dominant');
        expect(cssContent).toContain('body[data-handedness="left"] .card-actions-non-dominant');
        expect(cssContent).toContain('body[data-handedness="right"] .card-action-edit');
        expect(cssContent).toContain('body[data-handedness="left"] .card-action-edit');
    });
});