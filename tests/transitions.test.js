// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, isElementInert, sleep } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

function expectNoTransitionClasses(targetElement) {
    if (!targetElement) return;
    expect(targetElement.classList.contains('question-transition-out')).toBe(false);
    expect(targetElement.classList.contains('question-transition-enter')).toBe(false);
    expect(targetElement.classList.contains('question-transition-in')).toBe(false);
}

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

    it('7. Final Question Completion: Hides button stack, displays completion view, and hides footer actions', async () => {
        const buttonStack = documentInstance.getElementById('button-stack');
        const completionView = documentInstance.getElementById('completion-view');
        const footerBox = documentInstance.getElementById('footer-box');
        const progressElement = documentInstance.getElementById('progress-text');
        const questionElement = documentInstance.getElementById('question-text');

        // Fast-forward to final question
        windowInstance.STATE.currentQuestionIndex = windowInstance.STATE.activeQuestions.length - 1;
        windowInstance.renderCurrentQuestion();

        const lastScoreButton = documentInstance.querySelector('#button-stack .score-button[data-score="5"]');
        expect(lastScoreButton).not.toBeNull();
        lastScoreButton.click();

        await sleep(200);

        expect(buttonStack.hidden).toBe(true);
        expect(completionView.hidden).toBe(false);
        expect(footerBox.style.display).toBe('none');
        expect(progressElement.textContent).toBe('Check-In Complete');
        expect(questionElement.textContent).toBe('Mood recorded. Rest easy.');

        // Restarting check-in restores button stack and footer
        await windowInstance.startNewCheckIn();
        expect(buttonStack.hidden).toBe(false);
        expect(completionView.hidden).toBe(true);
        expect(footerBox.style.display).toBe('');
    });
});

describe('Task 2.11: Suppress Transitions on Initial Load & Page Refreshes', () => {
    it('1. Suppresses transitions during initial load and removes suppress-transitions once initialized', async () => {
        const environment = await setupTestDOM();
        const document = environment.document;

        // Allow microtasks and safeRAF to complete
        await sleep(50);

        // After initialization completes, suppress-transitions should be cleanly removed for interactive navigation
        expect(document.body.classList.contains('suppress-transitions')).toBe(false);
    });

    it('2. Restoring active view on load applies active and inert classes instantly without animation classes', async () => {
        const environment = await setupTestDOM({
            'high_and_low_active_view': 'history-canvas'
        });
        const document = environment.document;

        const historyCanvas = document.getElementById('history-canvas');
        const trackerCanvas = document.getElementById('tracker-canvas');
        const settingsCanvas = document.getElementById('settings-canvas');

        expect(historyCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(historyCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
        expect(settingsCanvas.classList.contains('view-hidden-right')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(true);

        // No lingering transition or entrance classes
        expectNoTransitionClasses(historyCanvas);
    });

    it('3. Restoring active check-in on load renders in-progress question immediately without triggering question transition animations', async () => {
        const savedCheckin = {
            currentQuestionIndex: 2,
            checkinAnswers: [
                { questionId: 'q_energy', score: 4, status: 'answered' },
                { questionId: 'q_sadness', score: 2, status: 'answered' }
            ],
            checkinNote: null,
            updatedAt: Date.now()
        };

        const environment = await setupTestDOM({
            'high_and_low_active_checkin': JSON.stringify(savedCheckin)
        });
        const document = environment.document;

        const headerBox = document.getElementById('header-box');
        const inputBox = document.getElementById('input-box');
        const progressElement = document.getElementById('progress-text');

        expect(progressElement.textContent).toContain('Question 3 of');

        // Question transition classes MUST NOT be applied during check-in restore
        expectNoTransitionClasses(headerBox);
        expectNoTransitionClasses(inputBox);
    });

    it('4. Theme and contrast updates do not trigger view or question transition animations', async () => {
        const environment = await setupTestDOM();
        const document = environment.document;

        const themeSelect = document.getElementById('theme-select');
        const contrastSelect = document.getElementById('contrast-select');
        const headerBox = document.getElementById('header-box');
        const inputBox = document.getElementById('input-box');
        const trackerCanvas = document.getElementById('tracker-canvas');

        if (themeSelect) {
            themeSelect.value = 'light';
            themeSelect.dispatchEvent(new environment.window.Event('change', { bubbles: true }));
        }

        if (contrastSelect) {
            contrastSelect.value = 'high';
            contrastSelect.dispatchEvent(new environment.window.Event('change', { bubbles: true }));
        }

        await sleep(50);

        expect(document.body.getAttribute('data-theme')).toBe('light');
        expect(document.body.getAttribute('data-contrast')).toBe('high');

        // Verify no transition classes were erroneously triggered on boxes or canvases
        expectNoTransitionClasses(headerBox);
        expectNoTransitionClasses(inputBox);

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
    });

    it('5. Completing check-in clears all question transition classes so content remains visible', async () => {
        const environment = await setupTestDOM();
        const document = environment.document;

        const headerBox = document.getElementById('header-box');
        const inputBox = document.getElementById('input-box');
        const completionView = document.getElementById('completion-view');

        // Answer all questions sequentially
        for (let i = 0; i < 5; i++) {
            const firstScoreButton = document.querySelector('.score-button');
            if (firstScoreButton) {
                firstScoreButton.click();
                await sleep(150);
            }
        }

        // Completion view should be visible and transition classes cleanly removed
        expect(completionView.hidden).toBe(false);
        expectNoTransitionClasses(headerBox);
        expectNoTransitionClasses(inputBox);
    });
});