// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDOM, createSampleGraphQuestions, createSampleTwoDayLogs } from './test-utils.js';
import {
    setupGraphGestureZoom,
    renderLineGraph
} from '../public/js/ui/history-graph.js';

let windowInstance;
let documentInstance;

describe('Live Gesture Zoom Input Handling', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Two-pointer touch pinch gesture tracking', () => {
        it('tracks gesture start, live scale changes, and gesture end lifecycle', () => {
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureStart = vi.fn();
            const onGestureChange = vi.fn();
            const onGestureEnd = vi.fn();

            const gestureController = setupGraphGestureZoom(scrollContainerElement, {
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
            const gestureController = setupGraphGestureZoom(scrollContainerElement, {
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
        it('starts gesture, computes scale factor, and triggers debounced end on wheel + ctrlKey', () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureStart = vi.fn();
            const onGestureChange = vi.fn();
            const onGestureEnd = vi.fn();

            const gestureController = setupGraphGestureZoom(scrollContainerElement, {
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

            // Fast-forward debounce timeout without real sleep
            vi.advanceTimersByTime(70);

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

        it('supports metaKey for macOS Command+wheel and trackpad pinch', () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            const scrollContainerElement = documentInstance.createElement('div');
            scrollContainerElement.className = 'graph-scroll-container';
            documentInstance.body.appendChild(scrollContainerElement);

            const onGestureStart = vi.fn();
            const onGestureEnd = vi.fn();

            const gestureController = setupGraphGestureZoom(scrollContainerElement, {
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

            vi.advanceTimersByTime(60);
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
            const gestureController = setupGraphGestureZoom(scrollContainerElement, {
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

            expect(defaultPrevented).toBe(true);
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

            renderLineGraph(container, { entries, questions });

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

            renderLineGraph(container, {
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

            renderLineGraph(container, { entries, questions });

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
});
