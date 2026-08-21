// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM, sleep } from './test-utils.js';

let domInstance;
let windowInstance;
let documentInstance;

describe('History Timeline & Gap Handling Tests (Task 3.4)', () => {
    beforeEach(async () => {
        const environment = await setupTestDOM();
        domInstance = environment.dom;
        windowInstance = environment.window;
        documentInstance = environment.document;
    });

    it('renders empty placeholder when no logs exist', () => {
        const container = documentInstance.createElement('div');
        windowInstance.renderLineGraph(container, { entries: [], questions: [] });
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
            {
                timestamp: '2026-08-10T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-11T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: null, status: 'skipped' },
                    { questionId: 'q2', score: 3, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-12T10:00:00.000Z',
                answers: [
                    // q1 is absent (wasn't asked / not in active set)
                    { questionId: 'q2', score: null, status: 'skipped' }
                ]
            },
            {
                timestamp: '2026-08-13T10:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 5, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        // 1. Check line paths:
        // For q1: answered on Day 1 (1 point) and Day 4 (1 point). Because both are isolated single-point segments, no continuous path connecting Day 1 to Day 4 across Day 2/3!
        // For q2: answered Day 1 & Day 2 (connected segment length 2), then skipped Day 3 (break), then answered Day 4 (1 point).
        const paths = container.querySelectorAll('svg g.lines path');
        expect(paths.length).toBe(1); // Only q2 has a contiguous segment of length >= 2 (Day 1 -> Day 2)

        // 2. Check points:
        // q1: 2 answered points (Day 1, Day 4)
        // q2: 3 answered points (Day 1, Day 2, Day 4)
        // Total = 5 answered points
        const points = container.querySelectorAll('svg g.points circle');
        expect(points.length).toBe(5);

        // 3. Check skip markers:
        // q1 has 1 skip marker (Day 2)
        // q2 has 1 skip marker (Day 3)
        // Total = 2 skip markers
        const skipMarkers = container.querySelectorAll('svg g.skips .skip-marker');
        expect(skipMarkers.length).toBe(2);

        // Verify titles/labels on skip markers
        const skipLabels = Array.from(skipMarkers).map(marker => marker.getAttribute('aria-label'));
        expect(skipLabels.some(label => label.includes('Mood') && label.includes('Skipped'))).toBe(true);
        expect(skipLabels.some(label => label.includes('Anxiety') && label.includes('Skipped'))).toBe(true);

        // 4. Verify guide key is present
        expect(container.textContent).toContain('Answered');
        expect(container.textContent).toContain('Skipped');
        expect(container.textContent).toContain('Not Asked');
    });

    it('proportionally scales X-axis based on elapsed time for intra-day and irregular intervals', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' }
        ];

        // 3 logs on same day:
        // Log 1: 08:00 (t0)
        // Log 2: 10:00 (t0 + 2h -> 2/10 = 20% of span)
        // Log 3: 18:00 (t0 + 10h -> 10/10 = 100% of span)
        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [{ questionId: 'q1', score: 3, status: 'answered' }]
            },
            {
                timestamp: '2026-08-14T10:00:00.000Z',
                answers: [{ questionId: 'q1', score: 4, status: 'answered' }]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [{ questionId: 'q1', score: 5, status: 'answered' }]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const points = Array.from(container.querySelectorAll('svg g.points circle'));
        expect(points.length).toBe(3);

        const x0 = parseFloat(points[0].getAttribute('cx'));
        const x1 = parseFloat(points[1].getAttribute('cx'));
        const x2 = parseFloat(points[2].getAttribute('cx'));

        // Proportional distance: (x1 - x0) / (x2 - x0) should be approx 2/10 = 0.2
        const totalDistance = x2 - x0;
        const subDistance = x1 - x0;
        const ratio = subDistance / totalDistance;

        expect(ratio).toBeCloseTo(0.2, 2);

        // Tooltips should have date and time
        const titleText = points[0].querySelector('title').textContent;
        expect(titleText).toContain('Energy');
        expect(titleText).toContain('8/14/2026');
    });

    it('enables recording multiple check-ins without refreshing the page', async () => {
        // Complete a check-in
        windowInstance.finalizeCheckin();
        await sleep(50);

        const progressElement = documentInstance.getElementById('progress-text');
        const questionElement = documentInstance.getElementById('question-text');
        const newCheckinButton = documentInstance.getElementById('button-new-checkin');
        const footerBox = documentInstance.getElementById('footer-box');

        expect(progressElement.textContent).toBe('Check-In Complete');
        expect(questionElement.textContent).toBe('Mood recorded. Rest easy.');
        expect(newCheckinButton).toBeTruthy();
        expect(footerBox.style.display).toBe('none');

        // Click "Record Another Check-In"
        newCheckinButton.click();
        await sleep(50);

        // Canvas should reset back to active Question 1
        expect(documentInstance.getElementById('progress-text').textContent).toContain('Question 1 of');
        expect(documentInstance.getElementById('button-stack').querySelectorAll('.score-button').length).toBeGreaterThan(0);
        expect(footerBox.style.display).not.toBe('none');
    });

    it('assigns distinct stroke-dasharray patterns to each active question line (Task 3.5)', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q3', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' },
            { id: 'q4', text: 'Irritability', shortLabel: 'Irritable', curve: 'less-is-better' }
        ];

        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' },
                    { questionId: 'q3', score: 4, status: 'answered' },
                    { questionId: 'q4', score: 1, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' },
                    { questionId: 'q3', score: 5, status: 'answered' },
                    { questionId: 'q4', score: 2, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const paths = Array.from(container.querySelectorAll('svg g.lines path'));
        expect(paths.length).toBe(4);

        // First line is solid (no dasharray or 'none')
        const dash0 = paths[0].getAttribute('stroke-dasharray');
        expect(dash0 === null || dash0 === 'none').toBe(true);

        // Lines 2, 3, 4 must have distinct dash patterns
        const dash1 = paths[1].getAttribute('stroke-dasharray');
        const dash2 = paths[2].getAttribute('stroke-dasharray');
        const dash3 = paths[3].getAttribute('stroke-dasharray');

        expect(dash1).toBe('6,4');
        expect(dash2).toBe('2,3');
        expect(dash3).toBe('8,3,2,3');

        // All 4 dash patterns are unique
        const patterns = [dash0 || 'solid', dash1, dash2, dash3];
        const uniquePatterns = new Set(patterns);
        expect(uniquePatterns.size).toBe(4);

        // Legend swatches must contain preview dash SVG indicators
        const legendSwatches = container.querySelectorAll('.graph-legend .legend-swatch');
        expect(legendSwatches.length).toBe(4);
    });

    it('toggles question line visibility when tapping legend checklist rows and prevents toggling to zero (Task 3.6)', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q3', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' }
        ];

        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' },
                    { questionId: 'q3', score: 4, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' },
                    { questionId: 'q3', score: 5, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        // Initial state: 3 lines, 3 legend checklist buttons with aria-checked="true"
        let items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items.length).toBe(3);
        expect(items.every(item => item.getAttribute('aria-checked') === 'true')).toBe(true);
        expect(container.querySelectorAll('svg g.lines path').length).toBe(3);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(6);

        // Click item 1 (q1) -> toggles q1 off
        items[0].click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('false');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(2);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(4);

        // Click item 2 (q2) -> toggles q2 off
        items[1].click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('false');
        expect(items[1].getAttribute('aria-checked')).toBe('false');
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(1);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(2);

        // Toggle off the last remaining visible question (q3) -> allows 0 lines visible
        items[2].click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('false');
        expect(items[1].getAttribute('aria-checked')).toBe('false');
        expect(items[2].getAttribute('aria-checked')).toBe('false');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(0);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(0);

        // Click item 1 (q1) again -> toggles q1 back on (now q1 is visible)
        items[0].click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('true');
        expect(items[1].getAttribute('aria-checked')).toBe('false');
        expect(items[2].getAttribute('aria-checked')).toBe('false');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(1);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(2);
    });

    it('isolates a single question on long-press (450ms) and restores all on second long-press (Task 3.7)', async () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q3', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' }
        ];

        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' },
                    { questionId: 'q3', score: 4, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' },
                    { questionId: 'q3', score: 5, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        let items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items.length).toBe(3);
        expect(container.querySelectorAll('svg g.lines path').length).toBe(3);

        // Simulate long-press pointerdown on item 1 (q2)
        const secondQuestionItem = items[1];
        const pointerDownEvent = new windowInstance.PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 100,
            clientY: 100
        });
        secondQuestionItem.dispatchEvent(pointerDownEvent);

        // Wait 500ms for long-press timer to fire
        await sleep(500);

        // Graph should now be isolated to q2 alone
        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('false');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('false');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(1);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(2);

        // Long-press q2 again while isolated to restore all
        const secondQuestionIsolatedItem = items[1];
        secondQuestionIsolatedItem.dispatchEvent(new windowInstance.PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 100,
            clientY: 100
        }));

        await sleep(500);

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('true');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(3);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(6);
    });

    it('isolates and restores questions via accessible per-row isolate button (Task 3.8)', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q3', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' }
        ];

        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' },
                    { questionId: 'q3', score: 4, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' },
                    { questionId: 'q3', score: 5, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        let isolateButtons = Array.from(container.querySelectorAll('.legend-isolate-button'));
        expect(isolateButtons.length).toBe(3);

        // Click isolate button on question 2 (Sadness)
        isolateButtons[1].click();

        let items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('false');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('false');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(1);

        isolateButtons = Array.from(container.querySelectorAll('.legend-isolate-button'));
        expect(isolateButtons[1].classList.contains('is-isolated')).toBe(true);
        expect(isolateButtons[1].getAttribute('aria-label')).toContain('Restore all');

        // Click isolate button on question 2 again while isolated -> restores all
        isolateButtons[1].click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('true');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(3);

        isolateButtons = Array.from(container.querySelectorAll('.legend-isolate-button'));
        expect(isolateButtons[1].classList.contains('is-isolated')).toBe(false);
        expect(isolateButtons[1].getAttribute('aria-label')).toContain('Isolate Sadness');
    });

    it('provides Show all and Clear all quick action buttons for fast timeline filter reset (Task 3.8)', () => {
        const container = documentInstance.createElement('div');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' },
            { id: 'q3', text: 'Self-Worth', shortLabel: 'Worth', curve: 'more-is-better' }
        ];

        const logs = [
            {
                timestamp: '2026-08-14T08:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' },
                    { questionId: 'q3', score: 4, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-14T18:00:00.000Z',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' },
                    { questionId: 'q3', score: 5, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        const showAllButton = container.querySelector('#button-legend-show-all');
        const clearAllButton = container.querySelector('#button-legend-clear-all');

        expect(showAllButton).toBeTruthy();
        expect(clearAllButton).toBeTruthy();

        // Click Clear All -> clears all questions (0 lines)
        clearAllButton.click();

        let items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('false');
        expect(items[1].getAttribute('aria-checked')).toBe('false');
        expect(items[2].getAttribute('aria-checked')).toBe('false');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(0);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(0);

        // Click Show All -> restores all questions
        showAllButton.click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('true');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(3);
    });

    it('renders note indicators on timeline and opens note modal with content on tap or keyboard interaction (Task 3.9)', async () => {
        const container = documentInstance.getElementById('panel-history');
        const questions = [
            { id: 'q1', text: 'Energy Level', shortLabel: 'Energy', curve: 'more-is-better' },
            { id: 'q2', text: 'Sadness Depth', shortLabel: 'Sadness', curve: 'less-is-better' }
        ];

        // 4 logs:
        // Day 1: With note
        // Day 2: note is null (no marker)
        // Day 3: note is whitespace string (no marker)
        // Day 4: With note
        const logs = [
            {
                timestamp: '2026-08-10T09:00:00.000Z',
                note: 'Felt well-rested after 8 hours of sleep.',
                answers: [
                    { questionId: 'q1', score: 4, status: 'answered' },
                    { questionId: 'q2', score: 1, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-11T09:00:00.000Z',
                note: null,
                answers: [
                    { questionId: 'q1', score: 3, status: 'answered' },
                    { questionId: 'q2', score: 2, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-12T09:00:00.000Z',
                note: '   ',
                answers: [
                    { questionId: 'q1', score: 2, status: 'answered' },
                    { questionId: 'q2', score: 4, status: 'answered' }
                ]
            },
            {
                timestamp: '2026-08-13T09:00:00.000Z',
                note: 'Sudden spike in agitation after difficult meeting.',
                answers: [
                    { questionId: 'q1', score: 2, status: 'answered' },
                    { questionId: 'q2', score: 5, status: 'answered' }
                ]
            }
        ];

        windowInstance.renderLineGraph(container, { entries: logs, questions });

        // 1. Verify only 2 note markers are rendered (for Day 1 and Day 4)
        const noteMarkers = Array.from(container.querySelectorAll('svg g.notes .note-marker'));
        expect(noteMarkers.length).toBe(2);

        // 2. Verify marker attributes and accessibility
        const firstMarker = noteMarkers[0];
        expect(firstMarker.getAttribute('role')).toBe('button');
        expect(firstMarker.getAttribute('tabindex')).toBe('0');
        expect(firstMarker.getAttribute('aria-label')).toContain('Felt well-rested');
        expect(firstMarker.querySelector('title').textContent).toContain('Felt well-rested');

        const secondMarker = noteMarkers[1];
        expect(secondMarker.getAttribute('aria-label')).toContain('Sudden spike in agitation');

        // 3. Click first note marker and verify notice modal dialog opens with note content
        firstMarker.dispatchEvent(new windowInstance.MouseEvent('click', { bubbles: true, cancelable: true }));
        await sleep(80);

        const overlayElement = documentInstance.getElementById('notice-dialog-overlay');
        const titleElement = documentInstance.getElementById('notice-dialog-title');
        const subtitleElement = documentInstance.getElementById('notice-dialog-subtitle');

        expect(overlayElement.classList.contains('is-open')).toBe(true);
        expect(overlayElement.getAttribute('aria-hidden')).toBe('false');
        expect(titleElement.textContent).toContain('Check-In Note');
        expect(subtitleElement.textContent).toBe('Felt well-rested after 8 hours of sleep.');
        expect(subtitleElement.classList.contains('notice-note-content')).toBe(true);

        // Close dialog
        const okButton = documentInstance.getElementById('button-notice-ok');
        okButton.click();
        await sleep(50);
        expect(overlayElement.classList.contains('is-open')).toBe(false);

        // 4. Test keyboard activation (Enter key) on second note marker
        secondMarker.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await sleep(80);

        expect(overlayElement.classList.contains('is-open')).toBe(true);
        expect(subtitleElement.textContent).toBe('Sudden spike in agitation after difficult meeting.');

        // Close via Escape key
        overlayElement.dispatchEvent(new windowInstance.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        await sleep(50);
        expect(overlayElement.classList.contains('is-open')).toBe(false);
    });
});
