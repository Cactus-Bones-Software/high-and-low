/**
 * HIGH & LOW - HISTORY & TIMELINE GRAPH UI
 * SVG mood timeline rendering, continuous time scaling, question curve paths, note indicators, and timeframe filters.
 */

import {STATE} from '../state.js';
import {getAll, getConfig} from '../storage/db.js';
import {
    BOOLEAN_NO_SCORE,
    BOOLEAN_YES_SCORE,
    DEFAULT_ACTIVE_SET,
    getCurveColor,
    getQuestionDashArray
} from '../questions.js';
import {escapeHTML} from '../utils.js';
import {showNoticeDialog} from './dialogs.js';

export const BASE_PIXELS_PER_HOUR = 2;
export const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export function formatZoomValue(zoomScale) {
    const formatted = Number(zoomScale).toFixed(2).replace(/0+$/, '');
    return formatted.endsWith('.') ? `${formatted}0` : formatted;
}

/**
 * Computes the zoom scale required for a given timeframe preset to span the viewport width.
 *
 * @param {string} rangeKey - Timeframe preset key ('7d', '14d', '30d', '90d', 'all')
 * @param {Object} options - Layout options
 * @param {Array<Object>} [options.entries=[]] - Complete list of history entries
 * @param {number} [options.viewportWidth=600] - Visible width of the timeline container in pixels
 * @returns {number} Calculated zoom scale multiplier
 */
export function calculateTimeframePresetZoomScale(rangeKey, { entries = [], viewportWidth = 600 } = {}) {
    const resolvedWidth = Number.isFinite(Number(viewportWidth)) && Number(viewportWidth) > 0
        ? Number(viewportWidth)
        : 600;

    let targetHours;
    if (rangeKey === 'all') {
        const validTimestamps = (Array.isArray(entries) ? entries : [])
            .map(entry => new Date(entry.timestamp).getTime())
            .filter(timestamp => !Number.isNaN(timestamp));
        if (validTimestamps.length > 1) {
            const minimumTimestamp = Math.min(...validTimestamps);
            const maximumTimestamp = Math.max(...validTimestamps);
            const elapsedHours = (maximumTimestamp - minimumTimestamp) / MILLISECONDS_PER_HOUR;
            targetHours = Math.max(24, elapsedHours);
        } else {
            targetHours = 7 * 24;
        }
    } else {
        const daysMap = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        const numberOfDays = daysMap[rangeKey] || 7;
        targetHours = numberOfDays * 24;
    }

    const calculatedScale = resolvedWidth / (targetHours * BASE_PIXELS_PER_HOUR);
    return Math.max(0.01, Math.round(calculatedScale * 100) / 100);
}

/**
 * Calculates the new horizontal scroll position when changing zoom scales, pivoting around
 * the horizontal center of the currently visible viewport.
 *
 * @param {Object} options - Pivot options
 * @param {number} [options.previousScrollLeft=0] - Scroll position prior to zoom change
 * @param {number} [options.viewportWidth=600] - Visible container width in pixels
 * @param {number} [options.previousZoomScale=1] - Zoom scale before the change
 * @param {number} [options.nextZoomScale=1] - Target zoom scale after the change
 * @param {number} [options.paddingLeft=32] - Left chart padding in pixels
 * @returns {number} Target horizontal scroll position in pixels
 */
export function calculateZoomPivotScrollLeft({
                                                 previousScrollLeft = 0,
                                                 viewportWidth = 600,
                                                 previousZoomScale = 1,
                                                 nextZoomScale = 1,
                                                 paddingLeft = 0
                                             } = {}) {
    const safePreviousScale = Number(previousZoomScale) > 0 ? Number(previousZoomScale) : 1;
    const safeNextScale = Number(nextZoomScale) > 0 ? Number(nextZoomScale) : 1;
    const zoomRatio = safeNextScale / safePreviousScale;
    const previousCenterCoordinate = previousScrollLeft + viewportWidth / 2;
    const nextCenterCoordinate = paddingLeft + (previousCenterCoordinate - paddingLeft) * zoomRatio;
    return Math.max(0, nextCenterCoordinate - viewportWidth / 2);
}

/**
 * Calculates the target horizontal scroll position to pan the mood timeline to the most recent
 * entries ("NOW"), placing the latest entry at its normal position with trailing padding.
 *
 * @param {Object} [options]
 * @param {number} [options.scrollWidth=0] - Total scrollable width of the timeline container
 * @param {number} [options.viewportWidth=0] - Viewport client width of the timeline container
 * @param {number} [options.svgWidth=0] - Rendered SVG width from layout dimensions
 * @returns {number} Target horizontal scroll position in pixels
 */
export function calculateNowScrollLeft({
                                           scrollWidth = 0,
                                           viewportWidth = 0,
                                           svgWidth = 0
                                       } = {}) {
    const totalWidth = Number(scrollWidth) > 0 ? Number(scrollWidth) : Number(svgWidth);
    const safeViewportWidth = Number(viewportWidth) > 0 ? Number(viewportWidth) : 0;
    if (totalWidth <= 0 || safeViewportWidth <= 0) {
        return Math.max(0, totalWidth);
    }
    return Math.max(0, totalWidth - safeViewportWidth);
}

/**
 * Computes the Euclidean distance between two pointers for touch pinch gesture tracking.
 *
 * @param {Object} firstPointer - First pointer object with clientX and clientY
 * @param {Object} secondPointer - Second pointer object with clientX and clientY
 * @returns {number} Distance in pixels
 */
export function calculatePinchDistance(firstPointer, secondPointer) {
    if (!firstPointer || !secondPointer) {
        return 0;
    }
    const horizontalDistance = Number(secondPointer.clientX) - Number(firstPointer.clientX);
    const verticalDistance = Number(secondPointer.clientY) - Number(firstPointer.clientY);
    if (!Number.isFinite(horizontalDistance) || !Number.isFinite(verticalDistance)) {
        return 0;
    }
    return Math.hypot(horizontalDistance, verticalDistance);
}

/**
 * Computes the midpoint coordinate between two pointers for touch pinch gesture tracking.
 *
 * @param {Object} firstPointer - First pointer object with clientX and clientY
 * @param {Object} secondPointer - Second pointer object with clientX and clientY
 * @returns {{ clientX: number, clientY: number }} Midpoint coordinates
 */
export function calculatePinchMidpoint(firstPointer, secondPointer) {
    if (!firstPointer || !secondPointer) {
        return { clientX: 0, clientY: 0 };
    }
    const firstClientX = Number(firstPointer.clientX) || 0;
    const firstClientY = Number(firstPointer.clientY) || 0;
    const secondClientX = Number(secondPointer.clientX) || 0;
    const secondClientY = Number(secondPointer.clientY) || 0;
    return {
        clientX: (firstClientX + secondClientX) / 2,
        clientY: (firstClientY + secondClientY) / 2
    };
}

/**
 * Computes the exponential zoom scale multiplier for a wheel event (Ctrl+wheel or trackpad pinch).
 *
 * @param {number} deltaY - Wheel vertical delta
 * @param {number} [deltaMode=0] - Wheel event delta mode (0 = pixels, 1 = lines, 2 = pages)
 * @returns {number} Multiplier to apply to current scale factor
 */
export function calculateWheelZoomDeltaMultiplier(deltaY, deltaMode = 0) {
    if (!Number.isFinite(deltaY) || deltaY === 0) {
        return 1;
    }
    const pixelMultiplier = deltaMode === 1 ? 20 : (deltaMode === 2 ? 400 : 1);
    const normalizedDelta = deltaY * pixelMultiplier;
    const zoomSensitivity = 0.005;
    return Math.exp(-normalizedDelta * zoomSensitivity);
}

/**
 * Computes the horizontal scale and compensating translation values for live gesture zoom pivoting.
 * Keeps the pivot coordinate visually fixed within the view during zoom scaling:
 *   newX = panDeltaX + pivotX + scaleFactor * (x - pivotX) = panDeltaX + scaleFactor * x + pivotX * (1 - scaleFactor)
 *
 * @param {number} scaleFactor - Live scale factor relative to gesture start (e.g. 1.25)
 * @param {number} pivotX - Horizontal pivot coordinate in target element coordinates
 * @param {number} [panDeltaX=0] - Horizontal translation offset if midpoint/cursor drifted during gesture
 * @returns {{ scaleX: number, translateX: number, transformString: string }} Transform parameters
 */
export function calculateGestureTransform(scaleFactor, pivotX = 0, panDeltaX = 0) {
    const safeScale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
    const safePivot = Number.isFinite(pivotX) ? pivotX : 0;
    const safePan = Number.isFinite(panDeltaX) ? panDeltaX : 0;
    const translateX = safePan + safePivot * (1 - safeScale);
    return {
        scaleX: safeScale,
        translateX,
        transformString: `translateX(${translateX}px) scaleX(${safeScale})`
    };
}

/**
 * Applies a live horizontal CSS transform to the SVG graph element or target container without
 * recomputing layout or rebuilding the DOM.
 *
 * Additionally applies an inverse horizontal counter-scale to point circles and text labels
 * (gridline labels and x-axis date tick labels) to prevent distortion during active gestures (Task 9.9).
 *
 * @param {Element} targetElement - The SVG or group element to transform
 * @param {number} scaleFactor - Scale factor relative to gesture start
 * @param {number} pivotX - Horizontal pivot coordinate in element container coordinates
 * @param {number} [panDeltaX=0] - Horizontal pan delta offset if midpoint moved during gesture
 * @returns {{ scaleX: number, translateX: number, transformString: string } | null} Applied transform
 */
export function applyGraphGestureTransform(targetElement, scaleFactor, pivotX = 0, panDeltaX = 0) {
    if (!targetElement || !targetElement.style) {
        return null;
    }
    const transformValues = calculateGestureTransform(scaleFactor, pivotX, panDeltaX);
    targetElement.style.transformOrigin = '0 0';
    targetElement.style.transform = transformValues.transformString;

    // Task 9.9: Counter-scale point circles and text elements
    const validScale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
    const inverseScaleX = 1 / validScale;
    const inverseTransform = `scaleX(${inverseScaleX})`;

    // Counter-scale data point circles around their own center (cx, cy)
    const pointCircles = targetElement.querySelectorAll('.points circle');
    pointCircles.forEach(pointCircle => {
        const coordinateX = pointCircle.getAttribute('cx') || '0';
        const coordinateY = pointCircle.getAttribute('cy') || '0';
        pointCircle.style.transformOrigin = `${coordinateX}px ${coordinateY}px`;
        pointCircle.style.transform = inverseTransform;
    });

    // Counter-scale gridline and skip/note baseline text labels
    const gridTexts = targetElement.querySelectorAll('.grid text');
    gridTexts.forEach(gridText => {
        const coordinateX = gridText.getAttribute('x') || '0';
        const coordinateY = gridText.getAttribute('y') || '0';
        gridText.style.transformOrigin = `${coordinateX}px ${coordinateY}px`;
        gridText.style.transform = inverseTransform;
    });

    // Counter-scale x-axis date tick labels
    const tickTexts = targetElement.querySelectorAll('.x-axis text');
    tickTexts.forEach(tickText => {
        const coordinateX = tickText.getAttribute('x') || '0';
        const coordinateY = tickText.getAttribute('y') || '0';
        tickText.style.transformOrigin = `${coordinateX}px ${coordinateY}px`;
        tickText.style.transform = inverseTransform;
    });

    return transformValues;
}

