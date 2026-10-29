// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    setupTestDOM,
    waitFor,
    createSampleEntry
} from './test-utils.js';
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

/**
 * Computes the rightmost x-coordinate reached by any rendered, data-driven graph content
 * element (x-axis tick lines, plotted data-line paths, point circles, skip markers, and note
 * icon markers) inside a rendered `<svg class="graph-svg">`.
 *
 * @param {SVGElement} svgElement
 * @returns {number} The maximum x-coordinate covered by any data-driven content element.
 */
function getSvgContentRightEdge(svgElement) {
    let maxX = -Infinity;

    function consider(value) {
        if (Number.isFinite(value) && value > maxX) maxX = value;
    }

    const contentSelector =
        '.x-axis line, .lines path, .points circle, .skips circle, .skips line, .notes rect, .notes path';

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

describe('History Graph Rendering, Gaps, and Geometry', () => {
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

        const paths = container.querySelectorAll('svg g.lines path');
        expect(paths.length).toBe(1);

        const points = container.querySelectorAll('svg g.points circle');
        expect(points.length).toBe(5);

        const skipMarkers = container.querySelectorAll('svg g.skips .skip-marker');
        expect(skipMarkers.length).toBe(2);

        const skipLabels = Array.from(skipMarkers).map(marker => marker.getAttribute('aria-label'));
        expect(skipLabels.some(label => label.includes('Mood') && label.includes('Skipped'))).toBe(true);
        expect(skipLabels.some(label => label.includes('Anxiety') && label.includes('Skipped'))).toBe(true);

        expect(container.textContent).toContain('Answered');
        expect(container.textContent).toContain('Skipped');
        expect(container.textContent).toContain('Not Asked');
    });

    it('proportionally scales X-axis based on elapsed time for intra-day and irregular intervals', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
        ];

        const logs = [
            createSampleEntry({
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
            }),
            createSampleEntry({
                timestamp: '2026-08-14T10:00:00.000Z',
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            }),
            createSampleEntry({
                timestamp: '2026-08-14T16:00:00.000Z',
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            })
        ];

        renderLineGraph(container, { entries: logs, questions });

        const points = container.querySelectorAll('svg g.points circle');
        expect(points.length).toBe(3);

        const xCoordinates = Array.from(points).map(point => Number(point.getAttribute('cx')));

        const deltaT1 = xCoordinates[1] - xCoordinates[0];
        const deltaT2 = xCoordinates[2] - xCoordinates[1];

        expect(deltaT2).toBeCloseTo(deltaT1 * 3, 0);

        const tickLabels = Array.from(container.querySelectorAll('svg .x-axis text')).map(
            textElement => textElement.textContent
        );
        expect(tickLabels.some(label => label.includes('8/14') || label.includes('Aug 14') || label.includes('08/14'))).toBe(true);

        const titleText = points[0].querySelector('title').textContent;
        expect(titleText).toContain('Energy');
        expect(titleText).toContain('8/14/2026');
    });

    it('enables recording multiple check-ins without refreshing the page', async () => {
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

        newCheckinButton.click();
        await waitFor(() => documentInstance.getElementById('progress-text').textContent.includes('Question 1 of'));

        expect(documentInstance.getElementById('progress-text').textContent).toContain('Question 1 of');
        expect(documentInstance.getElementById('button-stack').querySelectorAll('.score-button').length).toBeGreaterThan(0);
        expect(footerBox.style.display).not.toBe('none');
    });

    it('assigns distinct stroke-dasharray patterns to each active question line', () => {
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

        const dash0 = paths[0].getAttribute('stroke-dasharray');
        expect(dash0 === null || dash0 === 'none').toBe(true);

        const dash1 = paths[1].getAttribute('stroke-dasharray');
        const dash2 = paths[2].getAttribute('stroke-dasharray');
        const dash3 = paths[3].getAttribute('stroke-dasharray');

        expect(dash1).toBe('6,4');
        expect(dash2).toBe('2,3');
        expect(dash3).toBe('8,3,2,3');

        const patterns = [dash0 || 'solid', dash1, dash2, dash3];
        const uniquePatterns = new Set(patterns);
        expect(uniquePatterns.size).toBe(4);

        const legendSwatches = container.querySelectorAll('.graph-legend .legend-swatch');
        expect(legendSwatches.length).toBe(4);
    });

    it('renders note indicators on timeline and opens note modal with content on tap or keyboard interaction', async () => {
        const container = documentInstance.getElementById('panel-history');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' }
        ];

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

        const noteMarkers = Array.from(container.querySelectorAll('svg g.notes .note-marker'));
        expect(noteMarkers.length).toBe(2);

        const firstMarker = noteMarkers[0];
        expect(firstMarker.getAttribute('role')).toBe('button');
        expect(firstMarker.getAttribute('tabindex')).toBe('0');
        expect(firstMarker.getAttribute('aria-label')).toContain('Felt well-rested');
        expect(firstMarker.querySelector('title').textContent).toContain('Felt well-rested');

        const secondMarker = noteMarkers[1];
        expect(secondMarker.getAttribute('aria-label')).toContain('Sudden spike in agitation');

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

        const okButton = documentInstance.getElementById('button-notice-ok');
        okButton.click();
        await waitFor(() => !overlayElement.classList.contains('is-open'));
        expect(overlayElement.classList.contains('is-open')).toBe(false);

        secondMarker.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await waitFor(() => overlayElement.classList.contains('is-open'));

        expect(subtitleElement.textContent).toBe('Sudden spike in agitation after difficult meeting.');

        overlayElement.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await waitFor(() => !overlayElement.classList.contains('is-open'));
        expect(overlayElement.classList.contains('is-open')).toBe(false);
    });

    it('scales SVG width dynamically and provides horizontal scroll container for dense entries', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
        ];

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

        const scrollContainer = container.querySelector('.graph-scroll-container');
        expect(scrollContainer).toBeTruthy();
        expect(scrollContainer.getAttribute('role')).toBe('region');
        expect(scrollContainer.getAttribute('tabindex')).toBe('0');

        const svgElement = container.querySelector('svg.graph-svg');
        expect(svgElement).toBeTruthy();
        const viewBox = svgElement.getAttribute('viewBox');
        expect(viewBox).toBeTruthy();
        const [, , width] = viewBox.split(' ').map(Number);
        expect(width).toBeGreaterThan(600);
        expect(width).toBe(24 * 24 * BASE_PIXELS_PER_HOUR);
    });

    it('includes all answered questions from entries in addition to active questions when loading history view', async () => {
        const allQuestions = [
            { id: 'q_energy', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q_sadness', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q_worth', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' },
            { id: 'q_irritability', text: 'Irritability', shortLabel: 'Irritable', curve: 'less-is-better' },
            { id: 'q_racing', text: 'Racing Thoughts', shortLabel: 'Racing', curve: 'less-is-better' },
            { id: 'q_impulse', text: 'Restless Urges', shortLabel: 'Impulse', curve: 'less-is-better' },
            { id: 'q_overall', text: 'Overall Mood', shortLabel: 'Overall', curve: 'more-is-better' }
        ];

        for (const question of allQuestions) {
            await put('questions', question);
        }

        await setConfig('activeQuestionSet', ['q_energy', 'q_sadness', 'q_irritability', 'q_overall']);

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

        const legendItems = historyGraphContainer.querySelectorAll('.legend-checklist-item');
        expect(legendItems.length).toBe(7);

        const paths = historyGraphContainer.querySelectorAll('svg g.lines path');
        expect(paths.length).toBe(7);
    });

    describe('SVG Width Tightness — No Dead Space Beyond Intended Padding', () => {
        function buildDeadSpaceRegressionEntries() {
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

            const [baseline, ...rest] = deadSpaceByZoom;
            rest.forEach(deadSpace => {
                expect(Math.abs(deadSpace - baseline)).toBeLessThan(1);
            });
        });
    });
});
