// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    BASE_PIXELS_PER_HOUR,
    calculateGestureTransform,
    calculateNowScrollLeft,
    calculatePinchDistance,
    calculatePinchMidpoint,
    calculateSettledGestureScrollLeft,
    calculateTimeframePresetZoomScale,
    calculateWheelZoomDeltaMultiplier,
    calculateZoomPivotScrollLeft,
    computeGraphLayout
} from '../public/js/ui/history-graph.js';
import { BOOLEAN_YES_SCORE } from '../public/js/questions.js';
import { createSampleEntry } from './test-utils.js';

describe('Graph Math & Pure Layout Calculations', () => {
    describe('calculatePinchDistance helper', () => {
        it('returns 0 if either pointer object is missing or non-numeric', () => {
            expect(calculatePinchDistance(null, null)).toBe(0);
            expect(calculatePinchDistance({ clientX: 10, clientY: 20 }, null)).toBe(0);
            expect(calculatePinchDistance(null, { clientX: 10, clientY: 20 })).toBe(0);
            expect(calculatePinchDistance({ clientX: NaN, clientY: 20 }, { clientX: 0, clientY: 0 }))
                .toBe(0);
        });

        it('computes exact Euclidean distance between two pointers', () => {
            const firstPointer = { clientX: 0, clientY: 0 };
            const secondPointer = { clientX: 30, clientY: 40 };
            expect(calculatePinchDistance(firstPointer, secondPointer)).toBe(50);
        });

        it('computes purely horizontal and vertical distances', () => {
            expect(calculatePinchDistance(
                { clientX: 100, clientY: 50 },
                { clientX: 250, clientY: 50 }
            )).toBe(150);

            expect(calculatePinchDistance(
                { clientX: 50, clientY: 80 },
                { clientX: 50, clientY: 200 }
            )).toBe(120);
        });
    });

    describe('calculatePinchMidpoint helper', () => {
        it('returns origin coordinates if either pointer is missing', () => {
            expect(calculatePinchMidpoint(null, null)).toEqual({ clientX: 0, clientY: 0 });
            expect(calculatePinchMidpoint({ clientX: 50, clientY: 60 }, null))
                .toEqual({ clientX: 0, clientY: 0 });
        });

        it('calculates average midpoint between two pointer coordinates', () => {
            const firstPointer = { clientX: 100, clientY: 200 };
            const secondPointer = { clientX: 300, clientY: 400 };
            const midpoint = calculatePinchMidpoint(firstPointer, secondPointer);
            expect(midpoint).toEqual({ clientX: 200, clientY: 300 });
        });
    });

    describe('calculateWheelZoomDeltaMultiplier helper', () => {
        it('returns 1 for zero or non-finite deltaY', () => {
            expect(calculateWheelZoomDeltaMultiplier(0)).toBe(1);
            expect(calculateWheelZoomDeltaMultiplier(NaN)).toBe(1);
            expect(calculateWheelZoomDeltaMultiplier(Infinity)).toBe(1);
        });

        it('returns multiplier greater than 1 for negative delta (zoom in)', () => {
            const multiplier = calculateWheelZoomDeltaMultiplier(-50);
            expect(multiplier).toBeGreaterThan(1);
            expect(multiplier).toBeCloseTo(Math.exp(50 * 0.005), 4);
        });

        it('returns multiplier less than 1 for positive delta (zoom out)', () => {
            const multiplier = calculateWheelZoomDeltaMultiplier(50);
            expect(multiplier).toBeLessThan(1);
            expect(multiplier).toBeCloseTo(Math.exp(-50 * 0.005), 4);
        });

        it('scales line delta mode by 20x compared to pixel mode', () => {
            const pixelMultiplier = calculateWheelZoomDeltaMultiplier(2, 0);
            const lineMultiplier = calculateWheelZoomDeltaMultiplier(2, 1);
            expect(lineMultiplier).toBeCloseTo(Math.exp(-2 * 20 * 0.005), 4);
            expect(lineMultiplier).toBeLessThan(pixelMultiplier);
        });
    });

    describe('calculateGestureTransform helper', () => {
        it('calculateGestureTransform computes exact translateX and scaleX for pivot fixing', () => {
            // Formula: translateX = panDeltaX + pivotX * (1 - scaleFactor)
            const result1 = calculateGestureTransform(2.0, 100);
            expect(result1.scaleX).toBe(2.0);
            expect(result1.translateX).toBe(-100);
            expect(result1.transformString).toBe('translateX(-100px) scaleX(2)');

            const result2 = calculateGestureTransform(0.5, 200);
            expect(result2.scaleX).toBe(0.5);
            expect(result2.translateX).toBe(100);
            expect(result2.transformString).toBe('translateX(100px) scaleX(0.5)');

            const result3 = calculateGestureTransform(1.0, 150);
            expect(result3.scaleX).toBe(1.0);
            expect(result3.translateX).toBe(0);
            expect(result3.transformString).toBe('translateX(0px) scaleX(1)');

            // With pan offset (e.g. two-finger drift of +30px)
            const resultWithPan = calculateGestureTransform(2.0, 100, 30);
            expect(resultWithPan.scaleX).toBe(2.0);
            expect(resultWithPan.translateX).toBe(-70);
            expect(resultWithPan.transformString).toBe('translateX(-70px) scaleX(2)');
        });

        it('calculateGestureTransform safely handles invalid or zero scaleFactor and non-finite pivot', () => {
            const resultInvalidScale = calculateGestureTransform(0, 50);
            expect(resultInvalidScale.scaleX).toBe(1);
            expect(resultInvalidScale.translateX).toBe(0);

            const resultNaN = calculateGestureTransform(NaN, NaN);
            expect(resultNaN.scaleX).toBe(1);
            expect(resultNaN.translateX).toBe(0);
        });
    });

    describe('calculateSettledGestureScrollLeft helper', () => {
        it('returns 0 or safe fallback for non-finite parameters', () => {
            expect(calculateSettledGestureScrollLeft()).toBe(0);
            expect(calculateSettledGestureScrollLeft({
                previousScrollLeft: NaN,
                initialTargetPivotX: null,
                scaleFactor: -5
            })).toBe(0);
        });

        it('anchors pivot point when zooming in with zero pan', () => {
            // Point at SVG x=800 with previousScrollLeft=500 was at 300px in container.
            // At scaleFactor=1.5, new x=1200. With newScrollLeft=900, point remains at 300px in container.
            const settledScroll = calculateSettledGestureScrollLeft({
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
            const settledScroll = calculateSettledGestureScrollLeft({
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
            const settledScroll = calculateSettledGestureScrollLeft({
                previousScrollLeft: 500,
                initialTargetPivotX: 800,
                scaleFactor: 1.5,
                panDeltaX: 50
            });
            expect(settledScroll).toBe(850);
        });

        it('clamps settled scroll between 0 and maximum scroll width', () => {
            const settledScrollNegative = calculateSettledGestureScrollLeft({
                previousScrollLeft: 100,
                initialTargetPivotX: 100,
                scaleFactor: 0.2,
                panDeltaX: 500,
                scrollWidth: 1000,
                viewportWidth: 400
            });
            expect(settledScrollNegative).toBe(0);

            const settledScrollOverflow = calculateSettledGestureScrollLeft({
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

    describe('computeGraphLayout pure layout computation (Task 4.13)', () => {
        it('returns empty layout state when no entries or questions are provided', () => {
            const emptyEntriesLayout = computeGraphLayout({
                entries: [],
                questions: [{ id: 'q1', text: 'Mood', shortLabel: 'Mood', curve: 'more-is-better' }]
            });
            expect(emptyEntriesLayout.isEmpty).toBe(true);
            expect(emptyEntriesLayout.reason).toBe('no-entries');

            const emptyQuestionsLayout = computeGraphLayout({
                entries: [createSampleEntry({ answers: [{ questionId: 'q1', score: 3, status: 'answered' }] })],
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
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 40,
                    answers: [{ questionId: 'q1', score: 1, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 20,
                    answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 5,
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 0,
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                })
            ];

            // Always-render-everything model (Task 9.2): full entry history is always included in the rendered/scrollable domain
            const sevenDayLayout = computeGraphLayout({
                entries,
                questions,
                timeRange: '7d'
            });
            expect(sevenDayLayout.isEmpty).toBe(false);
            expect(sevenDayLayout.filteredEntries.length).toBe(4);

            // All-time window layout
            const allTimeLayout = computeGraphLayout({
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
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 3,
                    note: 'Felt energetic',
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 2,
                    answers: [{ questionId: 'q1', score: null, status: 'skipped' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 1,
                    note: 'Great day',
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 0,
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                })
            ];

            const layout = computeGraphLayout({ entries, questions });
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
                createSampleEntry({
                    timestamp: new Date(baseTime).toISOString(),
                    answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
                }),
                createSampleEntry({
                    timestamp: new Date(baseTime + 3 * 3600 * 1000).toISOString(),
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                }),
                createSampleEntry({
                    timestamp: new Date(baseTime + 6 * 3600 * 1000).toISOString(),
                    answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
                }),
                createSampleEntry({
                    timestamp: new Date(baseTime + 12 * 3600 * 1000).toISOString(),
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                })
            ];

            expect(BASE_PIXELS_PER_HOUR).toBe(2);

            const layout = computeGraphLayout({ entries, questions, zoomScale: 1 });
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
            const zoomedLayout = computeGraphLayout({ entries, questions, zoomScale: 1.5 });
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
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 180,
                    answers: [{ questionId: 'q1', score: 2, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 60,
                    answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 20,
                    answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
                }),
                createSampleEntry({
                    baseTimestamp: now,
                    daysAgo: 2,
                    answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
                })
            ];

            ['7d', '14d', '30d', '90d', 'all'].forEach(timeRange => {
                const layout = computeGraphLayout({ entries, questions, timeRange });
                expect(layout.isEmpty).toBe(false);
                expect(layout.isTimeframeEmpty).toBe(false);
                expect(layout.filteredEntries.length).toBe(4);
                expect(layout.series[0].points.length).toBe(4);
            });
        });
    });

    describe('calculateTimeframePresetZoomScale helper', () => {
        it('calculates preset zoom scale multipliers to span viewport width', () => {
            const viewportWidth = 600;
            // 7d: 168 hours * 2 px/h = 336 px base -> scale = 600 / 336 = 1.79
            expect(calculateTimeframePresetZoomScale('7d', { viewportWidth })).toBe(1.79);
            // 14d: 336 hours * 2 px/h = 672 px base -> scale = 600 / 672 = 0.89
            expect(calculateTimeframePresetZoomScale('14d', { viewportWidth })).toBe(0.89);
            // 30d: 720 hours * 2 px/h = 1440 px base -> scale = 600 / 1440 = 0.42
            expect(calculateTimeframePresetZoomScale('30d', { viewportWidth })).toBe(0.42);
            // 90d: 2160 hours * 2 px/h = 4320 px base -> scale = 600 / 4320 = 0.14
            expect(calculateTimeframePresetZoomScale('90d', { viewportWidth })).toBe(0.14);

            // 'all': entries spanning 5 days (120 hours) -> 120 * 2 = 240 px base -> scale = 600 / 240 = 2.5
            const baseTime = Date.now();
            const entries = [
                createSampleEntry({ baseTimestamp: baseTime, daysAgo: 5 }),
                createSampleEntry({ baseTimestamp: baseTime, daysAgo: 0 })
            ];
            expect(calculateTimeframePresetZoomScale('all', { entries, viewportWidth })).toBe(2.5);
        });
    });

    describe('calculateZoomPivotScrollLeft helper', () => {
        it('pivots horizontal scroll position around the viewport center', () => {
            // Previous center = 100 + 400 / 2 = 300
            // Padding = 32
            // Scale increases 1.0 -> 2.0 (zoom in 2x)
            // New center coordinate = 32 + (300 - 32) * 2 = 32 + 536 = 568
            // Target scroll left = 568 - 400 / 2 = 368
            // The coordinate at the viewport center (offset 200 in viewport) is 568 - 368 = 200 (exact match)
            const targetScrollLeft = calculateZoomPivotScrollLeft({
                previousScrollLeft: 100,
                viewportWidth: 400,
                previousZoomScale: 1,
                nextZoomScale: 2,
                paddingLeft: 32
            });
            expect(targetScrollLeft).toBe(368);

            // Clamps at 0 if target would be negative
            const zeroClampedScroll = calculateZoomPivotScrollLeft({
                previousScrollLeft: 0,
                viewportWidth: 600,
                previousZoomScale: 2,
                nextZoomScale: 0.5,
                paddingLeft: 32
            });
            expect(zeroClampedScroll).toBe(0);
        });
    });

    describe('calculateNowScrollLeft helper', () => {
        it('calculates target scroll position to bring latest entries into normal position', () => {
            // Container with scrollWidth > viewportWidth
            const scrollPosition = calculateNowScrollLeft({
                scrollWidth: 2400,
                viewportWidth: 600
            });
            expect(scrollPosition).toBe(1800);

            // Container where content fits in viewport
            const fittedScroll = calculateNowScrollLeft({
                scrollWidth: 500,
                viewportWidth: 600
            });
            expect(fittedScroll).toBe(0);

            // Fallback to svgWidth when scrollWidth is 0
            const fallbackScroll = calculateNowScrollLeft({
                scrollWidth: 0,
                svgWidth: 1500,
                viewportWidth: 500
            });
            expect(fallbackScroll).toBe(1000);

            // Zero / negative dimensions
            expect(calculateNowScrollLeft({})).toBe(0);
        });
    });

    describe('computeGraphLayout responseType tagging', () => {
        it('tags series items with responseType', () => {
            const questions = [
                { id: 'scale_q', text: 'Mood', curve: 'more-is-better', responseType: 'scale' },
                { id: 'bool_q', text: 'Eaten', curve: 'more-is-better', responseType: 'boolean' }
            ];
            const entries = [
                createSampleEntry({
                    timestamp: '2026-08-10T10:00:00.000Z',
                    answers: [
                        { questionId: 'scale_q', score: 3, status: 'answered' },
                        { questionId: 'bool_q', score: 5, status: 'answered' }
                    ]
                })
            ];

            const layout = computeGraphLayout({
                entries,
                questions,
                containerWidth: 600,
                timeRange: 'all',
                zoomScale: 1
            });

            expect(layout.series.length).toBe(2);
            expect(layout.series[0].responseType).toBe('scale');
            expect(layout.series[1].responseType).toBe('boolean');
        });

        it('tags point items with question responseType', () => {
            const questions = [
                { id: 'scale_q', text: 'Energy', curve: 'more-is-better', responseType: 'scale' },
                { id: 'bool_q', text: 'Eaten', curve: 'more-is-better', responseType: 'boolean' }
            ];
            const entries = [
                createSampleEntry({
                    timestamp: '2026-08-10T10:00:00.000Z',
                    answers: [
                        { questionId: 'scale_q', score: 3, status: 'answered' },
                        { questionId: 'bool_q', score: BOOLEAN_YES_SCORE, status: 'answered' }
                    ]
                })
            ];

            const layout = computeGraphLayout({
                entries,
                questions,
                containerWidth: 600,
                timeRange: 'all',
                zoomScale: 1
            });

            expect(layout.series[0].points[0].responseType).toBe('scale');
            expect(layout.series[1].points[0].responseType).toBe('boolean');
        });
    });
});