/**
 * Resets any active live horizontal CSS gesture transform on the target element back to identity.
 * Also resets counter-scales on point circles and text labels.
 *
 * @param {Element} targetElement - The transformed element to reset
 */
export function resetGraphGestureTransform(targetElement) {
    if (!targetElement || !targetElement.style) {
        return;
    }
    targetElement.style.transform = '';
    targetElement.style.transformOrigin = '';

    const counterScaledElements = targetElement.querySelectorAll(
        '.points circle, .grid text, .x-axis text'
    );
    counterScaledElements.forEach(element => {
        element.style.transform = '';
        element.style.transformOrigin = '';
    });
}

/**
 * Calculates the horizontal scroll position after committing a gesture zoom and pan,
 * keeping the pivot point visually anchored at its final gesture position.
 *
 * @param {Object} [options={}]
 * @param {number} [options.previousScrollLeft=0] - Scroll position before the gesture began
 * @param {number} [options.initialTargetPivotX=0] - Pivot coordinate relative to target SVG
 * @param {number} [options.scaleFactor=1] - Gesture scale factor relative to start
 * @param {number} [options.panDeltaX=0] - Horizontal pan delta offset during gesture
 * @param {number} [options.paddingLeft=0] - Left padding of the layout
 * @param {number} [options.scrollWidth=0] - Total scroll width of the container
 * @param {number} [options.viewportWidth=0] - Client width of the container
 * @returns {number} Settled scrollLeft in pixels
 */
export function calculateSettledGestureScrollLeft({
                                                      previousScrollLeft = 0,
                                                      initialTargetPivotX = 0,
                                                      scaleFactor = 1,
                                                      panDeltaX = 0,
                                                      paddingLeft = 0,
                                                      scrollWidth = 0,
                                                      viewportWidth = 0
                                                  } = {}) {
    const safePreviousScroll = Number.isFinite(previousScrollLeft) ? previousScrollLeft : 0;
    const safePivot = Number.isFinite(initialTargetPivotX) ? initialTargetPivotX : 0;
    const safeScale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
    const safePan = Number.isFinite(panDeltaX) ? panDeltaX : 0;
    const safePadding = Number.isFinite(paddingLeft) ? paddingLeft : 0;

    const newTargetPivotX = safePadding + (safePivot - safePadding) * safeScale;
    const rawScrollLeft = safePreviousScroll + (newTargetPivotX - safePivot) - safePan;

    const safeScrollWidth = Number.isFinite(scrollWidth) && scrollWidth > 0 ? scrollWidth : 0;
    const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0;
    if (safeScrollWidth > 0 && safeViewportWidth > 0) {
        const maximumScroll = Math.max(0, safeScrollWidth - safeViewportWidth);
        return Math.max(0, Math.min(rawScrollLeft, maximumScroll));
    }
    return Math.max(0, rawScrollLeft);
}

/**
 * Updates an existing rendered SVG graph element in place from a newly computed layout,
 * adjusting dimensions, viewBox, gridlines, axis ticks, curves, skips, data points,
 * and existing note markers without replacing the outer elements or dropping listeners.
 *
 * @param {Element} svgElement - The SVG element to update
 * @param {Object} layout - The layout returned by computeGraphLayout()
 */
export function updateGraphSVGInPlace(svgElement, layout) {
    if (!svgElement || !layout || layout.isEmpty || layout.isTimeframeEmpty) {
        return;
    }

    const { dimensions, gridLines, xTicks, series, notes } = layout;
    const {
        width,
        height,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        skipBaselineY,
        noteBaselineY
    } = dimensions;

    svgElement.setAttribute('width', String(width));
    svgElement.setAttribute('height', String(height));
    svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Update Grid Lines
    let gridLinesHTML = '';
    gridLines.forEach(gridLine => {
        gridLinesHTML += `
            <line x1="${paddingLeft}" y1="${gridLine.y}" x2="${width - paddingRight}" y2="${gridLine.y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" />
            <text x="${paddingLeft - 8}" y="${gridLine.y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end" font-weight="600">${gridLine.score}</text>
        `;
    });
    gridLinesHTML += `
        <line x1="${paddingLeft}" y1="${skipBaselineY}" x2="${width - paddingRight}" y2="${skipBaselineY}" stroke="var(--border-color)" stroke-width="0.8" stroke-dasharray="1,3" opacity="0.6" />
        <text x="${paddingLeft - 8}" y="${skipBaselineY + 3.5}" fill="var(--text-muted)" font-size="9.5" text-anchor="end" font-style="italic">Skip</text>
    `;
    gridLinesHTML += `
        <line x1="${paddingLeft}" y1="${noteBaselineY}" x2="${width - paddingRight}" y2="${noteBaselineY}" stroke="var(--border-color)" stroke-width="0.8" stroke-dasharray="1,3" opacity="0.6" />
        <text x="${paddingLeft - 8}" y="${noteBaselineY + 3.5}" fill="var(--text-muted)" font-size="9.5" text-anchor="end" font-style="italic">Note</text>
    `;
    const gridGroup = svgElement.querySelector('.grid');
    if (gridGroup) {
        gridGroup.innerHTML = gridLinesHTML;
    }

    // Update X-Axis Lines & Date Ticks
    let xAxisHTML = '';
    xTicks.forEach(tick => {
        xAxisHTML += `
            <line x1="${tick.x}" y1="${paddingTop}" x2="${tick.x}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.35" />
            <text x="${tick.x}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${escapeHTML(tick.label)}</text>
        `;
    });
    const xAxisGroup = svgElement.querySelector('.x-axis');
    if (xAxisGroup) {
        xAxisGroup.innerHTML = xAxisHTML;
    }

    // Update Curves & Series Paths, Points, Skips
    let linesHTML = '';
    let skipsHTML = '';
    let pointsHTML = '';

    series.forEach(seriesItem => {
        if (!seriesItem.isVisible) return;
        const { color, dashArray, questionTitle, segments, points, skips, question, responseType } = seriesItem;
        const isBoolean = responseType === 'boolean' || question?.responseType === 'boolean';
        const dashAttribute = dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : '';
        const escapedQuestionTitle = escapeHTML(questionTitle);

        segments.forEach(segment => {
            if (segment.length >= 2) {
                let pathData = `M ${segment[0].x} ${segment[0].y}`;
                for (let segmentIndex = 1; segmentIndex < segment.length; segmentIndex++) {
                    if (isBoolean) {
                        const previousY = segment[segmentIndex - 1].y;
                        const currentX = segment[segmentIndex].x;
                        const currentY = segment[segmentIndex].y;
                        pathData += ` L ${currentX} ${previousY} L ${currentX} ${currentY}`;
                    } else {
                        pathData += ` L ${segment[segmentIndex].x} ${segment[segmentIndex].y}`;
                    }
                }
                linesHTML += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5"${dashAttribute} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />`;
            }
        });

        points.forEach(point => {
            const escapedDate = escapeHTML(point.formattedDate);
            const isPointBoolean = isBoolean || point.responseType === 'boolean';
            let valueLabel = `Score ${point.score}`;
            let titleValueLabel = `Score ${point.score}/5`;
            if (isPointBoolean) {
                const booleanText = point.score === BOOLEAN_YES_SCORE
                    ? 'Yes'
                    : (point.score === BOOLEAN_NO_SCORE ? 'No' : `Score ${point.score}`);
                valueLabel = booleanText;
                titleValueLabel = booleanText;
            }
            pointsHTML += `
                <circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" stroke="var(--box-bg)"
                    stroke-width="1.5" vector-effect="non-scaling-stroke" aria-label="${escapedQuestionTitle}: ${valueLabel} (${escapedDate})">
                    <title>${escapedQuestionTitle}: ${titleValueLabel} (${escapedDate})</title>
                </circle>
            `;
        });

        skips.forEach(skip => {
            const escapedDate = escapeHTML(skip.formattedDate);
            skipsHTML += `
                <g class="skip-marker" aria-label="${escapedQuestionTitle}: Skipped (${escapedDate})">
                    <title>${escapedQuestionTitle}: Skipped (${escapedDate})</title>
                    <circle cx="${skip.x}" cy="${skip.y}" r="4.5" fill="var(--box-bg)" stroke="${color}" stroke-width="1.5" stroke-dasharray="2,2" />
                    <line x1="${skip.x - 2.5}" y1="${skip.y - 2.5}" x2="${skip.x + 2.5}" y2="${skip.y + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                    <line x1="${skip.x + 2.5}" y1="${skip.y - 2.5}" x2="${skip.x - 2.5}" y2="${skip.y + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                </g>
            `;
        });
    });

    const linesGroup = svgElement.querySelector('.lines');
    if (linesGroup) {
        linesGroup.innerHTML = linesHTML;
    }
    const skipsGroup = svgElement.querySelector('.skips');
    if (skipsGroup) {
        skipsGroup.innerHTML = skipsHTML;
    }
    const pointsGroup = svgElement.querySelector('.points');
    if (pointsGroup) {
        pointsGroup.innerHTML = pointsHTML;
    }

    // Update Notes without discarding existing DOM elements so direct listeners remain intact
    const notesGroup = svgElement.querySelector('.notes');
    if (notesGroup) {
        const existingNoteMarkers = notesGroup.querySelectorAll('.note-marker');
        if (existingNoteMarkers.length === notes.length && notes.length > 0) {
            notes.forEach((noteItem, index) => {
                const markerElement = existingNoteMarkers[index];
                const escapedNote = escapeHTML(noteItem.note);
                const escapedDate = escapeHTML(noteItem.formattedDate);
                markerElement.setAttribute('data-entry-index', String(noteItem.entryIndex));
                markerElement.setAttribute('data-note', escapedNote);
                markerElement.setAttribute('data-date', escapedDate);
                markerElement.setAttribute('aria-label', `Note (${escapedDate}): ${escapedNote}`);
                const titleNode = markerElement.querySelector('title');
                if (titleNode) {
                    titleNode.textContent = `Note (${escapedDate}): ${escapedNote}`;
                }
                const hitboxNode = markerElement.querySelector('.note-marker-hitbox');
                if (hitboxNode) {
                    hitboxNode.setAttribute('x', String(noteItem.x - 14));
                    hitboxNode.setAttribute('y', String(noteItem.y - 14));
                }
                const boxNode = markerElement.querySelector('.note-marker-box');
                if (boxNode) {
                    boxNode.setAttribute('x', String(noteItem.x - 7));
                    boxNode.setAttribute('y', String(noteItem.y - 7));
                }
                const iconNode = markerElement.querySelector('.note-marker-icon');
                if (iconNode) {
                    iconNode.setAttribute(
                        'd',
                        `M ${noteItem.x - 3.5} ${noteItem.y - 3.5} h 7 M ${noteItem.x - 3.5} ${noteItem.y} h 7 M ${noteItem.x - 3.5} ${noteItem.y + 3.5} h 4.5`
                    );
                }
            });
        } else {
            let notesHTML = '';
            notes.forEach(noteItem => {
                const escapedNoteText = escapeHTML(noteItem.note);
                const escapedDate = escapeHTML(noteItem.formattedDate);
                notesHTML += `
                    <g class="note-marker" role="button" tabindex="0" data-entry-index="${noteItem.entryIndex}" data-note="${escapedNoteText}" data-date="${escapedDate}" aria-label="Note (${escapedDate}): ${escapedNoteText}">
                        <title>Note (${escapedDate}): ${escapedNoteText}</title>
                        <rect class="note-marker-hitbox" x="${noteItem.x - 14}" y="${noteItem.y - 14}" width="28" height="28" fill="transparent" />
                        <rect class="note-marker-box" x="${noteItem.x - 7}" y="${noteItem.y - 7}" width="14" height="14" rx="3" fill="var(--button-default)" stroke="var(--border-color)" stroke-width="1.2" />
                        <path class="note-marker-icon" d="M ${noteItem.x - 3.5} ${noteItem.y - 3.5} h 7 M ${noteItem.x - 3.5} ${noteItem.y} h 7 M ${noteItem.x - 3.5} ${noteItem.y + 3.5} h 4.5" stroke="var(--text-bright)" stroke-width="1.2" stroke-linecap="round" />
                    </g>
                `;
            });
            notesGroup.innerHTML = notesHTML;
        }
    }
}

