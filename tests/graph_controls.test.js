// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    setupTestDOM,
    waitFor,
    createSingleSampleQuestion,
    createSampleOneDayRecentEntries,
    createSampleFourteenDayEntries,
    createSampleEntry,
    mockScrollDimensions
} from './test-utils.js';
import { STATE } from '../public/js/state.js';
import { renderLineGraph } from '../public/js/ui/history-graph.js';

let windowInstance;
let documentInstance;

describe('Timeline Navigation, Zoom, and Preset Controls', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    afterEach(() => {
        vi.useRealTimers();
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

    it('renders timeframe presets toolbar and keeps all data points rendered across timeframe selection', async () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Overall Mood', shortLabel: 'Mood', curve: 'more-is-better' }
        ];

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

            points = container.querySelectorAll('svg g.points circle');
            expect(points.length).toBe(5);
            if (testCase.assertActive) {
                expect(container.querySelector(`.graph-timeframe-button[data-range="${testCase.range}"]`).classList.contains('is-active')).toBe(true);
            }
        }
    });

    it('captures vertical wheel events over timeline and converts delta to horizontal scroll', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Overall Mood', shortLabel: 'Mood', curve: 'more-is-better' }
        ];
        const entries = [
            createSampleEntry({
                id: 'entry_1',
                daysAgo: 14,
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            }),
            createSampleEntry({
                id: 'entry_2',
                daysAgo: 0,
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            })
        ];

        renderLineGraph(container, { entries, questions, zoomScale: 2.0 });

        const scrollContainer = mockScrollDimensions(container.querySelector('.graph-scroll-container'), 600, 1200);
        expect(scrollContainer).toBeTruthy();

        scrollContainer.scrollLeft = 100;

        let defaultPrevented = false;
        const wheelEvent = new windowInstance.WheelEvent('wheel', {
            deltaY: 50,
            deltaX: 0,
            bubbles: true,
            cancelable: true
        });

        wheelEvent.preventDefault = () => {
            defaultPrevented = true;
        };

        scrollContainer.dispatchEvent(wheelEvent);

        expect(defaultPrevented).toBe(true);
        expect(scrollContainer.scrollLeft).toBe(150);
    });

    describe('Timeframe Buttons as Zoom Presets & Viewport Center Pivoting', () => {
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

    describe('Zoom Buttons — Pivot on Viewport Center, No Clamp', () => {
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

            expect(STATE.historyZoomScale).toBe(1.25);
            expect(STATE.historyScrollLeft).toBeCloseTo(325, 1);
        });
    });

    describe('NOW Return Button', () => {
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
});
