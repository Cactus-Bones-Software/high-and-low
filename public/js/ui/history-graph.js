/**
 * HIGH & LOW - HISTORY & TIMELINE GRAPH UI
 * SVG mood timeline rendering, continuous time scaling, question curve paths, note indicators, and timeframe filters.
 */

import { STATE } from '../state.js';
import { getAll, getConfig } from '../storage/db.js';
import { DEFAULT_ACTIVE_SET } from '../questions.js';
import { escapeHTML } from '../utils.js';
import { showNoticeDialog } from './dialogs.js';

export function getCurveColor(curve, index) {
    if (curve === 'more-is-better') return '#34c759';
    if (curve === 'less-is-better') return '#ff3b30';
    if (curve === 'middle-is-best') return '#007aff';
    const fallbackPalette = ['#34c759', '#ff3b30', '#007aff', '#af52de', '#ff9500', '#5ac8fa'];
    return fallbackPalette[index % fallbackPalette.length];
}

export const QUESTION_DASH_PATTERNS = [
    'none',          // 0: Solid line
    '6,4',           // 1: Medium dashes
    '2,3',           // 2: Dotted
    '8,3,2,3',       // 3: Dash-dot
    '12,4',          // 4: Long dashes
    '6,3,2,3,2,3',   // 5: Dash-dot-dot
    '10,3,4,3'       // 6: Long-dash short-dash
];

