// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, sleep, createSampleGraphQuestions, createSampleTwoDayLogs } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

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

async function simulateLongPress(windowInstance, element, durationMs = 500) {
    const pointerDownEvent = new windowInstance.PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 100,
        clientY: 100
    });
    element.dispatchEvent(pointerDownEvent);
    await sleep(durationMs);
}

describe('History Timeline & Gap Handling Tests (Task 3.4)', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('renders empty placeholder when no logs exist', () => {
        const container = documentInstance.createElement('div');
        windowInstance.renderLineGraph(container, { entries: [], questions: [] });
        expect(container.textContent).toContain('No recorded mood history yet');
    });

    it('distinguishes answered points, skipped gaps with markers, and absent gaps without markers', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Overall Mood', shortLabel: 'Mood', curve: 'more-is-better' },
            { id: 'q2', text: 'Anxiety Level', shortLabel: 'Anxiety', curve: 'less-is-better' }
        ];

        // 4 logs:
        // Day 1: q1=4 (answered), q2=2 (answered)
        // Day 2: q1 skipped (status: skipped), q2=3 (answered)
        // Day 3: q1 absent (not in answers), q2 skipped (status: skipped)
        // Day 4: q1=5 (answered), q2=1 (answered)
        const logs = [
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: null, status: 'skipped' },
                    { questionId: 'q2', score: 3, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-12T10:00:00.000Z',
                answers: [
                    // q1 is absent (wasn't asked / not in active set)
                    { questionId: 'q2', score: null, status: 'skipped' }
                ]
            },
            {
                timestamp: '2026-08-13T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 5, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        // 1. Check line paths:
        // For q1: answered on Day 1 (1 point) and Day 4 (1 point). Because both are isolated single-point segments, no continuous path connecting Day 1 to Day 4 across Day 2/3!
        // For q2: answered Day 1 & Day 2 (connected segment length 2), then skipped Day 3 (break), then answered Day 4 (1 point).
        const paths = container.querySelectorAll('svg g.lines path');
        expect(paths.length).toBe(1); // Only q2 has a contiguous segment of length >= 2 (Day 1 -> Day 2)

        // 2. Check points:
        // q1: 2 answered points (Day 1, Day 4)
        // q2: 3 answered points (Day 1, Day 2, Day 4)
        // Total = 5 answered points
        const points = container.querySelectorAll('svg g.points circle');
        expect(points.length).toBe(5);

        // 3. Check skip markers:
        // q1 has 1 skip marker (Day 2)
        // q2 has 1 skip marker (Day 3)
        // Total = 2 skip markers
        const skipMarkers = container.querySelectorAll('svg g.skips .skip-marker');
        expect(skipMarkers.length).toBe(2);

        // Verify titles/labels on skip markers
        const skipLabels = Array.from(skipMarkers).map(marker => marker.getAttribute('aria-label'));
        expect(skipLabels.some(label => label.includes('Mood') && label.includes('Skipped'))).toBe(true);
        expect(skipLabels.some(label => label.includes('Anxiety') && label.includes('Skipped'))).toBe(true);

        // 4. Verify guide key is present
        expect(container.textContent).toContain('Answered');
        expect(container.textContent).toContain('Skipped');
        expect(container.textContent).toContain('Not Asked');
    });

    it('proportionally scales X-axis based on elapsed time for intra-day and irregular intervals', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
        ];

        // 3 logs on same day:
        // Log 1: 08:00 (t0)
        // Log 2: 10:00 (t0 + 2h -> 2/10 = 20% of span)
        // Log 3: 18:00 (t0 + 10h -> 10/10 = 100% of span)
        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            },
            {
                timestamp: '2026-08-14T10:00:00.000Z',
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const points = Array.from(container.querySelectorAll('svg g.points circle'));
        expect(points.length).toBe(3);

        const x0 = parseFloat(points[0].getAttribute('cx'));
        const x1 = parseFloat(points[1].getAttribute('cx'));
        const x2 = parseFloat(points[2].getAttribute('cx'));

        // Proportional distance: (x1 - x0) / (x2 - x0) should be approx 2/10 = 0.2
        const totalDistance = x2 - x0;
        const subDistance = x1 - x0;
        const ratio = subDistance / totalDistance;

        expect(ratio).toBeCloseTo(0.2, 2);

        // Tooltips should have date and time
        const titleText = points[0].querySelector('title').textContent;
        expect(titleText).toContain('Energy');
        expect(titleText).toContain('8/14/2026');
    });

    it('enables recording multiple check-ins without refreshing the page', async () => {
        // Complete a check-in
        windowInstance.finalizeCheckin();
        await sleep(50);

        const progressElement = documentInstance.getElementById('progress-text');
        const questionElement = documentInstance.getElementById('question-text');
        const newCheckinButton = documentInstance.getElementById('button-new-checkin');
        const footerBox = documentInstance.getElementById('footer-box');

        expect(progressElement.textContent).toBe('Check-In Complete');
        expect(questionElement.textContent).toBe('Mood recorded. Rest easy.');
        expect(newCheckinButton).toBeTruthy();
        expect(footerBox.style.display).toBe('none');

        // Click "Record Another Check-In"
        newCheckinButton.click();
        await sleep(50);

        // Canvas should reset back to active Question 1
        expect(documentInstance.getElementById('progress-text').textContent).toContain('Question 1 of');
        expect(documentInstance.getElementById('button-stack').querySelectorAll('.score-button').length).toBeGreaterThan(0);
        expect(footerBox.style.display).not.toBe('none');
    });

    it('assigns distinct stroke-dasharray patterns to each active question line (Task 3.5)', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q3', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' },
            { id: 'q4', text: 'Irritability', shortLabel: 'Irritable', curve: 'less-is-better' }
        ];

        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' },
                    { questionId: 'q3', score: 4, status: 'answered' },
                    { questionId: 'q4', score: 1, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' },
                    { questionId: 'q3', score: 5, status: 'answered' },
                    { questionId: 'q4', score: 2, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const paths = Array.from(container.querySelectorAll('svg g.lines path'));
        expect(paths.length).toBe(4);

        // First line is solid (no dasharray or 'none')
        const dash0 = paths[0].getAttribute('stroke-dasharray');
        expect(dash0 === null || dash0 === 'none').toBe(true);

        // Lines 2, 3, 4 must have distinct dash patterns
        const dash1 = paths[1].getAttribute('stroke-dasharray');
        const dash2 = paths[2].getAttribute('stroke-dasharray');
        const dash3 = paths[3].getAttribute('stroke-dasharray');

        expect(dash1).toBe('6,4');
        expect(dash2).toBe('2,3');
        expect(dash3).toBe('8,3,2,3');

        // All 4 dash patterns are unique
        const patterns = [dash0 || 'solid', dash1, dash2, dash3];
        const uniquePatterns = new Set(patterns);
        expect(uniquePatterns.size).toBe(4);

        // Legend swatches must contain preview dash SVG indicators
        const legendSwatches = container.querySelectorAll('.graph-legend .legend-swatch');
        expect(legendSwatches.length).toBe(4);
    });

    it('toggles question line visibility when tapping legend checklist rows and prevents toggling to zero (Task 3.6)', () => {
        const container = documentInstance.createElement('div');
        const questions = createSampleGraphQuestions();
        const logs = createSampleTwoDayLogs();

        windowInstance.renderLineGraph(container, { entries: logs, questions });

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

    it('isolates a single question on long-press (450ms) and restores all on second long-press (Task 3.7)', async () => {
        const container = documentInstance.createElement('div');
        const questions = createSampleGraphQuestions();
        const logs = createSampleTwoDayLogs();

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        let items = expectGraphLegendAndLines(container, [true, true, true], 3, 6);

        // Simulate long-press pointerdown on item 1 (q2)
        await simulateLongPress(windowInstance, items[1], 500);

        // Graph should now be isolated to q2 alone
        items = expectGraphLegendAndLines(container, [false, true, false], 1, 2);

        // Long-press q2 again while isolated to restore all
        await simulateLongPress(windowInstance, items[1], 500);

        expectGraphLegendAndLines(container, [true, true, true], 3, 6);
    });

    it('isolates and restores questions via accessible per-row isolate button (Task 3.8)', () => {
        const container = documentInstance.createElement('div');
        const questions = createSampleGraphQuestions();
        const logs = createSampleTwoDayLogs();

        windowInstance.renderLineGraph(container, { entries: logs, questions });

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

    it('provides Show all and Clear all quick action buttons for fast timeline filter reset (Task 3.8)', () => {
        const container = documentInstance.createElement('div');
        const questions = createSampleGraphQuestions();
        const logs = createSampleTwoDayLogs();

        windowInstance.renderLineGraph(container, { entries: logs, questions });

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

    it('preserves timeline scroll position when using Show all or Clear all', () => {
        const container = documentInstance.createElement('div');
        const questions = createSampleGraphQuestions();
        const logs = createSampleTwoDayLogs();

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const scrollContainer = container.querySelector('.graph-scroll-container');
        expect(scrollContainer).toBeTruthy();

        Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1200, configurable: true });
        Object.defineProperty(scrollContainer, 'clientWidth', { value: 400, configurable: true });
        scrollContainer.scrollLeft = 250;

        container.querySelector('#button-legend-clear-all').click();
        const scrollAfterClear = container.querySelector('.graph-scroll-container');
        expect(scrollAfterClear.scrollLeft).toBe(250);

        container.querySelector('#button-legend-show-all').click();
        const scrollAfterShow = container.querySelector('.graph-scroll-container');
        expect(scrollAfterShow.scrollLeft).toBe(250);
    });

    it('renders note indicators on timeline and opens note modal with content on tap or keyboard interaction (Task 3.9)', async () => {
        const container = documentInstance.getElementById('panel-history');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' }
        ];

        // 4 logs:
        // Day 1: With note
        // Day 2: note is null (no marker)
        // Day 3: note is whitespace string (no marker)
        // Day 4: With note
        const logs = [
            {
                timestamp: '2026-08-10T09:00:00.000Z',
                note: 'Felt well-rested after 8 hours of sleep.',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-11T09:00:00.000Z',
                note: null,
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-12T09:00:00.000Z',
                note: '   ',
                answers: [
                    { questionId: 'q1', score: 2, status: 'answered' },
                    { questionId: 'q2', score: 4, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-13T09:00:00.000Z',
                note: 'Sudden spike in agitation after difficult meeting.',
                answers: [
                    { questionId: 'q1', score: 2, status: 'answered' },
                    { questionId: 'q2', score: 5, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        // 1. Verify only 2 note markers are rendered (for Day 1 and Day 4)
        const noteMarkers = Array.from(container.querySelectorAll('svg g.notes .note-marker'));
        expect(noteMarkers.length).toBe(2);

        // 2. Verify marker attributes and accessibility
        const firstMarker = noteMarkers[0];
        expect(firstMarker.getAttribute('role')).toBe('button');
        expect(firstMarker.getAttribute('tabindex')).toBe('0');
        expect(firstMarker.getAttribute('aria-label')).toContain('Felt well-rested');
        expect(firstMarker.querySelector('title').textContent).toContain('Felt well-rested');

        const secondMarker = noteMarkers[1];
        expect(secondMarker.getAttribute('aria-label')).toContain('Sudden spike in agitation');

        // 3. Click first note marker and verify notice modal dialog opens with note content
        firstMarker.dispatchEvent(new windowInstance.MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(80);

        const overlayElement = documentInstance.getElementById('notice-dialog-overlay');
        const titleElement = documentInstance.getElementById('notice-dialog-title');
        const subtitleElement = documentInstance.getElementById('notice-dialog-subtitle');

        expect(overlayElement.classList.contains('is-open')).toBe(true);
        expect(overlayElement.getAttribute('aria-hidden')).toBe('false');
        expect(titleElement.textContent).toContain('Check-In Note');
        expect(subtitleElement.textContent).toBe('Felt well-rested after 8 hours of sleep.');
        expect(subtitleElement.classList.contains('notice-note-content')).toBe(true);

        // Close dialog
        const okButton = documentInstance.getElementById('button-notice-ok');
        okButton.click();
        await sleep(50);
        expect(overlayElement.classList.contains('is-open')).toBe(false);

        // 4. Test keyboard activation (Enter key) on second note marker
        secondMarker.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await sleep(80);

        expect(overlayElement.classList.contains('is-open')).toBe(true);
        expect(subtitleElement.textContent).toBe('Sudden spike in agitation after difficult meeting.');

        // Close via Escape key
        overlayElement.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(50);
        expect(overlayElement.classList.contains('is-open')).toBe(false);
    });

    it('renders timeframe presets toolbar and filters data points by selected window (Task 3.10)', async () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Overall Mood', shortLabel: 'Mood', curve: 'more-is-better' }
        ];

        // 5 entries spanning 40 days:
        // Day 0: 40 days ago
        // Day 1: 20 days ago
        // Day 2: 10 days ago
        // Day 3: 5 days ago
        // Day 4: today
        const now = Date.now();
        const logs = [
            {
                timestamp: new Date(now - 40 * 24 * 3600 * 1000).toISOString(),
                answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
            },
            {
                timestamp: new Date(now - 20 * 24 * 3600 * 1000).toISOString(),
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            },
            {
                timestamp: new Date(now - 10 * 24 * 3600 * 1000).toISOString(),
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            },
            {
                timestamp: new Date(now - 5 * 24 * 3600 * 1000).toISOString(),
                answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
            },
            {
                timestamp: new Date(now).toISOString(),
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        // 1. Check timeframe toolbar existence and buttons
        const toolbar = container.querySelector('.graph-timeframe-toolbar');
        expect(toolbar).toBeTruthy();
        const timeframeButtons = Array.from(container.querySelectorAll('.graph-timeframe-button'));
        expect(timeframeButtons.length).toBe(5);
        expect(timeframeButtons.map(button => button.dataset.range)).toEqual(['7d', '14d', '30d', '90d', 'all']);

        // Default 'all' range should render all 5 points
        let points = container.querySelectorAll('svg g.points circle');
        expect(points.length).toBe(5);

        // 2. Test timeframe filtering for preset intervals
        const timeframeTestCases = [
            { range: '7d', expectedPoints: 2, assertActive: true },
            { range: '14d', expectedPoints: 3 },
            { range: '30d', expectedPoints: 4 },
            { range: 'all', expectedPoints: 5 }
        ];

        for (const testCase of timeframeTestCases) {
            const button = container.querySelector(`.graph-timeframe-button[data-range="${testCase.range}"]`);
            button.click();
            await sleep(50);

            points = container.querySelectorAll('svg g.points circle');
            expect(points.length).toBe(testCase.expectedPoints);
            if (testCase.assertActive) {
                expect(container.querySelector(`.graph-timeframe-button[data-range="${testCase.range}"]`).classList.contains('is-active')).toBe(true);
            }
        }
    });

    it('scales SVG width dynamically and provides horizontal scroll container for dense entries (Task 3.10)', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
        ];

        // Generate 25 entries spaced across 25 days
        const now = Date.now();
        const logs = [];
        for (let entryIndex = 0; entryIndex < 25; entryIndex++) {
            logs.push({
                timestamp: new Date(now - (24 - entryIndex) * 24 * 3600 * 1000).toISOString(),
                answers: [{ questionId: 'q1', score: (entryIndex % 5) + 1, status: 'answered' }]
            });
        }

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        // 1. Verify scroll container is present with appropriate region role & tabindex
        const scrollContainer = container.querySelector('.graph-scroll-container');
        expect(scrollContainer).toBeTruthy();
        expect(scrollContainer.getAttribute('role')).toBe('region');
        expect(scrollContainer.getAttribute('tabindex')).toBe('0');
        expect(container.querySelector('.graph-scroll-content')).toBeTruthy();

        // 2. Verify SVG width expands dynamically to provide comfortable point spacing (minimum 48px per point)
        const svgElement = container.querySelector('svg.graph-svg');
        expect(svgElement).toBeTruthy();
        const viewBox = svgElement.getAttribute('viewBox');
        expect(viewBox).toBeTruthy();
        const [, , width] = viewBox.split(' ').map(Number);
        // With 25 entries: 42 + 24 * 48 = 1194px; viewport deadspace is CSS-owned.
        expect(width).toBeGreaterThan(600);
        expect(width).toBe(42 + 24 * 48);
    });

    it('renders zoom toolbar with accessible zoom in, zoom out, and reset buttons (Task 3.11)', () => {
        const container = documentInstance.createElement('div');
        const questions = createSampleGraphQuestions();
        const logs = createSampleTwoDayLogs();

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const zoomToolbar = container.querySelector('.graph-zoom-toolbar');
        expect(zoomToolbar).toBeTruthy();
        expect(zoomToolbar.getAttribute('role')).toBe('toolbar');
        expect(zoomToolbar.getAttribute('aria-label')).toBe('Timeline zoom controls');

        const zoomOutBtn = container.querySelector('#button-graph-zoom-out');
        const resetBtn = container.querySelector('#button-graph-zoom-reset');
        const zoomInBtn = container.querySelector('#button-graph-zoom-in');
        const zoomValue = container.querySelector('.graph-zoom-value');

        expect(zoomOutBtn).toBeTruthy();
        expect(zoomOutBtn.getAttribute('aria-label')).toBe('Zoom out timeline');
        expect(zoomOutBtn.disabled).toBe(false);

        expect(resetBtn).toBeTruthy();
        expect(resetBtn.getAttribute('aria-label')).toBe('Reset timeline zoom');
        // Reset button is disabled at default 1.0x scale
        expect(resetBtn.disabled).toBe(true);

        expect(zoomInBtn).toBeTruthy();
        expect(zoomInBtn.getAttribute('aria-label')).toBe('Zoom in timeline');
        expect(zoomInBtn.disabled).toBe(false);

        expect(zoomValue).toBeTruthy();
        expect(zoomValue.getAttribute('aria-live')).toBe('polite');
        expect(zoomValue.textContent).toBe('1.0×');
    });

    it('dynamically adjusts horizontal point spacing and SVG width on zoom, with button disabled bounds (Task 3.11)', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
        ];

        // 5 entries spaced 1 day apart
        const now = Date.now();
        const logs = [];
        for (let i = 0; i < 5; i++) {
            logs.push({
                timestamp: new Date(now - (4 - i) * 86400000).toISOString(),
                answers: [{ questionId: 'q1', score: (i % 5) + 1, status: 'answered' }]
            });
        }

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const getSvgWidth = () => {
            const svg = container.querySelector('svg.graph-svg');
            const [, , width] = svg.getAttribute('viewBox').split(' ').map(Number);
            return width;
        };

        const initialWidth = getSvgWidth();
        // Base width for 5 entries: 42 + 4 * 48 = 234px
        expect(initialWidth).toBe(234);

        const zoomInBtn = container.querySelector('#button-graph-zoom-in');
        const zoomOutBtn = container.querySelector('#button-graph-zoom-out');
        const resetBtn = container.querySelector('#button-graph-zoom-reset');
        const zoomValue = container.querySelector('.graph-zoom-value');

        // Zoom In to 1.25x
        zoomInBtn.click();
        expect(zoomValue.textContent).toBe('1.25×');
        expect(resetBtn.disabled).toBe(false);
        const width125 = getSvgWidth();
        // 42 + 4 * (48 * 1.25) = 42 + 4 * 60 = 282px
        expect(width125).toBe(282);
        expect(width125).toBeGreaterThan(initialWidth);

        // Zoom In repeatedly to max scale (3.0x)
        // From 1.25x -> 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0 (7 more clicks)
        for (let click = 0; click < 7; click++) {
            zoomInBtn.click();
        }
        expect(zoomValue.textContent).toBe('3.0×');
        expect(zoomInBtn.disabled).toBe(true);
        expect(zoomOutBtn.disabled).toBe(false);
        const width300 = getSvgWidth();
        // 42 + 4 * (48 * 3.0) = 42 + 4 * 144 = 618px
        expect(width300).toBe(618);

        // Reset to default 1.0x scale
        resetBtn.click();
        expect(zoomValue.textContent).toBe('1.0×');
        expect(resetBtn.disabled).toBe(true);
        expect(zoomInBtn.disabled).toBe(false);
        expect(getSvgWidth()).toBe(initialWidth);

        // Zoom Out repeatedly to min scale (0.5x)
        // 1.0x -> 0.75x -> 0.5x (2 clicks)
        zoomOutBtn.click();
        expect(zoomValue.textContent).toBe('0.75×');
        expect(resetBtn.disabled).toBe(false);

        zoomOutBtn.click();
        expect(zoomValue.textContent).toBe('0.5×');
        expect(zoomOutBtn.disabled).toBe(true);
        expect(zoomInBtn.disabled).toBe(false);
        const width050 = getSvgWidth();
        // 42 + 4 * (48 * 0.5) = 42 + 4 * 24 = 138px
        expect(width050).toBe(138);
        expect(width050).toBeLessThan(initialWidth);
    });

    it('repositions graph points across the full zoomed width instead of leaving them clustered at the old scale', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
        ];
        const now = Date.now();
        const logs = [];
        for (let entryIndex = 0; entryIndex < 5; entryIndex++) {
            logs.push({
                timestamp: new Date(now - (4 - entryIndex) * 86400000).toISOString(),
                answers: [{ questionId: 'q1', score: (entryIndex % 5) + 1, status: 'answered' }]
            });
        }

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const getLastPointX = () => {
            const points = container.querySelectorAll('svg g.points circle');
            return Number(points[points.length - 1].getAttribute('cx'));
        };

        expect(getLastPointX()).toBe(234);

        container.querySelector('#button-graph-zoom-in').click();

        // At 1.25x, the last point must move to the new chart edge:
        // width = 42 + 4 * 60 = 282, so the last point is at the SVG edge.
        expect(getLastPointX()).toBe(282);
    });

    it('preserves horizontal viewport center anchor when zooming (Task 3.11)', () => {
        const container = documentInstance.createElement('div');
        const questions = createSampleGraphQuestions();
        const logs = createSampleTwoDayLogs();

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const scrollContainer = container.querySelector('.graph-scroll-container');
        expect(scrollContainer).toBeTruthy();

        // Simulate layout dimensions
        Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1200, configurable: true });
        Object.defineProperty(scrollContainer, 'clientWidth', { value: 400, configurable: true });
        scrollContainer.scrollLeft = 200;

        // Old center in content coords = scrollLeft + clientWidth / 2 = 200 + 200 = 400
        // Zooming from 1.0x to 1.25x -> ratio = 1.25
        // New center in content coords = 400 * 1.25 = 500
        // Target scrollLeft = 500 - 200 = 300
        const zoomInBtn = container.querySelector('#button-graph-zoom-in');
        zoomInBtn.click();

        const updatedScrollContainer = container.querySelector('.graph-scroll-container');
        expect(updatedScrollContainer.scrollLeft).toBe(300);
    });

    it('includes all answered questions from entries in addition to active questions when loading history view', async () => {
        // Seed 7 questions in IDB
        const allQuestions = [
            { id: 'q_energy', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q_sadness', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q_worth', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' },
            { id: 'q_irritability', text: 'Irritability', shortLabel: 'Irritability', curve: 'less-is-better' },
            { id: 'q_racing', text: 'Racing Thoughts', shortLabel: 'Racing', curve: 'less-is-better' },
            { id: 'q_impulse', text: 'Restless Urges', shortLabel: 'Impulse', curve: 'less-is-better' },
            { id: 'q_overall', text: 'Overall Mood', shortLabel: 'Overall', curve: 'more-is-better' }
        ];

        for (const question of allQuestions) {
            await windowInstance.put('questions', question);
        }

        // Active question set only has 4 questions
        await windowInstance.setConfig('activeQuestionSet', ['q_energy', 'q_sadness', 'q_irritability', 'q_overall']);

        // Seed entries with answers for all 7 questions
        await windowInstance.put('entries', {
            id: 'entry_1',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            answers: {
                q_energy: 3,
                q_sadness: 2,
                q_worth: 4,
                q_irritability: 1,
                q_racing: 5,
                q_impulse: 2,
                q_overall: 4
            }
        });
        await windowInstance.put('entries', {
            id: 'entry_2',
            timestamp: new Date().toISOString(),
            answers: {
                q_energy: 4,
                q_sadness: 1,
                q_worth: 5,
                q_irritability: 2,
                q_racing: 3,
                q_impulse: 1,
                q_overall: 5
            }
        });

        await windowInstance.loadHistoryView();

        const historyGraphContainer = documentInstance.getElementById('history-graph-container');
        expect(historyGraphContainer).toBeTruthy();

        // Verify all 7 legend items are rendered
        const legendItems = historyGraphContainer.querySelectorAll('.legend-checklist-item');
        expect(legendItems.length).toBe(7);

        // Verify 7 lines are rendered in SVG
        const paths = historyGraphContainer.querySelectorAll('svg g.lines path');
        expect(paths.length).toBe(7);
    });

    it('captures vertical wheel events over timeline and converts delta to horizontal scroll', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Overall Mood', shortLabel: 'Mood', curve: 'more-is-better' }
        ];
        const entries = [
            { id: 'entry_1', timestamp: new Date(Date.now() - 86400000).toISOString(), answers: [{ questionId: 'q1', score: 3, status: 'answered' }] },
            { id: 'entry_2', timestamp: new Date().toISOString(), answers: [{ questionId: 'q1', score: 4, status: 'answered' }] }
        ];
        windowInstance.renderLineGraph(container, { entries, questions });

        const scrollContainer = container.querySelector('.graph-scroll-container');
        expect(scrollContainer).toBeTruthy();

        // Mock scroll dimensions so scrollWidth > clientWidth
        Object.defineProperty(scrollContainer, 'scrollWidth', { value: 1200, configurable: true });
        Object.defineProperty(scrollContainer, 'clientWidth', { value: 400, configurable: true });
        scrollContainer.scrollLeft = 100;

        let defaultPrevented = false;
        const wheelEvent = new windowInstance.Event('wheel', { bubbles: true, cancelable: true });
        Object.defineProperty(wheelEvent, 'deltaY', { value: 50 });
        Object.defineProperty(wheelEvent, 'deltaX', { value: 0 });
        wheelEvent.preventDefault = () => { defaultPrevented = true; };

        scrollContainer.dispatchEvent(wheelEvent);

        expect(defaultPrevented).toBe(true);
        expect(scrollContainer.scrollLeft).toBe(150);
    });

    describe('computeGraphLayout pure layout computation (Task 4.13)', () => {
        it('returns empty layout state when no entries or questions are provided', () => {
            const emptyEntriesLayout = windowInstance.computeGraphLayout({
                entries: [],
                questions: [{ id: 'q1', text: 'Mood', shortLabel: 'Mood', curve: 'more-is-better' }]
            });
            expect(emptyEntriesLayout.isEmpty).toBe(true);
            expect(emptyEntriesLayout.reason).toBe('no-entries');

            const emptyQuestionsLayout = windowInstance.computeGraphLayout({
                entries: [{
                    timestamp: new Date().toISOString(),
                    answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
                }],
                questions: []
            });
            expect(emptyQuestionsLayout.isEmpty).toBe(true);
            expect(emptyQuestionsLayout.reason).toBe('no-questions');
        });

        it('calculates timeframe window filtering and coordinate scaling without DOM', () => {
            const now = Date.now();
            const questions = [
                { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
            ];
            const entries = [
                {
                    timestamp: new Date(now - 40 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: 1, status: 'answered' }]
                },
                {
                    timestamp: new Date(now - 20 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
                },
                {
                    timestamp: new Date(now - 5 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                },
                {
                    timestamp: new Date(now).toISOString(),
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                }
            ];

            // 7-day window layout
            const sevenDayLayout = windowInstance.computeGraphLayout({
                entries,
                questions,
                timeRange: '7d'
            });
            expect(sevenDayLayout.isEmpty).toBe(false);
            expect(sevenDayLayout.filteredEntries.length).toBe(2);

            // All-time window layout
            const allTimeLayout = windowInstance.computeGraphLayout({
                entries,
                questions,
                timeRange: 'all'
            });
            expect(allTimeLayout.filteredEntries.length).toBe(4);

            // Verify coordinate calculations
            // paddingTop = 24, paddingBottom = 60, height = 320 -> chartHeight = 236
            // score 5 -> top (y = 24)
            // score 1 -> bottom (y = 260)
            // score 3 -> middle (y = 142)
            expect(allTimeLayout.scales.getY(5)).toBe(24);
            expect(allTimeLayout.scales.getY(1)).toBe(260);
            expect(allTimeLayout.scales.getY(3)).toBe(142);

            // Verify grid lines length
            expect(allTimeLayout.gridLines.length).toBe(5);
            expect(allTimeLayout.gridLines[0].score).toBe(1);
            expect(allTimeLayout.gridLines[4].score).toBe(5);
        });

        it('supports zoomScale parameter in computeGraphLayout (Task 3.11)', () => {
            const now = Date.now();
            const questions = [
                { id: 'q1', text: 'Overall Mood', shortLabel: 'Mood', curve: 'more-is-better' }
            ];
            const entries = [
                { timestamp: new Date(now - 2 * 86400000).toISOString(), answers: [{ questionId: 'q1', score: 3, status: 'answered' }] },
                { timestamp: new Date(now - 86400000).toISOString(), answers: [{ questionId: 'q1', score: 4, status: 'answered' }] },
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 5, status: 'answered' }] }
            ];

            const defaultLayout = windowInstance.computeGraphLayout({ entries, questions, zoomScale: 1.0 });
            const zoomedLayout = windowInstance.computeGraphLayout({ entries, questions, zoomScale: 2.0 });

            // Default: 42 + 2 * 48 = 138
            expect(defaultLayout.width).toBe(138);
            // Zoomed (2x): 42 + 2 * (48 * 2.0) = 234
            expect(zoomedLayout.width).toBe(234);
            expect(zoomedLayout.scales.pointSpacing).toBe(96);
        });

        it('separates line segments across skips and records note indicators accurately', () => {
            const now = Date.now();
            const questions = [
                { id: 'q1', text: 'Overall Mood', shortLabel: 'Mood', curve: 'more-is-better' }
            ];
            const entries = [
                {
                    timestamp: new Date(now - 3 * 86400000).toISOString(),
                    note: 'Felt energetic',
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                },
                {
                    timestamp: new Date(now - 2 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: null, status: 'skipped' }]
                },
                {
                    timestamp: new Date(now - 86400000).toISOString(),
                    note: 'Great day',
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                },
                {
                    timestamp: new Date(now).toISOString(),
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                }
            ];

            const layout = windowInstance.computeGraphLayout({ entries, questions });
            expect(layout.series.length).toBe(1);

            const q1Series = layout.series[0];
            // Segment 1: [entry 0], Segment 2: [entry 2, entry 3]
            expect(q1Series.segments.length).toBe(2);
            expect(q1Series.segments[0].length).toBe(1);
            expect(q1Series.segments[1].length).toBe(2);

            // Skip marker
            expect(q1Series.skips.length).toBe(1);
            expect(q1Series.skips[0].questionId).toBe('q1');
            expect(q1Series.skips[0].entryIndex).toBe(1);

            // Notes list
            expect(layout.notes.length).toBe(2);
            expect(layout.notes[0].note).toBe('Felt energetic');
            expect(layout.notes[0].entryIndex).toBe(0);
            expect(layout.notes[1].note).toBe('Great day');
            expect(layout.notes[1].entryIndex).toBe(2);
        });
    });
});