/**
 * Commits a completed gesture zoom by recomputing graph layout at the settled scale,
 * updating the SVG element in place, resetting live CSS transforms and counter-scales,
 * adjusting horizontal scroll position, and updating zoom indicator UI without
 * rebuilding or rebinding the legend, toolbars, guide key, or note-marker listeners.
 *
 * @param {HTMLElement} container - The root history view container
 * @param {Object} [options={}]
 * @param {Object} [options.gestureEventData={}] - Gesture end payload
 * @param {number} [options.gestureStartScrollLeft=0] - Scroll position prior to gesture start
 * @param {number} [options.gestureStartZoomScale=1] - Zoom scale prior to gesture start
 * @param {Array<Object>} [options.layoutEntries=[]] - All graph entries
 * @param {Array<Object>} [options.questionList=[]] - Question list
 * @param {Set<string>} [options.currentVisibleSet=new Set()] - Set of visible question IDs
 * @param {string} [options.currentTimeRange='all'] - Timeframe range key
 * @returns {{ layout: Object, settledZoomScale: number, settledScrollLeft: number } | null} Commit result
 */
export function commitGraphGestureZoom(container, {
    gestureEventData = {},
    gestureStartScrollLeft = 0,
    gestureStartZoomScale = 1,
    layoutEntries = [],
    questionList = [],
    currentVisibleSet = new Set(),
    currentTimeRange = 'all'
} = {}) {
    if (!container) return null;

    const scrollContainerElement = container.querySelector('.graph-scroll-container');
    if (!scrollContainerElement) return null;

    const svgElement = scrollContainerElement.querySelector('.graph-svg');
    if (!svgElement) return null;

    // Reset live horizontal CSS transform and per-frame counter-scales to identity
    resetGraphGestureTransform(svgElement);

    const safeStartScale = Number.isFinite(Number(gestureStartZoomScale)) && Number(gestureStartZoomScale) > 0
        ? Number(gestureStartZoomScale)
        : 1;
    const finalCalculatedScale = gestureEventData?.finalZoomScale !== undefined
        ? Number(gestureEventData.finalZoomScale)
        : safeStartScale * (Number(gestureEventData?.scaleFactor) || 1);
    const settledZoomScale = Math.max(0.01, Math.round(finalCalculatedScale * 100) / 100);

    const newLayout = computeGraphLayout({
        entries: layoutEntries,
        allEntries: layoutEntries,
        questions: questionList,
        visibleQuestionIds: currentVisibleSet,
        timeRange: currentTimeRange,
        zoomScale: settledZoomScale
    });

    // Update the SVG in place (points, lines, gridlines, axis text, note marker coordinates)
    updateGraphSVGInPlace(svgElement, newLayout);

    // Compute settled horizontal scroll position keeping pivot visually fixed
    const viewportWidth = (scrollContainerElement.clientWidth > 0)
        ? scrollContainerElement.clientWidth
        : (container.clientWidth > 0 ? container.clientWidth : 600);
    const scrollWidth = (scrollContainerElement.scrollWidth > 0)
        ? scrollContainerElement.scrollWidth
        : (newLayout.dimensions ? newLayout.dimensions.width : 0);

    const settledScrollLeft = calculateSettledGestureScrollLeft({
        previousScrollLeft: gestureStartScrollLeft,
        initialTargetPivotX: gestureEventData?.pivotX || 0,
        scaleFactor: gestureEventData?.scaleFactor || 1,
        panDeltaX: gestureEventData?.panDeltaX || 0,
        paddingLeft: newLayout.dimensions?.paddingLeft || 0,
        scrollWidth,
        viewportWidth
    });

    scrollContainerElement.scrollLeft = settledScrollLeft;
    STATE.historyZoomScale = settledZoomScale;
    STATE.historyScrollLeft = settledScrollLeft;

    // Update zoom value and reset button without rebuilding or rebinding toolbars
    const zoomValueElement = container.querySelector('.graph-zoom-value');
    if (zoomValueElement) {
        zoomValueElement.textContent = `${formatZoomValue(settledZoomScale)}×`;
    }
    const resetButton = container.querySelector('#button-graph-zoom-reset');
    if (resetButton) {
        resetButton.disabled = Math.abs(settledZoomScale - 1) < 0.01;
    }

    return {
        layout: newLayout,
        settledZoomScale,
        settledScrollLeft
    };
}

/**
 * Configures live touch pinch and desktop Ctrl/Meta+wheel gesture zoom tracking on a scroll container.
 *
 * @param {HTMLElement} scrollContainerElement - The timeline scroll container element
 * @param {Object} [options={}] - Gesture configuration and callbacks
 * @param {Function} [options.getCurrentZoomScale] - Accessor for current base zoom scale
 * @param {Function} [options.onGestureStart] - Called when gesture zoom begins
 * @param {Function} [options.onGestureChange] - Called on each move/wheel tick during active gesture
 * @param {Function} [options.onGestureEnd] - Called when gesture zoom ends
 * @param {number} [options.wheelDebounceMs=160] - Idle duration before concluding wheel gesture
 * @returns {Object} Controller object with getState() and destroy() methods
 */
