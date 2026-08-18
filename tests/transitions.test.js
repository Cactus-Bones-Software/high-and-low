// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, isElementInert, sleep } from './test-utils.js';

let dom;
let win;
let doc;

describe('Task 2.10: Seamless View & Question Transitions Tests', () => {
    beforeEach(async () => {
        const env = await setupTestDOM();
        dom = env.dom;
        win = env.win;
        doc = env.doc;
    });

    it('1. Initial State: Tracker Canvas is view-active, others are inactive and inert', () => {
        const trackerCanvas = doc.getElementById('tracker-canvas');
        const settingsCanvas = doc.getElementById('settings-canvas');
        const historyCanvas = doc.getElementById('history-canvas');

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);

        expect(settingsCanvas.classList.contains('view-active')).toBe(false);
        expect(isElementInert(settingsCanvas)).toBe(true);

        expect(historyCanvas.classList.contains('view-active')).toBe(false);
        expect(isElementInert(historyCanvas)).toBe(true);
    });

    it('2. Forward Navigation (Tracker -> Settings): Tracker exits left, Settings enters and becomes active', () => {
        const trackerCanvas = doc.getElementById('tracker-canvas');
        const settingsCanvas = doc.getElementById('settings-canvas');

        win.navigateTo('settings-canvas');

        expect(settingsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(false);

        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
    });

    it('3. Backward Navigation (Settings -> Tracker): Settings exits right, Tracker enters and becomes active', () => {
        const trackerCanvas = doc.getElementById('tracker-canvas');
        const settingsCanvas = doc.getElementById('settings-canvas');

        // First forward
        win.navigateTo('settings-canvas');
        expect(settingsCanvas.classList.contains('view-active')).toBe(true);

        // Now backward to Tracker
        win.navigateTo('tracker-canvas');

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);

        expect(settingsCanvas.classList.contains('view-hidden-right')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(true);
    });

    it('4. Lateral Navigation (History -> Questions): History exits left, Questions becomes active', () => {
        const historyCanvas = doc.getElementById('history-canvas');
        const questionsCanvas = doc.getElementById('questions-canvas');

        win.navigateTo('history-canvas');
        expect(historyCanvas.classList.contains('view-active')).toBe(true);

        win.navigateTo('questions-canvas');
        expect(questionsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(questionsCanvas)).toBe(false);
        expect(historyCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(historyCanvas)).toBe(true);
    });

    it('5. Instant Navigation Mode: Applies instant classes without transition delays', () => {
        const trackerCanvas = doc.getElementById('tracker-canvas');
        const dataCanvas = doc.getElementById('data-canvas');

        win.navigateTo('data-canvas', { instant: true });

        expect(dataCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(dataCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
    });

    it('6. Question Score Submission: Advances questions seamlessly without hiding or unrendering tracker canvas', async () => {
        const trackerCanvas = doc.getElementById('tracker-canvas');
        const progressEl = doc.getElementById('progress-text');

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(progressEl.textContent).toContain('Question 1');

        const firstScoreBtn = doc.querySelector('#button-stack .score-button[data-score="4"]');
        expect(firstScoreBtn).not.toBeNull();
        firstScoreBtn.click();

        // Tracker canvas itself remains view-active and rendered (no whole-canvas blanking)
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);

        // Wait for question micro-transition
        await sleep(200);

        expect(progressEl.textContent).toContain('Question 2');
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
    });
});
