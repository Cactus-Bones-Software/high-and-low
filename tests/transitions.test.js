// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, isElementInert, sleep, createSampleCheckIn } from './test-utils.js';
import { navigateTo } from '../public/js/ui/navigation.js';
import { STATE } from '../public/js/state.js';
import { renderCurrentQuestion, startNewCheckIn } from '../public/js/checkin.js';

let _domInstance;
let _windowInstance;
let documentInstance;

function expectNoTransitionClasses(targetElement) {
    if (!targetElement) return;
    expect(targetElement.classList.contains('question-transition-out')).toBe(false);
    expect(targetElement.classList.contains('question-transition-enter')).toBe(false);
    expect(targetElement.classList.contains('question-transition-in')).toBe(false);
}

describe('Seamless View & Question Transitions', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        _domInstance = environment.dom;
        _windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('sets Tracker Canvas as view-active, and others as inactive and inert initially', () => {
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

    it('exits Tracker left and enters Settings as active on forward navigation (Tracker -> Settings)', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const settingsCanvas = documentInstance.getElementById('settings-canvas');

        navigateTo('settings-canvas');

        expect(settingsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(false);

        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
    });

    it('exits Settings right and enters Tracker as active on backward navigation (Settings -> Tracker)', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const settingsCanvas = documentInstance.getElementById('settings-canvas');

        // First forward
        navigateTo('settings-canvas');
        expect(settingsCanvas.classList.contains('view-active')).toBe(true);

        // Now backward to Tracker
        navigateTo('tracker-canvas');

        expect(trackerCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(false);

        expect(settingsCanvas.classList.contains('view-hidden-right')).toBe(true);
        expect(isElementInert(settingsCanvas)).toBe(true);
    });

    it('exits History left and makes Questions active on lateral navigation (History -> Questions)', () => {
        const historyCanvas = documentInstance.getElementById('history-canvas');
        const questionsCanvas = documentInstance.getElementById('questions-canvas');

        navigateTo('history-canvas');
        expect(historyCanvas.classList.contains('view-active')).toBe(true);

        navigateTo('questions-canvas');
        expect(questionsCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(questionsCanvas)).toBe(false);
        expect(historyCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(historyCanvas)).toBe(true);
    });

    it('applies instant classes without transition delays in instant navigation mode', () => {
        const trackerCanvas = documentInstance.getElementById('tracker-canvas');
        const dataCanvas = documentInstance.getElementById('data-canvas');

        navigateTo('data-canvas', { instant: true });

        expect(dataCanvas.classList.contains('view-active')).toBe(true);
        expect(isElementInert(dataCanvas)).toBe(false);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
        expect(isElementInert(trackerCanvas)).toBe(true);
    });

    it('advances questions seamlessly without hiding or unrendering tracker canvas on question score submission', async () => {
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

    it('hides button stack, displays completion view, and hides footer actions on final question completion', async () => {
        const buttonStack = documentInstance.getElementById('button-stack');
        const completionView = documentInstance.getElementById('completion-view');
        const footerBox = documentInstance.getElementById('footer-box');
        const progressElement = documentInstance.getElementById('progress-text');
        const questionElement = documentInstance.getElementById('question-text');

        // Fast-forward to final question
        STATE.currentQuestionIndex = STATE.activeQuestions.length - 1;
        renderCurrentQuestion();

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
        await startNewCheckIn();
        expect(buttonStack.hidden).toBe(false);
        expect(completionView.hidden).toBe(true);
        expect(footerBox.style.display).toBe('');
    });
});

describe('Suppress Transitions on Initial Load & Page Refreshes', () => {
    it('suppresses transitions during initial load and removes suppress-transitions once initialized', async () => {
        const environment = await setupTestDOM();
        const document = environment.document;

        // Allow microtasks and safeRAF to complete
        await sleep(50);

        // After initialization completes, suppress-transitions should be cleanly removed for interactive navigation
        expect(document.body.classList.contains('suppress-transitions')).toBe(false);
    });

    it('applies active and inert classes instantly without animation classes when restoring active view on load', async () => {
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

    it('renders in-progress question immediately without triggering question transition animations on load', async () => {
        const savedCheckin = createSampleCheckIn({
            checkinAnswers: [
                { questionId: 'q_energy', score: 4, status: 'answered' },
                { questionId: 'q_sadness', score: 2, status: 'answered' }
            ],
            checkinNote: null
        });

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

    it('does not trigger view or question transition animations on theme and contrast updates', async () => {
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

    it('clears all question transition classes so content remains visible when completing check-in', async () => {
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