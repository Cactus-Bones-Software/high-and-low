// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    setupTestDOM,
    createSampleGraphQuestions,
    createSampleTwoDayLogs
} from './test-utils.js';
import { renderLineGraph } from '../public/js/ui/history-graph.js';

let windowInstance;
let documentInstance;

function renderSampleTwoDayGraph() {
    const container = documentInstance.createElement('div');
    const questions = createSampleGraphQuestions();
    const logs = createSampleTwoDayLogs();
    renderLineGraph(container, { entries: logs, questions });
    return { container, questions, logs };
}

function expectGraphLegendAndLines(container, checkedStates, expectedPathsCount, expectedPointsCount) {
    const items = Array.from(container.querySelectorAll('.legend-checklist-item'));
    if (checkedStates) {
        checkedStates.forEach((state, index) => {
            expect(items[index].getAttribute('aria-checked')).toBe(state ? 'true' : 'false');
        });
    }
    if (typeof expectedPathsCount === 'number') {
        expect(container.querySelectorAll('svg g.lines path').length).toBe(expectedPathsCount);
    }
    if (typeof expectedPointsCount === 'number') {
        expect(container.querySelectorAll('svg g.points circle').length).toBe(expectedPointsCount);
    }
    return items;
}

function simulateLongPress(windowInstance, element, durationMs = 500) {
    const pointerDownEvent = new windowInstance.PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 100,
        clientY: 100
    });
    element.dispatchEvent(pointerDownEvent);
    vi.advanceTimersByTime(durationMs);
}

describe('Graph Legend Checklist and Series Isolation Controls', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('toggles question line visibility when tapping legend checklist rows and prevents toggling to zero', () => {
        const { container } = renderSampleTwoDayGraph();

        // Initial state: 3 lines, 3 legend checklist buttons with aria-checked="true"
        let items = expectGraphLegendAndLines(container, [true, true, true], 3, 6);

        // Click item 1 (q1) -> toggles q1 off
        items[0].click();
        items = expectGraphLegendAndLines(container, [false, true, true], 2, 4);

        // Click item 2 (q2) -> toggles q2 off
        items[1].click();
        items = expectGraphLegendAndLines(container, [false, false, true], 1, 2);

        // Toggle off the last remaining visible question (q3) -> allows 0 lines visible
        items[2].click();
        items = expectGraphLegendAndLines(container, [false, false, false], 0, 0);

        // Click item 1 (q1) again -> toggles q1 back on (now q1 is visible)
        items[0].click();
        expectGraphLegendAndLines(container, [true, false, false], 1, 2);
    });

    it('isolates a single question on long-press (450ms) and restores all on second long-press', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { container } = renderSampleTwoDayGraph();

        let items = expectGraphLegendAndLines(container, [true, true, true], 3, 6);

        // Simulate long-press pointerdown on item 1 (q2)
        simulateLongPress(windowInstance, items[1], 500);

        // Graph should now be isolated to q2 alone
        items = expectGraphLegendAndLines(container, [false, true, false], 1, 2);

        // Long-press q2 again while isolated to restore all
        simulateLongPress(windowInstance, items[1], 500);

        expectGraphLegendAndLines(container, [true, true, true], 3, 6);
    });

    it('isolates and restores questions via accessible per-row isolate button', () => {
        const { container } = renderSampleTwoDayGraph();

        let isolateButtons = Array.from(container.querySelectorAll('.legend-isolate-button'));
        expect(isolateButtons.length).toBe(3);

        // Click isolate button on question 2 (Sadness)
        isolateButtons[1].click();

        expectGraphLegendAndLines(container, [false, true, false], 1);

        isolateButtons = Array.from(container.querySelectorAll('.legend-isolate-button'));
        expect(isolateButtons[1].classList.contains('is-isolated')).toBe(true);
        expect(isolateButtons[1].getAttribute('aria-label')).toContain('Restore all');

        // Click isolate button on question 2 again while isolated -> restores all
        isolateButtons[1].click();

        expectGraphLegendAndLines(container, [true, true, true], 3);

        isolateButtons = Array.from(container.querySelectorAll('.legend-isolate-button'));
        expect(isolateButtons[1].classList.contains('is-isolated')).toBe(false);
        expect(isolateButtons[1].getAttribute('aria-label')).toContain('Isolate Sadness');
    });

    it('provides Show all and Clear all quick action buttons for fast timeline filter reset', () => {
        const { container } = renderSampleTwoDayGraph();

        const showAllButton = container.querySelector('#button-legend-show-all');
        const clearAllButton = container.querySelector('#button-legend-clear-all');

        expect(showAllButton).toBeTruthy();
        expect(clearAllButton).toBeTruthy();

        // Click Clear All -> clears all questions (0 lines)
        clearAllButton.click();
        expectGraphLegendAndLines(container, [false, false, false], 0, 0);

        // Click Show All -> restores all questions
        showAllButton.click();
        expectGraphLegendAndLines(container, [true, true, true], 3);
    });
});
