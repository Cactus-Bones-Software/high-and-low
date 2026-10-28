// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    setupTestDOM,
    waitFor,
    createSampleGraphQuestions,
    createSampleTwoDayLogs,
    createSingleSampleQuestion,
    createSampleOneDayRecentEntries,
    createSampleFourteenDayEntries,
    createSampleEntry,
    mockScrollDimensions
} from './test-utils.js';
import { STATE } from '../public/js/state.js';
import {
    computeGraphLayout,
    renderLineGraph,
    BASE_PIXELS_PER_HOUR,
    loadHistoryView
} from '../public/js/ui/history-graph.js';
import { finalizeCheckin } from '../public/js/checkin.js';
import { put, setConfig } from '../public/js/storage/db.js';

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

/**
 * Computes the rightmost x-coordinate reached by any rendered, data-driven graph content
 * element (x-axis tick lines, plotted data-line paths, point circles, skip markers, and note
 * icon markers) inside a rendered `<svg class="graph-svg">`. Used to detect unaccounted-for
 * dead space: the SVG's declared `width` should never exceed this content edge by more than
 * the chart's own designed `paddingRight`, at any zoom level.
 *
 * Deliberately excludes the `.grid` group (the score gridlines and skip/note baseline lines):
 * those are drawn from `paddingLeft` to `width - paddingRight` by design, so they always
 * stretch to fill whatever `width` the layout produces. Measuring them would make this check
 * tautological — it would "pass" even if `width` itself were wrong, because the gridlines
 * would simply stretch to match. Every element measured here derives its position purely
 * from entry timestamps/padding, independent of the layout's own `width` value, so it can
 * actually catch `width` drifting away from where the real content ends.
 *
 * jsdom does not implement SVG geometry APIs (`getBBox()` etc.), so bounds are derived
 * directly from the rendered attributes instead of relying on layout measurement.
 *
 * @param {SVGElement} svgElement
 * @returns {number} The maximum x-coordinate covered by any data-driven content element.
 */
