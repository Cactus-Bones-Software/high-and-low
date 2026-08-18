// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDOM } from './test-utils.js';

let dom;
let win;
let doc;

describe('History Timeline & Gap Handling Tests (Task 3.4)', () => {
    beforeEach(async () => {
        const env = await setupTestDOM();
        dom = env.dom;
        win = env.win;
        doc = env.doc;
    });

    it('renders empty placeholder when no logs exist', () => {
        const container = doc.createElement('div');
        win.renderLineGraph(container, { logs: [], questions: [] });
        expect(container.textContent).toContain('No recorded mood history yet');
    });

    it('distinguishes answered points, skipped gaps with markers, and absent gaps without markers', () => {
        const container = doc.createElement('div');
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

        win.renderLineGraph(container, { logs, questions });

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
        const skipLabels = Array.from(skipMarkers).map(m => m.getAttribute('aria-label'));
        expect(skipLabels.some(lbl => lbl.includes('Mood') && lbl.includes('Skipped'))).toBe(true);
        expect(skipLabels.some(lbl => lbl.includes('Anxiety') && lbl.includes('Skipped'))).toBe(true);

        // 4. Verify guide key is present
        expect(container.textContent).toContain('Answered');
        expect(container.textContent).toContain('Skipped');
        expect(container.textContent).toContain('Not Asked');
    });

    it('proportionally scales X-axis based on elapsed time for intra-day and irregular intervals', () => {
        const container = doc.createElement('div');
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

        win.renderLineGraph(container, { logs, questions });

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
        win.finalizeSession();
        await new Promise(resolve => setTimeout(resolve, 50));

        const progressEl = doc.getElementById('progress-text');
        const questionEl = doc.getElementById('question-text');
        const newCheckinBtn = doc.getElementById('button-new-checkin');
        const footerBox = doc.getElementById('footer-box');

        expect(progressEl.textContent).toBe('Check-In Complete');
        expect(questionEl.textContent).toBe('Log recorded. Rest easy.');
        expect(newCheckinBtn).toBeTruthy();
        expect(footerBox.style.display).toBe('none');

        // Click "Record Another Check-In"
        newCheckinBtn.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        // Canvas should reset back to active Question 1
        expect(doc.getElementById('progress-text').textContent).toContain('Question 1 of');
        expect(doc.getElementById('button-stack').querySelectorAll('.score-button').length).toBeGreaterThan(0);
        expect(footerBox.style.display).not.toBe('none');
    });

    it('assigns distinct stroke-dasharray patterns to each active question line (Task 3.5)', () => {
        const container = doc.createElement('div');
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

        win.renderLineGraph(container, { logs, questions });

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
        const legendSwatches = container.querySelectorAll('.graph-legend svg');
        expect(legendSwatches.length).toBe(4);
    });

    it('toggles question line visibility when tapping legend checklist rows and prevents toggling to zero (Task 3.6)', () => {
        const container = doc.createElement('div');
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

        win.renderLineGraph(container, { logs, questions });

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

        // Attempt to toggle off the last remaining visible question (q3) -> MUST NOT hide, keep at least 1 visible
        items[2].click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(1);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(2);

        // Click item 1 (q1) again -> toggles q1 back on (now q1 and q3 are visible)
        items[0].click();

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('true');
        expect(items[1].getAttribute('aria-checked')).toBe('false');
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(2);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(4);
    });

    it('isolates a single question on long-press (450ms) and restores all on second long-press (Task 3.7)', async () => {
        const container = doc.createElement('div');
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

        win.renderLineGraph(container, { logs, questions });

        let items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items.length).toBe(3);
        expect(container.querySelectorAll('svg g.lines path').length).toBe(3);

        // Simulate long-press pointerdown on item 1 (q2)
        const q2Item = items[1];
        const pointerDownEvent = new win.PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 100,
            clientY: 100
        });
        q2Item.dispatchEvent(pointerDownEvent);

        // Wait 500ms for long-press timer to fire
        await new Promise(r => setTimeout(r, 500));

        // Graph should now be isolated to q2 alone
        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('false');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('false');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(1);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(2);

        // Long-press q2 again while isolated to restore all
        const q2IsolatedItem = items[1];
        q2IsolatedItem.dispatchEvent(new win.PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            button: 0,
            clientX: 100,
            clientY: 100
        }));

        await new Promise(r => setTimeout(r, 500));

        items = Array.from(container.querySelectorAll('.legend-checklist-item'));
        expect(items[0].getAttribute('aria-checked')).toBe('true');
        expect(items[1].getAttribute('aria-checked')).toBe('true');
        expect(items[2].getAttribute('aria-checked')).toBe('true');
        expect(container.querySelectorAll('svg g.lines path').length).toBe(3);
        expect(container.querySelectorAll('svg g.points circle').length).toBe(6);
    });
});
