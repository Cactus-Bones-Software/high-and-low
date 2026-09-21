/**
 * HIGH & LOW - HISTORY & TIMELINE GRAPH UI
 * SVG mood timeline rendering, continuous time scaling, question curve paths, note indicators, and timeframe filters.
 */

import { STATE } from '../state.js';
import { getAll, getConfig } from '../storage/db.js';
import {
    DEFAULT_ACTIVE_SET,
    BOOLEAN_NO_SCORE,
    BOOLEAN_YES_SCORE,
    getCurveColor,
    getQuestionDashArray
} from '../questions.js';
import { escapeHTML } from '../utils.js';
import { showNoticeDialog } from './dialogs.js';

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
                                                 paddingLeft = 42
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
    const paddingLeft = 42;
    const paddingRight = 24;

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
                linesHTML += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5"${dashAttribute} stroke-linejoin="round" stroke-linecap="round" />`;
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
                    stroke-width="1.5" aria-label="${escapedQuestionTitle}: ${valueLabel} (${escapedDate})">
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

export function renderLineGraph(container, { entries, allEntries, questions, visibleQuestionIds, timeRange, zoomScale } = {}) {
    if (!container) return;

    const previousScrollContainer = container.querySelector('.graph-scroll-container');
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
            <button type="button" class="graph-timeframe-button${isActive ? ' is-active' : ''}" data-range="${rangeItem.key}" role="radio" aria-checked="${isActive ? 'true' : 'false'}" aria-label="${rangeItem.ariaLabel}">${rangeItem.label}</button>
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
                <button type="button" class="legend-isolate-button${isIsolated ? ' is-isolated' : ''}" data-question-id="${escapeHTML(question.id)}" aria-label="${isIsolated ? `Restore all questions (currently isolating ${questionTitle})` : `Isolate ${questionTitle}`}" title="${isIsolated ? 'Restore all questions' : `Isolate ${questionTitle}`}">
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

                const targetScrollLeft = calculateZoomPivotScrollLeft({
                    previousScrollLeft,
                    viewportWidth,
                    previousZoomScale: currentZoomScale,
                    nextZoomScale,
                    paddingLeft: layout.dimensions.paddingLeft
                });
                STATE.historyScrollLeft = targetScrollLeft;
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

        // Map mouse wheel delta to horizontal scrolling when cursor is over the timeline
        scrollContainerElement.addEventListener('wheel', (event) => {
            if (scrollContainerElement.scrollWidth <= scrollContainerElement.clientWidth) {
                return;
            }
            // If the user is scrolling vertically with the mouse wheel, translate to horizontal scroll
            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.preventDefault();
                const maximumScroll = scrollContainerElement.scrollWidth - scrollContainerElement.clientWidth;
                scrollContainerElement.scrollLeft = Math.max(0, Math.min(
                    scrollContainerElement.scrollLeft + event.deltaY,
                    maximumScroll
                ));
                STATE.historyScrollLeft = scrollContainerElement.scrollLeft;
            }
        }, { passive: false });
    }

    wireTimeframeAndLegendListeners();

    // Attach click and keyboard interaction handlers to note markers
    const noteMarkerElements = container.querySelectorAll('.note-marker');
    noteMarkerElements.forEach(noteMarkerElement => {
        function displayNoteDialog() {
            const entryIndexAttribute = noteMarkerElement.getAttribute('data-entry-index');
            const entryIndex = entryIndexAttribute !== null ? parseInt(entryIndexAttribute, 10) : -1;
            const targetEntry = Number.isInteger(entryIndex) && layout.entries?.[entryIndex]
                ? layout.entries[entryIndex]
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

        noteMarkerElement.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            displayNoteDialog();
        });

        noteMarkerElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                displayNoteDialog();
            }
        });
    });

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