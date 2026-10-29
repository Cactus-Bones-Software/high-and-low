// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDOM, waitFor, createSampleGraphQuestions, createSampleTwoDayLogs } from './test-utils.js';
import { STATE } from '../public/js/state.js';
import {
    setupGraphGestureZoom,
    calculateGestureTransform,
    applyGraphGestureTransform,
    resetGraphGestureTransform,
    updateGraphSVGInPlace,
    commitGraphGestureZoom,
    computeGraphLayout,
    renderLineGraph
} from '../public/js/ui/history-graph.js';

let windowInstance;
let documentInstance;

describe('Live Gesture Zoom — Commit, Transforms, and Counter-Scaling', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Live Gesture Zoom — CSS Transform Rendering Pass', () => {
        it('applyGraphGestureTransform sets transformOrigin to 0 0 and applies transform string', () => {
            const dummyElement = documentInstance.createElement('div');
            const transformResult = applyGraphGestureTransform(dummyElement, 1.5, 120);

            expect(transformResult).toEqual({
                scaleX: 1.5,
                translateX: -60,
                transformString: 'translateX(-60px) scaleX(1.5)'
            });
            expect(dummyElement.style.transformOrigin).toMatch(/0(px)?\s+0(px)?/);
            expect(dummyElement.style.transform).toBe('translateX(-60px) scaleX(1.5)');
        });

        it('applyGraphGestureTransform returns null when given null element', () => {
            expect(applyGraphGestureTransform(null, 1.5, 100)).toBeNull();
        });

        it('resetGraphGestureTransform clears transform and transformOrigin', () => {
            const dummyElement = documentInstance.createElement('div');
            dummyElement.style.transform = 'scaleX(2)';
            dummyElement.style.transformOrigin = '0 0';

            resetGraphGestureTransform(dummyElement);
            expect(dummyElement.style.transform).toBe('');
            expect(dummyElement.style.transformOrigin).toBe('');
        });

        it('live wheel gesture applies live CSS transform without layout recomputations', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            renderLineGraph(container, { entries, questions });

            const scrollContainerElement = container.querySelector('.graph-scroll-container');
            const svgElement = container.querySelector('.graph-svg');

            // Dispatch ctrl+wheel event
            scrollContainerElement.dispatchEvent(new windowInstance.WheelEvent('wheel', {
                bubbles: true,
                ctrlKey: true,
                deltaY: -40,
                clientX: 120,
                clientY: 50
            }));

            // Verify live CSS transform was applied directly to svgElement
            expect(svgElement.style.transform).toContain('scaleX(');
            expect(svgElement.style.transform).toContain('translateX(');
            expect(svgElement.style.transformOrigin).toMatch(/0(px)?\s+0(px)?/);
        });
    });

    describe('Live Gesture Zoom — Per-Frame Counter-Scale for Points & Text', () => {
        it('renderGraphSVG renders vector-effect="non-scaling-stroke" on line paths and point circles', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            renderLineGraph(container, { entries, questions });

            const paths = container.querySelectorAll('.graph-svg path');
            expect(paths.length).toBeGreaterThan(0);
            paths.forEach(path => {
                expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke');
            });

            const pointCircles = container.querySelectorAll('.graph-svg .points circle');
            expect(pointCircles.length).toBeGreaterThan(0);
            pointCircles.forEach(circle => {
                expect(circle.getAttribute('vector-effect')).toBe('non-scaling-stroke');
            });
        });

        it('applyGraphGestureTransform counter-scales point circles, grid texts, and tick texts', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            renderLineGraph(container, { entries, questions });

            const svgElement = container.querySelector('.graph-svg');
            const pointCircles = svgElement.querySelectorAll('.points circle');
            const gridTexts = svgElement.querySelectorAll('.grid text');
            const tickTexts = svgElement.querySelectorAll('.x-axis text');

            expect(pointCircles.length).toBeGreaterThan(0);
            expect(gridTexts.length).toBeGreaterThan(0);
            expect(tickTexts.length).toBeGreaterThan(0);

            // Apply gesture transform with scaleFactor = 2
            applyGraphGestureTransform(svgElement, 2.0, 100);

            // Inverse scale is 1/2 = 0.5
            pointCircles.forEach(circle => {
                expect(circle.style.transform).toBe('scaleX(0.5)');
                const cx = circle.getAttribute('cx') || '0';
                const cy = circle.getAttribute('cy') || '0';
                expect(circle.style.transformOrigin).toBe(`${cx}px ${cy}px`);
            });

            gridTexts.forEach(text => {
                expect(text.style.transform).toBe('scaleX(0.5)');
                const x = text.getAttribute('x') || '0';
                const y = text.getAttribute('y') || '0';
                expect(text.style.transformOrigin).toBe(`${x}px ${y}px`);
            });

            tickTexts.forEach(text => {
                expect(text.style.transform).toBe('scaleX(0.5)');
                const x = text.getAttribute('x') || '0';
                const y = text.getAttribute('y') || '0';
                expect(text.style.transformOrigin).toBe(`${x}px ${y}px`);
            });
        });

        it('resetGraphGestureTransform clears transform and transformOrigin on counter-scaled elements', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            renderLineGraph(container, { entries, questions });

            const svgElement = container.querySelector('.graph-svg');
            applyGraphGestureTransform(svgElement, 1.8, 150);

            // Reset gesture transform
            resetGraphGestureTransform(svgElement);

            expect(svgElement.style.transform).toBe('');
            expect(svgElement.style.transformOrigin).toBe('');

            const pointCircles = svgElement.querySelectorAll('.points circle');
            pointCircles.forEach(circle => {
                expect(circle.style.transform).toBe('');
                expect(circle.style.transformOrigin).toBe('');
            });

            const gridTexts = svgElement.querySelectorAll('.grid text');
            gridTexts.forEach(text => {
                expect(text.style.transform).toBe('');
                expect(text.style.transformOrigin).toBe('');
            });

            const tickTexts = svgElement.querySelectorAll('.x-axis text');
            tickTexts.forEach(text => {
                expect(text.style.transform).toBe('');
                expect(text.style.transformOrigin).toBe('');
            });
        });

        it('accurately centers zoom around the touch midpoint when target has scroll offset', () => {
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            const svgElement = documentInstance.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgElement.setAttribute('class', 'graph-svg');
            scrollContainerElement.appendChild(svgElement);
            documentInstance.body.appendChild(scrollContainerElement);

            // Mock getBoundingClientRect on target SVG to simulate -300px horizontal scroll position
            svgElement.getBoundingClientRect = () => ({
                left: -300,
                top: 0,
                right: 700,
                bottom: 400,
                width: 1000,
                height: 400,
                x: -300,
                y: 0
            });

            const onGestureStart = vi.fn();
            const onGestureChange = vi.fn();
            const gestureController = setupGraphGestureZoom(scrollContainerElement, {
                targetElement: svgElement,
                onGestureStart,
                onGestureChange
            });

            // Touch pointers at clientX: 100 and clientX: 300 -> midpoint is 200
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 1,
                clientX: 100,
                clientY: 50
            }));
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 2,
                clientX: 300,
                clientY: 50
            }));

            // Initial pivot in SVG coordinates: clientPivot (200) - targetLeft (-300) = 500
            expect(onGestureStart).toHaveBeenCalledWith(expect.objectContaining({
                pivotX: 500,
                clientPivotX: 200,
                scaleFactor: 1.0,
                panDeltaX: 0
            }));

            // Pinch outwards: pointer 1 at 50, pointer 2 at 450 (distance 400 vs 200 -> scale 2.0, midpoint 250)
            // Midpoint drifted from 200 to 250 -> panDeltaX = 50
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 1,
                clientX: 50,
                clientY: 50
            }));
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 2,
                clientX: 450,
                clientY: 50
            }));

            expect(onGestureChange).toHaveBeenLastCalledWith(expect.objectContaining({
                pivotX: 500,
                scaleFactor: 2.0,
                panDeltaX: 50,
                clientPivotX: 250
            }));

            // Calculate gesture transform with pan compensation:
            // translateX = panDeltaX (50) + pivotX (500) * (1 - 2.0) = 50 - 500 = -450
            const transformResult = calculateGestureTransform(2.0, 500, 50);
            expect(transformResult.translateX).toBe(-450);

            // Screen position of the anchor point (x=500 in SVG):
            // screenX = targetLeft (-300) + translateX (-450) + scale (2.0) * 500 = -750 + 1000 = 250
            // Exactly matches the current touch midpoint (250px)!
            const anchorScreenX = -300 + transformResult.translateX + transformResult.scaleX * 500;
            expect(anchorScreenX).toBe(250);

            gestureController.destroy();
            scrollContainerElement.remove();
        });
    });

    describe('Live Gesture Zoom — Commit on Gesture End', () => {
        describe('updateGraphSVGInPlace', () => {
            it('updates SVG attributes and element groups without discarding DOM elements', () => {
                const container = documentInstance.createElement('div');
                documentInstance.body.appendChild(container);

                const questions = createSampleGraphQuestions();
                const logs = createSampleTwoDayLogs();
                logs[0].note = 'Felt energetic and productive.';
                renderLineGraph(container, { entries: logs, questions });

                const svgElement = container.querySelector('.graph-svg');
                expect(svgElement).not.toBeNull();
                const initialWidth = Number(svgElement.getAttribute('width'));

                const existingNoteMarkers = Array.from(svgElement.querySelectorAll('.note-marker'));
                expect(existingNoteMarkers.length).toBeGreaterThan(0);
                const firstMarkerInstance = existingNoteMarkers[0];

                const updatedLayout = computeGraphLayout({
                    entries: logs,
                    allEntries: logs,
                    questions,
                    visibleQuestionIds: new Set(questions.map(question => question.id)),
                    timeRange: 'all',
                    zoomScale: 2.0
                });

                updateGraphSVGInPlace(svgElement, updatedLayout);

                const newWidth = Number(svgElement.getAttribute('width'));
                expect(newWidth).toBeGreaterThan(initialWidth);

                // Note marker elements in DOM must be identical instances (not re-created)
                const currentNoteMarkers = Array.from(svgElement.querySelectorAll('.note-marker'));
                expect(currentNoteMarkers[0]).toBe(firstMarkerInstance);

                container.remove();
            });
        });

        describe('commitGraphGestureZoom integration', () => {
            it('commits settled scale, resets transforms, updates scroll, and preserves listeners', async () => {
                const container = documentInstance.createElement('div');
                documentInstance.body.appendChild(container);

                const questions = createSampleGraphQuestions();
                const logs = createSampleTwoDayLogs();
                logs[0].note = 'Check-in note for testing gesture commit.';
                renderLineGraph(container, { entries: logs, questions });

                const scrollContainerElement = container.querySelector('.graph-scroll-container');
                const svgElement = container.querySelector('.graph-svg');
                expect(scrollContainerElement).toBeTruthy();
                expect(svgElement).toBeTruthy();

                Object.defineProperty(scrollContainerElement, 'clientWidth', { value: 600, configurable: true });
                Object.defineProperty(scrollContainerElement, 'scrollWidth', { value: 2000, configurable: true });
                scrollContainerElement.scrollLeft = 100;

                // Ground truth note marker before commit
                const noteMarkerBefore = svgElement.querySelector('.note-marker');
                expect(noteMarkerBefore).toBeTruthy();

                // Apply live gesture transform
                applyGraphGestureTransform(svgElement, 1.5, 200);
                expect(svgElement.style.transform).toContain('scaleX(');

                // Commit settled zoom: pivot at 200, scale 1.5
                commitGraphGestureZoom(container, {
                    gestureStartScrollLeft: 100,
                    gestureStartZoomScale: 1.0,
                    gestureEventData: {
                        pivotX: 200,
                        scaleFactor: 1.5,
                        finalZoomScale: 1.5
                    },
                    layoutEntries: logs,
                    questionList: questions,
                    currentVisibleSet: new Set(questions.map(question => question.id)),
                    currentTimeRange: 'all'
                });

                // 1. Transform reset cleanly
                expect(svgElement.style.transform).toBe('');
                expect(svgElement.style.transformOrigin).toBe('');

                // 2. STATE updated
                expect(STATE.historyZoomScale).toBe(1.5);

                // 3. Zoom reset toolbar button updated (enabled at 1.5x)
                const resetButton = container.querySelector('#button-graph-zoom-reset');
                if (resetButton) {
                    expect(resetButton.disabled).toBe(false);
                }

                // 4. Same DOM element instance preserved (in-place update, not discarded)
                const noteMarkerAfter = svgElement.querySelector('.note-marker');
                expect(noteMarkerAfter).toBe(noteMarkerBefore);

                // 5. Existing note marker click opens dialog cleanly
                noteMarkerAfter.dispatchEvent(new windowInstance.MouseEvent('click', { bubbles: true, cancelable: true }));
                const overlayElement = documentInstance.getElementById('notice-dialog-overlay');
                await waitFor(() => overlayElement.classList.contains('is-open'));
                expect(overlayElement.classList.contains('is-open')).toBe(true);

                const okButton = documentInstance.getElementById('button-notice-ok');
                okButton.click();
                await waitFor(() => !overlayElement.classList.contains('is-open'));
                expect(overlayElement.classList.contains('is-open')).toBe(false);

                container.remove();
            });

            it('executes full end-to-end touch pinch gesture lifecycle with commit on pointerup', async () => {
                const container = documentInstance.createElement('div');
                documentInstance.body.appendChild(container);

                const questions = createSampleGraphQuestions();
                const logs = createSampleTwoDayLogs();
                renderLineGraph(container, { entries: logs, questions });

                const scrollContainerElement = container.querySelector('.graph-scroll-container');
                const svgElement = container.querySelector('.graph-svg');
                const initialWidth = Number(svgElement.getAttribute('width'));

                // Mock bounding rect on SVG
                svgElement.getBoundingClientRect = () => ({
                    left: 0,
                    top: 0,
                    right: 800,
                    bottom: 400,
                    width: 800,
                    height: 400,
                    x: 0,
                    y: 0
                });

                // 1. Gesture start: two touch pointers 100px apart
                scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                    bubbles: true,
                    pointerId: 1,
                    clientX: 200,
                    clientY: 100
                }));
                scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                    bubbles: true,
                    pointerId: 2,
                    clientX: 300,
                    clientY: 100
                }));

                // 2. Gesture move: pinch apart to 200px (scaleFactor = 2.0)
                scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointermove', {
                    bubbles: true,
                    pointerId: 1,
                    clientX: 150,
                    clientY: 100
                }));
                scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointermove', {
                    bubbles: true,
                    pointerId: 2,
                    clientX: 350,
                    clientY: 100
                }));

                // Live transform was applied during active gesture
                expect(svgElement.style.transform).toContain('scaleX(2)');

                // 3. Gesture end: pointer lifts
                scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerup', {
                    bubbles: true,
                    pointerId: 1,
                    clientX: 150,
                    clientY: 100
                }));

                // Transform reset on commit
                expect(svgElement.style.transform).toBe('');
                // Settled scale committed to STATE
                expect(STATE.historyZoomScale).toBe(2.0);
                // SVG intrinsic width redrawn at settled scale
                const settledWidth = Number(svgElement.getAttribute('width'));
                expect(settledWidth).toBeGreaterThan(initialWidth);

                container.remove();
            });
        });
    });
});
