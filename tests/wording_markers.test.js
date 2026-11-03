// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    setupTestDOM,
    createSampleEntry
} from './test-utils.js';
import {
    computeGraphLayout,
    renderGraphSVG,
    renderLineGraph,
    renderWordingMarkerMarkup,
    applyGraphGestureTransform,
    resetGraphGestureTransform,
    updateGraphSVGInPlace
} from '../public/js/ui/history-graph.js';

describe('Question Wording-Change Timeline Markers', () => {
    const sampleQuestion = {
        id: 'q_energy',
        text: 'How energetic do you feel?',
        shortLabel: 'Energy',
        originalText: 'How is your energy right now?',
        curve: 'more-is-better',
        responseType: 'scale',
        textHistory: [
            {
                text: 'How energetic do you feel?',
                changedAt: '2026-08-11T12:00:00.000Z'
            }
        ]
    };

    const uneditedQuestion = {
        id: 'q_mood',
        text: 'Overall mood',
        shortLabel: 'Mood',
        curve: 'middle-is-best',
        responseType: 'scale'
    };

    const sampleEntries = [
        createSampleEntry({
            timestamp: '2026-08-10T10:00:00.000Z',
            answers: [
                { questionId: 'q_energy', score: 2, status: 'answered' },
                { questionId: 'q_mood', score: 3, status: 'answered' }
            ]
        }),
        createSampleEntry({
            timestamp: '2026-08-12T10:00:00.000Z',
            answers: [
                { questionId: 'q_energy', score: 4, status: 'answered' },
                { questionId: 'q_mood', score: 3, status: 'answered' }
            ]
        })
    ];

    it('places wording change marker at the calculated timeline coordinate within range', () => {
        const layout = computeGraphLayout({
            entries: sampleEntries,
            questions: [sampleQuestion, uneditedQuestion],
            visibleQuestionIds: ['q_energy', 'q_mood'],
            timeRange: 'all',
            zoomScale: 1
        });

        expect(layout.wordingMarkers).toBeDefined();
        expect(layout.wordingMarkers.length).toBe(1);

        const marker = layout.wordingMarkers[0];
        expect(marker.questionId).toBe('q_energy');
        expect(marker.previousText).toBe('How is your energy right now?');
        expect(marker.newText).toBe('How energetic do you feel?');
        expect(marker.x).toBeGreaterThan(0);
        expect(marker.y).toBeGreaterThan(0);
        expect(marker.formattedDate).toContain('2026');
    });

    it('ignores wording changes that occurred outside the rendered time range', () => {
        const outOfRangeQuestion = {
            id: 'q_energy',
            text: 'How energetic do you feel?',
            shortLabel: 'Energy',
            originalText: 'Energy level',
            curve: 'more-is-better',
            responseType: 'scale',
            textHistory: [
                {
                    text: 'How energetic do you feel?',
                    changedAt: '2025-01-01T00:00:00.000Z'
                }
            ]
        };

        const layout = computeGraphLayout({
            entries: sampleEntries,
            questions: [outOfRangeQuestion],
            visibleQuestionIds: ['q_energy'],
            timeRange: 'all',
            zoomScale: 1
        });

        expect(layout.wordingMarkers).toHaveLength(0);
    });

    it('omits wording markers for questions without text history', () => {
        const layout = computeGraphLayout({
            entries: sampleEntries,
            questions: [uneditedQuestion],
            visibleQuestionIds: ['q_mood'],
            timeRange: 'all',
            zoomScale: 1
        });

        expect(layout.wordingMarkers).toHaveLength(0);
    });

    it('interpolates Y coordinate linearly on scale question lines', () => {
        const layout = computeGraphLayout({
            entries: sampleEntries,
            questions: [sampleQuestion],
            visibleQuestionIds: ['q_energy'],
            timeRange: 'all',
            zoomScale: 1
        });

        const seriesPoints = layout.series[0].points;
        expect(seriesPoints).toHaveLength(2);
        const yFirst = seriesPoints[0].y;
        const ySecond = seriesPoints[1].y;

        const marker = layout.wordingMarkers[0];
        // Score went from 2 to 4, so Y decreased (higher score = lower Y coordinate)
        expect(marker.y).toBeLessThan(yFirst);
        expect(marker.y).toBeGreaterThan(ySecond);
    });

    it('retains horizontal step line height for boolean questions', () => {
        const booleanQuestion = {
            id: 'q_eaten',
            text: 'Did you eat food today?',
            shortLabel: 'Eaten',
            originalText: 'Have you eaten today?',
            curve: 'more-is-better',
            responseType: 'boolean',
            textHistory: [
                {
                    text: 'Did you eat food today?',
                    changedAt: '2026-08-11T12:00:00.000Z'
                }
            ]
        };

        const booleanEntries = [
            createSampleEntry({
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [{ questionId: 'q_eaten', score: 1, status: 'answered' }]
            }),
            createSampleEntry({
                timestamp: '2026-08-12T10:00:00.000Z',
                answers: [{ questionId: 'q_eaten', score: 5, status: 'answered' }]
            })
        ];

        const layout = computeGraphLayout({
            entries: booleanEntries,
            questions: [booleanQuestion],
            visibleQuestionIds: ['q_eaten'],
            timeRange: 'all',
            zoomScale: 1
        });

        const marker = layout.wordingMarkers[0];
        const initialPointY = layout.series[0].points[0].y;
        expect(marker.y).toBe(initialPointY);
    });

    it('hides wording markers when question is toggled off or another is isolated in legend', () => {
        const layoutWithHiddenQuestion = computeGraphLayout({
            entries: sampleEntries,
            questions: [sampleQuestion, uneditedQuestion],
            visibleQuestionIds: ['q_mood'],
            timeRange: 'all',
            zoomScale: 1
        });

        expect(layoutWithHiddenQuestion.wordingMarkers).toHaveLength(0);

        const layoutWithIsolatedEnergy = computeGraphLayout({
            entries: sampleEntries,
            questions: [sampleQuestion, uneditedQuestion],
            visibleQuestionIds: ['q_energy'],
            timeRange: 'all',
            zoomScale: 1
        });

        expect(layoutWithIsolatedEnergy.wordingMarkers).toHaveLength(1);
    });

    it('escapes dangerous HTML characters in wording marker SVG markup', () => {
        const dangerousMarker = {
            questionId: 'q_xss',
            questionTitle: 'Title & <Dangerous>',
            color: '#123456',
            x: 150,
            y: 80,
            formattedDate: '8/11/2026, 12:00 PM',
            previousText: '<script>alert("hack")</script>',
            newText: 'Safe & Clean "Text"'
        };

        const markup = renderWordingMarkerMarkup(dangerousMarker);
        expect(markup).not.toContain('<script>');
        expect(markup).toContain('&lt;script&gt;');
        expect(markup).toContain('&amp; &lt;Dangerous&gt;');
        expect(markup).toContain('Safe &amp; Clean &quot;Text&quot;');
        expect(markup).toContain('class="wording-marker"');
        expect(markup).toContain('class="wording-marker-badge');
        expect(markup).toContain('>W<');
    });

    it('renders wording markers group inside full graph SVG', () => {
        const layout = computeGraphLayout({
            entries: sampleEntries,
            questions: [sampleQuestion],
            visibleQuestionIds: ['q_energy'],
            timeRange: 'all',
            zoomScale: 1
        });

        const svgMarkup = renderGraphSVG(layout);
        expect(svgMarkup).toContain('<g class="wording-markers">');
        expect(svgMarkup).toContain('class="wording-marker"');
        expect(svgMarkup).toContain('>W</text>');
    });

    describe('Interactive DOM and Dialog Behavior', () => {
        let documentInstance;

        beforeEach(async () => {
            const environment = await setupTestDOM();
            documentInstance = environment.document;
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('opens notice dialog with previous and new wording on marker click', () => {
            const container = documentInstance.createElement('div');
            documentInstance.body.appendChild(container);

            renderLineGraph(container, {
                entries: sampleEntries,
                questions: [sampleQuestion],
                visibleQuestionIds: ['q_energy'],
                timeRange: 'all',
                zoomScale: 1
            });

            const markerElement = container.querySelector('.wording-marker');
            expect(markerElement).not.toBeNull();

            markerElement.dispatchEvent(new documentInstance.defaultView.MouseEvent('click', {
                bubbles: true,
                cancelable: true
            }));

            const overlay = documentInstance.getElementById('notice-dialog-overlay');
            expect(overlay.classList.contains('is-open')).toBe(true);

            const title = documentInstance.getElementById('notice-dialog-title');
            expect(title.textContent).toBe('Wording changed');

            const subtitle = documentInstance.getElementById('notice-dialog-subtitle');
            expect(subtitle.textContent).toContain('Previous wording:\n"How is your energy right now?"');
            expect(subtitle.textContent).toContain('New wording:\n"How energetic do you feel?"');
        });

        it('opens notice dialog when Enter or Space key is pressed on focused marker', () => {
            const container = documentInstance.createElement('div');
            documentInstance.body.appendChild(container);

            renderLineGraph(container, {
                entries: sampleEntries,
                questions: [sampleQuestion],
                visibleQuestionIds: ['q_energy'],
                timeRange: 'all',
                zoomScale: 1
            });

            const markerElement = container.querySelector('.wording-marker');
            expect(markerElement).not.toBeNull();

            markerElement.dispatchEvent(new documentInstance.defaultView.KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                cancelable: true
            }));

            const overlay = documentInstance.getElementById('notice-dialog-overlay');
            expect(overlay.classList.contains('is-open')).toBe(true);
            expect(documentInstance.getElementById('notice-dialog-title').textContent).toBe('Wording changed');
        });

        it('counter-scales wording markers during active pinch/wheel gestures and resets on end', () => {
            const container = documentInstance.createElement('div');
            documentInstance.body.appendChild(container);

            renderLineGraph(container, {
                entries: sampleEntries,
                questions: [sampleQuestion],
                visibleQuestionIds: ['q_energy'],
                timeRange: 'all',
                zoomScale: 1
            });

            const svgElement = container.querySelector('.graph-svg');
            const markerElement = container.querySelector('.wording-marker');
            expect(markerElement).not.toBeNull();

            // Apply gesture transform with scale factor 2
            applyGraphGestureTransform(svgElement, 2.0, 100, 0);

            // Wording marker should be counter-scaled with scaleX(0.5)
            expect(markerElement.style.transform).toBe('scaleX(0.5)');

            // Reset gesture transform
            resetGraphGestureTransform(svgElement);
            expect(markerElement.style.transform).toBe('');
        });

        it('updates wording markers in place during settled gesture zoom without rebuilding DOM', () => {
            const container = documentInstance.createElement('div');
            documentInstance.body.appendChild(container);

            renderLineGraph(container, {
                entries: sampleEntries,
                questions: [sampleQuestion],
                visibleQuestionIds: ['q_energy'],
                timeRange: 'all',
                zoomScale: 1
            });

            const svgElement = container.querySelector('.graph-svg');
            const initialMarker = container.querySelector('.wording-marker');
            expect(initialMarker).not.toBeNull();

            const newLayout = computeGraphLayout({
                entries: sampleEntries,
                questions: [sampleQuestion],
                visibleQuestionIds: ['q_energy'],
                timeRange: 'all',
                zoomScale: 2
            });

            updateGraphSVGInPlace(svgElement, newLayout);

            const updatedMarker = container.querySelector('.wording-marker');
            // Element reference should be preserved (in-place update)
            expect(updatedMarker).toBe(initialMarker);
            // X coordinate attribute should be updated
            expect(Number(updatedMarker.getAttribute('data-x'))).toBe(newLayout.wordingMarkers[0].x);
        });
    });
});
