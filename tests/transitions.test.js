// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, isElementInert, sleep } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

describe('Task 2.10: Seamless View & Question Transitions Tests', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('1. Initial State: Tracker Canvas is view-active, others are inactive and inert', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const settingsCanvas = documentInstance.getElementById('settings-canvas');
        const historyCanvas = documentInstance.getElementById('history-canvas');

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);

        expect(settingsCanvas.classList.contains('view-active')).toBe(false);
        expect(isElementInert(settingsCanvas)).toBe(true);

        expect(historyCanvas.classList.contains('view-active')).toBe(false);
        expect(isElementInert(historyCanvas)).toBe(true);
    });

    it('2. Forward Navigation (Tracker -> Settings): Tracker exits left, Settings enters and becomes active', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const settingsCanvas = documentInstance.getElementById('settings-canvas');

        windowInstance.navigateTo('settings-canvas');

        expect(settingsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(false);

        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
    });

    it('3. Backward Navigation (Settings -> Tracker): Settings exits right, Tracker enters and becomes active', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const settingsCanvas = documentInstance.getElementById('settings-canvas');

        // First forward
        windowInstance.navigateTo('settings-canvas');
        expect(settingsCanvas.classList.contains('view-active')).toBe(true);

        // Now backward to Tracker
        windowInstance.navigateTo('tracker-canvas');

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);

        expect(settingsCanvas.classList.contains('view-hidden-right')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(true);
    });

    it('4. Lateral Navigation (History -> Questions): History exits left, Questions becomes active', () => {
        const historyCanvas = documentInstance.getElementById('history-canvas');
        const questionsCanvas = documentInstance.getElementById('questions-canvas');

        windowInstance.navigateTo('history-canvas');
        expect(historyCanvas.classList.contains('view-active')).toBe(true);

        windowInstance.navigateTo('questions-canvas');
        expect(questionsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(questionsCanvas)).toBe(false);
        expect(historyCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(historyCanvas)).toBe(true);
    });

    it('5. Instant Navigation Mode: Applies instant classes without transition delays', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const dataCanvas = documentInstance.getElementById('data-canvas');

        windowInstance.navigateTo('data-canvas', { instant: true });

        expect(dataCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(dataCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
    });

    it('6. Question Score Submission: Advances questions seamlessly without hiding or unrendering tracker canvas', async () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const progressElement = documentInstance.getElementById('progress-text');

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(progressElement.textContent).toContain('Question 1');

        const firstScoreButton = documentInstance.querySelector('#button-stack .score-button[data-score="4"]');
        expect(firstScoreButton).not.toBeNull();
        firstScoreButton.click();

        // Tracker canvas itself remains view-active and rendered (no whole-canvas blanking)
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);

        // Wait for question micro-transition
        await sleep(200);

        expect(progressElement.textContent).toContain('Question 2');
        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
    });
});
