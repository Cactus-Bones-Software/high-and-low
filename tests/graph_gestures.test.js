// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDOM, sleep, createSampleGraphQuestions, createSampleTwoDayLogs } from './test-utils.js';

let windowInstance;
let documentInstance;

describe('Live Gesture Zoom Input Handling Tests (Task 9.7)', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    describe('calculatePinchDistance helper', () => {
        it('returns 0 if either pointer object is missing or non-numeric', () => {
            expect(windowInstance.calculatePinchDistance(null, null)).toBe(0);
            expect(windowInstance.calculatePinchDistance({ clientX: 10, clientY: 20 }, null)).toBe(0);
            expect(windowInstance.calculatePinchDistance(null, { clientX: 10, clientY: 20 })).toBe(0);
            expect(windowInstance.calculatePinchDistance({ clientX: NaN, clientY: 20 }, { clientX: 0, clientY: 0 }))
                .toBe(0);
        });

        it('computes exact Euclidean distance between two pointers', () => {
            const firstPointer = { clientX: 0, clientY: 0 };
            const secondPointer = { clientX: 30, clientY: 40 };
            expect(windowInstance.calculatePinchDistance(firstPointer, secondPointer)).toBe(50);
        });

        it('computes purely horizontal and vertical distances', () => {
            expect(windowInstance.calculatePinchDistance(
                { clientX: 100, clientY: 50 },
                { clientX: 250, clientY: 50 }
            )).toBe(150);

            expect(windowInstance.calculatePinchDistance(
                { clientX: 50, clientY: 80 },
                { clientX: 50, clientY: 200 }
            )).toBe(120);
        });
    });

    describe('calculatePinchMidpoint helper', () => {
        it('returns origin coordinates if either pointer is missing', () => {
            expect(windowInstance.calculatePinchMidpoint(null, null)).toEqual({ clientX: 0, clientY: 0 });
            expect(windowInstance.calculatePinchMidpoint({ clientX: 50, clientY: 60 }, null))
                .toEqual({ clientX: 0, clientY: 0 });
        });

        it('calculates average midpoint between two pointer coordinates', () => {
            const firstPointer = { clientX: 100, clientY: 200 };
            const secondPointer = { clientX: 300, clientY: 400 };
            const midpoint = windowInstance.calculatePinchMidpoint(firstPointer, secondPointer);
            expect(midpoint).toEqual({ clientX: 200, clientY: 300 });
        });
    });

    describe('calculateWheelZoomDeltaMultiplier helper', () => {
        it('returns 1 for zero or non-finite deltaY', () => {
            expect(windowInstance.calculateWheelZoomDeltaMultiplier(0)).toBe(1);
            expect(windowInstance.calculateWheelZoomDeltaMultiplier(NaN)).toBe(1);
            expect(windowInstance.calculateWheelZoomDeltaMultiplier(Infinity)).toBe(1);
        });

        it('returns multiplier greater than 1 for negative delta (zoom in)', () => {
            const multiplier = windowInstance.calculateWheelZoomDeltaMultiplier(-50);
            expect(multiplier).toBeGreaterThan(1);
            expect(multiplier).toBeCloseTo(Math.exp(50 * 0.005), 4);
        });

        it('returns multiplier less than 1 for positive delta (zoom out)', () => {
            const multiplier = windowInstance.calculateWheelZoomDeltaMultiplier(50);
            expect(multiplier).toBeLessThan(1);
            expect(multiplier).toBeCloseTo(Math.exp(-50 * 0.005), 4);
        });

        it('scales line delta mode by 20x compared to pixel mode', () => {
            const pixelMultiplier = windowInstance.calculateWheelZoomDeltaMultiplier(2, 0);
            const lineMultiplier = windowInstance.calculateWheelZoomDeltaMultiplier(2, 1);
            expect(lineMultiplier).toBeCloseTo(Math.exp(-2 * 20 * 0.005), 4);
            expect(lineMultiplier).toBeLessThan(pixelMultiplier);
        });
    });

    describe('Two-pointer touch pinch gesture tracking', () => {
        it('tracks gesture start, live scale changes, and gesture end lifecycle', () => {
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureStart = vi.fn();
            const onGestureChange = vi.fn();
            const onGestureEnd = vi.fn();

            const gestureController = windowInstance.setupGraphGestureZoom(scrollContainerElement, {
                getCurrentZoomScale: () => 1.5,
                onGestureStart,
                onGestureChange,
                onGestureEnd
            });

            // First pointer down (e.g. single finger)
            const firstPointerDown = new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                clientX: 100,
                clientY: 200
            });
            scrollContainerElement.dispatchEvent(firstPointerDown);

            expect(gestureController.getState().isActive).toBe(false);
            expect(onGestureStart).not.toHaveBeenCalled();

            // Second pointer down: gesture starts
            const secondPointerDown = new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                cancelable: true,
                pointerId: 2,
                clientX: 200,
                clientY: 200
            });
            scrollContainerElement.dispatchEvent(secondPointerDown);

            expect(gestureController.getState().isActive).toBe(true);
            expect(gestureController.getState().source).toBe('touch');
            expect(gestureController.getState().initialZoomScale).toBe(1.5);
            expect(gestureController.getState().currentScaleFactor).toBe(1.0);
            expect(scrollContainerElement.style.touchAction).toBe('none');

            expect(onGestureStart).toHaveBeenCalledTimes(1);
            expect(onGestureStart).toHaveBeenCalledWith(expect.objectContaining({
                source: 'touch',
                initialZoomScale: 1.5,
                scaleFactor: 1.0,
                clientPivotX: 150
            }));

            // Move second pointer outward (pinch zoom in: distance 100 -> 200)
            const secondPointerMoveZoomIn = new windowInstance.PointerEvent('pointermove', {
                bubbles: true,
                cancelable: true,
                pointerId: 2,
                clientX: 300,
                clientY: 200
            });
            scrollContainerElement.dispatchEvent(secondPointerMoveZoomIn);

            expect(onGestureChange).toHaveBeenCalledTimes(1);
            expect(gestureController.getState().currentScaleFactor).toBe(2.0);
            expect(gestureController.getState().currentZoomScale).toBe(3.0);
            expect(onGestureChange).toHaveBeenLastCalledWith(expect.objectContaining({
                source: 'touch',
                scaleFactor: 2.0,
                initialZoomScale: 1.5,
                currentZoomScale: 3.0,
                clientPivotX: 200
            }));

            // Move second pointer inward (pinch zoom out: distance 100 -> 50)
            const secondPointerMoveZoomOut = new windowInstance.PointerEvent('pointermove', {
                bubbles: true,
                cancelable: true,
                pointerId: 2,
                clientX: 150,
                clientY: 200
            });
            scrollContainerElement.dispatchEvent(secondPointerMoveZoomOut);

            expect(onGestureChange).toHaveBeenCalledTimes(2);
            expect(gestureController.getState().currentScaleFactor).toBe(0.5);
            expect(gestureController.getState().currentZoomScale).toBe(0.75);

            // First pointer lifts: gesture concludes
            const firstPointerUp = new windowInstance.PointerEvent('pointerup', {
                bubbles: true,
                cancelable: true,
                pointerId: 1,
                clientX: 100,
                clientY: 200
            });
            scrollContainerElement.dispatchEvent(firstPointerUp);

            expect(gestureController.getState().isActive).toBe(false);
            expect(gestureController.getState().source).toBeNull();
            expect(scrollContainerElement.style.touchAction).toBe('');

            expect(onGestureEnd).toHaveBeenCalledTimes(1);
            expect(onGestureEnd).toHaveBeenCalledWith(expect.objectContaining({
                source: 'touch',
                scaleFactor: 0.5,
                initialZoomScale: 1.5,
                finalZoomScale: 0.75
            }));

            gestureController.destroy();
            scrollContainerElement.remove();
        });

        it('cleans up gesture and restores touch action if pointercancel is emitted', () => {
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureEnd = vi.fn();
            const gestureController = windowInstance.setupGraphGestureZoom(scrollContainerElement, {
                onGestureEnd
            });

            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 10,
                clientX: 50,
                clientY: 50
            }));
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 20,
                clientX: 150,
                clientY: 50
            }));

            expect(gestureController.getState().isActive).toBe(true);
            expect(scrollContainerElement.style.touchAction).toBe('none');

            // Cancel pointer
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointercancel', {
                bubbles: true,
                pointerId: 10,
                clientX: 50,
                clientY: 50
            }));

            expect(gestureController.getState().isActive).toBe(false);
            expect(scrollContainerElement.style.touchAction).toBe('');
            expect(onGestureEnd).toHaveBeenCalledTimes(1);

            gestureController.destroy();
            scrollContainerElement.remove();
        });
    });

    describe('Desktop Ctrl/Meta+Wheel zoom gesture handling', () => {
        it('starts gesture, computes scale factor, and triggers debounced end on wheel + ctrlKey', async () => {
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureStart = vi.fn();
            const onGestureChange = vi.fn();
            const onGestureEnd = vi.fn();

            const gestureController = windowInstance.setupGraphGestureZoom(scrollContainerElement, {
                getCurrentZoomScale: () => 1.0,
                wheelDebounceMs: 50,
                onGestureStart,
                onGestureChange,
                onGestureEnd
            });

            let defaultPrevented = false;
            const ctrlWheelEvent = new windowInstance.Event('wheel', { bubbles: true, cancelable: true });
            Object.defineProperty(ctrlWheelEvent, 'ctrlKey', { value: true });
            Object.defineProperty(ctrlWheelEvent, 'deltaY', { value: -40 });
            Object.defineProperty(ctrlWheelEvent, 'deltaX', { value: 0 });
            Object.defineProperty(ctrlWheelEvent, 'clientX', { value: 250 });
            ctrlWheelEvent.preventDefault = () => { defaultPrevented = true; };

            scrollContainerElement.dispatchEvent(ctrlWheelEvent);

            expect(defaultPrevented).toBe(true);
            expect(gestureController.getState().isActive).toBe(true);
            expect(gestureController.getState().source).toBe('wheel');
            expect(onGestureStart).toHaveBeenCalledTimes(1);
            expect(onGestureChange).toHaveBeenCalledTimes(1);

            const expectedFirstScale = Math.exp(40 * 0.005);
            expect(gestureController.getState().currentScaleFactor).toBeCloseTo(expectedFirstScale, 4);

            // Additional wheel pulse before debounce expires
            const secondCtrlWheelEvent = new windowInstance.Event('wheel', { bubbles: true, cancelable: true });
            Object.defineProperty(secondCtrlWheelEvent, 'ctrlKey', { value: true });
            Object.defineProperty(secondCtrlWheelEvent, 'deltaY', { value: -40 });
            Object.defineProperty(secondCtrlWheelEvent, 'deltaX', { value: 0 });
            Object.defineProperty(secondCtrlWheelEvent, 'clientX', { value: 260 });
            secondCtrlWheelEvent.preventDefault = () => {};

            scrollContainerElement.dispatchEvent(secondCtrlWheelEvent);
            expect(onGestureChange).toHaveBeenCalledTimes(2);

            const expectedCumulativeScale = expectedFirstScale * expectedFirstScale;
            expect(gestureController.getState().currentScaleFactor).toBeCloseTo(expectedCumulativeScale, 4);

            // Wait for debounce timeout to fire
            await sleep(70);

            expect(gestureController.getState().isActive).toBe(false);
            expect(onGestureEnd).toHaveBeenCalledTimes(1);
            expect(onGestureEnd).toHaveBeenCalledWith(expect.objectContaining({
                source: 'wheel',
                scaleFactor: expect.any(Number),
                finalZoomScale: expect.any(Number)
            }));

            gestureController.destroy();
            scrollContainerElement.remove();
        });

        it('supports metaKey for macOS Command+wheel and trackpad pinch', async () => {
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureStart = vi.fn();
            const onGestureEnd = vi.fn();

            const gestureController = windowInstance.setupGraphGestureZoom(scrollContainerElement, {
                wheelDebounceMs: 40,
                onGestureStart,
                onGestureEnd
            });

            let defaultPrevented = false;
            const metaWheelEvent = new windowInstance.Event('wheel', { bubbles: true, cancelable: true });
            Object.defineProperty(metaWheelEvent, 'metaKey', { value: true });
            Object.defineProperty(metaWheelEvent, 'deltaY', { value: 30 });
            Object.defineProperty(metaWheelEvent, 'deltaX', { value: 0 });
            Object.defineProperty(metaWheelEvent, 'clientX', { value: 180 });
            metaWheelEvent.preventDefault = () => { defaultPrevented = true; };

            scrollContainerElement.dispatchEvent(metaWheelEvent);

            expect(defaultPrevented).toBe(true);
            expect(gestureController.getState().isActive).toBe(true);
            expect(onGestureStart).toHaveBeenCalledTimes(1);

            await sleep(60);
            expect(gestureController.getState().isActive).toBe(false);
            expect(onGestureEnd).toHaveBeenCalledTimes(1);

            gestureController.destroy();
            scrollContainerElement.remove();
        });

        it('does not intercept regular wheel events without ctrlKey/metaKey for horizontal scrolling', () => {
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            Object.defineProperty(scrollContainerElement, 'scrollWidth', { value: 1200, configurable: true });
            Object.defineProperty(scrollContainerElement, 'clientWidth', { value: 400, configurable: true });
            scrollContainerElement.scrollLeft = 50;
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureStart = vi.fn();
            const gestureController = windowInstance.setupGraphGestureZoom(scrollContainerElement, {
                onGestureStart
            });

            let defaultPrevented = false;
            const regularWheelEvent = new windowInstance.Event('wheel', { bubbles: true, cancelable: true });
            Object.defineProperty(regularWheelEvent, 'ctrlKey', { value: false });
            Object.defineProperty(regularWheelEvent, 'metaKey', { value: false });
            Object.defineProperty(regularWheelEvent, 'deltaY', { value: 80 });
            Object.defineProperty(regularWheelEvent, 'deltaX', { value: 0 });
            regularWheelEvent.preventDefault = () => { defaultPrevented = true; };

            scrollContainerElement.dispatchEvent(regularWheelEvent);

            expect(defaultPrevented).toBe(true); // Converted vertical to horizontal scroll
            expect(onGestureStart).not.toHaveBeenCalled();
            expect(gestureController.getState().isActive).toBe(false);
            expect(scrollContainerElement.scrollLeft).toBe(130);

            gestureController.destroy();
            scrollContainerElement.remove();
        });
    });

    describe('renderLineGraph integration with gestureController', () => {
        it('attaches _gestureController to rendered .graph-scroll-container', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            windowInstance.renderLineGraph(container, { entries, questions });

            const scrollContainerElement = container.querySelector('.graph-scroll-container');
            expect(scrollContainerElement).toBeTruthy();
            expect(scrollContainerElement._gestureController).toBeTruthy();
            expect(typeof scrollContainerElement._gestureController.getState).toBe('function');
            expect(typeof scrollContainerElement._gestureController.destroy).toBe('function');
        });

        it('forwards custom gestureOptions callbacks through renderLineGraph', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            const onGestureStart = vi.fn();
            const onGestureChange = vi.fn();
            const onGestureEnd = vi.fn();

            windowInstance.renderLineGraph(container, {
                entries,
                questions,
                gestureOptions: {
                    onGestureStart,
                    onGestureChange,
                    onGestureEnd
                }
            });

            const scrollContainerElement = container.querySelector('.graph-scroll-container');
            expect(scrollContainerElement).toBeTruthy();

            // Simulate pinch start with two pointers
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 101,
                clientX: 100,
                clientY: 100
            }));
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 102,
                clientX: 200,
                clientY: 100
            }));

            expect(onGestureStart).toHaveBeenCalledTimes(1);

            // Move pointer to trigger change
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 102,
                clientX: 250,
                clientY: 100
            }));

            expect(onGestureChange).toHaveBeenCalledTimes(1);

            // Lift pointer
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerup', {
                bubbles: true,
                pointerId: 101,
                clientX: 100,
                clientY: 100
            }));

            expect(onGestureEnd).toHaveBeenCalledTimes(1);
        });

        it('applies live CSS transform on gesture start/change and resets on gesture end', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            windowInstance.renderLineGraph(container, { entries, questions });

            const scrollContainerElement = container.querySelector('.graph-scroll-container');
            const svgElement = container.querySelector('.graph-svg');
            expect(scrollContainerElement).toBeTruthy();
            expect(svgElement).toBeTruthy();

            // Initially, no transform is applied
            expect(svgElement.style.transform).toBe('');

            // Start pinch gesture with two pointers: distance = 100, midpoint = 150
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 1,
                clientX: 100,
                clientY: 50
            }));
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
                bubbles: true,
                pointerId: 2,
                clientX: 200,
                clientY: 50
            }));

            // At start (scale = 1), scaleX is 1, translateX is 0
            expect(svgElement.style.transformOrigin).toMatch(/0(px)?\s+0(px)?/);
            expect(svgElement.style.transform).toContain('scaleX(1)');

            // Move pointer 2 outwards to clientX: 300 (distance = 200 -> scale = 2.0, midpoint = 200)
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 2,
                clientX: 300,
                clientY: 50
            }));

            // Verify live CSS transform is applied without re-rendering or modifying DOM innerHTML
            expect(svgElement.style.transform).toContain('scaleX(2)');
            expect(svgElement.style.transform).toContain('translateX(');

            // Container elements and SVG instance remain untouched (same element identity)
            expect(container.querySelector('.graph-svg')).toBe(svgElement);

            // End pinch gesture by lifting pointer 1
            scrollContainerElement.dispatchEvent(new windowInstance.PointerEvent('pointerup', {
                bubbles: true,
                pointerId: 1,
                clientX: 100,
                clientY: 50
            }));

            // On gesture end, live transform is cleanly reset to empty
            expect(svgElement.style.transform).toBe('');
            expect(svgElement.style.transformOrigin).toBe('');
        });
    });

    describe('Live Gesture Zoom — CSS Transform Rendering Pass (Task 9.8)', () => {
        it('calculateGestureTransform computes exact translateX and scaleX for pivot fixing', () => {
            // Formula: translateX = panDeltaX + pivotX * (1 - scaleFactor)
            const result1 = windowInstance.calculateGestureTransform(2.0, 100);
            expect(result1.scaleX).toBe(2.0);
            expect(result1.translateX).toBe(-100);
            expect(result1.transformString).toBe('translateX(-100px) scaleX(2)');

            const result2 = windowInstance.calculateGestureTransform(0.5, 200);
            expect(result2.scaleX).toBe(0.5);
            expect(result2.translateX).toBe(100);
            expect(result2.transformString).toBe('translateX(100px) scaleX(0.5)');

            const result3 = windowInstance.calculateGestureTransform(1.0, 150);
            expect(result3.scaleX).toBe(1.0);
            expect(result3.translateX).toBe(0);
            expect(result3.transformString).toBe('translateX(0px) scaleX(1)');

            // With pan offset (e.g. two-finger drift of +30px)
            const resultWithPan = windowInstance.calculateGestureTransform(2.0, 100, 30);
            expect(resultWithPan.scaleX).toBe(2.0);
            expect(resultWithPan.translateX).toBe(-70);
            expect(resultWithPan.transformString).toBe('translateX(-70px) scaleX(2)');
        });

        it('calculateGestureTransform safely handles invalid or zero scaleFactor and non-finite pivot', () => {
            const resultInvalidScale = windowInstance.calculateGestureTransform(0, 50);
            expect(resultInvalidScale.scaleX).toBe(1);
            expect(resultInvalidScale.translateX).toBe(0);

            const resultNaN = windowInstance.calculateGestureTransform(NaN, NaN);
            expect(resultNaN.scaleX).toBe(1);
            expect(resultNaN.translateX).toBe(0);
        });

        it('applyGraphGestureTransform sets transformOrigin to 0 0 and applies transform string', () => {
            const dummyElement = documentInstance.createElement('div');
            const transformResult = windowInstance.applyGraphGestureTransform(dummyElement, 1.5, 120);

            expect(transformResult).toEqual({
                scaleX: 1.5,
                translateX: -60,
                transformString: 'translateX(-60px) scaleX(1.5)'
            });
            expect(dummyElement.style.transformOrigin).toMatch(/0(px)?\s+0(px)?/);
            expect(dummyElement.style.transform).toBe('translateX(-60px) scaleX(1.5)');
        });

        it('applyGraphGestureTransform returns null when given null element', () => {
            expect(windowInstance.applyGraphGestureTransform(null, 1.5, 100)).toBeNull();
        });

        it('resetGraphGestureTransform clears transform and transformOrigin', () => {
            const dummyElement = documentInstance.createElement('div');
            dummyElement.style.transform = 'scaleX(2)';
            dummyElement.style.transformOrigin = '0 0';

            windowInstance.resetGraphGestureTransform(dummyElement);
            expect(dummyElement.style.transform).toBe('');
            expect(dummyElement.style.transformOrigin).toBe('');
        });

        it('live wheel gesture applies live CSS transform without layout recomputations', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            windowInstance.renderLineGraph(container, { entries, questions });

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

    describe('Live Gesture Zoom — Per-Frame Counter-Scale for Points & Text (Task 9.9)', () => {
        it('renderGraphSVG renders vector-effect="non-scaling-stroke" on line paths and point circles', () => {
            const container = documentInstance.createElement('div');
            const questions = createSampleGraphQuestions();
            const entries = createSampleTwoDayLogs();

            windowInstance.renderLineGraph(container, { entries, questions });

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

            windowInstance.renderLineGraph(container, { entries, questions });

            const svgElement = container.querySelector('.graph-svg');
            const pointCircles = svgElement.querySelectorAll('.points circle');
            const gridTexts = svgElement.querySelectorAll('.grid text');
            const tickTexts = svgElement.querySelectorAll('.x-axis text');

            expect(pointCircles.length).toBeGreaterThan(0);
            expect(gridTexts.length).toBeGreaterThan(0);
            expect(tickTexts.length).toBeGreaterThan(0);

            // Apply gesture transform with scaleFactor = 2
            windowInstance.applyGraphGestureTransform(svgElement, 2.0, 100);

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

            windowInstance.renderLineGraph(container, { entries, questions });

            const svgElement = container.querySelector('.graph-svg');
            windowInstance.applyGraphGestureTransform(svgElement, 1.8, 150);

            // Reset gesture transform
            windowInstance.resetGraphGestureTransform(svgElement);

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
            const gestureController = windowInstance.setupGraphGestureZoom(scrollContainerElement, {
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
            const transformResult = windowInstance.calculateGestureTransform(2.0, 500, 50);
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

    describe('Live Gesture Zoom — Commit on Gesture End (Task 9.10)', () => {
        describe('calculateSettledGestureScrollLeft', () => {
            it('returns 0 or safe fallback for non-finite parameters', () => {
                expect(windowInstance.calculateSettledGestureScrollLeft()).toBe(0);
                expect(windowInstance.calculateSettledGestureScrollLeft({
                    previousScrollLeft: NaN,
                    initialTargetPivotX: null,
                    scaleFactor: -5
                })).toBe(0);
            });

            it('anchors pivot point when zooming in with zero pan', () => {
                // Point at SVG x=800 with previousScrollLeft=500 was at 300px in container.
                // At scaleFactor=1.5, new x=1200. With newScrollLeft=900, point remains at 300px in container.
                const settledScroll = windowInstance.calculateSettledGestureScrollLeft({
                    previousScrollLeft: 500,
                    initialTargetPivotX: 800,
                    scaleFactor: 1.5,
                    panDeltaX: 0
                });
                expect(settledScroll).toBe(900);
            });

            it('anchors pivot point when zooming out with zero pan', () => {
                // Point at SVG x=800 with previousScrollLeft=500 was at 300px in container.
                // At scaleFactor=0.5, new x=400. With newScrollLeft=100, point remains at 300px in container.
                const settledScroll = windowInstance.calculateSettledGestureScrollLeft({
                    previousScrollLeft: 500,
                    initialTargetPivotX: 800,
                    scaleFactor: 0.5,
                    panDeltaX: 0
                });
                expect(settledScroll).toBe(100);
            });

            it('incorporates pan delta displacement into settled scroll', () => {
                // Point moved right by 50px during gesture (panDeltaX=50).
                // Expected newScrollLeft = 500 + (1200 - 800) - 50 = 850.
                const settledScroll = windowInstance.calculateSettledGestureScrollLeft({
                    previousScrollLeft: 500,
                    initialTargetPivotX: 800,
                    scaleFactor: 1.5,
                    panDeltaX: 50
                });
                expect(settledScroll).toBe(850);
            });

            it('clamps settled scroll between 0 and maximum scroll width', () => {
                const settledScrollNegative = windowInstance.calculateSettledGestureScrollLeft({
                    previousScrollLeft: 100,
                    initialTargetPivotX: 100,
                    scaleFactor: 0.2,
                    panDeltaX: 500,
                    scrollWidth: 1000,
                    viewportWidth: 400
                });
                expect(settledScrollNegative).toBe(0);

                const settledScrollOverflow = windowInstance.calculateSettledGestureScrollLeft({
                    previousScrollLeft: 500,
                    initialTargetPivotX: 500,
                    scaleFactor: 3.0,
                    panDeltaX: -500,
                    scrollWidth: 1500,
                    viewportWidth: 500
                });
                // maximumScroll = 1500 - 500 = 1000
                expect(settledScrollOverflow).toBe(1000);
            });
        });

        describe('updateGraphSVGInPlace', () => {
            it('updates SVG attributes and element groups without discarding DOM elements', () => {
                const container = documentInstance.createElement('div');
                documentInstance.body.appendChild(container);

                const questions = createSampleGraphQuestions();
                const logs = createSampleTwoDayLogs();
                logs[0].note = 'Felt energetic and productive.';
                windowInstance.renderLineGraph(container, { entries: logs, questions });

                const svgElement = container.querySelector('.graph-svg');
                expect(svgElement).not.toBeNull();
                const initialWidth = Number(svgElement.getAttribute('width'));

                const existingNoteMarkers = Array.from(svgElement.querySelectorAll('.note-marker'));
                expect(existingNoteMarkers.length).toBeGreaterThan(0);
                const firstMarkerInstance = existingNoteMarkers[0];

                const updatedLayout = windowInstance.computeGraphLayout({
                    entries: logs,
                    allEntries: logs,
                    questions,
                    visibleQuestionIds: new Set(questions.map(question => question.id)),
                    timeRange: 'all',
                    zoomScale: 2.0
                });

                windowInstance.updateGraphSVGInPlace(svgElement, updatedLayout);

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
                windowInstance.renderLineGraph(container, { entries: logs, questions });

                const svgElement = container.querySelector('.graph-svg');
                const zoomValueElement = container.querySelector('.graph-zoom-value');
                const resetButton = container.querySelector('#button-graph-zoom-reset');
                const firstNoteMarker = container.querySelector('.note-marker');
                expect(firstNoteMarker).not.toBeNull();

                // Track note marker click listener invocation
                let noteClicked = false;
                firstNoteMarker.addEventListener('click', () => {
                    noteClicked = true;
                });

                // Simulate gesture start & active zoom transform
                windowInstance.applyGraphGestureTransform(svgElement, 2.0, 400, 20);
                expect(svgElement.style.transform).toContain('scaleX(2)');

                // Commit gesture end at 2.0x scale
                const commitResult = windowInstance.commitGraphGestureZoom(container, {
                    gestureEventData: {
                        scaleFactor: 2.0,
                        initialZoomScale: 1.0,
                        finalZoomScale: 2.0,
                        pivotX: 400,
                        panDeltaX: 20
                    },
                    gestureStartScrollLeft: 100,
                    gestureStartZoomScale: 1.0,
                    layoutEntries: logs,
                    questionList: questions,
                    currentVisibleSet: new Set(questions.map(question => question.id)),
                    currentTimeRange: 'all'
                });

                expect(commitResult).not.toBeNull();
                expect(commitResult.settledZoomScale).toBe(2.0);

                // 1. CSS live transform must be reset to identity
                expect(svgElement.style.transform).toBe('');
                expect(svgElement.style.transformOrigin).toBe('');

                // 2. STATE and zoom toolbar display must be updated
                expect(windowInstance.STATE.historyZoomScale).toBe(2.0);
                expect(zoomValueElement.textContent).toBe('2.0×');
                expect(resetButton.disabled).toBe(false);

                // 3. Note marker direct listener must remain active and functional
                firstNoteMarker.dispatchEvent(new windowInstance.MouseEvent('click', {
                    bubbles: true,
                    cancelable: true
                }));
                expect(noteClicked).toBe(true);

                // 4. Modal note dialog opens correctly after commit
                await sleep(50);
                const overlayElement = documentInstance.getElementById('notice-dialog-overlay');
                expect(overlayElement.classList.contains('is-open')).toBe(true);

                // Close dialog
                const okButton = documentInstance.getElementById('button-notice-ok');
                okButton.click();
                await sleep(40);

                container.remove();
            });

            it('executes full end-to-end touch pinch gesture lifecycle with commit on pointerup', async () => {
                const container = documentInstance.createElement('div');
                documentInstance.body.appendChild(container);

                const questions = createSampleGraphQuestions();
                const logs = createSampleTwoDayLogs();
                windowInstance.renderLineGraph(container, { entries: logs, questions });

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
                expect(windowInstance.STATE.historyZoomScale).toBe(2.0);
                // SVG intrinsic width redrawn at settled scale
                const settledWidth = Number(svgElement.getAttribute('width'));
                expect(settledWidth).toBeGreaterThan(initialWidth);

                container.remove();
            });
        });
    });
});