export function setupGraphGestureZoom(scrollContainerElement, options = {}) {
    if (!scrollContainerElement) {
        return {
            getState: () => ({ isActive: false, source: null, currentScaleFactor: 1 }),
            destroy: () => {}
        };
    }

    const {
        getCurrentZoomScale = () => 1,
        getTargetElement = null,
        targetElement: optionTargetElement = null,
        onGestureStart = null,
        onGestureChange = null,
        onGestureEnd = null,
        wheelDebounceMs = 160
    } = options;

    function resolveTargetElement() {
        if (typeof getTargetElement === 'function') {
            const resolved = getTargetElement();
            if (resolved) return resolved;
        }
        if (optionTargetElement) {
            return optionTargetElement;
        }
        return scrollContainerElement.querySelector('.graph-svg') || scrollContainerElement;
    }

    const activePointersMap = new Map();
    let trackingPointerIds = [];
    let isGestureActive = false;
    let activeGestureSource = null;
    let initialPinchDistance = 1;
    let gestureInitialZoomScale = 1;
    let currentScaleFactor = 1.0;
    let initialTargetPivotX = 0;
    let initialClientPivotX = 0;
    let lastPivotX = 0;
    let lastClientPivotX = 0;
    let wheelDebounceTimeoutId = null;
    let originalTouchAction = scrollContainerElement.style.touchAction || '';

    function computeTargetPivotX(clientX) {
        const targetElement = resolveTargetElement();
        if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
            try {
                const targetRect = targetElement.getBoundingClientRect();
                if (targetRect && Number.isFinite(targetRect.left)) {
                    return clientX - targetRect.left;
                }
            } catch {
                // Fallback below
            }
        }
        try {
            const containerRect = scrollContainerElement.getBoundingClientRect();
            if (containerRect && Number.isFinite(containerRect.left)) {
                return clientX - containerRect.left;
            }
        } catch {
            // Fallback to clientX
        }
        return clientX;
    }

    function handlePointerDown(pointerEvent) {
        activePointersMap.set(pointerEvent.pointerId, {
            clientX: pointerEvent.clientX,
            clientY: pointerEvent.clientY
        });

        if (typeof scrollContainerElement.setPointerCapture === 'function') {
            try {
                scrollContainerElement.setPointerCapture(pointerEvent.pointerId);
            } catch {
                // Ignore pointer capture errors in unattached or non-standard environments
            }
        }

        if (activePointersMap.size === 2 && !isGestureActive) {
            trackingPointerIds = Array.from(activePointersMap.keys()).slice(0, 2);
            const firstPointer = activePointersMap.get(trackingPointerIds[0]);
            const secondPointer = activePointersMap.get(trackingPointerIds[1]);
            const calculatedDistance = calculatePinchDistance(firstPointer, secondPointer);
            initialPinchDistance = Math.max(1, calculatedDistance);

            const midpoint = calculatePinchMidpoint(firstPointer, secondPointer);
            initialClientPivotX = midpoint.clientX;
            initialTargetPivotX = computeTargetPivotX(midpoint.clientX);
            lastClientPivotX = midpoint.clientX;
            lastPivotX = initialTargetPivotX;

            isGestureActive = true;
            activeGestureSource = 'touch';
            gestureInitialZoomScale = Number(getCurrentZoomScale()) || 1;
            currentScaleFactor = 1.0;

            originalTouchAction = scrollContainerElement.style.touchAction || '';
            scrollContainerElement.style.touchAction = 'none';

            if (typeof onGestureStart === 'function') {
                onGestureStart({
                    source: 'touch',
                    initialZoomScale: gestureInitialZoomScale,
                    scaleFactor: 1.0,
                    currentZoomScale: gestureInitialZoomScale,
                    pivotX: initialTargetPivotX,
                    panDeltaX: 0,
                    clientPivotX: initialClientPivotX,
                    initialClientPivotX: initialClientPivotX
                });
            }
        }
    }

    function handlePointerMove(pointerEvent) {
        if (!activePointersMap.has(pointerEvent.pointerId)) {
            return;
        }

        activePointersMap.set(pointerEvent.pointerId, {
            clientX: pointerEvent.clientX,
            clientY: pointerEvent.clientY
        });

        if (isGestureActive && activeGestureSource === 'touch' && trackingPointerIds.length === 2) {
            const firstPointer = activePointersMap.get(trackingPointerIds[0]);
            const secondPointer = activePointersMap.get(trackingPointerIds[1]);
            if (!firstPointer || !secondPointer) {
                return;
            }

            const currentDistance = calculatePinchDistance(firstPointer, secondPointer);
            const scaleFactor = Math.max(0.01, currentDistance / initialPinchDistance);
            currentScaleFactor = scaleFactor;

            const midpoint = calculatePinchMidpoint(firstPointer, secondPointer);
            lastClientPivotX = midpoint.clientX;
            const panDeltaX = midpoint.clientX - initialClientPivotX;
            lastPivotX = initialTargetPivotX;

            if (typeof onGestureChange === 'function') {
                onGestureChange({
                    source: 'touch',
                    scaleFactor: currentScaleFactor,
                    initialZoomScale: gestureInitialZoomScale,
                    currentZoomScale: gestureInitialZoomScale * currentScaleFactor,
                    pivotX: initialTargetPivotX,
                    panDeltaX: panDeltaX,
                    clientPivotX: lastClientPivotX,
                    initialClientPivotX: initialClientPivotX
                });
            }
        }
    }

    function handlePointerUpOrCancel(pointerEvent) {
        activePointersMap.delete(pointerEvent.pointerId);

        if (typeof scrollContainerElement.releasePointerCapture === 'function') {
            try {
                scrollContainerElement.releasePointerCapture(pointerEvent.pointerId);
            } catch {
                // Ignore pointer capture errors
            }
        }

        const wasTrackingPointer = trackingPointerIds.includes(pointerEvent.pointerId);
        if (isGestureActive && activeGestureSource === 'touch' && wasTrackingPointer) {
            isGestureActive = false;
            activeGestureSource = null;
            trackingPointerIds = [];
            scrollContainerElement.style.touchAction = originalTouchAction;

            if (typeof onGestureEnd === 'function') {
                onGestureEnd({
                    source: 'touch',
                    scaleFactor: currentScaleFactor,
                    initialZoomScale: gestureInitialZoomScale,
                    finalZoomScale: gestureInitialZoomScale * currentScaleFactor,
                    pivotX: initialTargetPivotX,
                    panDeltaX: lastClientPivotX - initialClientPivotX,
                    clientPivotX: lastClientPivotX,
                    initialClientPivotX: initialClientPivotX
                });
            }
        }
    }

    function handleWheel(wheelEvent) {
        const isZoomIntent = Boolean(wheelEvent.ctrlKey || wheelEvent.metaKey);

        if (isZoomIntent) {
            wheelEvent.preventDefault();

            const clientX = Number.isFinite(wheelEvent.clientX)
                ? wheelEvent.clientX
                : 0;

            if (!isGestureActive || activeGestureSource !== 'wheel') {
                if (isGestureActive && typeof onGestureEnd === 'function') {
                    onGestureEnd({
                        source: activeGestureSource,
                        scaleFactor: currentScaleFactor,
                        initialZoomScale: gestureInitialZoomScale,
                        finalZoomScale: gestureInitialZoomScale * currentScaleFactor,
                        pivotX: initialTargetPivotX,
                        panDeltaX: lastClientPivotX - initialClientPivotX,
                        clientPivotX: lastClientPivotX,
                        initialClientPivotX: initialClientPivotX
                    });
                }
                isGestureActive = true;
                activeGestureSource = 'wheel';
                gestureInitialZoomScale = Number(getCurrentZoomScale()) || 1;
                currentScaleFactor = 1.0;
                initialClientPivotX = clientX;
                initialTargetPivotX = computeTargetPivotX(clientX);
                lastClientPivotX = clientX;
                lastPivotX = initialTargetPivotX;

                if (typeof onGestureStart === 'function') {
                    onGestureStart({
                        source: 'wheel',
                        scaleFactor: 1.0,
                        initialZoomScale: gestureInitialZoomScale,
                        currentZoomScale: gestureInitialZoomScale,
                        pivotX: initialTargetPivotX,
                        panDeltaX: 0,
                        clientPivotX: initialClientPivotX,
                        initialClientPivotX: initialClientPivotX
                    });
                }
            }

            const multiplier = calculateWheelZoomDeltaMultiplier(
                wheelEvent.deltaY,
                wheelEvent.deltaMode
            );
            currentScaleFactor = Math.max(0.01, currentScaleFactor * multiplier);
            lastClientPivotX = clientX;
            const panDeltaX = clientX - initialClientPivotX;
            lastPivotX = initialTargetPivotX;

            if (typeof onGestureChange === 'function') {
                onGestureChange({
                    source: 'wheel',
                    scaleFactor: currentScaleFactor,
                    initialZoomScale: gestureInitialZoomScale,
                    currentZoomScale: gestureInitialZoomScale * currentScaleFactor,
                    pivotX: initialTargetPivotX,
                    panDeltaX: panDeltaX,
                    clientPivotX: lastClientPivotX,
                    initialClientPivotX: initialClientPivotX
                });
            }

            if (wheelDebounceTimeoutId !== null) {
                clearTimeout(wheelDebounceTimeoutId);
            }
            wheelDebounceTimeoutId = setTimeout(() => {
                wheelDebounceTimeoutId = null;
                if (isGestureActive && activeGestureSource === 'wheel') {
                    isGestureActive = false;
                    activeGestureSource = null;
                    if (typeof onGestureEnd === 'function') {
                        onGestureEnd({
                            source: 'wheel',
                            scaleFactor: currentScaleFactor,
                            initialZoomScale: gestureInitialZoomScale,
                            finalZoomScale: gestureInitialZoomScale * currentScaleFactor,
                            pivotX: initialTargetPivotX,
                            panDeltaX: lastClientPivotX - initialClientPivotX,
                            clientPivotX: lastClientPivotX,
                            initialClientPivotX: initialClientPivotX
                        });
                    }
                }
            }, wheelDebounceMs);

            return;
        }

        // Default mouse wheel behavior: map vertical wheel to horizontal scroll over timeline
        if (scrollContainerElement.scrollWidth <= scrollContainerElement.clientWidth) {
            return;
        }
        if (Math.abs(wheelEvent.deltaY) > Math.abs(wheelEvent.deltaX)) {
            wheelEvent.preventDefault();
            const maximumScroll = scrollContainerElement.scrollWidth - scrollContainerElement.clientWidth;
            scrollContainerElement.scrollLeft = Math.max(0, Math.min(
                scrollContainerElement.scrollLeft + wheelEvent.deltaY,
                maximumScroll
            ));
            STATE.historyScrollLeft = scrollContainerElement.scrollLeft;
        }
    }

    scrollContainerElement.addEventListener('pointerdown', handlePointerDown);
    scrollContainerElement.addEventListener('pointermove', handlePointerMove);
    scrollContainerElement.addEventListener('pointerup', handlePointerUpOrCancel);
    scrollContainerElement.addEventListener('pointercancel', handlePointerUpOrCancel);
    scrollContainerElement.addEventListener('wheel', handleWheel, { passive: false });

    return {
        getState() {
            return {
                isActive: isGestureActive,
                source: activeGestureSource,
                initialZoomScale: gestureInitialZoomScale,
                currentScaleFactor,
                currentZoomScale: gestureInitialZoomScale * currentScaleFactor,
                pivotX: initialTargetPivotX,
                panDeltaX: lastClientPivotX - initialClientPivotX,
                clientPivotX: lastClientPivotX,
                initialClientPivotX,
                activePointerCount: activePointersMap.size
            };
        },
        destroy() {
            if (wheelDebounceTimeoutId !== null) {
                clearTimeout(wheelDebounceTimeoutId);
                wheelDebounceTimeoutId = null;
            }
            activePointersMap.clear();
            trackingPointerIds = [];
            if (isGestureActive && activeGestureSource === 'touch') {
                scrollContainerElement.style.touchAction = originalTouchAction;
            }
            isGestureActive = false;
            activeGestureSource = null;
            initialTargetPivotX = 0;
            initialClientPivotX = 0;
            lastClientPivotX = 0;
            lastPivotX = 0;

            scrollContainerElement.removeEventListener('pointerdown', handlePointerDown);
            scrollContainerElement.removeEventListener('pointermove', handlePointerMove);
            scrollContainerElement.removeEventListener('pointerup', handlePointerUpOrCancel);
            scrollContainerElement.removeEventListener('pointercancel', handlePointerUpOrCancel);
            scrollContainerElement.removeEventListener('wheel', handleWheel);
        }
    };
}

export async function loadHistoryView() {
    const container = document.getElementById('history-graph-container') || document.getElementById('panel-history');
    if (!container) return;

    try {
        const [entries, questions, activeSet] = await Promise.all([
            getAll('entries'),
            getAll('questions'),
            getConfig('activeQuestionSet')
        ]);

        const questionsById = new Map(questions.map(question => [question.id, question]));
        const activeIds = Array.isArray(activeSet) ? activeSet : DEFAULT_ACTIVE_SET;

        const sortedEntries = (entries || [])
            .filter(entry => entry?.timestamp && !Number.isNaN(new Date(entry.timestamp).getTime()))
            .slice()
            .sort((firstEntry, secondEntry) => new Date(firstEntry.timestamp).getTime() - new Date(secondEntry.timestamp).getTime());

        // Collect all question IDs that are either active or present in the logged entries
        const relevantQuestionIds = new Set(activeIds);
        sortedEntries.forEach(entry => {
            if (Array.isArray(entry.answers)) {
                entry.answers.forEach(answerItem => {
                    if (answerItem?.questionId) {
                        relevantQuestionIds.add(answerItem.questionId);
                    }
                });
            } else if (entry?.answers && typeof entry.answers === 'object') {
                Object.keys(entry.answers).forEach(questionId => {
                    if (entry.answers[questionId] !== undefined && entry.answers[questionId] !== null) {
                        relevantQuestionIds.add(questionId);
                    }
                });
            }
        });

        const historyQuestions = [];
        relevantQuestionIds.forEach(questionId => {
            const foundQuestion = questionsById.get(questionId);
            if (foundQuestion) {
                historyQuestions.push(foundQuestion);
            }
        });

        STATE.historyData = {
            entries: sortedEntries,
            allEntries: sortedEntries,
            questions: historyQuestions,
            allQuestionsMap: questionsById
        };

        renderLineGraph(container, STATE.historyData);
    } catch (error) {
        console.error('Failed to load history data:', error);
    }
}

