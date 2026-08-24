// @vitest-environment jsdom
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, isElementInert } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

function expectDrawerState(document, { isOpen }) {
    const body = document.body;
    const drawer = document.getElementById('side-drawer');
    const menuButton = document.getElementById('button-menu');
    const trackerCanvas = document.getElementById('tracker-canvas');

    expect(body.classList.contains('drawer-open')).toBe(isOpen);
    expect(isElementInert(drawer)).toBe(!isOpen);
    expect(menuButton.getAttribute('aria-expanded')).toBe(isOpen ? 'true' : 'false');
    expect(isElementInert(trackerCanvas)).toBe(isOpen);
}

describe('Navigation Drawer State & Container Placement Tests', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('1. Initial State Sanity Check: Drawer closed, tracker canvas active, containers properly positioned', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const historyCanvas = documentInstance.getElementById('history-canvas');

        // Drawer closed state
        expectDrawerState(documentInstance, { isOpen: false });

        // Active Canvas
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);

        // Inactive Canvases
        expect(isElementInert(historyCanvas)).toBe(true);
        expect(historyCanvas.classList.contains('view-active')).toBe(false);
    });

    it('2. Action: Opening Drawer via Menu Toggle Button (#button-menu)', () => {
        const menuButton = documentInstance.getElementById('button-menu');
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');

        // Trigger open
        menuButton.click();

        // State changes
        expectDrawerState(documentInstance, { isOpen: true });

        // Container placement check: active canvas remains .view-active (styled dimmed/scaled via CSS rule body.drawer-open .app-canvas.view-active)
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
    });

    it('3. Action: Closing Drawer via Menu Toggle Button (#button-menu) when open', () => {
        const menuButton = documentInstance.getElementById('button-menu');
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');

        // Open then close
        menuButton.click();
        expectDrawerState(documentInstance, { isOpen: true });

        menuButton.click();

        // State changes
        expectDrawerState(documentInstance, { isOpen: false });
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
    });

    it('4. Action: Closing Drawer via Backdrop Overlay (#drawer-overlay)', () => {
        const menuButton = documentInstance.getElementById('button-menu');
        const overlay = documentInstance.getElementById('drawer-overlay');

        // Open
        menuButton.click();
        expectDrawerState(documentInstance, { isOpen: true });

        // Click backdrop
        overlay.click();

        // State changes
        expectDrawerState(documentInstance, { isOpen: false });
    });

    it('5. Action: Closing Drawer via Escape Key', () => {
        const menuButton = documentInstance.getElementById('button-menu');

        // Open
        menuButton.click();
        expectDrawerState(documentInstance, { isOpen: true });

        // Press Escape
        documentInstance.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Escape' }));

        // State changes
        expectDrawerState(documentInstance, { isOpen: false });
    });

    it('6. Action: Navigating to all options in frequency order (Mood Tracker, History, Questions, Data, Settings)', () => {
        const menuButton = documentInstance.getElementById('button-menu');
        const body = documentInstance.body;
        const drawer = documentInstance.getElementById('side-drawer');

        const navigationButtons = Array.from(documentInstance.querySelectorAll('.drawer-nav-button'));
        const navigationTargets = navigationButtons.map(button => button.getAttribute('data-target'));

        // Expected frequency order: Mood Tracker, History, Questions, Data, Settings
        expect(navigationTargets).toEqual([
            'tracker-canvas',
            'history-canvas',
            'questions-canvas',
            'data-canvas',
            'settings-canvas'
        ]);

        // Step A: Navigate to History (history-canvas)
        menuButton.click(); // Open drawer
        const historyNavigationButton = documentInstance.querySelector('.drawer-nav-button[data-target="history-canvas"]');
        historyNavigationButton.click();

        // Sanity checks for container placement
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(isElementInert(drawer)).toBe(true);

        const historyCanvas = documentInstance.getElementById('history-canvas');
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');

        expect(historyCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(historyCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
        expect(historyNavigationButton.classList.contains('active')).toBe(true);

        // Step B: Navigate to Questions Library (questions-canvas)
        menuButton.click(); // Open drawer
        const questionsNavigationButton = documentInstance.querySelector('.drawer-nav-button[data-target="questions-canvas"]');
        questionsNavigationButton.click();

        const questionsCanvas = documentInstance.getElementById('questions-canvas');
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(questionsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(questionsCanvas)).toBe(false);
        expect(historyCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(questionsNavigationButton.classList.contains('active')).toBe(true);

        // Step C: Navigate to Data & Backups (data-canvas)
        menuButton.click();
        const dataNavigationButton = documentInstance.querySelector('.drawer-nav-button[data-target="data-canvas"]');
        dataNavigationButton.click();

        const dataCanvas = documentInstance.getElementById('data-canvas');
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(dataCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(dataCanvas)).toBe(false);
        expect(dataNavigationButton.classList.contains('active')).toBe(true);

        // Step D: Navigate to Settings (settings-canvas)
        menuButton.click();
        const settingsNavigationButton = documentInstance.querySelector('.drawer-nav-button[data-target="settings-canvas"]');
        settingsNavigationButton.click();

        const settingsCanvas = documentInstance.getElementById('settings-canvas');
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(settingsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(false);
        expect(settingsNavigationButton.classList.contains('active')).toBe(true);

        // Step E: Navigate back to Mood Tracker (tracker-canvas)
        menuButton.click();
        const trackerNavigationButton = documentInstance.querySelector('.drawer-nav-button[data-target="tracker-canvas"]');
        trackerNavigationButton.click();

        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);
        expect(trackerNavigationButton.classList.contains('active')).toBe(true);
    });

    it('7. Action: Re-selecting currently active canvas inside drawer', () => {
        const menuButton = documentInstance.getElementById('button-menu');
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');

        menuButton.click(); // Open
        const trackerNavigationButton = documentInstance.querySelector('.drawer-nav-button[data-target="tracker-canvas"]');
        trackerNavigationButton.click();

        // Drawer should close, canvas remains active
        expect(documentInstance.body.classList.contains('drawer-open')).toBe(false);
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);
    });

    it('8. Action: Quick options section removed from drawer', () => {
        const quickPreferences = documentInstance.querySelector('.drawer-quick-prefs');
        const drawerHandednessSelect = documentInstance.getElementById('drawer-handedness-select');
        const drawerThemeSelect = documentInstance.getElementById('drawer-theme-select');

        expect(quickPreferences).toBeNull();
        expect(drawerHandednessSelect).toBeNull();
        expect(drawerThemeSelect).toBeNull();
    });

    it('9. Console Debug Controls: setDebugBounds and toggleDebugBounds', () => {
        expect(windowInstance.setDebugBounds).toBeDefined();
        expect(windowInstance.toggleDebugBounds).toBeDefined();

        windowInstance.setDebugBounds(true);
        expect(documentInstance.body.getAttribute('data-debug-bounds')).toBe('true');

        windowInstance.toggleDebugBounds();
        expect(documentInstance.body.getAttribute('data-debug-bounds')).toBe('false');
    });

    it('10. Landscape Mobile Layout Verification: CSS contains 2-column landscape grid rules and action buttons', () => {
        const cssContent = readFileSync(resolve(__dirname, '../public/style.css'), 'utf8');
        expect(cssContent).toContain('@media (orientation: landscape) and (max-height: 600px)');
        expect(cssContent).toContain('"header input"');
        expect(cssContent).toContain('"footer input"');

        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const headerBox = documentInstance.getElementById('header-box');
        const inputBox = documentInstance.getElementById('input-box');
        const footerBox = documentInstance.getElementById('footer-box');
        const notesButton = documentInstance.getElementById('button-notes');
        const skipButton = documentInstance.getElementById('button-skip');

        expect(trackerCanvas).not.toBeNull();
        expect(headerBox).not.toBeNull();
        expect(inputBox).not.toBeNull();
        expect(footerBox).not.toBeNull();
        expect(notesButton).not.toBeNull();
        expect(skipButton).not.toBeNull();
    });
});