function getSvgContentRightEdge(svgElement) {
    let maxX = -Infinity;

    function consider(value) {
        if (Number.isFinite(value) && value > maxX) maxX = value;
    }

    const contentSelector = '.x-axis line, .lines path, .points circle, .skips circle, .skips line, .notes rect, .notes path';

    svgElement.querySelectorAll(contentSelector).forEach(element => {
        if (element.tagName === 'circle') {
            const cx = Number(element.getAttribute('cx'));
            const r = Number(element.getAttribute('r')) || 0;
            const strokeWidth = Number(element.getAttribute('stroke-width')) || 0;
            consider(cx + r + strokeWidth / 2);
        } else if (element.tagName === 'line') {
            consider(Number(element.getAttribute('x1')));
            consider(Number(element.getAttribute('x2')));
        } else if (element.tagName === 'rect') {
            const x = Number(element.getAttribute('x'));
            const width = Number(element.getAttribute('width')) || 0;
            consider(x + width);
        } else if (element.tagName === 'path') {
            const pathData = element.getAttribute('d') || '';
            const coordinatePattern = /[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
            for (const match of pathData.matchAll(coordinatePattern)) {
                consider(Number(match[1]));
            }
        }
    });

    return maxX;
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

describe('History Timeline & Gap Handling Tests (Task 3.4)', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders empty placeholder when no logs exist', () => {
        const container = documentInstance.createElement('div');
        renderLineGraph(container, { entries: [], questions: [] });
        expect(container.textContent).toContain('No recorded mood history yet');
    });

    it('renders accessible zoom controls and changes horizontal graph spacing', () => {
        const container = documentInstance.createElement('div');
        const questions = [{ id: 'q1', text: 'Energy level', shortLabel: 'Energy', curve: 'more-is-better' }];
        const entries = [
            createSampleEntry({
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            }),
            createSampleEntry({
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            })
        ];

        renderLineGraph(container, { entries, questions });
        const zoomInButton = container.querySelector('#button-graph-zoom-in');
        const resetButton = container.querySelector('#button-graph-zoom-reset');
        const zoomValue = container.querySelector('.graph-zoom-value');
        const getWidth = () => Number(container.querySelector('svg.graph-svg').getAttribute('viewBox').split(' ')[2]);

        expect(zoomInButton.getAttribute('aria-label')).toBe('Zoom in timeline');
        expect(resetButton.getAttribute('aria-label')).toBe('Reset timeline zoom');
        expect(zoomValue.textContent).toBe('1.0×');
        expect(resetButton.disabled).toBe(true);

        const initialWidth = getWidth();
        zoomInButton.click();

        expect(zoomValue.textContent).toBe('1.25×');
        expect(resetButton.disabled).toBe(false);
        expect(getWidth()).toBeGreaterThan(initialWidth);
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
            createSampleEntry({
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' }
                ]
            }),
            createSampleEntry({
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: null, status: 'skipped' },
                    { questionId: 'q2', score: 3, status: 'answered' }
                ]
            }),
            createSampleEntry({
                timestamp: '2026-08-12T10:00:00.000Z',
                answers: [
                    // q1 is absent (wasn't asked / not in active set)
                    { questionId: 'q2', score: null, status: 'skipped' }
                ]
            }),
            createSampleEntry({
                timestamp: '2026-08-13T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 5, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' }
                ]
            })
        ];

        renderLineGraph(container, { entries: logs, questions });

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
            createSampleEntry({
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            }),
            createSampleEntry({
                timestamp: '2026-08-14T10:00:00.000Z',
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            }),
            createSampleEntry({
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
            })
        ];

        renderLineGraph(container, { entries: logs, questions });

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
        finalizeCheckin();
        const progressElement = documentInstance.getElementById('progress-text');
        await waitFor(() => progressElement.textContent === 'Check-In Complete');

        const questionElement = documentInstance.getElementById('question-text');
        const newCheckinButton = documentInstance.getElementById('button-new-checkin');
        const footerBox = documentInstance.getElementById('footer-box');

        expect(progressElement.textContent).toBe('Check-In Complete');
        expect(questionElement.textContent).toBe('Mood recorded. Rest easy.');
        expect(newCheckinButton).toBeTruthy();
        expect(footerBox.style.display).toBe('none');

        // Click "Record Another Check-In"
        newCheckinButton.click();
        await waitFor(() => documentInstance.getElementById('progress-text').textContent.includes('Question 1 of'));

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
            createSampleEntry({
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' },
                    { questionId: 'q3', score: 4, status: 'answered' },
                    { questionId: 'q4', score: 1, status: 'answered' }
                ]
            }),
            createSampleEntry({
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' },
                    { questionId: 'q3', score: 5, status: 'answered' },
                    { questionId: 'q4', score: 2, status: 'answered' }
                ]
            })
        ];

        renderLineGraph(container, { entries: logs, questions });

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

    it('isolates a single question on long-press (450ms) and restores all on second long-press (Task 3.7)', () => {
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

    it('isolates and restores questions via accessible per-row isolate button (Task 3.8)', () => {
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

    it('provides Show all and Clear all quick action buttons for fast timeline filter reset (Task 3.8)', () => {
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
            createSampleEntry({
                timestamp: '2026-08-10T09:00:00.000Z',
                note: 'Felt well-rested after 8 hours of sleep.',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' }
                ]
            }),
            createSampleEntry({
                timestamp: '2026-08-11T09:00:00.000Z',
                note: null,
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' }
                ]
            }),
            createSampleEntry({
                timestamp: '2026-08-12T09:00:00.000Z',
                note: '   ',
                answers: [
                    { questionId: 'q1', score: 2, status: 'answered' },
                    { questionId: 'q2', score: 4, status: 'answered' }
                ]
            }),
            createSampleEntry({
                timestamp: '2026-08-13T09:00:00.000Z',
                note: 'Sudden spike in agitation after difficult meeting.',
                answers: [
                    { questionId: 'q1', score: 2, status: 'answered' },
                    { questionId: 'q2', score: 5, status: 'answered' }
                ]
            })
        ];

        renderLineGraph(container, { entries: logs, questions });

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
        const overlayElement = documentInstance.getElementById('notice-dialog-overlay');
        await waitFor(() => overlayElement.classList.contains('is-open'));

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
        await waitFor(() => !overlayElement.classList.contains('is-open'));
        expect(overlayElement.classList.contains('is-open')).toBe(false);

        // 4. Test keyboard activation (Enter key) on second note marker
        secondMarker.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await waitFor(() => overlayElement.classList.contains('is-open'));

        expect(subtitleElement.textContent).toBe('Sudden spike in agitation after difficult meeting.');

        // Close via Escape key
        overlayElement.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await waitFor(() => !overlayElement.classList.contains('is-open'));
        expect(overlayElement.classList.contains('is-open')).toBe(false);
    });

    it('renders timeframe presets toolbar and keeps all data points rendered across timeframe selection (Task 3.10, Task 9.2)', async () => {
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
            createSampleEntry({
                baseTimestamp: now,
                daysAgo: 40,
                answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
            }),
            createSampleEntry({
                baseTimestamp: now,
                daysAgo: 20,
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            }),
            createSampleEntry({
                baseTimestamp: now,
                daysAgo: 10,
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            }),
            createSampleEntry({
                baseTimestamp: now,
                daysAgo: 5,
                answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
            }),
            createSampleEntry({
                baseTimestamp: now,
                daysAgo: 0,
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            })
        ];

        renderLineGraph(container, { entries: logs, questions });

        // 1. Check timeframe toolbar existence and buttons
        const toolbar = container.querySelector('.graph-timeframe-toolbar');
        expect(toolbar).toBeTruthy();
        const timeframeButtons = Array.from(container.querySelectorAll('.graph-timeframe-button'));
        expect(timeframeButtons.length).toBe(5);
        expect(timeframeButtons.map(button => button.dataset.range)).toEqual(['7d', '14d', '30d', '90d', 'all']);
        expect(timeframeButtons.map(button => button.textContent.trim())).toEqual(['~7D', '~14D', '~30D', '~90D', 'All']);
        expect(timeframeButtons.map(button => button.getAttribute('aria-label'))).toEqual([
            'Zoom to ~7 days',
            'Zoom to ~14 days',
            'Zoom to ~30 days',
            'Zoom to ~90 days',
            'Zoom to all entries'
        ]);

        // Default 'all' range should render all 5 points
        let points = container.querySelectorAll('svg g.points circle');
        expect(points.length).toBe(5);

        // 2. Test timeframe selection maintains all points rendered (always-render-everything model)
        const timeframeTestCases = [
            { range: '7d', assertActive: true },
            { range: '14d' },
            { range: '30d' },
            { range: 'all' }
        ];

        for (const testCase of timeframeTestCases) {
            const button = container.querySelector(`.graph-timeframe-button[data-range="${testCase.range}"]`);
            button.click();
            await waitFor(() => {
                const targetButton = container.querySelector(`.graph-timeframe-button[data-range="${testCase.range}"]`);
                return targetButton.classList.contains('is-active');
            });

            // Under Task 9.2, full history is always included in the rendered SVG domain
            points = container.querySelectorAll('svg g.points circle');
            expect(points.length).toBe(5);
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
            logs.push(createSampleEntry({
                baseTimestamp: now,
                daysAgo: 24 - entryIndex,
                answers: [{ questionId: 'q1', score: (entryIndex % 5) + 1, status: 'answered' }]
            }));
        }

        renderLineGraph(container, { entries: logs, questions });

        // 1. Verify scroll container is present with appropriate region role & tabindex
        const scrollContainer = container.querySelector('.graph-scroll-container');
        expect(scrollContainer).toBeTruthy();
        expect(scrollContainer.getAttribute('role')).toBe('region');
        expect(scrollContainer.getAttribute('tabindex')).toBe('0');

        // 2. Verify SVG width expands dynamically to provide comfortable point spacing (minimum 48px per point)
        const svgElement = container.querySelector('svg.graph-svg');
        expect(svgElement).toBeTruthy();
        const viewBox = svgElement.getAttribute('viewBox');
        expect(viewBox).toBeTruthy();
        const [, , width] = viewBox.split(' ').map(Number);
        // With 25 entries spanning 24 days without SVG internal padding (24 days = 576h):
        // 0 (paddingLeft) + 0 (paddingRight) + 576 * 2 = 1152px
        expect(width).toBeGreaterThan(600);
        expect(width).toBe(24 * 24 * BASE_PIXELS_PER_HOUR);
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
            await put('questions', question);
        }

        // Active question set only has 4 questions
        await setConfig('activeQuestionSet', ['q_energy', 'q_sadness', 'q_irritability', 'q_overall']);

        // Seed entries with answers for all 7 questions
        await put('entries', createSampleEntry({
            id: 'entry_1',
            daysAgo: 1,
            answers: {
                q_energy: 3,
                q_sadness: 2,
                q_worth: 4,
                q_irritability: 1,
                q_racing: 5,
                q_impulse: 2,
                q_overall: 4
            }
        }));
        await put('entries', createSampleEntry({
            id: 'entry_2',
            daysAgo: 0,
            answers: {
                q_energy: 4,
                q_sadness: 1,
                q_worth: 5,
                q_irritability: 2,
                q_racing: 3,
                q_impulse: 1,
                q_overall: 5
            }
        }));

        await loadHistoryView();

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
            createSampleEntry({
                id: 'entry_1',
                daysAgo: 1,
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            }),
            createSampleEntry({
                id: 'entry_2',
                daysAgo: 0,
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            })
        ];
        renderLineGraph(container, { entries, questions });

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

    describe('Timeframe Buttons as Zoom Presets & Viewport Center Pivoting (Task 9.3)', () => {
        it('updates zoom scale and scroll position when clicking preset button in DOM', async () => {
            const container = documentInstance.createElement('div');
            const questions = createSingleSampleQuestion();
            const entries = createSampleFourteenDayEntries();

            renderLineGraph(container, { entries, questions });
            const scrollContainer = mockScrollDimensions(container.querySelector('.graph-scroll-container'), 600, 2000);
            scrollContainer.scrollLeft = 200;

            const sevenDayButton = container.querySelector('.graph-timeframe-button[data-range="7d"]');
            expect(sevenDayButton.textContent.trim()).toBe('~7D');
            expect(sevenDayButton.getAttribute('aria-label')).toBe('Zoom to ~7 days');

            sevenDayButton.click();
            await waitFor(() => STATE.historyTimeRange === '7d');

            expect(STATE.historyZoomScale).toBe(1.79);
            expect(STATE.historyTimeRange).toBe('7d');
            const updatedButton = container.querySelector('.graph-timeframe-button[data-range="7d"]');
            expect(updatedButton.classList.contains('is-active')).toBe(true);
        });
    });

    describe('Zoom Buttons — Pivot on Viewport Center, No Clamp (Task 9.4)', () => {
        it('renders zoom in and zoom out buttons without disabled attributes regardless of scale', () => {
            const container = documentInstance.createElement('div');
            const questions = createSingleSampleQuestion();
            const entries = createSampleOneDayRecentEntries();

            // Render at scale 0.5 (which previously had zoom-out disabled)
            renderLineGraph(container, { entries, questions, zoomScale: 0.5 });
            let zoomOutButton = container.querySelector('#button-graph-zoom-out');
            let zoomInButton = container.querySelector('#button-graph-zoom-in');
            expect(zoomOutButton.disabled).toBe(false);
            expect(zoomInButton.disabled).toBe(false);

            // Render at scale 3.0 (which previously had zoom-in disabled)
            renderLineGraph(container, { entries, questions, zoomScale: 3.0 });
            zoomOutButton = container.querySelector('#button-graph-zoom-out');
            zoomInButton = container.querySelector('#button-graph-zoom-in');
            expect(zoomOutButton.disabled).toBe(false);
            expect(zoomInButton.disabled).toBe(false);

            // Render at extreme high scale 5.0
            renderLineGraph(container, { entries, questions, zoomScale: 5.0 });
            zoomOutButton = container.querySelector('#button-graph-zoom-out');
            zoomInButton = container.querySelector('#button-graph-zoom-in');
            expect(zoomOutButton.disabled).toBe(false);
            expect(zoomInButton.disabled).toBe(false);
        });

        it('zooms in beyond 3.0 without clamp', async () => {
            const container = documentInstance.createElement('div');
            const questions = createSingleSampleQuestion();
            const entries = createSampleOneDayRecentEntries();

            renderLineGraph(container, { entries, questions, zoomScale: 3.0 });
            const zoomInButton = container.querySelector('#button-graph-zoom-in');
            zoomInButton.click();
            await waitFor(() => STATE.historyZoomScale === 3.25);

            expect(STATE.historyZoomScale).toBe(3.25);
            const zoomValue = container.querySelector('.graph-zoom-value');
            expect(zoomValue.textContent).toBe('3.25×');
        });

        it('zooms out beyond 0.5 without clamp', async () => {
            const container = documentInstance.createElement('div');
            const questions = createSingleSampleQuestion();
            const entries = createSampleOneDayRecentEntries();

            renderLineGraph(container, { entries, questions, zoomScale: 0.5 });
            const zoomOutButton = container.querySelector('#button-graph-zoom-out');
            zoomOutButton.click();
            await waitFor(() => STATE.historyZoomScale === 0.25);

            expect(STATE.historyZoomScale).toBe(0.25);
            const zoomValue = container.querySelector('.graph-zoom-value');
            expect(zoomValue.textContent).toBe('0.25×');

            // Zoom out again from 0.25
            const nextZoomOutButton = container.querySelector('#button-graph-zoom-out');
            nextZoomOutButton.click();
            await waitFor(() => STATE.historyZoomScale === 0.13);

            expect(STATE.historyZoomScale).toBe(0.13);
            expect(STATE.historyZoomScale).toBeGreaterThan(0);
        });

        it('pivots scroll position around viewport center when clicking zoom buttons', async () => {
            const container = documentInstance.createElement('div');
            const questions = createSingleSampleQuestion();
            const entries = createSampleFourteenDayEntries();

            renderLineGraph(container, { entries, questions, zoomScale: 1.0 });
            const scrollContainer = mockScrollDimensions(container.querySelector('.graph-scroll-container'), 600, 3000);
            scrollContainer.scrollLeft = 200;

            const zoomInButton = container.querySelector('#button-graph-zoom-in');
            zoomInButton.click();
            await waitFor(() => STATE.historyZoomScale === 1.25);

            // Previous center = 200 + 600 / 2 = 500
            // paddingLeft = 0
            // Next scale = 1.25, zoomRatio = 1.25
            // Next center coordinate = 0 + (500 - 0) * 1.25 = 625
            // Target scroll left = 625 - 600 / 2 = 325
            expect(STATE.historyZoomScale).toBe(1.25);
            expect(STATE.historyScrollLeft).toBeCloseTo(325, 1);
        });
    });

    describe('NOW Return Button Tests (Task 9.5)', () => {
        it('renders NOW button in .graph-header-controls with accessible labels', () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Mood', shortLabel: 'Mood', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                createSampleEntry({ baseTimestamp: now, daysAgo: 0, answers: [{ questionId: 'q1', score: 4 }] })
            ];

            renderLineGraph(container, { entries, questions });

            const headerControls = container.querySelector('.graph-header-controls');
            expect(headerControls).toBeTruthy();

            const nowButton = headerControls.querySelector('#button-graph-now');
            expect(nowButton).toBeTruthy();
            expect(nowButton.textContent.trim()).toBe('NOW');
            expect(nowButton.getAttribute('aria-label')).toBe('Pan timeline to latest entries');
        });

        it('pans scroll position to end without changing zoom scale from arbitrary pan/zoom state', async () => {
            const container = documentInstance.createElement('div');
            const questions = createSingleSampleQuestion();
            const entries = createSampleFourteenDayEntries();

            // Render with non-default zoom scale 2.0
            renderLineGraph(container, { entries, questions, zoomScale: 2.0 });
            const scrollContainer = mockScrollDimensions(container.querySelector('.graph-scroll-container'), 600, 3200);

            // User has panned far back in time (scrollLeft = 150)
            scrollContainer.scrollLeft = 150;
            STATE.historyScrollLeft = 150;
            STATE.historyZoomScale = 2.0;

            const nowButton = container.querySelector('#button-graph-now');
            expect(nowButton).toBeTruthy();

            nowButton.click();
            await waitFor(() => STATE.historyScrollLeft === 2600);

            // Zoom scale must remain unchanged
            expect(STATE.historyZoomScale).toBe(2.0);

            // Scroll position must be panned to end: 3200 - 600 = 2600
            expect(scrollContainer.scrollLeft).toBe(2600);
            expect(STATE.historyScrollLeft).toBe(2600);
        });
    });

    describe('SVG Width Tightness — No Dead Space Beyond Intended Padding (Task 9.6 diagnosis)', () => {
        function buildDeadSpaceRegressionEntries() {
            // Entries spread across real, unevenly-spaced days so that content position depends
            // purely on elapsed time, not on entry index or entry count.
            const now = Date.now();
            return [
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 20,
                    answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 13,
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 9,
                    answers: [{ questionId: 'q1', score: 1, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 4,
                    answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
                }),
                createSampleEntry({
                    // Final entry carries a note, so the rightmost content element on the timeline
                    // is the note marker rather than a plain point circle.
                    baseTimestamp: now,
                    daysAgo: 0,
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }],
                    note: 'Last check-in of the window.'
                })
            ];
        }

        function renderDeadSpaceSvg(zoomScale) {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }];
            const entries = buildDeadSpaceRegressionEntries();
            renderLineGraph(container, { entries, questions, zoomScale });
            const svgElement = container.querySelector('svg.graph-svg');
            const declaredWidth = Number(svgElement.getAttribute('width'));
            const contentRightEdge = getSvgContentRightEdge(svgElement);
            return { container, questions, entries, svgElement, declaredWidth, contentRightEdge };
        }

        it('never renders an SVG wider than its rightmost content plus the designed paddingRight, at any zoom level', () => {
            [0.25, 0.5, 1, 1.5, 2, 3, 4].forEach(zoomScale => {
                const { svgElement, declaredWidth, contentRightEdge, entries, questions } = renderDeadSpaceSvg(zoomScale);
                expect(svgElement).toBeTruthy();

                const [, , viewBoxWidth] = svgElement.getAttribute('viewBox').split(' ').map(Number);
                expect(declaredWidth).toBe(viewBoxWidth);

                // Ground truth for "how much right-side padding is intentional" comes straight from
                // the layout function, not a hard-coded number, so this test tracks the real design
                // constant instead of drifting out of sync with it.
                const layout = computeGraphLayout({ entries, questions, zoomScale });
                const { paddingRight } = layout.dimensions;

                const roundingSlack = 0.5;
                expect(declaredWidth).toBeLessThanOrEqual(contentRightEdge + paddingRight + roundingSlack);
            });
        });

        it('keeps the dead space between content and the SVG edge constant (in pixels) rather than growing with zoom', () => {
            const deadSpaceByZoom = [0.5, 1, 2, 4].map(zoomScale => {
                const { declaredWidth, contentRightEdge } = renderDeadSpaceSvg(zoomScale);
                return declaredWidth - contentRightEdge;
            });

            // The gap between the last rendered element and the SVG's right edge is a fixed
            // design constant (paddingRight); it must not scale up as zoomScale increases. A
            // regression that multiplies dead space by the zoom factor would blow this tolerance well past
            // ~1px of floating point/rounding slack.
            const [baseline, ...rest] = deadSpaceByZoom;
            rest.forEach(deadSpace => {
                expect(Math.abs(deadSpace - baseline)).toBeLessThan(1);
            });
        });
    });
});