export function formatEntryDateTime(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return isoString;
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHour = hours % 12 || 12;
        const formattedMinute = minutes < 10 ? `0${minutes}` : minutes;
        return `${month}/${day}/${year}, ${formattedHour}:${formattedMinute} ${ampm}`;
    } catch (error) {
        console.warn('Failed to format entry date time:', error);
        return isoString;
    }
}

export function formatTickDate(timeMilliseconds, isShortRange) {
    try {
        const date = new Date(timeMilliseconds);
        if (Number.isNaN(date.getTime())) return '';
        const month = date.getMonth() + 1;
        const day = date.getDate();
        if (isShortRange) {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const ampm = hours >= 12 ? 'p' : 'a';
            const formattedHour = hours % 12 || 12;
            const formattedMinute = minutes === 0 ? '' : `:${minutes < 10 ? '0' + minutes : minutes}`;
            return `${month}/${day} ${formattedHour}${formattedMinute}${ampm}`;
        }
        return `${month}/${day}`;
    } catch (error) {
        console.warn('Failed to format tick date:', error);
        return '';
    }
}

export function getTimeframeLabel(rangeKey) {
    switch (rangeKey) {
        case '7d': return '7 Days';
        case '14d': return '14 Days';
        case '30d': return '30 Days';
        case '90d': return '90 Days';
        default: return 'All Time';
    }
}

/**
 * Computes pure mathematical layout, timeframe windowing, coordinates, and scale mapping for the mood timeline graph.
 * This is a pure function with no DOM dependencies or side effects, allowing direct headless unit testing.
 *
 * @param {Object} [options={}]
 * @param {Array<Object>} [options.entries]
 * @param {Array<Object>} [options.allEntries]
 * @param {Array<Object>} [options.questions]
 * @param {Set<string>|Array<string>} [options.visibleQuestionIds]
 * @param {string} [options.timeRange='all']
 * @param {number} [options.minimumSpacingPerPoint=48]
 * @param {number} [options.zoomScale=1]
 * @returns {Object} Layout object containing computed dimensions, scales, points, paths, and series data.
 */
export function computeGraphLayout({
                                       entries: entriesInput,
                                       allEntries,
                                       questions = [],
                                       visibleQuestionIds,
                                       timeRange = 'all',
                                       minimumSpacingPerPoint = 48,
                                       zoomScale = 1
                                   } = {}) {
    const entries = Array.isArray(allEntries)
        ? allEntries
        : (Array.isArray(entriesInput) ? entriesInput : []);

    const questionList = Array.isArray(questions) ? questions : [];
    const currentTimeRange = timeRange || 'all';
    const resolvedMinimumSpacing = Number.isFinite(Number(minimumSpacingPerPoint))
        ? Number(minimumSpacingPerPoint)
        : 48;
    const resolvedZoomScale = Number.isFinite(Number(zoomScale)) ? Number(zoomScale) : 1;

    let currentVisibleSet;
    if (visibleQuestionIds instanceof Set) {
        currentVisibleSet = new Set(visibleQuestionIds);
    } else if (Array.isArray(visibleQuestionIds)) {
        currentVisibleSet = new Set(visibleQuestionIds);
    } else {
        currentVisibleSet = new Set(questionList.map(question => question.id));
    }

    if (!entries || entries.length === 0) {
        return {
            isEmpty: true,
            reason: 'no-entries',
            entries: [],
            filteredEntries: [],
            rawAllEntries: [],
            questions: questionList,
            visibleQuestionIds: currentVisibleSet,
            timeRange: currentTimeRange
        };
    }

    if (!questionList || questionList.length === 0) {
        return {
            isEmpty: true,
            reason: 'no-questions',
            entries,
            filteredEntries: entries,
            rawAllEntries: entries,
            questions: [],
            visibleQuestionIds: currentVisibleSet,
            timeRange: currentTimeRange
        };
    }

    // Always include the full entry history in the rendered domain;
    // timeframe-based entry filtering is retired in favor of always-render-everything.
    const entryCount = entries.length;
    const entryTimes = entries.map(entry => {
        const time = new Date(entry.timestamp).getTime();
        return Number.isNaN(time) ? 0 : time;
    });

    let minTime = Infinity;
    let maxTime = -Infinity;
    for (let index = 0; index < entryTimes.length; index++) {
        const time = entryTimes[index];
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
    }
    if (minTime === Infinity) minTime = 0;
    if (maxTime === -Infinity) maxTime = 0;
    const timeDuration = maxTime - minTime;

    const originTime = minTime;
    const timeScale = (BASE_PIXELS_PER_HOUR * resolvedZoomScale) / MILLISECONDS_PER_HOUR;
    const pointSpacing = 24 * BASE_PIXELS_PER_HOUR * resolvedZoomScale;
    const paddingTop = 24;
    const paddingBottom = 60;
    const paddingLeft = 0;
    const paddingRight = 0;

    const chartWidth = timeDuration > 0
        ? timeDuration * timeScale
        : (24 * MILLISECONDS_PER_HOUR) * timeScale;
    const calculatedWidth = paddingLeft + paddingRight + chartWidth;
    const width = calculatedWidth;
    const height = 320;

    const chartHeight = height - paddingTop - paddingBottom;

    function getY(score) {
        if (score === null || score === undefined) return null;
        const ratio = (score - 1) / 4;
        return paddingTop + chartHeight * (1 - ratio);
    }

    const skipBaselineY = height - paddingBottom + 16;
    const noteBaselineY = height - paddingBottom + 32;

    function getX(entryTimeOrIndex) {
        let entryTime;
        if (typeof entryTimeOrIndex === 'number' && entryTimeOrIndex >= 0 && entryTimeOrIndex < entryTimes.length && entryTimeOrIndex < 1000000) {
            entryTime = entryTimes[entryTimeOrIndex];
        } else if (typeof entryTimeOrIndex === 'number') {
            entryTime = entryTimeOrIndex;
        } else if (entryTimeOrIndex) {
            entryTime = new Date(entryTimeOrIndex).getTime();
        } else {
            entryTime = originTime;
        }
        if (Number.isNaN(entryTime) || entryTime === undefined) {
            entryTime = originTime;
        }
        return paddingLeft + (entryTime - originTime) * timeScale;
    }

    // Grid lines for scores 1-5
    const gridLines = [];
    for (let score = 1; score <= 5; score++) {
        gridLines.push({
            score,
            y: getY(score),
            label: String(score)
        });
    }

    // Time-Scaled X-Axis Gridlines & Tick Labels
    const xTicks = [];
    if (entryCount === 1 || timeDuration <= 0) {
        const xPosition = getX(minTime);
        const dateString = formatTickDate(minTime, true);
        xTicks.push({ x: xPosition, time: minTime, label: dateString });
    } else {
        const isShortRange = timeDuration <= 36 * 3600 * 1000;
        const tickDensity = Math.max(3, Math.min(entryCount, Math.round(chartWidth / 90)));
        for (let tickIndex = 0; tickIndex < tickDensity; tickIndex++) {
            const tickTime = minTime + (tickIndex / (tickDensity - 1)) * timeDuration;
            const xPosition = getX(tickTime);
            const dateString = formatTickDate(tickTime, isShortRange);
            xTicks.push({ x: xPosition, time: tickTime, label: dateString });
        }
    }

    const series = [];
    const allSkips = [];
    const allPoints = [];

    questionList.forEach((question, questionIndex) => {
        const color = getCurveColor(question.curve, questionIndex);
        const dashArray = getQuestionDashArray(questionIndex);
        const questionTitle = question.shortLabel || question.text;
        const isVisible = currentVisibleSet.has(question.id);
        const isIsolated = currentVisibleSet.size === 1 && currentVisibleSet.has(question.id);

        if (!isVisible) {
            series.push({
                question,
                responseType: question.responseType || 'scale',
                questionIndex,
                color,
                dashArray,
                questionTitle,
                isVisible: false,
                isIsolated,
                segments: [],
                points: [],
                skips: []
            });
            return;
        }

        const segments = [];
        let currentSegment = [];
        const questionSkips = [];
        const questionPoints = [];

        entries.forEach((entry, entryIndex) => {
            let answer = null;
            if (Array.isArray(entry.answers)) {
                answer = entry.answers.find(answerItem => answerItem.questionId === question.id);
            } else if (entry.answers && typeof entry.answers === 'object') {
                const rawValue = entry.answers[question.id];
                if (typeof rawValue === 'number') {
                    answer = { questionId: question.id, score: rawValue, status: 'answered' };
                } else if (rawValue && typeof rawValue === 'object') {
                    answer = { questionId: question.id, ...rawValue };
                }
            }
            const isAnswered = answer && answer.status === 'answered' && answer.score !== null &&
                answer.score >= 1 && answer.score <= 5;
            const isSkipped = answer && (answer.status === 'skipped' || answer.score === null);

            if (isAnswered && answer) {
                const x = getX(entryTimes[entryIndex]);
                const y = getY(answer.score);
                const pointItem = {
                    x,
                    y,
                    score: answer.score,
                    entryIndex,
                    timestamp: entry.timestamp,
                    formattedDate: formatEntryDateTime(entry.timestamp),
                    questionTitle,
                    color,
                    responseType: question.responseType || 'scale'
                };
                currentSegment.push(pointItem);
                questionPoints.push(pointItem);
                allPoints.push(pointItem);
            } else {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }

                if (isSkipped) {
                    const rawXPosition = getX(entryTimes[entryIndex]);
                    const fannedXPosition = (entryCount === 1 || questionList.length === 1)
                        ? rawXPosition
                        : rawXPosition + (questionIndex - (questionList.length - 1) / 2) * 6;
                    const dateString = formatEntryDateTime(entry.timestamp);
                    const skipItem = {
                        questionId: question.id,
                        questionTitle,
                        x: fannedXPosition,
                        y: skipBaselineY,
                        entryIndex,
                        timestamp: entry.timestamp,
                        formattedDate: dateString,
                        color
                    };
                    questionSkips.push(skipItem);
                    allSkips.push(skipItem);
                }
            }
        });

        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        series.push({
            question,
            responseType: question.responseType || 'scale',
            questionIndex,
            color,
            dashArray,
            questionTitle,
            isVisible: true,
            isIsolated,
            segments,
            points: questionPoints,
            skips: questionSkips
        });
    });

    const notes = [];
    entries.forEach((entry, entryIndex) => {
        const hasNote = Boolean(entry.note && typeof entry.note === 'string' && entry.note.trim().length > 0);
        if (!hasNote) return;

        const noteXPosition = getX(entryTimes[entryIndex]);
        const formattedDateString = formatEntryDateTime(entry.timestamp);
        const rawNoteText = entry.note.trim();

        notes.push({
            entryIndex,
            x: noteXPosition,
            y: noteBaselineY,
            note: rawNoteText,
            formattedDate: formattedDateString,
            timestamp: entry.timestamp
        });
    });

    return {
        isEmpty: false,
        isTimeframeEmpty: false,
        entries,
        filteredEntries: entries,
        rawAllEntries: entries,
        questions: questionList,
        visibleQuestionIds: currentVisibleSet,
        timeRange: currentTimeRange,
        zoomScale: resolvedZoomScale,
        minimumSpacingPerPoint: resolvedMinimumSpacing,
        dimensions: {
            width,
            height,
            chartWidth,
            chartHeight,
            paddingTop,
            paddingBottom,
            paddingLeft,
            paddingRight,
            calculatedWidth,
            skipBaselineY,
            noteBaselineY
        },
        timeBounds: {
            minTime,
            maxTime,
            timeDuration
        },
        scales: {
            getY,
            pointSpacing,
            timeScale,
            originTime,
            basePixelsPerHour: BASE_PIXELS_PER_HOUR
        },
        gridLines,
        xTicks,
        series,
        notes,
        allSkips,
        allPoints
    };
}