export function getQuestionDashArray(index) {
    return QUESTION_DASH_PATTERNS[index % QUESTION_DASH_PATTERNS.length];
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
            .filter(entry => entry && entry.timestamp && !isNaN(new Date(entry.timestamp).getTime()))
            .slice()
            .sort((firstEntry, secondEntry) => new Date(firstEntry.timestamp).getTime() - new Date(secondEntry.timestamp).getTime());

        // Collect all question IDs that are either active or present in the logged entries
        const relevantQuestionIds = new Set(activeIds);
        sortedEntries.forEach(entry => {
            if (Array.isArray(entry.answers)) {
                entry.answers.forEach(answerItem => {
                    if (answerItem && answerItem.questionId) {
                        relevantQuestionIds.add(answerItem.questionId);
                    }
                });
            } else if (entry && entry.answers && typeof entry.answers === 'object') {
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
        if (isNaN(date.getTime())) return isoString;
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
        return isoString;
    }
}

export function formatTickDate(timeMilliseconds, isShortRange) {
    try {
        const date = new Date(timeMilliseconds);
        if (isNaN(date.getTime())) return '';
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

export function renderLineGraph(container, { entries, allEntries, questions, visibleQuestionIds, timeRange } = {}) {
    if (!container) return;

    const rawAllEntries = Array.isArray(allEntries)
        ? allEntries
        : (Array.isArray(entries) ? entries : []);

    if (!rawAllEntries || rawAllEntries.length === 0) {
        container.innerHTML = `
            <h3>Mood Timeline</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 12px; line-height: 1.5; text-align: center;">
                No recorded mood history yet.<br>Complete an entry in the Mood Tracker to view your history timeline.
            </p>
        `;
        return;
    }

    if (!questions || questions.length === 0) {
        container.innerHTML = `
            <h3>Mood Timeline</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 12px; line-height: 1.5; text-align: center;">
                No active questions found for timeline rendering.
            </p>
        `;
        return;
    }

    const currentTimeRange = timeRange || STATE.historyTimeRange || 'all';
    STATE.historyTimeRange = currentTimeRange;

    // Filter entries according to active timeframe
    let filteredEntries = rawAllEntries;
    if (currentTimeRange !== 'all' && rawAllEntries.length > 0) {
        const rangeDaysMap = { '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
        const numberOfDays = rangeDaysMap[currentTimeRange] || 30;
        const millisecondsInWindow = numberOfDays * 24 * 60 * 60 * 1000;

        let latestTimestampNumber = -Infinity;
        for (const entry of rawAllEntries) {
            const time = new Date(entry.timestamp).getTime();
            if (!isNaN(time) && time > latestTimestampNumber) {
                latestTimestampNumber = time;
            }
        }
        const referenceTime = latestTimestampNumber === -Infinity ? Date.now() : latestTimestampNumber;
        const cutoffTime = referenceTime - millisecondsInWindow;

        filteredEntries = rawAllEntries.filter(entry => {
            const entryTime = new Date(entry.timestamp).getTime();
            return !isNaN(entryTime) && entryTime >= cutoffTime;
        });
    }

    // Determine current visible question IDs Set
    let currentVisibleSet;
    if (visibleQuestionIds instanceof Set) {
        currentVisibleSet = new Set(visibleQuestionIds);
    } else if (Array.isArray(visibleQuestionIds)) {
        currentVisibleSet = new Set(visibleQuestionIds);
    } else if (STATE.historyVisibleQuestionIds instanceof Set) {
        currentVisibleSet = new Set(STATE.historyVisibleQuestionIds);
    } else {
        currentVisibleSet = new Set(questions.map(question => question.id));
    }

    STATE.historyVisibleQuestionIds = currentVisibleSet;

    const timeframeRanges = [
        { key: '7d', label: '7D', ariaLabel: 'Last 7 days' },
        { key: '14d', label: '14D', ariaLabel: 'Last 14 days' },
        { key: '30d', label: '30D', ariaLabel: 'Last 30 days' },
        { key: '90d', label: '90D', ariaLabel: 'Last 90 days' },
        { key: 'all', label: 'All', ariaLabel: 'All time' }
    ];

    const timeframeButtonsHTML = timeframeRanges.map(rangeItem => {
        const isActive = rangeItem.key === currentTimeRange;
        return `
            <button type="button" class="graph-timeframe-button${isActive ? ' is-active' : ''}" data-range="${rangeItem.key}" role="radio" aria-checked="${isActive ? 'true' : 'false'}" aria-label="${rangeItem.ariaLabel}">${rangeItem.label}</button>
        `;
    }).join('');

    const timeframeToolbarHTML = `
        <div class="graph-timeframe-toolbar" role="toolbar" aria-label="Timeline time range filter">
            <span class="graph-timeframe-title">Timeframe</span>
            <div class="graph-timeframe-buttons" role="radiogroup" aria-label="Select date range">
                ${timeframeButtonsHTML}
            </div>
        </div>
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
    questions.forEach((question, questionIndex) => {
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
                if (selectedRange && selectedRange !== currentTimeRange) {
                    STATE.historyTimeRange = selectedRange;
                    renderLineGraph(container, {
                        entries: rawAllEntries,
                        allEntries: rawAllEntries,
                        questions: questions,
                        visibleQuestionIds: currentVisibleSet,
                        timeRange: selectedRange
                    });
                }
            });
        });

        const showAllButton = container.querySelector('#button-legend-show-all');
        if (showAllButton) {
            showAllButton.addEventListener('click', () => {
                const allQuestionIds = questions.map(question => question.id);
                currentVisibleSet = new Set(allQuestionIds);
                STATE.historyVisibleQuestionIds = currentVisibleSet;
                renderLineGraph(container, {
                    entries: rawAllEntries,
                    allEntries: rawAllEntries,
                    questions: questions,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: currentTimeRange
                });
            });
        }

        const clearAllButton = container.querySelector('#button-legend-clear-all');
        if (clearAllButton) {
            clearAllButton.addEventListener('click', () => {
                currentVisibleSet = new Set();
                STATE.historyVisibleQuestionIds = currentVisibleSet;
                renderLineGraph(container, {
                    entries: rawAllEntries,
                    allEntries: rawAllEntries,
                    questions: questions,
                    visibleQuestionIds: currentVisibleSet,
                    timeRange: currentTimeRange
                });
            });
        }
    }

    if (filteredEntries.length === 0) {
        container.innerHTML = `
            <div class="history-graph-wrapper">
                <div class="graph-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                    <h3 style="margin: 0;">Mood Timeline</h3>
                    ${timeframeToolbarHTML}
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

    const entryCount = filteredEntries.length;
    const entryTimes = filteredEntries.map(entry => {
        const time = new Date(entry.timestamp).getTime();
        return isNaN(time) ? 0 : time;
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

    const minimumSpacingPerPoint = 48;
    const paddingTop = 24;
    const paddingBottom = 60;
    const paddingLeft = 42;
    const paddingRight = 24;

    const calculatedWidth = entryCount > 1
        ? Math.max(600, paddingLeft + paddingRight + (entryCount - 1) * minimumSpacingPerPoint)
        : 600;
    const width = calculatedWidth;
    const height = 320;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    function getY(score) {
        if (score === null || score === undefined) return null;
        const ratio = (score - 1) / 4;
        return paddingTop + chartHeight * (1 - ratio);
    }

    const skipBaselineY = height - paddingBottom + 16;
    const noteBaselineY = height - paddingBottom + 32;

    function getX(index) {
        if (entryCount === 1) return paddingLeft + chartWidth / 2;
        if (timeDuration <= 0) return paddingLeft + (index / (entryCount - 1)) * chartWidth;
        const ratio = (entryTimes[index] - minTime) / timeDuration;
        return paddingLeft + ratio * chartWidth;
    }

    // Grid lines for scores 1-5
    let gridLinesHTML = '';
    for (let score = 1; score <= 5; score++) {
        const y = getY(score);
        gridLinesHTML += `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" />
            <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end" font-weight="600">${score}</text>
        `;
    }

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
    if (entryCount === 1) {
        const xPosition = paddingLeft + chartWidth / 2;
        const dateString = formatTickDate(minTime, true);
        xAxisHTML += `
            <line x1="${xPosition}" y1="${paddingTop}" x2="${xPosition}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.4" />
            <text x="${xPosition}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${dateString}</text>
        `;
    } else if (timeDuration <= 0) {
        filteredEntries.forEach((entry, entryIndex) => {
            const xPosition = getX(entryIndex);
            const dateString = formatTickDate(entryTimes[entryIndex], true);
            xAxisHTML += `
                <line x1="${xPosition}" y1="${paddingTop}" x2="${xPosition}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.4" />
                <text x="${xPosition}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${dateString}</text>
            `;
        });
    } else {
        const isShortRange = timeDuration <= 36 * 3600 * 1000;
        const tickDensity = Math.max(3, Math.min(entryCount, Math.round(chartWidth / 90)));
        for (let tickIndex = 0; tickIndex < tickDensity; tickIndex++) {
            const tickTime = minTime + (tickIndex / (tickDensity - 1)) * timeDuration;
            const xPosition = paddingLeft + (tickIndex / (tickDensity - 1)) * chartWidth;
            const dateString = formatTickDate(tickTime, isShortRange);
            xAxisHTML += `
                <line x1="${xPosition}" y1="${paddingTop}" x2="${xPosition}" y2="${height - paddingBottom}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2,2" opacity="0.35" />
                <text x="${xPosition}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${dateString}</text>
            `;
        }
    }

    let linesHTML = '';
    let skipsHTML = '';
    let notesHTML = '';
    let pointsHTML = '';

    questions.forEach((question, questionIndex) => {
        const color = getCurveColor(question.curve, questionIndex);
        const dashArray = getQuestionDashArray(questionIndex);
        const questionTitle = escapeHTML(question.shortLabel || question.text);
        const dashAttr = dashArray !== 'none' ? ` stroke-dasharray="${dashArray}"` : '';
        const isVisible = currentVisibleSet.has(question.id);

        if (!isVisible) {
            return;
        }

        // Separate contiguous segments of answered points
        const segments = [];
        let currentSegment = [];

        filteredEntries.forEach((entry, entryIndex) => {
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
            const isAnswered = answer && answer.status === 'answered' && answer.score !== null && answer.score >= 1 && answer.score <= 5;
            const isSkipped = answer && (answer.status === 'skipped' || answer.score === null);

            if (isAnswered && answer) {
                const x = getX(entryIndex);
                const y = getY(answer.score);
                currentSegment.push({ x, y, score: answer.score, entryIndex: entryIndex, timestamp: entry.timestamp });
            } else {
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }

                if (isSkipped) {
                    const rawXPosition = getX(entryIndex);
                    const fannedXPosition = (entryCount === 1 || questions.length === 1)
                        ? rawXPosition
                        : rawXPosition + (questionIndex - (questions.length - 1) / 2) * 6;
                    const dateString = formatEntryDateTime(entry.timestamp);
                    skipsHTML += `
                        <g class="skip-marker" aria-label="${questionTitle}: Skipped (${dateString})">
                            <title>${questionTitle}: Skipped (${dateString})</title>
                            <circle cx="${fannedXPosition}" cy="${skipBaselineY}" r="4.5" fill="var(--box-bg)" stroke="${color}" stroke-width="1.5" stroke-dasharray="2,2" />
                            <line x1="${fannedXPosition - 2.5}" y1="${skipBaselineY - 2.5}" x2="${fannedXPosition + 2.5}" y2="${skipBaselineY + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                            <line x1="${fannedXPosition + 2.5}" y1="${skipBaselineY - 2.5}" x2="${fannedXPosition - 2.5}" y2="${skipBaselineY + 2.5}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
                        </g>
                    `;
                }
            }
        });

        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        // Draw line paths for each contiguous segment (never across skips or absent gaps)
        segments.forEach(segment => {
            if (segment.length >= 2) {
                let pathData = `M ${segment[0].x} ${segment[0].y}`;
                for (let segmentIndex = 1; segmentIndex < segment.length; segmentIndex++) {
                    pathData += ` L ${segment[segmentIndex].x} ${segment[segmentIndex].y}`;
                }
                linesHTML += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5"${dashAttr} stroke-linejoin="round" stroke-linecap="round" />`;
            }

            // Draw data point circles with accessible tooltips
            segment.forEach(point => {
                const dateString = formatEntryDateTime(point.timestamp);
                pointsHTML += `
                    <circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" stroke="var(--box-bg)" stroke-width="1.5" aria-label="${questionTitle}: Score ${point.score} (${dateString})">
                        <title>${questionTitle}: Score ${point.score}/5 (${dateString})</title>
                    </circle>
                `;
            });
        });
    });

    // Generate Notes indicator markers on the timeline (Task 3.9)
    filteredEntries.forEach((entry, entryIndex) => {
        const hasNote = Boolean(entry.note && typeof entry.note === 'string' && entry.note.trim().length > 0);
        if (!hasNote) return;

        const noteXPosition = getX(entryIndex);
        const formattedDateString = formatEntryDateTime(entry.timestamp);
        const rawNoteText = entry.note.trim();
        const escapedNoteText = escapeHTML(rawNoteText);

        notesHTML += `
            <g class="note-marker" role="button" tabindex="0" data-entry-index="${entryIndex}" data-note="${escapedNoteText}" data-date="${escapeHTML(formattedDateString)}" aria-label="Note (${escapeHTML(formattedDateString)}): ${escapedNoteText}">
                <title>Note (${escapeHTML(formattedDateString)}): ${escapedNoteText}</title>
                <rect class="note-marker-hitbox" x="${noteXPosition - 14}" y="${noteBaselineY - 14}" width="28" height="28" fill="transparent" />
                <rect class="note-marker-box" x="${noteXPosition - 7}" y="${noteBaselineY - 7}" width="14" height="14" rx="3" fill="var(--button-default)" stroke="var(--border-color)" stroke-width="1.2" />
                <path class="note-marker-icon" d="M ${noteXPosition - 3.5} ${noteBaselineY - 3.5} h 7 M ${noteXPosition - 3.5} ${noteBaselineY} h 7 M ${noteXPosition - 3.5} ${noteBaselineY + 3.5} h 4.5" stroke="var(--text-bright)" stroke-width="1.2" stroke-linecap="round" />
            </g>
        `;
    });

    const svgHTML = `
        <svg class="graph-svg" viewBox="0 0 ${width} ${height}" style="width: ${calculatedWidth > 600 ? calculatedWidth + 'px' : '100%'}; min-width: 100%; height: auto; max-height: 280px; overflow: visible;">
            <g class="grid">${gridLinesHTML}</g>
            <g class="x-axis">${xAxisHTML}</g>
            <g class="lines">${linesHTML}</g>
            <g class="skips">${skipsHTML}</g>
            <g class="notes">${notesHTML}</g>
            <g class="points">${pointsHTML}</g>
        </svg>
    `;

    container.innerHTML = `
        <div class="history-graph-wrapper">
            <div class="graph-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                <h3 style="margin: 0;">Mood Timeline</h3>
                ${timeframeToolbarHTML}
            </div>
            <div class="graph-scroll-container" tabindex="0" role="region" aria-label="Interactive mood timeline chart, scroll horizontally to view earlier dates">
                ${svgHTML}
            </div>
            ${quickActionsHTML}
            ${legendHTML}
            ${guideKeyHTML}
        </div>
    `;

    // Auto-scroll timeline to recent entries on render
    const scrollContainerElement = container.querySelector('.graph-scroll-container');
    if (scrollContainerElement) {
        if (scrollContainerElement.scrollWidth > scrollContainerElement.clientWidth) {
            scrollContainerElement.scrollLeft = scrollContainerElement.scrollWidth;
        }

        // Map mouse wheel delta to horizontal scrolling when cursor is over the timeline
        scrollContainerElement.addEventListener('wheel', (event) => {
            if (scrollContainerElement.scrollWidth <= scrollContainerElement.clientWidth) {
                return;
            }
            // If the user is scrolling vertically with the mouse wheel, translate to horizontal scroll
            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                event.preventDefault();
                scrollContainerElement.scrollLeft += event.deltaY;
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
            const targetEntry = Number.isInteger(entryIndex) && filteredEntries && filteredEntries[entryIndex] ? filteredEntries[entryIndex] : null;
            const rawNoteContent = targetEntry && targetEntry.note
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
        let activePointerId = null;
        let startPosition = { x: 0, y: 0 };

        function clearLongPress() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            activePointerId = null;
        }

        function handleIsolateOrRestore(targetQuestionId) {
            const allQuestionIds = questions.map(question => question.id);
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
                try { navigator.vibrate(40); } catch (_) {}
            }
            renderLineGraph(container, {
                entries: rawAllEntries,
                allEntries: rawAllEntries,
                questions: questions,
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
            activePointerId = event.pointerId;
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
                entries: rawAllEntries,
                allEntries: rawAllEntries,
                questions: questions,
                visibleQuestionIds: currentVisibleSet,
                timeRange: currentTimeRange
            });
        });
    }
}
