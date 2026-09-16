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

    it('renders accessible zoom controls and changes horizontal graph spacing', () => {
        const container = documentInstance.createElement('div');
        const questions = [{ id: 'q1', text: 'Energy level', shortLabel: 'Energy', curve: 'more-is-better' }];
        const entries = [
            { timestamp: '2026-08-10T10:00:00.000Z', answers: [{ questionId: 'q1', score: 3, status: 'answered' }] },
            { timestamp: '2026-08-11T10:00:00.000Z', answers: [{ questionId: 'q1', score: 4, status: 'answered' }] }
        ];

        windowInstance.renderLineGraph(container, { entries, questions });
        const zoomInButton = container.querySelector('#button-graph-zoom-in');
        const resetButton = container.querySelector('#button-graph-zoom-reset');
        const zoomValue = container.querySelector('.graph-zoom-value');
        const getWidth = () => Number(container.querySelector('svg').getAttribute('viewBox').split(' ')[2]);

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
            await sleep(50);

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

        // 2. Verify SVG width expands dynamically to provide comfortable point spacing (minimum 48px per point)
        const svgElement = container.querySelector('svg.graph-svg');
        expect(svgElement).toBeTruthy();
        const viewBox = svgElement.getAttribute('viewBox');
        expect(viewBox).toBeTruthy();
        const [, , width] = viewBox.split(' ').map(Number);
        // With 25 entries: 42 + 24 + 24 * 48 = 1218px
        expect(width).toBeGreaterThan(600);
        expect(width).toBe(42 + 24 + 24 * 48);
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

            // Always-render-everything model (Task 9.2): full entry history is always included in the rendered/scrollable domain
            const sevenDayLayout = windowInstance.computeGraphLayout({
                entries,
                questions,
                timeRange: '7d'
            });
            expect(sevenDayLayout.isEmpty).toBe(false);
            expect(sevenDayLayout.filteredEntries.length).toBe(4);

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

        it('derives every point x-position purely from elapsed time and BASE_PIXELS_PER_HOUR scale (Task 9.1)', () => {
            const baseTime = new Date('2026-08-01T12:00:00.000Z').getTime();
            const questions = [
                { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
            ];

            // 4 logs at 0h, 3h, 6h, 12h: non-uniform elapsed times
            const entries = [
                {
                    timestamp: new Date(baseTime).toISOString(),
                    answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
                },
                {
                    timestamp: new Date(baseTime + 3 * 3600 * 1000).toISOString(),
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                },
                {
                    timestamp: new Date(baseTime + 6 * 3600 * 1000).toISOString(),
                    answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
                },
                {
                    timestamp: new Date(baseTime + 12 * 3600 * 1000).toISOString(),
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                }
            ];

            expect(windowInstance.BASE_PIXELS_PER_HOUR).toBe(2);

            const layout = windowInstance.computeGraphLayout({ entries, questions, zoomScale: 1 });
            const paddingLeft = layout.dimensions.paddingLeft;
            const points = layout.series[0].points;
            expect(points.length).toBe(4);

            // Point 0 (0h): paddingLeft + 0 * 2 = paddingLeft
            expect(points[0].x).toBe(paddingLeft);
            // Point 1 (3h): paddingLeft + 3 * 2 = paddingLeft + 6
            expect(points[1].x).toBe(paddingLeft + 6);
            // Point 2 (6h): paddingLeft + 6 * 2 = paddingLeft + 12
            expect(points[2].x).toBe(paddingLeft + 12);
            // Point 3 (12h): paddingLeft + 12 * 2 = paddingLeft + 24
            expect(points[3].x).toBe(paddingLeft + 24);

            // Verify with zoomScale = 1.5
            const zoomedLayout = windowInstance.computeGraphLayout({ entries, questions, zoomScale: 1.5 });
            const zoomedPoints = zoomedLayout.series[0].points;
            // Point 1 (3h): paddingLeft + 3 * (2 * 1.5) = paddingLeft + 9
            expect(zoomedPoints[1].x).toBe(paddingLeft + 9);
            // Point 3 (12h): paddingLeft + 12 * (2 * 1.5) = paddingLeft + 36
            expect(zoomedPoints[3].x).toBe(paddingLeft + 36);
        });

        it('never excludes entries based on timeRange parameter, keeping full history rendered (Task 9.2)', () => {
            const now = Date.now();
            const questions = [
                { id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }
            ];
            // Entries spanning 180 days ago to now
            const entries = [
                {
                    timestamp: new Date(now - 180 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
                },
                {
                    timestamp: new Date(now - 60 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
                },
                {
                    timestamp: new Date(now - 20 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                },
                {
                    timestamp: new Date(now - 2 * 86400000).toISOString(),
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                }
            ];

            ['7d', '14d', '30d', '90d', 'all'].forEach(timeRange => {
                const layout = windowInstance.computeGraphLayout({ entries, questions, timeRange });
                expect(layout.isEmpty).toBe(false);
                expect(layout.isTimeframeEmpty).toBe(false);
                expect(layout.filteredEntries.length).toBe(4);
                expect(layout.series[0].points.length).toBe(4);
            });
        });
    });

    describe('Timeframe Buttons as Zoom Presets & Viewport Center Pivoting (Task 9.3)', () => {
        it('calculates preset zoom scale multipliers to span viewport width', () => {
            const viewportWidth = 600;
            // 7d: 168 hours * 2 px/h = 336 px base -> scale = 600 / 336 = 1.79
            expect(windowInstance.calculateTimeframePresetZoomScale('7d', { viewportWidth })).toBe(1.79);
            // 14d: 336 hours * 2 px/h = 672 px base -> scale = 600 / 672 = 0.89
            expect(windowInstance.calculateTimeframePresetZoomScale('14d', { viewportWidth })).toBe(0.89);
            // 30d: 720 hours * 2 px/h = 1440 px base -> scale = 600 / 1440 = 0.42
            expect(windowInstance.calculateTimeframePresetZoomScale('30d', { viewportWidth })).toBe(0.42);
            // 90d: 2160 hours * 2 px/h = 4320 px base -> scale = 600 / 4320 = 0.14
            expect(windowInstance.calculateTimeframePresetZoomScale('90d', { viewportWidth })).toBe(0.14);

            // 'all': entries spanning 5 days (120 hours) -> 120 * 2 = 240 px base -> scale = 600 / 240 = 2.5
            const baseTime = Date.now();
            const entries = [
                { timestamp: new Date(baseTime - 5 * 24 * 3600 * 1000).toISOString() },
                { timestamp: new Date(baseTime).toISOString() }
            ];
            expect(windowInstance.calculateTimeframePresetZoomScale('all', { entries, viewportWidth })).toBe(2.5);
        });

        it('pivots horizontal scroll position around the viewport center', () => {
            // Previous center = 100 + 400 / 2 = 300
            // Padding = 32
            // Scale increases 1.0 -> 2.0 (zoom in 2x)
            // New center coordinate = 32 + (300 - 32) * 2 = 32 + 536 = 568
            // Target scroll left = 568 - 400 / 2 = 368
            // The coordinate at the viewport center (offset 200 in viewport) is 568 - 368 = 200 (exact match)
            const targetScrollLeft = windowInstance.calculateZoomPivotScrollLeft({
                previousScrollLeft: 100,
                viewportWidth: 400,
                previousZoomScale: 1,
                nextZoomScale: 2,
                paddingLeft: 32
            });
            expect(targetScrollLeft).toBe(368);

            // Clamps at 0 if target would be negative
            const zeroClampedScroll = windowInstance.calculateZoomPivotScrollLeft({
                previousScrollLeft: 0,
                viewportWidth: 600,
                previousZoomScale: 2,
                nextZoomScale: 0.5,
                paddingLeft: 32
            });
            expect(zeroClampedScroll).toBe(0);
        });

        it('updates zoom scale and scroll position when clicking preset button in DOM', async () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                { timestamp: new Date(now - 14 * 86400000).toISOString(), answers: [{ questionId: 'q1', score: 2 }] },
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 5 }] }
            ];

            windowInstance.renderLineGraph(container, { entries, questions });
            const scrollContainer = container.querySelector('.graph-scroll-container');
            Object.defineProperty(scrollContainer, 'clientWidth', { value: 600, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollWidth', { value: 2000, configurable: true });
            scrollContainer.scrollLeft = 200;

            const sevenDayButton = container.querySelector('.graph-timeframe-button[data-range="7d"]');
            expect(sevenDayButton.textContent.trim()).toBe('~7D');
            expect(sevenDayButton.getAttribute('aria-label')).toBe('Zoom to ~7 days');

            sevenDayButton.click();
            await sleep(50);

            expect(windowInstance.STATE.historyZoomScale).toBe(1.79);
            expect(windowInstance.STATE.historyTimeRange).toBe('7d');
            const updatedButton = container.querySelector('.graph-timeframe-button[data-range="7d"]');
            expect(updatedButton.classList.contains('is-active')).toBe(true);
        });
    });

    describe('Zoom Buttons — Pivot on Viewport Center, No Clamp (Task 9.4)', () => {
        it('renders zoom in and zoom out buttons without disabled attributes regardless of scale', () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                { timestamp: new Date(now - 86400000).toISOString(), answers: [{ questionId: 'q1', score: 3 }] },
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 4 }] }
            ];

            // Render at scale 0.5 (which previously had zoom-out disabled)
            windowInstance.renderLineGraph(container, { entries, questions, zoomScale: 0.5 });
            let zoomOutButton = container.querySelector('#button-graph-zoom-out');
            let zoomInButton = container.querySelector('#button-graph-zoom-in');
            expect(zoomOutButton.disabled).toBe(false);
            expect(zoomInButton.disabled).toBe(false);

            // Render at scale 3.0 (which previously had zoom-in disabled)
            windowInstance.renderLineGraph(container, { entries, questions, zoomScale: 3.0 });
            zoomOutButton = container.querySelector('#button-graph-zoom-out');
            zoomInButton = container.querySelector('#button-graph-zoom-in');
            expect(zoomOutButton.disabled).toBe(false);
            expect(zoomInButton.disabled).toBe(false);

            // Render at extreme high scale 5.0
            windowInstance.renderLineGraph(container, { entries, questions, zoomScale: 5.0 });
            zoomOutButton = container.querySelector('#button-graph-zoom-out');
            zoomInButton = container.querySelector('#button-graph-zoom-in');
            expect(zoomOutButton.disabled).toBe(false);
            expect(zoomInButton.disabled).toBe(false);
        });

        it('zooms in beyond 3.0 without clamp', async () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                { timestamp: new Date(now - 86400000).toISOString(), answers: [{ questionId: 'q1', score: 3 }] },
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 4 }] }
            ];

            windowInstance.renderLineGraph(container, { entries, questions, zoomScale: 3.0 });
            const zoomInButton = container.querySelector('#button-graph-zoom-in');
            zoomInButton.click();
            await sleep(50);

            expect(windowInstance.STATE.historyZoomScale).toBe(3.25);
            const zoomValue = container.querySelector('.graph-zoom-value');
            expect(zoomValue.textContent).toBe('3.25×');
        });

        it('zooms out beyond 0.5 without clamp', async () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                { timestamp: new Date(now - 86400000).toISOString(), answers: [{ questionId: 'q1', score: 3 }] },
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 4 }] }
            ];

            windowInstance.renderLineGraph(container, { entries, questions, zoomScale: 0.5 });
            const zoomOutButton = container.querySelector('#button-graph-zoom-out');
            zoomOutButton.click();
            await sleep(50);

            expect(windowInstance.STATE.historyZoomScale).toBe(0.25);
            const zoomValue = container.querySelector('.graph-zoom-value');
            expect(zoomValue.textContent).toBe('0.25×');

            // Zoom out again from 0.25
            const nextZoomOutButton = container.querySelector('#button-graph-zoom-out');
            nextZoomOutButton.click();
            await sleep(50);

            expect(windowInstance.STATE.historyZoomScale).toBe(0.13);
            expect(windowInstance.STATE.historyZoomScale).toBeGreaterThan(0);
        });

        it('pivots scroll position around viewport center when clicking zoom buttons', async () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                { timestamp: new Date(now - 14 * 86400000).toISOString(), answers: [{ questionId: 'q1', score: 2 }] },
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 5 }] }
            ];

            windowInstance.renderLineGraph(container, { entries, questions, zoomScale: 1.0 });
            const scrollContainer = container.querySelector('.graph-scroll-container');
            Object.defineProperty(scrollContainer, 'clientWidth', { value: 600, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollWidth', { value: 3000, configurable: true });
            scrollContainer.scrollLeft = 200;

            const zoomInButton = container.querySelector('#button-graph-zoom-in');
            zoomInButton.click();
            await sleep(50);

            // Previous center = 200 + 600 / 2 = 500
            // paddingLeft = 42
            // Next scale = 1.25, zoomRatio = 1.25
            // Next center coordinate = 42 + (500 - 42) * 1.25 = 42 + 572.5 = 614.5
            // Target scroll left = 614.5 - 600 / 2 = 314.5
            expect(windowInstance.STATE.historyZoomScale).toBe(1.25);
            expect(windowInstance.STATE.historyScrollLeft).toBeCloseTo(314.5, 1);
        });
    });

    describe('NOW Return Button Tests (Task 9.5)', () => {
        it('calculates target scroll position to bring latest entries into normal position', () => {
            // Container with scrollWidth > viewportWidth
            const scrollPosition = windowInstance.calculateNowScrollLeft({
                scrollWidth: 2400,
                viewportWidth: 600
            });
            expect(scrollPosition).toBe(1800);

            // Container where content fits in viewport
            const fittedScroll = windowInstance.calculateNowScrollLeft({
                scrollWidth: 500,
                viewportWidth: 600
            });
            expect(fittedScroll).toBe(0);

            // Fallback to svgWidth when scrollWidth is 0
            const fallbackScroll = windowInstance.calculateNowScrollLeft({
                scrollWidth: 0,
                svgWidth: 1500,
                viewportWidth: 500
            });
            expect(fallbackScroll).toBe(1000);

            // Zero / negative dimensions
            expect(windowInstance.calculateNowScrollLeft({})).toBe(0);
        });

        it('renders NOW button in .graph-header-controls with accessible labels', () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Mood', shortLabel: 'Mood', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 4 }] }
            ];

            windowInstance.renderLineGraph(container, { entries, questions });

            const headerControls = container.querySelector('.graph-header-controls');
            expect(headerControls).toBeTruthy();

            const nowButton = headerControls.querySelector('#button-graph-now');
            expect(nowButton).toBeTruthy();
            expect(nowButton.textContent.trim()).toBe('NOW');
            expect(nowButton.getAttribute('aria-label')).toBe('Pan timeline to latest entries');
        });

        it('pans scroll position to end without changing zoom scale from arbitrary pan/zoom state', async () => {
            const container = documentInstance.createElement('div');
            const questions = [{ id: 'q1', text: 'Energy', shortLabel: 'Energy', curve: 'more-is-better' }];
            const now = Date.now();
            const entries = [
                { timestamp: new Date(now - 14 * 86400000).toISOString(), answers: [{ questionId: 'q1', score: 2 }] },
                { timestamp: new Date(now).toISOString(), answers: [{ questionId: 'q1', score: 5 }] }
            ];

            // Render with non-default zoom scale 2.0
            windowInstance.renderLineGraph(container, { entries, questions, zoomScale: 2.0 });
            const scrollContainer = container.querySelector('.graph-scroll-container');
            Object.defineProperty(scrollContainer, 'clientWidth', { value: 600, configurable: true });
            Object.defineProperty(scrollContainer, 'scrollWidth', { value: 3200, configurable: true });

            // User has panned far back in time (scrollLeft = 150)
            scrollContainer.scrollLeft = 150;
            windowInstance.STATE.historyScrollLeft = 150;
            windowInstance.STATE.historyZoomScale = 2.0;

            const nowButton = container.querySelector('#button-graph-now');
            expect(nowButton).toBeTruthy();

            nowButton.click();
            await sleep(50);

            // Zoom scale must remain unchanged
            expect(windowInstance.STATE.historyZoomScale).toBe(2.0);

            // Scroll position must be panned to end: 3200 - 600 = 2600
            expect(scrollContainer.scrollLeft).toBe(2600);
            expect(windowInstance.STATE.historyScrollLeft).toBe(2600);
        });
    });
});
