// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { setupTestDOM, sleep } from './test-utils.js';

let dom;
let win;
let doc;

async function initEnv(customSessionStorage = {}) {
    const env = await setupTestDOM(customSessionStorage);
    dom = env.dom;
    win = env.win;
    doc = env.doc;
}

describe('Session and View State Persistence (Theme Switch & Reload Resilience)', () => {
    it('restores in-progress question index and note on reload', async () => {
        const savedSession = {
            currentQuestionIndex: 2,
            sessionAnswers: [
                { questionId: 'q_energy', score: 4, status: 'answered' },
                { questionId: 'q_sadness', score: 1, status: 'answered' }
            ],
            sessionNote: 'Feeling decent this afternoon.'
        };

        await initEnv({
            'high_and_low_active_checkin': JSON.stringify(savedSession)
        });

        const progressText = doc.getElementById('progress-text');
        expect(progressText.textContent).toContain('Question 3 of');

        const noteButtonLabel = doc.getElementById('button-notes').querySelector('.button-label');
        expect(noteButtonLabel.textContent).toBe('Note Attached ✓');

        expect(win.STATE.currentQuestionIndex).toBe(2);
        expect(win.STATE.sessionAnswers.length).toBe(2);
        expect(win.STATE.sessionNote).toBe('Feeling decent this afternoon.');
    });

    it('restores currently active view on reload', async () => {
        await initEnv({
            'high_and_low_active_view': 'settings-canvas'
        });

        const settingsCanvas = doc.getElementById('settings-canvas');
        const trackerCanvas = doc.getElementById('tracker-canvas');

        expect(settingsCanvas.classList.contains('view-active')).toBe(true);
        expect(trackerCanvas.classList.contains('view-hidden-left')).toBe(true);
    });

    it('saves answers to sessionStorage when answering a question', async () => {
        await initEnv();

        const firstScoreBtn = doc.querySelector('.score-button');
        firstScoreBtn.click();

        // Allow microtask and transition
        await sleep(250);

        const stored = win.sessionStorage.getItem('high_and_low_active_checkin');
        expect(stored).not.toBeNull();

        const parsed = JSON.parse(stored);
        expect(parsed.currentQuestionIndex).toBe(1);
        expect(parsed.sessionAnswers.length).toBe(1);
    });

    it('persists view in sessionStorage when navigateTo is called', async () => {
        await initEnv();

        win.navigateTo('history-canvas');

        expect(win.sessionStorage.getItem('high_and_low_active_view')).toBe('history-canvas');
    });

    it('clears active session in sessionStorage when check-in is finalized', async () => {
        await initEnv();

        win.finalizeSession();
        await sleep(50);

        expect(win.sessionStorage.getItem('high_and_low_active_checkin')).toBeNull();
    });

    it('clears active session in sessionStorage when startNewCheckIn is called', async () => {
        await initEnv({
            'high_and_low_active_checkin': JSON.stringify({
                currentQuestionIndex: 1,
                sessionAnswers: [{ questionId: 'q_energy', score: 3, status: 'answered' }],
                sessionNote: null,
                updatedAt: Date.now()
            })
        });

        await win.startNewCheckIn();

        expect(win.sessionStorage.getItem('high_and_low_active_checkin')).toBeNull();
        expect(win.STATE.currentQuestionIndex).toBe(0);
    });

    it('discards stale session if older than 30 minutes (30m TTL expiry)', async () => {
        const thirtyOneMinutesAgo = Date.now() - (31 * 60 * 1000);
        await initEnv({
            'high_and_low_active_checkin': JSON.stringify({
                currentQuestionIndex: 2,
                sessionAnswers: [
                    { questionId: 'q_energy', score: 4, status: 'answered' },
                    { questionId: 'q_sadness', score: 1, status: 'answered' }
                ],
                sessionNote: 'Old stale note',
                updatedAt: thirtyOneMinutesAgo
            })
        });

        // Should have reset to Question 1 because the session timed out
        const progressText = doc.getElementById('progress-text');
        expect(progressText.textContent).toContain('Question 1 of');
        expect(win.STATE.currentQuestionIndex).toBe(0);
        expect(win.STATE.sessionAnswers.length).toBe(0);
        expect(win.STATE.sessionNote).toBeNull();
        expect(win.sessionStorage.getItem('high_and_low_active_checkin')).toBeNull();
    });
});
