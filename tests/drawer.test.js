// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, isElementInert } from './test-utils.js';

let dom;
let win;
let doc;

describe('Navigation Drawer State & Container Placement Tests', () => {
    beforeEach(async () => {
        const env = await setupTestDOM();
        dom = env.dom;
        win = env.win;
        doc = env.doc;
    });

    it('1. Initial State Sanity Check: Drawer closed, tracker canvas active, containers properly positioned', () => {
        const body = doc.body;
        const drawer = doc.getElementById('side-drawer');
        const menuBtn = doc.getElementById('button-menu');
        const trackerCanvas = doc.getElementById('tracker-canvas');
        const historyCanvas = doc.getElementById('history-canvas');

        // Drawer closed state
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(isElementInert(drawer)).toBe(true);
        expect(menuBtn.getAttribute('aria-expanded')).toBe('false');

        // Active Canvas
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);

        // Inactive Canvases
        expect(isElementInert(historyCanvas)).toBe(true);
        expect(historyCanvas.classList.contains('view-active')).toBe(false);
    });

    it('2. Action: Opening Drawer via Menu Toggle Button (#button-menu)', () => {
        const body = doc.body;
        const drawer = doc.getElementById('side-drawer');
        const menuBtn = doc.getElementById('button-menu');
        const trackerCanvas = doc.getElementById('tracker-canvas');

        // Trigger open
        menuBtn.click();

        // State changes
        expect(body.classList.contains('drawer-open')).toBe(true);
        expect(isElementInert(drawer)).toBe(false);
        expect(menuBtn.getAttribute('aria-expanded')).toBe('true');

        // Canvases should become inert while drawer is open
        expect(isElementInert(trackerCanvas)).toBe(true);

        // Container placement check: active canvas remains .view-active (styled dimmed/scaled via CSS rule body.drawer-open .app-canvas.view-active)
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
    });

    it('3. Action: Closing Drawer via Menu Toggle Button (#button-menu) when open', () => {
        const body = doc.body;
        const drawer = doc.getElementById('side-drawer');
        const menuBtn = doc.getElementById('button-menu');
        const trackerCanvas = doc.getElementById('tracker-canvas');

        // Open then close
        menuBtn.click();
        expect(body.classList.contains('drawer-open')).toBe(true);

        menuBtn.click();

        // State changes
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(isElementInert(drawer)).toBe(true);
        expect(menuBtn.getAttribute('aria-expanded')).toBe('false');

        // Active canvas interactive state restored
        expect(isElementInert(trackerCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
    });

    it('4. Action: Closing Drawer via Backdrop Overlay (#drawer-overlay)', () => {
        const body = doc.body;
        const drawer = doc.getElementById('side-drawer');
        const menuBtn = doc.getElementById('button-menu');
        const overlay = doc.getElementById('drawer-overlay');
        const trackerCanvas = doc.getElementById('tracker-canvas');

        // Open
        menuBtn.click();
        expect(body.classList.contains('drawer-open')).toBe(true);

        // Click backdrop
        overlay.click();

        // State changes
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(isElementInert(drawer)).toBe(true);
        expect(menuBtn.getAttribute('aria-expanded')).toBe('false');
        expect(isElementInert(trackerCanvas)).toBe(false);
    });

    it('5. Action: Closing Drawer via Escape Key', () => {
        const body = doc.body;
        const drawer = doc.getElementById('side-drawer');
        const menuBtn = doc.getElementById('button-menu');
        const trackerCanvas = doc.getElementById('tracker-canvas');

        // Open
        menuBtn.click();
        expect(body.classList.contains('drawer-open')).toBe(true);

        // Press Escape
        doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape' }));

        // State changes
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(isElementInert(drawer)).toBe(true);
        expect(menuBtn.getAttribute('aria-expanded')).toBe('false');
        expect(isElementInert(trackerCanvas)).toBe(false);
    });

    it('6. Action: Navigating to all options in frequency order (Mood Tracker, History, Questions, Data, Settings)', () => {
        const menuBtn = doc.getElementById('button-menu');
        const body = doc.body;
        const drawer = doc.getElementById('side-drawer');

        const navBtns = Array.from(doc.querySelectorAll('.drawer-nav-button'));
        const navTargets = navBtns.map(btn => btn.getAttribute('data-target'));

        // Expected frequency order: Mood Tracker, History, Questions, Data, Settings
        expect(navTargets).toEqual([
            'tracker-canvas',
            'history-canvas',
            'questions-canvas',
            'data-canvas',
            'settings-canvas'
        ]);

        // Step A: Navigate to History (history-canvas)
        menuBtn.click(); // Open drawer
        const historyNavBtn = doc.querySelector('.drawer-nav-button[data-target="history-canvas"]');
        historyNavBtn.click();

        // Sanity checks for container placement
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(isElementInert(drawer)).toBe(true);

        const historyCanvas = doc.getElementById('history-canvas');
        const trackerCanvas = doc.getElementById('tracker-canvas');

        expect(historyCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(historyCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
        expect(historyNavBtn.classList.contains('active')).toBe(true);

        // Step B: Navigate to Questions Library (questions-canvas)
        menuBtn.click(); // Open drawer
        const questionsNavBtn = doc.querySelector('.drawer-nav-button[data-target="questions-canvas"]');
        questionsNavBtn.click();

        const questionsCanvas = doc.getElementById('questions-canvas');
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(questionsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(questionsCanvas)).toBe(false);
        expect(historyCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(questionsNavBtn.classList.contains('active')).toBe(true);

        // Step C: Navigate to Data & Backups (data-canvas)
        menuBtn.click();
        const dataNavBtn = doc.querySelector('.drawer-nav-button[data-target="data-canvas"]');
        dataNavBtn.click();

        const dataCanvas = doc.getElementById('data-canvas');
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(dataCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(dataCanvas)).toBe(false);
        expect(dataNavBtn.classList.contains('active')).toBe(true);

        // Step D: Navigate to Settings (settings-canvas)
        menuBtn.click();
        const settingsNavBtn = doc.querySelector('.drawer-nav-button[data-target="settings-canvas"]');
        settingsNavBtn.click();

        const settingsCanvas = doc.getElementById('settings-canvas');
        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(settingsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(false);
        expect(settingsNavBtn.classList.contains('active')).toBe(true);

        // Step E: Navigate back to Mood Tracker (tracker-canvas)
        menuBtn.click();
        const trackerNavBtn = doc.querySelector('.drawer-nav-button[data-target="tracker-canvas"]');
        trackerNavBtn.click();

        expect(body.classList.contains('drawer-open')).toBe(false);
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);
        expect(trackerNavBtn.classList.contains('active')).toBe(true);
    });

    it('7. Action: Re-selecting currently active canvas inside drawer', () => {
        const menuBtn = doc.getElementById('button-menu');
        const trackerCanvas = doc.getElementById('tracker-canvas');

        menuBtn.click(); // Open
        const trackerNavBtn = doc.querySelector('.drawer-nav-button[data-target="tracker-canvas"]');
        trackerNavBtn.click();

        // Drawer should close, canvas remains active
        expect(doc.body.classList.contains('drawer-open')).toBe(false);
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);
    });

    it('8. Action: Quick options section removed from drawer', () => {
        const quickPrefs = doc.querySelector('.drawer-quick-prefs');
        const drawerHandednessSelect = doc.getElementById('drawer-handedness-select');
        const drawerThemeSelect = doc.getElementById('drawer-theme-select');

        expect(quickPrefs).toBeNull();
        expect(drawerHandednessSelect).toBeNull();
        expect(drawerThemeSelect).toBeNull();
    });

    it('9. Console Debug Controls: setDebugBounds and toggleDebugBounds', () => {
        expect(win.setDebugBounds).toBeDefined();
        expect(win.toggleDebugBounds).toBeDefined();

        win.setDebugBounds(true);
        expect(doc.body.getAttribute('data-debug-bounds')).toBe('true');

        win.toggleDebugBounds();
        expect(doc.body.getAttribute('data-debug-bounds')).toBe('false');
    });
});