/**
 * Renders the pure SVG string markup for the mood timeline from a computed layout object.
 *
 * @param {Object} layout The computed layout returned by computeGraphLayout()
 * @returns {string} SVG markup string
 */
export function renderGraphSVG(layout) {
    if (!layout || layout.isEmpty || layout.isTimeframeEmpty) {
        return '';
    }

    const { dimensions, gridLines, xTicks, series, notes } = layout;
    const {
        width,
        height,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        skipBaselineY,
        noteBaselineY
    } = dimensions;

    // Grid lines for scores 1-5
    let gridLinesHTML = '';
    gridLines.forEach(gridLine => {
        gridLinesHTML += `
            <line x1="${paddingLeft}" y1="${gridLine.y}" x2="${width - paddingRight}" y2="${gridLine.y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" />
            <text x="${paddingLeft - 8}" y="${gridLine.y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end" font-weight="600">${gridLine.score}</text>
        `;
    });

    // Dedicated Skip Baseline Row on Y-Axis
    gridLinesHTML += `
        <line x1="${paddingLeft}" y1="${skipBaselineY}" x2="${width - paddingRight}" y2="${skipBaselineY}" stroke="var(--border-color)" stroke-width="0.8" stroke-dasharray="1,3" opacity="0.6" />
        <text x="${paddingLeft - 8}" y="${skipBaselineY + 3.5}" fill="var(--text-muted)" font-size="9.5" text-anchor="end" font-style="italic">Skip</text>
    `;

    // Dedicated Note Baseline Row on Y-Axis
    gridLinesHTML += `
        <line x1="${paddingLeft}" y1="${noteBaselineY}" x2="${width - paddingRight}" y2="${noteBaselineY}" stroke="var(--border-color)" stroke-width="0.8" stroke-dasharray="1,3" opacity="0.6" />
        <text x="${paddingLeft - 8}" y="${noteBaselineY + 3.5}" fill="var(--text-muted)" font-size="9.5" text-anchor="end" font-style="italic">Note</text>
    `;

    // Time-Scaled X-Axis Gridlines & Tick Labels
    let xAxisHTML = '';
    xTicks.forEach(tick => {
        xAxisHTML += `
            <line x1="${tick.x}" y1="${paddingTop}" x2="${tick.x}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.35" />
            <text x="${tick.x}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${escapeHTML(tick.label)}</text>
        `;
    });

    let linesHTML = '';
    let skipsHTML = '';
    let notesHTML = '';
    let pointsHTML = '';

    series.forEach(seriesItem => {
        if (!seriesItem.isVisible) return;

        const { color, dashArray, questionTitle, segments, points, skips, question, responseType } = seriesItem;
        const isBoolean = responseType === 'boolean' || question?.responseType === 'boolean';
        const dashAttribute = dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : '';
        const escapedQuestionTitle = escapeHTML(questionTitle);

        // Draw line paths for each contiguous segment
        segments.forEach(segment => {
            if (segment.length >= 2) {
                let pathData = `M ${segment[0].x} ${segment[0].y}`;
                for (let segmentIndex = 1; segmentIndex < segment.length; segmentIndex++) {
                    if (isBoolean) {
                        const previousY = segment[segmentIndex - 1].y;
                        const currentX = segment[segmentIndex].x;
                        const currentY = segment[segmentIndex].y;
                        pathData += ` L ${currentX} ${previousY} L ${currentX} ${currentY}`;
                    } else {
                        pathData += ` L ${segment[segmentIndex].x} ${segment[segmentIndex].y}`;
                    }
                }
                linesHTML += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5"${dashAttribute} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />`;
            }
        });

        // Draw data point circles with accessible tooltips
        points.forEach(point => {
            const escapedDate = escapeHTML(point.formattedDate);
            const isPointBoolean = isBoolean || point.responseType === 'boolean';
            let valueLabel = `Score ${point.score}`;
            let titleValueLabel = `Score ${point.score}/5`;
            if (isPointBoolean) {
                const booleanText = point.score === BOOLEAN_YES_SCORE
                    ? 'Yes'
                    : (point.score === BOOLEAN_NO_SCORE ? 'No' : `Score ${point.score}`);
                valueLabel = booleanText;
                titleValueLabel = booleanText;
            }
            pointsHTML += `
                <circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" stroke="var(--box-bg)"
                    stroke-width="1.5" vector-effect="non-scaling-stroke" aria-label="${escapedQuestionTitle}: ${valueLabel} (${escapedDate})">
                    <title>${escapedQuestionTitle}: ${titleValueLabel} (${escapedDate})</title>
                </circle>
            `;
        });

        // Draw skip markers
        skips.forEach(skip => {
            const escapedDate = escapeHTML(skip.formattedDate);
            skipsHTML += `
                <g class="skip-marker" aria-label="${escapedQuestionTitle}: Skipped (${escapedDate})">
                    <title>${escapedQuestionTitle}: Skipped (${escapedDate})</title>
                    <circle cx="${skip.x}" cy="${skip.y}" r="4.5" fill="var(--box-bg)" stroke="${color}" stroke-width="1.5" stroke-dasharray="2,2" />
                    <line x1="${skip.x - 2.5}" y1="${skip.y - 2.5}" x2="${skip.x + 2.5}" y2="${skip.y + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                    <line x1="${skip.x + 2.5}" y1="${skip.y - 2.5}" x2="${skip.x - 2.5}" y2="${skip.y + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                </g>
            `;
        });
    });

    // Generate Notes indicator markers on the timeline (Task 3.9)
    notes.forEach(noteItem => {
        const escapedNoteText = escapeHTML(noteItem.note);
        const escapedDate = escapeHTML(noteItem.formattedDate);
        notesHTML += `
            <g class="note-marker" role="button" tabindex="0" data-entry-index="${noteItem.entryIndex}" data-note="${escapedNoteText}" data-date="${escapedDate}" aria-label="Note (${escapedDate}): ${escapedNoteText}">
                <title>Note (${escapedDate}): ${escapedNoteText}</title>
                <rect class="note-marker-hitbox" x="${noteItem.x - 14}" y="${noteItem.y - 14}" width="28" height="28" fill="transparent" />
                <rect class="note-marker-box" x="${noteItem.x - 7}" y="${noteItem.y - 7}" width="14" height="14" rx="3" fill="var(--button-default)" stroke="var(--border-color)" stroke-width="1.2" />
                <path class="note-marker-icon" d="M ${noteItem.x - 3.5} ${noteItem.y - 3.5} h 7 M ${noteItem.x - 3.5} ${noteItem.y} h 7 M ${noteItem.x - 3.5} ${noteItem.y + 3.5} h 4.5" stroke="var(--text-bright)" stroke-width="1.2" stroke-linecap="round" />
            </g>
        `;
    });

    return `
        <svg class="graph-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <g class="grid">${gridLinesHTML}</g>
            <g class="x-axis">${xAxisHTML}</g>
            <g class="lines">${linesHTML}</g>
            <g class="skips">${skipsHTML}</g>
            <g class="notes">${notesHTML}</g>
            <g class="points">${pointsHTML}</g>
        </svg>
    `;
}

export function renderLineGraph(container, {
    entries,
    allEntries,
    questions,
    visibleQuestionIds,
    timeRange,
    zoomScale,
    gestureOptions = {}
} = {}) {
    if (!container) return;

    const previousScrollContainer = container.querySelector('.graph-scroll-container');
    if (previousScrollContainer && previousScrollContainer._gestureController) {
        previousScrollContainer._gestureController.destroy();
    }
    const hadPreviousTimeline = Boolean(previousScrollContainer);

    const currentTimeRange = timeRange || STATE.historyTimeRange || 'all';
    STATE.historyTimeRange = currentTimeRange;
    const currentZoomScale = Number.isFinite(Number(zoomScale)) ? Number(zoomScale) :
        (Number.isFinite(Number(STATE.historyZoomScale)) ? Number(STATE.historyZoomScale) : 1);
    STATE.historyZoomScale = currentZoomScale;

    const resolvedVisibleQuestionIds = visibleQuestionIds !== undefined
        ? visibleQuestionIds
        : STATE.historyVisibleQuestionIds;

    const layout = computeGraphLayout({
        entries,
        allEntries,
        questions,
        visibleQuestionIds: resolvedVisibleQuestionIds,
        timeRange: currentTimeRange,
        zoomScale: currentZoomScale
    });

    let currentVisibleSet = layout.visibleQuestionIds;
    STATE.historyVisibleQuestionIds = currentVisibleSet;

    const layoutEntries = layout.entries;
    const questionList = layout.questions;

    if (layout.isEmpty) {
        const emptyMessage = layout.reason === 'no-questions'
            ? 'No active questions found for timeline rendering.'
            : 'No recorded mood history yet.<br>Complete an entry in the Mood Tracker to view your history timeline.';
        container.innerHTML = `
            <h3>Mood Timeline</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 12px; line-height: 1.5; text-align: center;">
                ${emptyMessage}
            </p>
        `;
        return;
    }

    const timeframeRanges = [
        { key: '7d', label: '~7D', ariaLabel: 'Zoom to ~7 days' },
        { key: '14d', label: '~14D', ariaLabel: 'Zoom to ~14 days' },
        { key: '30d', label: '~30D', ariaLabel: 'Zoom to ~30 days' },
        { key: '90d', label: '~90D', ariaLabel: 'Zoom to ~90 days' },
        { key: 'all', label: 'All', ariaLabel: 'Zoom to all entries' }
    ];

    const timeframeButtonsHTML = timeframeRanges.map(rangeItem => {
        const isActive = rangeItem.key === currentTimeRange;
        return `
            <button type="button" class="graph-timeframe-button ${isActive ? 'is-active' : ''}" data-range="${rangeItem.key}" role="radio" aria-checked="${isActive ? 'true' : 'false'}" aria-label="${rangeItem.ariaLabel}">${rangeItem.label}</button>
        `;
    }).join('');

    const timeframeToolbarHTML = `
        <div class="graph-timeframe-toolbar" role="toolbar" aria-label="Timeline zoom scale presets">
            <span class="graph-timeframe-title">Scale</span>
            <div class="graph-timeframe-buttons" role="radiogroup" aria-label="Select zoom preset">
                ${timeframeButtonsHTML}
            </div>
        </div>
    `;

    const isZoomResetDisabled = Math.abs(currentZoomScale - 1) < 0.01;
    const zoomToolbarHTML = `
        <div class="graph-zoom-toolbar" role="toolbar" aria-label="Timeline zoom controls">
            <button type="button" id="button-graph-zoom-out" class="graph-zoom-button"
                    data-zoom-action="zoom-out" aria-label="Zoom out timeline">−</button>
            <button type="button" id="button-graph-zoom-reset" class="graph-zoom-button graph-zoom-button-reset"
                    data-zoom-action="reset" aria-label="Reset timeline zoom"${isZoomResetDisabled ? ' disabled' : ''}>Reset</button>
            <button type="button" id="button-graph-zoom-in" class="graph-zoom-button"
                    data-zoom-action="zoom-in" aria-label="Zoom in timeline">+</button>
            <span class="graph-zoom-value" aria-live="polite">${formatZoomValue(currentZoomScale)}×</span>
        </div>
    `;

    const nowButtonHTML = `
        <button type="button" id="button-graph-now" class="graph-now-button"
                aria-label="Pan timeline to latest entries" title="Pan timeline to latest entries">NOW</button>
    `;

    const quickActionsHTML = `
        <div class="legend-quick-actions" role="toolbar" aria-label="Timeline question quick filters">
            <span class="legend-quick-title">Filter Questions</span>
            <div class="legend-quick-buttons">
                <button type="button" class="legend-quick-button" id="button-legend-show-all" aria-label="Show all questions on timeline">Show all</button>
                <button type="button" class="legend-quick-button" id="button-legend-clear-all" aria-label="Clear all questions on timeline">Clear all</button>
            </div>
        </div>
    `;

    let legendItemsHTML = '';
    questionList.forEach((question, questionIndex) => {
        const color = getCurveColor(question.curve, questionIndex);
        const dashArray = getQuestionDashArray(questionIndex);
        const questionTitle = escapeHTML(question.shortLabel || question.text);
        const swatchLineDash = dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : '';
        const isVisible = currentVisibleSet.has(question.id);
        const isIsolated = currentVisibleSet.size === 1 && currentVisibleSet.has(question.id);

        legendItemsHTML += `
            <div class="legend-checklist-row">
                <button type="button" class="legend-checklist-item" role="checkbox" aria-checked="${isVisible ? 'true' : 'false'}" data-question-id="${escapeHTML(question.id)}" aria-label="Toggle ${questionTitle}">
                    <span class="legend-checkbox-box" aria-hidden="true">${isVisible ? '✓' : ''}</span>
                    <svg class="legend-swatch" width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
                        <line x1="0" y1="5" x2="22" y2="5" stroke="${color}" stroke-width="2.5"${swatchLineDash} stroke-linecap="round" />
                        <circle cx="11" cy="5" r="3" fill="${color}" stroke="var(--box-bg)" stroke-width="1" />
                    </svg>
                    <span class="legend-label">${questionTitle}</span>
                </button>
                <button type="button" class="legend-isolate-button ${isIsolated ? 'is-isolated' : ''}" data-question-id="${escapeHTML(question.id)}" aria-label="${isIsolated ? `Restore all questions (currently isolating ${questionTitle})` : `Isolate ${questionTitle}`}" title="${isIsolated ? 'Restore all questions' : `Isolate ${questionTitle}`}">
                    <svg class="isolate-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="8" cy="8" r="6" />
                        <circle cx="8" cy="8" r="2" fill="currentColor" />
                    </svg>
                </button>
            </div>
        `;
    });

    const legendHTML = `
        <div class="graph-legend graph-legend-checklist" role="group" aria-label="Timeline Questions Filter">
            ${legendItemsHTML}
        </div>
    `;

    // Reading Key for clear visual differentiation between Answered, Skipped, and Not Asked
    const guideKeyHTML = `
        <div class="graph-guide-key" style="display: flex; gap: 14px; justify-content: center; margin-top: 10px; font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap;">
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: currentColor;"></span>
                <span>Answered (1–5)</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 10px; height: 10px; border-radius: 50%; border: 1px dashed currentColor; font-size: 7px; font-weight: bold; line-height: 1;">✕</span>
                <span>Skipped (Chose not to answer)</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <span style="display: inline-block; width: 12px; height: 0; border-top: 1px dashed currentColor;"></span>
                <span>(Gap) Not Asked</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 5px;">
                <svg width="12" height="12" viewBox="0 0 14 14" style="flex-shrink: 0;" aria-hidden="true">
                    <rect x="0" y="0" width="14" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.5" />
                    <path d="M 3.5 3.5 h 7 M 3.5 7 h 7 M 3.5 10.5 h 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                </svg>
                <span>Note Attached (Tap to view)</span>
            </span>
        </div>
    `;

    function wireTimeframeAndLegendListeners() {
        const timeframeButtonElements = container.querySelectorAll('.graph-timeframe-button');
        timeframeButtonElements.forEach(timeframeButtonElement => {
            timeframeButtonElement.addEventListener('click', () => {
                const selectedRange = timeframeButtonElement.getAttribute('data-range');
                if (!selectedRange) return;

                const scrollContainer = container.querySelector('.graph-scroll-container');
                const previousScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
                const viewportWidth = (scrollContainer && scrollContainer.clientWidth > 0)
                    ? scrollContainer.clientWidth
                    : (container.clientWidth > 0 ? container.clientWidth : 600);

                const nextZoomScale = calculateTimeframePresetZoomScale(selectedRange, {
                    entries: layoutEntries,
                    viewportWidth
                });

                const targetScrollLeft = calculateZoomPivotScrollLeft({
                    previousScrollLeft,
                    viewportWidth,
                    previousZoomScale: currentZoomScale,
                    nextZoomScale,
                    paddingLeft: layout.dimensions.paddingLeft
                });

                STATE.historyTimeRange = selectedRange;
                STATE.historyZoomScale = nextZoomScale;
                STATE.historyScrollLeft = targetScrollLeft;

                renderLineGraph(container, {
                    entries: layoutEntries,
                    allEntries: layoutEntries,
                    questions: questionList,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: selectedRange,
                    zoomScale: nextZoomScale
                });
            });
        });

        container.querySelectorAll('.graph-zoom-button').forEach(zoomButton => {
            zoomButton.addEventListener('click', () => {
                const scrollContainer = container.querySelector('.graph-scroll-container');
                const previousScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
                const viewportWidth = (scrollContainer && scrollContainer.clientWidth > 0)
                    ? scrollContainer.clientWidth
                    : (container.clientWidth > 0 ? container.clientWidth : 600);
                const zoomAction = zoomButton.dataset.zoomAction;
                let nextZoomScale = currentZoomScale;
                if (zoomAction === 'zoom-in') nextZoomScale = currentZoomScale + 0.25;
                if (zoomAction === 'zoom-out') {
                    nextZoomScale = currentZoomScale > 0.25
                        ? currentZoomScale - 0.25
                        : Math.max(0.01, Math.round(currentZoomScale * 0.5 * 100) / 100);
                }
                if (zoomAction === 'reset') nextZoomScale = 1;
                nextZoomScale = Math.round(nextZoomScale * 100) / 100;
                if (nextZoomScale === currentZoomScale) return;

                STATE.historyScrollLeft = calculateZoomPivotScrollLeft({
                    previousScrollLeft,
                    viewportWidth,
                    previousZoomScale: currentZoomScale,
                    nextZoomScale,
                    paddingLeft: layout.dimensions.paddingLeft
                });
                STATE.historyZoomScale = nextZoomScale;

                const currentZoomValueElement = container.querySelector('.graph-zoom-value');
                if (currentZoomValueElement) {
                    currentZoomValueElement.textContent = `${formatZoomValue(nextZoomScale)}×`;
                }
                const currentResetButton = container.querySelector('#button-graph-zoom-reset');
                if (currentResetButton) {
                    currentResetButton.disabled = Math.abs(nextZoomScale - 1) < 0.01;
                }

                renderLineGraph(container, {
                    entries: layoutEntries,
                    allEntries: layoutEntries,
                    questions: questionList,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: currentTimeRange,
                    zoomScale: nextZoomScale
                });
            });
        });

        const nowButtonElement = container.querySelector('#button-graph-now');
        if (nowButtonElement) {
            nowButtonElement.addEventListener('click', () => {
                const scrollContainer = container.querySelector('.graph-scroll-container');
                if (!scrollContainer) return;
                const viewportWidth = (scrollContainer.clientWidth > 0)
                    ? scrollContainer.clientWidth
                    : (container.clientWidth > 0 ? container.clientWidth : 600);
                const scrollWidth = (scrollContainer.scrollWidth > 0)
                    ? scrollContainer.scrollWidth
                    : (layout.dimensions ? layout.dimensions.width : 0);
                const targetScrollLeft = calculateNowScrollLeft({
                    scrollWidth,
                    viewportWidth,
                    svgWidth: layout.dimensions ? layout.dimensions.width : 0
                });
                if (typeof scrollContainer.scrollTo === 'function') {
                    scrollContainer.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
                }
                scrollContainer.scrollLeft = targetScrollLeft;
                STATE.historyScrollLeft = targetScrollLeft;
            });
        }

        const showAllButton = container.querySelector('#button-legend-show-all');
        if (showAllButton) {
            showAllButton.addEventListener('click', () => {
                const allQuestionIds = questionList.map(question => question.id);
                currentVisibleSet = new Set(allQuestionIds);
                STATE.historyVisibleQuestionIds = currentVisibleSet;
                renderLineGraph(container, {
                    entries: layoutEntries,
                    allEntries: layoutEntries,
                    questions: questionList,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: currentTimeRange,
                    zoomScale: currentZoomScale
                });
            });
        }

        const clearAllButton = container.querySelector('#button-legend-clear-all');
        if (clearAllButton) {
            clearAllButton.addEventListener('click', () => {
                currentVisibleSet = new Set();
                STATE.historyVisibleQuestionIds = currentVisibleSet;
                renderLineGraph(container, {
                    entries: layoutEntries,
                    allEntries: layoutEntries,
                    questions: questionList,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: currentTimeRange,
                    zoomScale: currentZoomScale
                });
            });
        }
    }

    if (layout.isTimeframeEmpty) {
        container.innerHTML = `
            <div class="history-graph-wrapper">
                <div class="graph-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                    <h3 style="margin: 0;">Mood Timeline</h3>
                    <div class="graph-header-controls">${timeframeToolbarHTML}${zoomToolbarHTML}${nowButtonHTML}</div>
                </div>
                <div style="padding: 32px 16px; text-align: center; color: var(--text-muted); font-size: 0.92rem; background: var(--box-bg); border: 1px solid var(--border-color); border-radius: 8px; margin: 12px 0;">
                    No check-ins found in the selected timeframe (${getTimeframeLabel(currentTimeRange)}).<br>
                    Switch to <strong>All</strong> or a wider timeframe to view earlier entries.
                </div>
                ${quickActionsHTML}
                ${legendHTML}
                ${guideKeyHTML}
            </div>
        `;
        wireTimeframeAndLegendListeners();
        return;
    }

    const svgHTML = renderGraphSVG(layout);

    container.innerHTML = `
        <div class="history-graph-wrapper">
            <div class="graph-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                <h3 style="margin: 0;">Mood Timeline</h3>
                <div class="graph-header-controls">${timeframeToolbarHTML}${zoomToolbarHTML}${nowButtonHTML}</div>
            </div>
            <div class="graph-scroll-container" tabindex="0" role="region" aria-label="Interactive mood timeline chart, scroll horizontally to view earlier dates">
                <div class="graph-scroll-content">${svgHTML}</div>
            </div>
            ${quickActionsHTML}
            ${legendHTML}
            ${guideKeyHTML}
        </div>
    `;

    const scrollContainerElement = container.querySelector('.graph-scroll-container');
    if (scrollContainerElement) {
        const hasLayoutDimensions = scrollContainerElement.scrollWidth > 0 || scrollContainerElement.clientWidth > 0;
        const maximumScroll = hasLayoutDimensions
            ? Math.max(0, scrollContainerElement.scrollWidth - scrollContainerElement.clientWidth)
            : Infinity;
        const targetScroll = hadPreviousTimeline && Number.isFinite(Number(STATE.historyScrollLeft))
            ? STATE.historyScrollLeft
            : (hasLayoutDimensions ? maximumScroll : 0);
        scrollContainerElement.scrollLeft = Number.isFinite(maximumScroll)
            ? Math.min(Math.max(0, targetScroll), maximumScroll)
            : Math.max(0, targetScroll);
        STATE.historyScrollLeft = hasLayoutDimensions
            ? scrollContainerElement.scrollLeft
            : targetScroll;

        // Keep STATE.historyScrollLeft synchronized as user pans or scrolls
        scrollContainerElement.addEventListener('scroll', () => {
            STATE.historyScrollLeft = scrollContainerElement.scrollLeft;
        }, { passive: true });

        let gestureStartScrollLeft = scrollContainerElement.scrollLeft;
        let gestureStartZoomScale = currentZoomScale;

        // Set up live touch pinch and Ctrl/Meta+wheel gesture zoom handling (Task 9.7, 9.8, 9.9, 9.10)
        const svgElement = scrollContainerElement.querySelector('.graph-svg');
        const gestureController = setupGraphGestureZoom(scrollContainerElement, {
            targetElement: svgElement,
            getCurrentZoomScale: () => (
                Number.isFinite(Number(STATE.historyZoomScale)) ? Number(STATE.historyZoomScale) : 1
            ),
            onGestureStart: (gestureEventData) => {
                gestureStartScrollLeft = scrollContainerElement.scrollLeft;
                gestureStartZoomScale = Number.isFinite(Number(STATE.historyZoomScale))
                    ? Number(STATE.historyZoomScale)
                    : currentZoomScale;

                const targetSvgElement = scrollContainerElement.querySelector('.graph-svg');
                if (targetSvgElement) {
                    applyGraphGestureTransform(
                        targetSvgElement,
                        gestureEventData.scaleFactor,
                        gestureEventData.pivotX,
                        gestureEventData.panDeltaX || 0
                    );
                }
                if (typeof gestureOptions.onGestureStart === 'function') {
                    gestureOptions.onGestureStart(gestureEventData);
                }
            },
            onGestureChange: (gestureEventData) => {
                const targetSvgElement = scrollContainerElement.querySelector('.graph-svg');
                if (targetSvgElement) {
                    applyGraphGestureTransform(
                        targetSvgElement,
                        gestureEventData.scaleFactor,
                        gestureEventData.pivotX,
                        gestureEventData.panDeltaX || 0
                    );
                }
                if (typeof gestureOptions.onGestureChange === 'function') {
                    gestureOptions.onGestureChange(gestureEventData);
                }
            },
            onGestureEnd: (gestureEventData) => {
                const commitResult = commitGraphGestureZoom(container, {
                    gestureEventData,
                    gestureStartScrollLeft,
                    gestureStartZoomScale,
                    layoutEntries,
                    questionList,
                    currentVisibleSet,
                    currentTimeRange
                });
                if (commitResult?.layout) {
                    activeLayout = commitResult.layout;
                }
                if (typeof gestureOptions.onGestureEnd === 'function') {
                    gestureOptions.onGestureEnd({
                        ...gestureEventData,
                        settledZoomScale: commitResult?.settledZoomScale ?? gestureEventData.finalZoomScale,
                        settledScrollLeft: commitResult?.settledScrollLeft
                    });
                }
            },
            ...gestureOptions
        });
        scrollContainerElement._gestureController = gestureController;
    }

    let activeLayout = layout;

    wireTimeframeAndLegendListeners();

    function displayNoteDialog(noteMarkerElement) {
        if (!noteMarkerElement) return;
        const entryIndexAttribute = noteMarkerElement.getAttribute('data-entry-index');
        const entryIndex = entryIndexAttribute !== null ? parseInt(entryIndexAttribute, 10) : -1;
        const targetEntry = Number.isInteger(entryIndex) && activeLayout.entries?.[entryIndex]
            ? activeLayout.entries[entryIndex]
            : null;
        const rawNoteContent = targetEntry?.note
            ? targetEntry.note.trim()
            : (noteMarkerElement.dataset.note || noteMarkerElement.getAttribute('data-note') || '');
        const noteDateTime = targetEntry
            ? formatEntryDateTime(targetEntry.timestamp)
            : (noteMarkerElement.dataset.date || noteMarkerElement.getAttribute('data-date') || '');
        if (rawNoteContent) {
            if (typeof showNoticeDialog === 'function') {
                showNoticeDialog(`Check-In Note — ${noteDateTime}`, rawNoteContent, noteMarkerElement, true);
            } else if (typeof window !== 'undefined' && typeof window.showNoticeDialog === 'function') {
                window.showNoticeDialog(`Check-In Note — ${noteDateTime}`, rawNoteContent, noteMarkerElement, true);
            }
        }
    }

    // Attach click and keyboard interaction handlers to note markers
    const noteMarkerElements = container.querySelectorAll('.note-marker');
    noteMarkerElements.forEach(noteMarkerElement => {
        noteMarkerElement.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            displayNoteDialog(noteMarkerElement);
        });

        noteMarkerElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                displayNoteDialog(noteMarkerElement);
            }
        });
    });

    if (scrollContainerElement) {
        scrollContainerElement.addEventListener('click', (event) => {
            const marker = event.target.closest('.note-marker');
            if (marker) {
                event.preventDefault();
                event.stopPropagation();
                displayNoteDialog(marker);
            }
        });
        scrollContainerElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                const marker = event.target.closest('.note-marker');
                if (marker) {
                    event.preventDefault();
                    event.stopPropagation();
                    displayNoteDialog(marker);
                }
            }
        });
    }

    const legendElement = container.querySelector('.graph-legend');
    if (legendElement) {
        let longPressTimer = null;
        let isLongPressTriggered = false;
        let _activePointerId = null;
        let startPosition = { x: 0, y: 0 };

        function clearLongPress() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            _activePointerId = null;
        }

        function handleIsolateOrRestore(targetQuestionId) {
            const allQuestionIds = questionList.map(question => question.id);
            const isCurrentlyIsolated = currentVisibleSet.size === 1 && currentVisibleSet.has(targetQuestionId);

            if (isCurrentlyIsolated) {
                // Restore all questions
                currentVisibleSet = new Set(allQuestionIds);
            } else {
                // Isolate to target question alone
                currentVisibleSet = new Set([targetQuestionId]);
            }

            STATE.historyVisibleQuestionIds = currentVisibleSet;
            if (navigator.vibrate) {
                try {
                    navigator.vibrate(40);
                } catch (error) {
                    console.warn('Failed to trigger haptic vibration:', error);
                }
            }
            renderLineGraph(container, {
                entries: layoutEntries,
                allEntries: layoutEntries,
                questions: questionList,
                visibleQuestionIds: currentVisibleSet,
                timeRange: currentTimeRange
            });
        }

        legendElement.addEventListener('pointerdown', (event) => {
            if (event.target.closest('.legend-isolate-button')) {
                return;
            }

            const button = event.target.closest('.legend-checklist-item');
            if (!button || (event.button !== undefined && event.button !== 0)) return;

            const questionId = button.dataset.questionId;
            if (!questionId) return;

            isLongPressTriggered = false;
            _activePointerId = event.pointerId;
            startPosition = { x: event.clientX, y: event.clientY };

            clearLongPress();
            longPressTimer = setTimeout(() => {
                isLongPressTriggered = true;
                handleIsolateOrRestore(questionId);
            }, 450);
        });

        legendElement.addEventListener('pointermove', (event) => {
            if (!longPressTimer) return;
            const distance = Math.hypot(event.clientX - startPosition.x, event.clientY - startPosition.y);
            if (distance > 10) {
                clearLongPress();
            }
        });

        legendElement.addEventListener('pointerup', () => {
            clearLongPress();
        });

        legendElement.addEventListener('pointercancel', () => {
            clearLongPress();
        });

        legendElement.addEventListener('contextmenu', (event) => {
            if (event.target.closest('.legend-checklist-item')) {
                event.preventDefault();
            }
        });

        legendElement.addEventListener('click', (event) => {
            const isolateButton = event.target.closest('.legend-isolate-button');
            if (isolateButton) {
                event.preventDefault();
                event.stopPropagation();
                const questionId = isolateButton.dataset.questionId;
                if (questionId) {
                    handleIsolateOrRestore(questionId);
                }
                return;
            }

            const button = event.target.closest('.legend-checklist-item');
            if (!button) return;

            if (isLongPressTriggered) {
                isLongPressTriggered = false;
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            const questionId = button.dataset.questionId;
            if (!questionId) return;

            if (currentVisibleSet.has(questionId)) {
                currentVisibleSet.delete(questionId);
            } else {
                currentVisibleSet.add(questionId);
            }

            STATE.historyVisibleQuestionIds = currentVisibleSet;
            renderLineGraph(container, {
                entries: layoutEntries,
                allEntries: layoutEntries,
                questions: questionList,
                visibleQuestionIds: currentVisibleSet,
                timeRange: currentTimeRange
            });
        });
    }
}